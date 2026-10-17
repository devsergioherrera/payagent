import logging
from typing import Literal

from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool

log = logging.getLogger(__name__)


class PostgresNotifications:
    """Audit trail of every mail we tried to send. Never raises: logging must not break the pipeline."""

    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def record(
        self,
        invoice_id: str | None,
        kind: Literal["ESCALATION", "REPLY"],
        recipient: str,
        status: Literal["SENT", "FAILED"],
        error: str | None = None,
    ) -> None:
        try:
            with self._pool.connection() as conn:
                conn.execute(
                    "insert into notification (invoice_id, kind, recipient, status, error) values (%s, %s, %s, %s, %s)",
                    (invoice_id, kind, recipient, status, error),
                )
        except Exception:
            log.exception("could not record %s notification for invoice %s", kind, invoice_id)
