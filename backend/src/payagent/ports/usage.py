from typing import Literal, Protocol

Purpose = Literal["EXTRACT", "EXPLAIN", "DRAFT_RULE", "PROPOSE_RULES", "CHAT"]


class UsageMeter(Protocol):
    def record(
        self,
        operation_id: str,
        purpose: Purpose,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
    ) -> None:
        """Store one LLM call with its cost. Must never raise: a metering failure only logs."""
        ...
