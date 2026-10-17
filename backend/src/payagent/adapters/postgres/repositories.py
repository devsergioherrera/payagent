import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal
from uuid import UUID

from psycopg import Connection, sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool, json_dumps
from payagent.domain.decision import Decision, Outcome
from payagent.domain.facts import Facts, Row
from payagent.domain.invoice import ExtractedInvoice, normalize_id
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule
from payagent.ports.invoice_source import IncomingDocument
from payagent.ports.repositories import InvoiceStatus, OperationType

DECISION_LOCK_KEY = 4242
# Facts are read under this role (SELECT-only, RLS policy in migration 005).
FACT_READER_ROLE: str | None = "rules_reader"


class PostgresOperations:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def start(self, type: OperationType, invoice_id: str | None = None) -> str:
        with self._pool.connection() as conn:
            row = conn.execute(
                "insert into operation (type, invoice_id) values (%s, %s) returning id", (type, invoice_id)
            ).fetchone()
        return str(row[0])

    def finish(self, operation_id: str, error: str | None = None) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "update operation set status = %s, error = %s, finished_at = now() where id = %s",
                ("DONE" if error is None else "FAILED", error, operation_id),
            )


def _fold(name: str) -> str:
    """Case- and accent-insensitive form of a vendor name."""
    decomposed = unicodedata.normalize("NFKD", name)
    return " ".join("".join(ch for ch in decomposed if not unicodedata.combining(ch)).casefold().split())


class PostgresInvoices:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def create(self, doc: IncomingDocument, sha256: str, file_path: str) -> str | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                """
                insert into invoice (file_sha256, source, source_ref, file_path, content_type,
                                     email_message_id, email_sender, email_subject)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (file_sha256) do nothing
                returning id
                """,
                (
                    sha256,
                    doc.source_type.value,
                    doc.source_ref,
                    file_path,
                    doc.content_type,
                    doc.email.message_id if doc.email else None,
                    doc.email.sender if doc.email else None,
                    doc.email.subject if doc.email else None,
                ),
            ).fetchone()
        return str(row[0]) if row else None

    def set_status(self, invoice_id: str, status: InvoiceStatus, error: str | None = None) -> None:
        with self._pool.connection() as conn:
            conn.execute("update invoice set status = %s, error = %s where id = %s", (status, error, invoice_id))

    def save_extraction(self, invoice_id: str, extracted: ExtractedInvoice) -> None:
        with self._pool.connection() as conn:
            vendor_id = self._resolve_vendor(conn, extracted)
            currency = extracted.currency.upper() if extracted.currency else None
            fx_rate = None
            if currency:
                row = conn.execute("select rate_to_usd from fx_rate where currency = %s", (currency,)).fetchone()
                fx_rate = row[0] if row else None
            amount_usd = None
            if extracted.amount is not None and fx_rate is not None:
                amount_usd = (extracted.amount * fx_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            conn.execute(
                """
                update invoice set vendor_id = %s, vendor_name_raw = %s, vendor_tax_id = %s, invoice_number = %s,
                    po_number = %s, bank_account = %s, amount = %s, currency = %s, fx_rate = %s, amount_usd = %s,
                    issue_date = %s, due_date = %s, confidence = %s
                where id = %s
                """,
                (
                    vendor_id,
                    extracted.vendor_name_raw,
                    extracted.vendor_tax_id,
                    extracted.invoice_number,
                    extracted.po_number,
                    extracted.bank_account,
                    extracted.amount,
                    currency,
                    fx_rate,
                    amount_usd,
                    extracted.issue_date,
                    extracted.due_date,
                    round(min(max(extracted.confidence, 0.0), 1.0), 2),
                    invoice_id,
                ),
            )

    @staticmethod
    def _resolve_vendor(conn: Connection, extracted: ExtractedInvoice) -> str | None:
        tax_id = normalize_id(extracted.vendor_tax_id)
        if tax_id:
            row = conn.execute("select id from vendor where tax_id = %s", (tax_id,)).fetchone()
            if row:
                return row[0]
        if extracted.vendor_name_raw:
            wanted = _fold(extracted.vendor_name_raw)
            for vendor_id, name in conn.execute("select id, name from vendor order by name").fetchall():
                if _fold(name) == wanted:
                    return vendor_id
        return None

    def set_explanation(self, decision_id: str, text: str, by: Literal["LLM", "TEMPLATE"]) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "update decision set explanation = %s, explained_by = %s where id = %s", (text, by, decision_id)
            )


