"""Read models for the HTTP API: plain SQL, one or two queries per view."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool
from payagent.api.schemas import (
    Approval,
    ColumnView,
    ConditionView,
    CostByType,
    Costs,
    Extracted,
    Hit,
    InvoiceDetail,
    InvoiceSummary,
    OperationCost,
    OperationRow,
    PurchaseOrderView,
    RuleSourceView,
    RuleView,
    Summary,
    TimelineStep,
    VendorView,
)
from payagent.app.rule_text import condition_text
from payagent.domain.rule import ColumnRef, Condition, Operator
from payagent.adapters.postgres.catalog import source_columns


class NotFound(Exception):
    pass


class NotPending(Exception):
    """The decision is not waiting for a human."""


def _f(x: Decimal | float | None) -> float | None:
    return None if x is None else float(x)


def _rows(conn: Connection, query: str, params: tuple | dict = ()) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(query, params).fetchall()


def _row(conn: Connection, query: str, params: tuple | dict = ()) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        return cur.execute(query, params).fetchone()


class ApiQueries:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    # ---- invoices -------------------------------------------------------------------------------------------

    _SUMMARY_COLS = """
        i.id::text as id, i.status, coalesce(v.name, i.vendor_name_raw) as vendor_name, i.invoice_number,
               i.amount, i.currency, i.amount_usd, i.received_at, i.source,
               d.outcome, d.status as decision_status,
               coalesce(
                 (select h.rule_name from decision_rule_hit h join rule r on r.id = h.rule_id
                   where h.decision_id = d.id and h.effect = 'HOLD' and h.result = 'FIRED'
                   order by r.proposed_at, h.rule_name limit 1),
                 (select h.rule_name from decision_rule_hit h join rule r on r.id = h.rule_id
                   where h.decision_id = d.id and h.effect = 'ESCALATE' and h.result in ('FIRED', 'MISSING_DATA')
                   order by r.proposed_at, h.rule_name limit 1)
               ) as headline,
               case when a.id is not null then 'HUMAN' when d.id is not null then 'AGENT' end as decided_by"""
    _SUMMARY_FROM = """
        from invoice i
        left join vendor v on v.id = i.vendor_id
        left join decision d on d.invoice_id = i.id
        left join approval a on a.decision_id = d.id
    """
    _SUMMARY_SELECT = "select" + _SUMMARY_COLS + _SUMMARY_FROM

    @staticmethod
    def _summary(r: dict) -> InvoiceSummary:
        return InvoiceSummary(
            id=r["id"], status=r["status"], vendor_name=r["vendor_name"], invoice_number=r["invoice_number"],
            amount=_f(r["amount"]), currency=r["currency"], amount_usd=_f(r["amount_usd"]),
            received_at=r["received_at"], source=r["source"], outcome=r["outcome"],
            decision_status=r["decision_status"], headline=r["headline"], decided_by=r["decided_by"],
        )

    def list_invoices(
        self, outcome: str | None = None, status: str | None = None, q: str | None = None, limit: int = 300
    ) -> list[InvoiceSummary]:
        where, params = [], []
        if outcome:
            where.append("d.outcome = %s")
            params.append(outcome)
        if status:
            if status == "PENDING":
                status = "PENDING_HUMAN"
            column = "d.status" if status in ("FINAL", "PENDING_HUMAN", "RESOLVED") else "i.status"
            where.append(f"{column} = %s")
            params.append(status)
        if q and q.strip():
            like = f"%{q.strip()}%"
            where.append(
                "(coalesce(v.name, i.vendor_name_raw) ilike %s or i.invoice_number ilike %s or i.amount::text ilike %s)"
            )
            params += [like, like, like]
        query = self._SUMMARY_SELECT + (" where " + " and ".join(where) if where else "")
        query += " order by i.received_at desc limit %s"
        with self._pool.connection() as conn:
            return [self._summary(r) for r in _rows(conn, query, (*params, limit))]

    def invoice_detail(self, invoice_id: str) -> InvoiceDetail:
        with self._pool.connection() as conn:
            return self._invoice_detail(conn, invoice_id)

    def _invoice_detail(self, conn: Connection, invoice_id: str) -> InvoiceDetail:
        r = _row(
            conn,
            "select" + self._SUMMARY_COLS
            + """, d.id::text as decision_id, d.explanation, d.decided_at, i.vendor_id::text as vendor_id,
                 i.vendor_name_raw, i.vendor_tax_id, i.fx_rate, i.issue_date, i.due_date, i.po_number,
                 i.bank_account, i.confidence, i.error, a.verdict, a.note, a.approver, a.created_at as approved_at"""
            + self._SUMMARY_FROM + " where i.id = %s",
            (invoice_id,),
        ) if _valid_uuid(invoice_id) else None
        if r is None:
            raise NotFound(invoice_id)
        hits = []
        if r["decision_id"]:
            for h in _rows(
                conn,
                """select h.rule_id::text, h.rule_name, h.effect, h.result, h.observed, h.threshold,
                          o.name as overridden_by
                   from decision_rule_hit h join rule r on r.id = h.rule_id
                   left join rule o on o.id = h.overridden_by_rule_id
                   where h.decision_id = %s order by r.proposed_at, h.rule_name""",
                (r["decision_id"],),
            ):
                hits.append(Hit(rule_id=h["rule_id"], rule_name=h["rule_name"], effect=h["effect"],
                                result=h["result"], observed=h["observed"] or {}, threshold=h["threshold"] or {},
                                overridden_by=h["overridden_by"]))
        approval = None
        if r["verdict"]:
            approval = Approval(verdict=r["verdict"], note=r["note"], approver=r["approver"],
                                created_at=r["approved_at"])
        ops = _rows(
            conn,
            """select o.id::text, o.started_at, o.finished_at,
                      (select max(u.created_at) from llm_usage u where u.operation_id = o.id and u.purpose = 'EXTRACT')
                        as extracted_at,
                      coalesce((select sum(u.cost_usd) from llm_usage u where u.operation_id = o.id), 0) as cost,
                      coalesce((select sum(u.input_tokens) from llm_usage u where u.operation_id = o.id), 0) as tin,
                      coalesce((select sum(u.output_tokens) from llm_usage u where u.operation_id = o.id), 0) as tout
               from operation o where o.invoice_id = %s and o.type = 'PROCESS_INVOICE' order by o.started_at""",
            (invoice_id,),
        )
        notes = _rows(
            conn,
            "select kind, recipient, status, created_at from notification where invoice_id = %s",
            (invoice_id,),
        )
        steps = [TimelineStep(label="Factura recibida", detail=_SOURCE_LABEL.get(r["source"], r["source"]),
                              at=r["received_at"])]
        for o in ops:
            steps.append(TimelineStep(label="Datos extraídos", detail=None, at=o["extracted_at"] or o["started_at"]))
        if r["decision_id"]:
            steps.append(TimelineStep(label=f"Decisión: {_OUTCOME_LABEL[r['outcome']]}", detail=r["headline"],
                                      at=r["decided_at"]))
        if approval:
            verdict = "aprobada" if approval.verdict == "APPROVED" else "rechazada"
            steps.append(TimelineStep(label=f"Resolución humana: {verdict}", detail=f"{approval.approver}"
                                      + (f" · {approval.note}" if approval.note else ""), at=approval.created_at))
        for n in notes:
            sent = n["status"] == "SENT"
            steps.append(TimelineStep(label="Notificación enviada" if sent else "Notificación fallida",
                                      detail=n["recipient"], at=n["created_at"]))
        steps.sort(key=lambda s: s.at)
        cost = None
        if ops:
            cost = OperationCost(
                cost_usd=float(sum(o["cost"] for o in ops)),
                duration_ms=int(sum(((o["finished_at"] or o["started_at"]) - o["started_at"]).total_seconds() * 1000
                                    for o in ops)),
                input_tokens=int(sum(o["tin"] for o in ops)),
                output_tokens=int(sum(o["tout"] for o in ops)),
            )
        return InvoiceDetail(
            summary=self._summary(r), vendor_id=r["vendor_id"],
            extracted=Extracted(
                vendor_name_raw=r["vendor_name_raw"], vendor_tax_id=r["vendor_tax_id"],
                invoice_number=r["invoice_number"], amount=_f(r["amount"]), currency=r["currency"],
                fx_rate=_f(r["fx_rate"]), amount_usd=_f(r["amount_usd"]), issue_date=r["issue_date"],
                due_date=r["due_date"], po_number=r["po_number"], bank_account=r["bank_account"],
                confidence=_f(r["confidence"]),
            ),
            explanation=r["explanation"], hits=hits, approval=approval, timeline=steps, cost=cost,
            file_url=f"/api/invoices/{invoice_id}/file", error=r["error"],
        )

    def invoice_file(self, invoice_id: str) -> tuple[str, str | None]:
        with self._pool.connection() as conn:
            row = conn.execute(
                "select file_path, content_type from invoice where id = %s", (invoice_id,)
            ).fetchone() if _valid_uuid(invoice_id) else None
        if row is None or not row[0]:
            raise NotFound(invoice_id)
        return row[0], row[1]

    def invoice_id_by_sha(self, sha256: str) -> str | None:
        with self._pool.connection() as conn:
            row = conn.execute("select id from invoice where file_sha256 = %s", (sha256,)).fetchone()
        return str(row[0]) if row else None

    def resolve(self, invoice_id: str, verdict: str, note: str | None, approver: str) -> InvoiceDetail:
        if not _valid_uuid(invoice_id):
            raise NotFound(invoice_id)
        with self._pool.connection() as conn:
            row = conn.execute(
                "select id, status from decision where invoice_id = %s for update", (invoice_id,)
            ).fetchone()
            if row is None:
                raise NotFound(invoice_id)
            if row[1] != "PENDING_HUMAN":
                raise NotPending(invoice_id)
            conn.execute(
                "insert into approval (decision_id, verdict, note, approver) values (%s, %s, %s, %s)",
                (row[0], verdict, note, approver),
            )
            conn.execute("update decision set status = 'RESOLVED' where id = %s", (row[0],))
            return self._invoice_detail(conn, invoice_id)

    # ---- rules ----------------------------------------------------------------------------------------------

    def rule_views(self, rule_id: str | None = None) -> list[RuleView]:
        with self._pool.connection() as conn:
            if rule_id is not None and not _valid_uuid(rule_id):
                return []
            labels = {r["name"]: r["label"] for r in _rows(conn, "select name, label from rule_source")}
            rules = _rows(
                conn,
                """select r.id::text, r.name, r.natural_language, r.effect, r.overridable, r.origin, r.proposed_by,
                          r.proposed_at, r.approved_by, r.approved_at, r.active,
                          (select count(*) from decision_rule_hit h where h.rule_id = r.id and h.result = 'FIRED')
                            as times_fired
                   from rule r where (%(id)s::uuid is null or r.id = %(id)s::uuid)
                   order by r.active desc, r.proposed_at desc, r.name""",
                {"id": rule_id},
            )
            conds: dict[str, list[ConditionView]] = {}
            for c in _rows(
                conn,
                """select c.rule_id::text, c.source, c.column_name, c.operator, c.value, c.value_source, c.value_column
                   from rule_condition c where (%(id)s::uuid is null or c.rule_id = %(id)s::uuid)
                   order by c.rule_id, c.position""",
                {"id": rule_id},
            ):
                cond = Condition(
                    left=ColumnRef(c["source"], c["column_name"]),
                    operator=Operator(c["operator"]),
                    value=c["value"],
                    value_ref=ColumnRef(c["value_source"], c["value_column"]) if c["value_source"] else None,
                )
                conds.setdefault(c["rule_id"], []).append(ConditionView(
                    source=c["source"], column=c["column_name"], operator=c["operator"], value=c["value"],
                    value_source=c["value_source"], value_column=c["value_column"],
                    text=condition_text(cond, labels),
                ))
        return [
            RuleView(
                id=r["id"], name=r["name"], natural_language=r["natural_language"], effect=r["effect"],
                overridable=r["overridable"], conditions=conds.get(r["id"], []), origin=r["origin"],
                proposed_by=r["proposed_by"], proposed_at=r["proposed_at"], approved_by=r["approved_by"],
                approved_at=r["approved_at"], active=r["active"], times_fired=r["times_fired"],
            )
            for r in rules
        ]

    def rule_source_labels(self) -> dict[str, str]:
        with self._pool.connection() as conn:
            return {r["name"]: r["label"] for r in _rows(conn, "select name, label from rule_source")}

    def rule_sources(self) -> list[RuleSourceView]:
        with self._pool.connection() as conn:
            out = []
            for s in _rows(conn, "select name, label, description from rule_source where active order by name"):
                cols = [ColumnView(name=c.name, data_type=c.data_type, description=c.description)
                        for c in source_columns(conn, s["name"])]
                out.append(RuleSourceView(name=s["name"], label=s["label"], description=s["description"],
                                          columns=cols))
        return out

    # ---- dashboards -----------------------------------------------------------------------------------------

    def summary(self, stale_after_s: int) -> Summary:
        with self._pool.connection() as conn:
            r = _row(
                conn,
                """select
                     count(*) filter (where d.outcome = 'PAY') as paid,
                     count(*) filter (where d.outcome = 'HOLD') as held,
                     count(*) filter (where d.outcome = 'ESCALATE') as escalated,
                     count(*) filter (where d.status = 'PENDING_HUMAN') as pending_human,
                     count(*) filter (where d.status = 'FINAL' and a.id is null) as autonomous,
                     count(d.id) as decided
                   from decision d left join approval a on a.decision_id = d.id""",
            )
            processing = conn.execute(
                "select count(*) from invoice where status in ('RECEIVED', 'EXTRACTING', 'EVALUATING')"
            ).fetchone()[0]
            checked_at = None
            if conn.execute("select to_regclass('public.worker_heartbeat')").fetchone()[0]:
                checked_at = conn.execute(
                    "select email_checked_at from worker_heartbeat where email_ok"
                ).fetchone()
                checked_at = checked_at[0] if checked_at else None
        connected = checked_at is not None and datetime.now(timezone.utc) - checked_at < timedelta(seconds=stale_after_s)
        return Summary(
            paid=r["paid"], held=r["held"], escalated=r["escalated"], pending_human=r["pending_human"],
            processing=processing,
            autonomy_pct=round(100 * r["autonomous"] / r["decided"], 1) if r["decided"] else 0.0,
            email_connected=connected, email_checked_at=checked_at,
        )

    def vendors(self) -> list[VendorView]:
        with self._pool.connection() as conn:
            vendors = _rows(
                conn,
                """select v.id::text, v.name, v.tax_id, v.country, v.currency, v.bank_rail, v.bank_account, v.status,
                          (select count(*) from invoice i where i.vendor_id = v.id) as invoices,
                          coalesce((select sum(c.amount_usd) from committed_invoice c where c.vendor_id = v.id), 0)
                            as paid_usd
                   from vendor v order by v.name""",
            )
            pos: dict[str, list[PurchaseOrderView]] = {}
            for p in _rows(conn, "select vendor_id::text, po_number, amount, currency, status, description "
                                 "from purchase_order order by po_number"):
                pos.setdefault(p["vendor_id"], []).append(PurchaseOrderView(
                    po_number=p["po_number"], amount=float(p["amount"]), currency=p["currency"],
                    status=p["status"], description=p["description"]))
        return [VendorView(id=v["id"], name=v["name"], tax_id=v["tax_id"], country=v["country"],
                           currency=v["currency"], bank_rail=v["bank_rail"], bank_account=v["bank_account"],
                           status=v["status"], purchase_orders=pos.get(v["id"], []), invoices=v["invoices"],
                           paid_usd=float(v["paid_usd"])) for v in vendors]

    def costs(self) -> Costs:
        with self._pool.connection() as conn:
            t = _row(
                conn,
                """select
                     coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())), 0) as today,
                     coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0) as month,
                     coalesce(sum(input_tokens), 0) as tin, coalesce(sum(output_tokens), 0) as tout
                   from llm_usage""",
            )
            by_type = _rows(
                conn,
                """select o.type, count(distinct o.id) as operations, coalesce(sum(u.cost_usd), 0) as total
                   from operation o left join llm_usage u on u.operation_id = o.id group by o.type order by o.type""",
            )
            recent = _rows(
                conn,
                """select o.id::text, o.type, o.status, o.invoice_id::text as invoice_id, o.started_at,
                          o.finished_at, coalesce(sum(u.cost_usd), 0) as cost,
                          coalesce(sum(u.input_tokens), 0) as tin, coalesce(sum(u.output_tokens), 0) as tout
                   from operation o left join llm_usage u on u.operation_id = o.id
                   group by o.id order by o.started_at desc limit 20""",
            )
            operations = conn.execute("select count(*) from operation").fetchone()[0]
        return Costs(
            today_usd=float(t["today"]), month_usd=float(t["month"]), operations=operations,
            input_tokens=int(t["tin"]), output_tokens=int(t["tout"]),
            by_type=[CostByType(type=b["type"], operations=b["operations"], total_usd=float(b["total"]),
                                avg_usd=float(b["total"]) / b["operations"] if b["operations"] else 0.0)
                     for b in by_type],
            recent=[OperationRow(
                id=o["id"], type=o["type"], status=o["status"], invoice_id=o["invoice_id"], started_at=o["started_at"],
                cost=OperationCost(
                    cost_usd=float(o["cost"]),
                    duration_ms=int(((o["finished_at"] or o["started_at"]) - o["started_at"]).total_seconds() * 1000),
                    input_tokens=int(o["tin"]), output_tokens=int(o["tout"]))) for o in recent],
        )


_OUTCOME_LABEL = {"PAY": "Pagada", "HOLD": "Frenada", "ESCALATE": "Escalada"}
_SOURCE_LABEL = {"EMAIL": "Por correo", "UPLOAD": "Subida a mano", "TEXT": "Texto pegado", "CHAT": "Desde el chat",
                 "INBOX": "Carpeta inbox", "SEED": "Datos de ejemplo"}


def _valid_uuid(value: str) -> bool:
    from uuid import UUID

    try:
        UUID(value)
    except ValueError:
        return False
    return True
