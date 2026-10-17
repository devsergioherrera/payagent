import logging
import time
from collections.abc import Callable
from typing import Any

from payagent.ports.usage import Purpose, UsageMeter

log = logging.getLogger(__name__)


def call_with_retry[T](fn: Callable[[], T]) -> T:
    """One retry for transient failures (rate limit, 5xx, network), then raise."""
    try:
        return fn()
    except Exception:
        log.warning("Gemini call failed, retrying once", exc_info=True)
        time.sleep(0.5)
        return fn()


def record_usage(
    meter: UsageMeter, operation_id: str, purpose: Purpose, model: str, response: Any, started: float
) -> None:
    try:
        usage = response.usage_metadata
        meter.record(
            operation_id,
            purpose,
            model,
            int(getattr(usage, "prompt_token_count", 0) or 0),
            int(getattr(usage, "candidates_token_count", 0) or 0),
            int((time.monotonic() - started) * 1000),
        )
    except Exception:
        log.exception("Metering failed; ignoring")
