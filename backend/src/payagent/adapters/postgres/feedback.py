from collections.abc import Iterator

from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool
from payagent.ports.repositories import ResolvedCase


class PostgresFeedbackLog:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def unreviewed(self, limit: int = 20) -> Iterator[ResolvedCase]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                """
                select i.id, coalesce(v.name, i.vendor_name_raw), i.amount_usd, d.outcome, a.verdict, a.note,
                       coalesce((select array_agg(h.rule_name order by h.rule_name) from decision_rule_hit h
                                 where h.decision_id = d.id and h.result in ('FIRED', 'MISSING_DATA')), '{}')
                from approval a
                join decision d on d.id = a.decision_id
                join invoice i on i.id = d.invoice_id
                left join vendor v on v.id = i.vendor_id
                where a.reviewed_in_operation_id is null
                order by a.created_at
                limit %s
                """,
                (limit,),
            ).fetchall()
        return iter(
            ResolvedCase(
                invoice_id=str(r[0]),
                vendor_name=r[1],
                amount_usd=r[2],
                outcome=r[3],
                fired_rules=list(r[6]),
                verdict=r[4],
                note=r[5],
            )
            for r in rows
        )

    def mark_reviewed(self, invoice_ids: list[str], operation_id: str) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                update approval set reviewed_in_operation_id = %s
                where decision_id in (select id from decision where invoice_id = any(%s::uuid[]))
                """,
                (operation_id, invoice_ids),
            )
