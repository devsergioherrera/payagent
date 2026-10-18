from collections.abc import Sequence

from psycopg import Connection
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool, json_dumps
from payagent.app.rule_validation import RuleError, validate_rule
from payagent.domain.rule import Condition, Effect, Operator
from payagent.ports.repositories import ColumnInfo, SourceInfo

_NUMBER = {"smallint", "integer", "bigint", "numeric", "real", "double precision"}
_DATE = {"date", "timestamp without time zone", "timestamp with time zone"}


def _map_type(pg_type: str) -> str:
    if pg_type in _NUMBER:
        return "number"
    if pg_type == "boolean":
        return "boolean"
    if pg_type in _DATE:
        return "date"
    return "text"


def source_columns(conn: Connection, name: str) -> list[ColumnInfo]:
    """Columns of a table or view in public, with their COMMENT, in table order."""
    rows = conn.execute(
        """
        select c.column_name, c.data_type,
               coalesce(col_description(to_regclass(quote_ident(c.table_schema) || '.' || quote_ident(c.table_name)),
                                        c.ordinal_position), '')
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = %s
        order by c.ordinal_position
        """,
        (name,),
    ).fetchall()
    return [ColumnInfo(name=r[0], data_type=_map_type(r[1]), description=r[2]) for r in rows]


class PostgresRuleCatalog:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def list_sources(self) -> list[SourceInfo]:
        with self._pool.connection() as conn:
            rows = conn.execute("select name, label, description from rule_source where active order by name").fetchall()
        return [SourceInfo(*r) for r in rows]

    def describe_source(self, name: str) -> list[ColumnInfo]:
        with self._pool.connection() as conn:
            if conn.execute("select 1 from rule_source where name = %s and active", (name,)).fetchone() is None:
                raise KeyError(name)
            return source_columns(conn, name)


class PostgresRules:
    """Writes rules. Conditions are checked against the catalog before anything is inserted."""

    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def create_rule(
        self,
        *,
        name: str,
        natural_language: str,
        effect: Effect,
        overridable: bool,
        conditions: Sequence[Condition],
        origin: str,
        proposed_by: str,
        approved_by: str,
        replaces_rule_id: str | None = None,
    ) -> str:
        with self._pool.connection() as conn:
            self._validate(conn, effect, overridable, conditions)
            if replaces_rule_id is not None:
                conn.execute(
                    "update rule set active = false, deactivated_at = now(), deactivated_by = %s where id = %s",
                    (approved_by, replaces_rule_id),
                )
            rule_id = conn.execute(
                """
                insert into rule (name, natural_language, effect, overridable, origin, proposed_by, approved_by,
                                  replaces_rule_id)
                values (%s, %s, %s, %s, %s, %s, %s, %s) returning id
                """,
                (name, natural_language, effect.value, overridable, origin, proposed_by, approved_by, replaces_rule_id),
            ).fetchone()[0]
            for position, c in enumerate(conditions, start=1):
                literal = None if c.value_ref or c.operator in (Operator.IS_NULL, Operator.IS_NOT_NULL) else Jsonb(
                    c.value, dumps=json_dumps
                )
                conn.execute(
                    """
                    insert into rule_condition (rule_id, position, source, column_name, operator, value,
                                                value_source, value_column)
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        rule_id,
                        position,
                        c.left.source,
                        c.left.column,
                        c.operator.value,
                        literal,
                        c.value_ref.source if c.value_ref else None,
                        c.value_ref.column if c.value_ref else None,
                    ),
                )
        return str(rule_id)

    def deactivate(self, rule_id: str, by: str | None = None) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "update rule set active = false, deactivated_at = now(), deactivated_by = %s where id = %s",
                (by, rule_id),
            )

    def activate(self, rule_id: str) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "update rule set active = true, deactivated_at = null, deactivated_by = null where id = %s", (rule_id,)
            )

    @staticmethod
    def _validate(conn: Connection, effect: Effect, overridable: bool, conditions: Sequence[Condition]) -> None:
        active = {r[0] for r in conn.execute("select name from rule_source where active").fetchall()}
        cache: dict[str, dict[str, ColumnInfo]] = {}

        def column(source: str, name: str) -> ColumnInfo:
            if source not in active:
                raise RuleError(f"La fuente «{source}» no existe")
            cols = cache.setdefault(source, {c.name: c for c in source_columns(conn, source)})
            if name not in cols:
                raise RuleError(f"La fuente «{source}» no tiene la columna «{name}»")
            return cols[name]

        validate_rule(effect=effect, overridable=overridable, conditions=conditions, column=column)
