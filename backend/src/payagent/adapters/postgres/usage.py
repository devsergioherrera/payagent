import logging

from psycopg_pool import ConnectionPool

from payagent.adapters.postgres.db import get_pool

log = logging.getLogger(__name__)

# USD per 1M tokens: (input, output).
PRICES: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.30, 2.50),
}


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICES.get(model, (0.0, 0.0))
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000


class PostgresUsageMeter:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool or get_pool()

    def record(
        self,
        operation_id: str,
        purpose: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
    ) -> None:
        try:
            with self._pool.connection() as conn:
                conn.execute(
                    """
                    insert into llm_usage (operation_id, purpose, model, input_tokens, output_tokens, cost_usd,
                                           latency_ms)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        operation_id,
                        purpose,
                        model,
                        input_tokens,
                        output_tokens,
                        round(cost_usd(model, input_tokens, output_tokens), 6),
                        latency_ms,
                    ),
                )
        except Exception:
            log.exception("could not record LLM usage for operation %s", operation_id)