def _to_fact(value: object) -> object:
    """Loader contract: numbers as int or Decimal, dates as ISO strings, uuids as str."""
    if isinstance(value, bool | int | Decimal | str) or value is None:
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def _columns(conn: Connection, table: str) -> set[str]:
    rows = conn.execute(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = %s",
        (table,),
    ).fetchall()
    return {r[0] for r in rows}


class PostgresDecisionSession:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def active_rules(self) -> list[Rule]:
        conn = self._conn
        rules = conn.execute(
            "select id, name, effect, overridable from rule where active order by proposed_at, name"
        ).fetchall()
        conditions: dict[object, list[Condition]] = {}
        for r in conn.execute(
            """
            select c.rule_id, c.source, c.column_name, c.operator, c.value, c.value_source, c.value_column
            from rule_condition c join rule r on r.id = c.rule_id
            where r.active order by c.rule_id, c.position
            """
        ).fetchall():
            value = r[4]
            conditions.setdefault(r[0], []).append(
                Condition(
                    left=ColumnRef(r[1], r[2]),
                    operator=Operator(r[3]),
                    value=Decimal(str(value)) if isinstance(value, float) else value,
                    value_ref=ColumnRef(r[5], r[6]) if r[5] else None,
                )
            )
        return [Rule(str(r[0]), r[1], Effect(r[2]), r[3], tuple(conditions.get(r[0], []))) for r in rules]

    def load_facts(self, invoice_id: str, sources: set[str]) -> Facts:
        conn = self._conn
        invoice_cols = _columns(conn, "invoice")
        rows: dict[str, Row | None] = {}
        for name in sorted(sources):
            meta = conn.execute(
                "select link_column, invoice_column from rule_source where name = %s and active", (name,)
            ).fetchone()
            if meta is None:
                raise KeyError(f"unknown rule source: {name}")
            link, inv_col = meta
            if link not in _columns(conn, name) or inv_col not in invoice_cols:
                raise ValueError(f"rule source {name} links through a column that does not exist")
            query = sql.SQL(
                "select s.* from {src} s where s.{link} = (select i.{inv} from {invoice} i where i.id = %s) limit 1"
            ).format(
                src=sql.Identifier(name),
                link=sql.Identifier(link),
                inv=sql.Identifier(inv_col),
                invoice=sql.Identifier("invoice"),
            )
            if FACT_READER_ROLE:
                conn.execute(sql.SQL("set local role {}").format(sql.Identifier(FACT_READER_ROLE)))
            try:
                with conn.cursor(row_factory=dict_row) as cur:
                    row = cur.execute(query, (invoice_id,)).fetchone()
            finally:
                if FACT_READER_ROLE:
                    conn.execute("reset role")
            rows[name] = {k: _to_fact(v) for k, v in row.items()} if row else None
        return Facts(rows=rows)

    def save_decision(self, invoice_id: str, operation_id: str, decision: Decision, explanation: str) -> str:
        conn = self._conn
        status = "FINAL" if decision.outcome is Outcome.PAY else "PENDING_HUMAN"
        decision_id = conn.execute(
            """
            insert into decision (invoice_id, operation_id, outcome, status, explanation, explained_by)
            values (%s, %s, %s, %s, %s, 'TEMPLATE') returning id
            """,
            (invoice_id, operation_id, decision.outcome.value, status, explanation),
        ).fetchone()[0]
        for h in decision.hits:
            conn.execute(
                """
                insert into decision_rule_hit (decision_id, rule_id, rule_name, effect, result, observed, threshold,
                                               overridden_by_rule_id)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    decision_id,
                    h.rule_id,
                    h.rule_name,
                    h.effect.value,
                    h.result.value,
                    Jsonb(h.observed, dumps=json_dumps),
                    Jsonb(h.threshold, dumps=json_dumps),
                    h.overridden_by,
                ),
            )
        conn.execute("update invoice set status = 'DECIDED' where id = %s", (invoice_id,))
        return str(decision_id)


class PostgresDecisions:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    @contextmanager
    def session(self) -> Iterator[PostgresDecisionSession]:
        # Commits on a clean exit, rolls back (and drops the lock) on an exception.
        with self._pool.connection() as conn:
            conn.execute("select pg_advisory_xact_lock(%s)", (DECISION_LOCK_KEY,))
            yield PostgresDecisionSession(conn)
