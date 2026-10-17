import json
from decimal import Decimal

from psycopg_pool import ConnectionPool

from payagent.config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Process-wide pool, opened on first use."""
    global _pool
    if _pool is None:
        # The Supabase pooler (transaction mode) does not support prepared statements.
        _pool = ConnectionPool(
            settings.database_url,
            kwargs={"prepare_threshold": None},
            min_size=1,
            max_size=5,
            open=False,
        )
        _pool.open(wait=True, timeout=30)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def json_dumps(obj: object) -> str:
    """json.dumps that also accepts Decimal (written as a JSON number)."""

    def default(o: object) -> object:
        if isinstance(o, Decimal):
            return int(o) if o == o.to_integral_value() else float(o)
        raise TypeError(type(o))

    return json.dumps(obj, default=default)
