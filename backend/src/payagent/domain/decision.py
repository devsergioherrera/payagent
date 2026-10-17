from dataclasses import dataclass
from enum import StrEnum

from payagent.domain.rule import Effect, Scalar


class Outcome(StrEnum):
    PAY = "PAY"  # Pagar
    HOLD = "HOLD"  # Frenar
    ESCALATE = "ESCALATE"  # Escalar


class HitResult(StrEnum):
    FIRED = "FIRED"  # every condition held
    PASSED = "PASSED"  # some condition did not hold
    OVERRIDDEN = "OVERRIDDEN"  # fired, then cancelled by an ALLOW
    MISSING_DATA = "MISSING_DATA"  # a needed value was NULL: counts as fired (fail-closed)
    NOT_APPLICABLE = "NOT_APPLICABLE"  # a source has no row for this invoice


@dataclass(frozen=True)
class RuleHit:
    rule_id: str
    rule_name: str
    effect: Effect
    result: HitResult
    observed: dict[str, Scalar]  # "source.column" -> value seen
    threshold: dict[str, Scalar | list[Scalar]]  # "source.column" -> literal or other column's value
    overridden_by: str | None = None


@dataclass(frozen=True)
class Decision:
    outcome: Outcome
    hits: tuple[RuleHit, ...]  # one per evaluated rule, in rule order

    @property
    def needs_human(self) -> bool:
        return self.outcome is not Outcome.PAY
