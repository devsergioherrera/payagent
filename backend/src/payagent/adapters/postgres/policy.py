"""Payment policy read model: the month's budget plus the thresholds the active rules enforce."""
from datetime import date

from psycopg import Connection
from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool
from payagent.adapters.postgres.queries import _row, _rows
from payagent.api.schemas import BudgetStatus, Policy, PolicyLimit

# key, label, seed rule id, column holding the threshold, unit
_LIMITS = [
    ("payment_limit", "Límite por pago", "20000000-0000-0000-0000-000000000005", "amount_usd", "USD"),
    ("human_approval", "Aprobación humana desde", "20000000-0000-0000-0000-000000000006", "amount_usd", "USD"),
    ("po_tolerance", "Tolerancia de la orden", "20000000-0000-0000-0000-000000000011", "desviacion_pct", "%"),
    ("po_overdraft", "Sobregiro de la orden", "20000000-0000-0000-0000-000000000016", "saldo_oc_despues_pct", "%"),
    ("date_window", "Ventana de fechas", "20000000-0000-0000-0000-000000000014", "dias_emision", "días"),
]


def _threshold(value: object) -> float | None:
    if isinstance(value, list):  # a range such as [0, 90]: the far end is the limit
        value = value[-1] if value else None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return abs(float(value))  # "saldo < -5" reads as a 5 % overdraft


class PolicyQueries:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def policy(self) -> Policy:
        with self._pool.connection() as conn:
            return self._policy(conn)

    def set_budget(self, period: date, amount_usd: float) -> Policy:
        with self._pool.connection() as conn:
            conn.execute(
                """insert into budget (period, amount_usd) values (%s, %s)
                   on conflict (period) do update set amount_usd = excluded.amount_usd""",
                (period, amount_usd),
            )
            return self._policy(conn)

    def _policy(self, conn: Connection) -> Policy:
        return Policy(
            budget=self._budget(conn),
            limits=self._limits(conn),
            blocked_vendors=conn.execute("select count(*) from vendor where status = 'BLOCKED'").fetchone()[0],
            exceptions=conn.execute(
                "select count(*) from rule where effect = 'ALLOW' and active"
            ).fetchone()[0],
        )

    @staticmethod
    def _budget(conn: Connection) -> BudgetStatus:
        r = _row(
            conn,
            """with m as (select date_trunc('month', now())::date as period)
               select m.period,
                      coalesce((select amount_usd from budget b where b.period = m.period), 0) as amount,
                      coalesce(sum(c.amount_usd) filter (where d.outcome = 'PAY'), 0) as paid,
                      coalesce(sum(c.amount_usd) filter (where d.outcome <> 'PAY'), 0) as approved,
                      count(c.id) as invoices
               from m
               left join committed_invoice c on date_trunc('month', c.received_at)::date = m.period
               left join decision d on d.invoice_id = c.id
               group by m.period""",
        )
        amount, paid, approved = float(r["amount"]), float(r["paid"]), float(r["approved"])
        return BudgetStatus(
            period=r["period"], amount_usd=amount, paid_usd=paid, approved_usd=approved,
            available_usd=amount - paid - approved, invoices_paid=r["invoices"],
        )

    @staticmethod
    def _limits(conn: Connection) -> list[PolicyLimit]:
        rules = {r["id"]: r for r in _rows(
            conn, "select id::text, replaces_rule_id::text as replaces, effect, active, proposed_at from rule")}
        conds = {}
        for c in _rows(conn, "select rule_id::text, column_name, value from rule_condition order by position"):
            conds.setdefault(c["rule_id"], {}).setdefault(c["column_name"], c["value"])
        children: dict[str, list[dict]] = {}
        for r in rules.values():
            if r["replaces"]:
                children.setdefault(r["replaces"], []).append(r)
        out = []
        for key, label, seed_id, column, unit in _LIMITS:
            if seed_id not in rules:
                continue
            current = rules[seed_id]
            while current["id"] in children:  # follow replacements to the newest version
                current = max(children[current["id"]], key=lambda r: r["proposed_at"])
            out.append(PolicyLimit(
                key=key, label=label, rule_id=current["id"], value=_threshold(conds.get(current["id"], {}).get(column)),
                unit=unit, effect=current["effect"], active=current["active"],
            ))
        return out
