from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool, json_dumps
from payagent.adapters.postgres.repositories import PostgresDecisionSession
from payagent.api.schemas import InvoiceSummary
from payagent.app.propose_rules import NewProposal, RuleInfo, StoredProposal
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule


def conditions_to_json(conditions: Sequence[Condition]) -> list[dict]:
    return [
        {
            "source": c.left.source,
            "column": c.left.column,
            "operator": c.operator.value,
            "value": c.value,
            "value_source": c.value_ref.source if c.value_ref else None,
            "value_column": c.value_ref.column if c.value_ref else None,
        }
        for c in conditions
    ]


def conditions_from_json(raw: list[dict]) -> tuple[Condition, ...]:
    return tuple(
        Condition(
            left=ColumnRef(c["source"], c["column"]),
            operator=Operator(c["operator"]),
            value=Decimal(str(c["value"])) if isinstance(c["value"], float) else c["value"],
            value_ref=ColumnRef(c["value_source"], c["value_column"]) if c.get("value_source") else None,
        )
        for c in raw
    )


_SUMMARY_SQL = """
select i.id, i.status, coalesce(v.name, i.vendor_name_raw), i.invoice_number, i.amount, i.currency, i.amount_usd,
       i.received_at, i.source, d.outcome, d.status,
       (select h.rule_name from decision_rule_hit h
        where h.decision_id = d.id and h.result = 'FIRED' order by h.rule_name limit 1),
       case when d.id is null then null when a.id is not null then 'HUMAN' else 'AGENT' end
from invoice i
left join vendor v on v.id = i.vendor_id
left join decision d on d.invoice_id = i.id
left join approval a on a.decision_id = d.id
where i.id = any(%s::uuid[])
"""


class PostgresProposals:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def vendor_tax_ids(self, invoice_ids: list[str]) -> dict[str, str | None]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                "select i.id, coalesce(v.tax_id, i.vendor_tax_id) from invoice i left join vendor v on v.id = i.vendor_id "
                "where i.id = any(%s::uuid[])",
                (invoice_ids,),
            ).fetchall()
        return {str(r[0]): r[1] for r in rows}

    def active_rules(self) -> list[Rule]:
        with self._pool.connection() as conn:
            return PostgresDecisionSession(conn).active_rules()

    def recently_rejected(self, days: int = 30) -> list[tuple[Condition, ...]]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                "select conditions from rule_proposal where status = 'REJECTED' "
                "and resolved_at > now() - make_interval(days => %s)",
                (days,),
            ).fetchall()
        return [conditions_from_json(r[0]) for r in rows]

    def save(self, operation_id: str, proposals: Sequence[NewProposal], reviewed_invoice_ids: list[str]) -> list[str]:
        """Insert the proposals and mark the cases reviewed in one transaction."""
        with self._pool.connection() as conn:
            ids = [
                str(
                    conn.execute(
                        """
                        insert into rule_proposal (operation_id, name, natural_language, effect, overridable,
                                                   conditions, rationale, evidence_invoice_ids)
                        values (%s, %s, %s, %s, %s, %s, %s, %s::uuid[]) returning id
                        """,
                        (
                            operation_id,
                            p.name,
                            p.natural_language,
                            p.effect.value,
                            p.overridable,
                            Jsonb(conditions_to_json(p.conditions), dumps=json_dumps),
                            p.rationale,
                            list(p.evidence_invoice_ids),
                        ),
                    ).fetchone()[0]
                )
                for p in proposals
            ]
            conn.execute(
                "update approval set reviewed_in_operation_id = %s "
                "where decision_id in (select id from decision where invoice_id = any(%s::uuid[]))",
                (operation_id, reviewed_invoice_ids),
            )
        return ids

    def list(self, status: str) -> list[StoredProposal]:
        return self._fetch("where status = %s", (status,))

    def get(self, proposal_id: str) -> StoredProposal | None:
        found = self._fetch("where id = %s", (proposal_id,))
        return found[0] if found else None

    def _fetch(self, where: str, params: tuple) -> list[StoredProposal]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                f"""
                select id, name, natural_language, effect, overridable, conditions, rationale,
                       evidence_invoice_ids, status, created_at
                from rule_proposal {where} order by created_at desc, name
                """,
                params,
            ).fetchall()
            evidence_ids = sorted({str(e) for r in rows for e in r[7]})
            summaries = {
                str(r[0]): InvoiceSummary(
                    id=str(r[0]), status=r[1], vendor_name=r[2], invoice_number=r[3],
                    amount=float(r[4]) if r[4] is not None else None, currency=r[5],
                    amount_usd=float(r[6]) if r[6] is not None else None, received_at=r[7], source=r[8],
                    outcome=r[9], decision_status=r[10], headline=r[11], decided_by=r[12],
                )
                for r in conn.execute(_SUMMARY_SQL, (evidence_ids,)).fetchall()
            }
        return [
            StoredProposal(
                id=str(r[0]), name=r[1], natural_language=r[2], effect=Effect(r[3]), overridable=r[4],
                conditions=conditions_from_json(r[5]), rationale=r[6],
                evidence=[summaries[str(e)] for e in r[7] if str(e) in summaries], status=r[8], created_at=r[9],
            )
            for r in rows
        ]

    def resolve(self, proposal_id: str, status: str, by: str, created_rule_id: str | None = None) -> bool:
        """False when the proposal is not PENDING any more."""
        with self._pool.connection() as conn:
            cur = conn.execute(
                "update rule_proposal set status = %s, resolved_by = %s, resolved_at = now(), created_rule_id = %s "
                "where id = %s and status = 'PENDING'",
                (status, by, created_rule_id, proposal_id),
            )
            return cur.rowcount == 1

    def rule_info(self, rule_id: str) -> RuleInfo:
        with self._pool.connection() as conn:
            r = conn.execute(
                """
                select r.id, r.name, r.natural_language, r.effect, r.overridable, r.origin, r.proposed_by,
                       r.proposed_at, r.approved_by, r.approved_at, r.active,
                       (select count(*) from decision_rule_hit h where h.rule_id = r.id and h.result = 'FIRED')
                from rule r where r.id = %s
                """,
                (rule_id,),
            ).fetchone()
            conds = conn.execute(
                "select source, column_name, operator, value, value_source, value_column "
                "from rule_condition where rule_id = %s order by position",
                (rule_id,),
            ).fetchall()
        return RuleInfo(
            id=str(r[0]), name=r[1], natural_language=r[2], effect=Effect(r[3]), overridable=r[4], origin=r[5],
            proposed_by=r[6], proposed_at=r[7], approved_by=r[8], approved_at=r[9], active=r[10], times_fired=r[11],
            conditions=conditions_from_json(
                [dict(source=c[0], column=c[1], operator=c[2], value=c[3], value_source=c[4], value_column=c[5])
                 for c in conds]
            ),
        )
