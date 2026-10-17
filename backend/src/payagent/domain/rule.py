from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

# Literal values as they come out of rule_condition.value (jsonb) and out of the fact rows.
Scalar = str | int | float | Decimal | bool | None


class Effect(StrEnum):
    ALLOW = "ALLOW"
    ESCALATE = "ESCALATE"
    HOLD = "HOLD"


class Operator(StrEnum):
    EQ = "EQ"
    NEQ = "NEQ"
    GT = "GT"
    GTE = "GTE"
    LT = "LT"
    LTE = "LTE"
    IN = "IN"
    NOT_IN = "NOT_IN"
    BETWEEN = "BETWEEN"  # value is [low, high], inclusive
    NOT_BETWEEN = "NOT_BETWEEN"
    IS_NULL = "IS_NULL"  # takes no value
    IS_NOT_NULL = "IS_NOT_NULL"


@dataclass(frozen=True)
class ColumnRef:
    """A column of a registered rule source, e.g. ColumnRef("invoice", "amount_usd")."""

    source: str
    column: str

    def __str__(self) -> str:
        return f"{self.source}.{self.column}"


@dataclass(frozen=True)
class Condition:
    """`left operator value`, where value is a literal or another column (never both)."""

    left: ColumnRef
    operator: Operator
    value: Scalar | list[Scalar] = None
    value_ref: ColumnRef | None = None


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    effect: Effect
    overridable: bool
    conditions: tuple[Condition, ...]  # combined with AND, evaluated in order

    def sources(self) -> set[str]:
        refs = [c.left for c in self.conditions] + [c.value_ref for c in self.conditions if c.value_ref]
        return {r.source for r in refs}
