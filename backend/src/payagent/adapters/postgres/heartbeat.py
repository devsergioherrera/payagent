from datetime import datetime

from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool


class PostgresHeartbeat:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def beat(self, ok: bool) -> None:
        """A failed poll keeps the time of the last good one, so "revisado hace" stays honest."""
        with self._pool.connection() as conn:
            conn.execute(
                """
                insert into worker_heartbeat (id, email_checked_at, email_ok)
                values (1, case when %(ok)s then now() end, %(ok)s)
                on conflict (id) do update
                set email_checked_at = case when %(ok)s then now() else worker_heartbeat.email_checked_at end,
                    email_ok = %(ok)s
                """,
                {"ok": ok},
            )

    def last(self) -> tuple[datetime | None, bool]:
        with self._pool.connection() as conn:
            row = conn.execute("select email_checked_at, email_ok from worker_heartbeat where id = 1").fetchone()
        return (row[0], bool(row[1])) if row else (None, False)
