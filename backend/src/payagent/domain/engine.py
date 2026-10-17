import operator as op
import re
from collections.abc import Callable, Sequence
from dataclasses import replace
from datetime import date
from decimal import Decimal, InvalidOperation

from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit
from payagent.domain.facts import Facts
from payagent.domain.rule import Condition, Effect, Operator, Rule, Scalar

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ORDERING: dict[Operator, Callable] = {
    Operator.GT: op.gt,
    Operator.GTE: op.ge,
    Operator.LT: op.lt,
    Operator.LTE: op.le,
}
_NULL_OPERATORS = (Operator.IS_NULL, Operator.IS_NOT_NULL)


def evaluate(rules: Sequence[Rule], facts: Facts) -> Decision:
    """Pure, deterministic decision. No I/O, no LLM.

    Per rule, conditions in order:
      - a referenced source with no row -> NOT_APPLICABLE
      - a condition that does not hold -> PASSED (stop)
      - a NULL operand (operator other than IS_NULL / IS_NOT_NULL) -> MISSING_DATA (stop);
        for HOLD/ESCALATE rules it counts as fired, for ALLOW rules it counts as passed
      - all conditions hold -> FIRED
    Then:
      - each FIRED ALLOW turns FIRED/MISSING_DATA results of overridable ESCALATE rules into OVERRIDDEN.
        ALLOW never touches HOLD rules or non-overridable rules.
      - outcome: HOLD if any HOLD rule fired; else ESCALATE if any HOLD/ESCALATE rule fired or
        missed data; else PAY. Missing data escalates even on a HOLD rule: a human must look.
      - no rules at all -> ESCALATE (fail-closed).
    Comparisons: numbers compare numerically whatever their Python type; ISO date strings compare
    as dates; EQ/NEQ on mixed types compare as strings.
    """
    if not rules:
        return Decision(Outcome.ESCALATE, ())

    hits = [_evaluate_rule(rule, facts) for rule in rules]

    allow = next((h for h in hits if h.effect is Effect.ALLOW and h.result is HitResult.FIRED), None)
    if allow is not None:
        overridable = {r.id for r in rules if r.overridable and r.effect is Effect.ESCALATE}
        hits = [
            replace(h, result=HitResult.OVERRIDDEN, overridden_by=allow.rule_id)
            if h.rule_id in overridable and h.result in _FIRING
            else h
            for h in hits
        ]

    return Decision(_outcome(hits), tuple(hits))


_FIRING = (HitResult.FIRED, HitResult.MISSING_DATA)


def _outcome(hits: Sequence[RuleHit]) -> Outcome:
    # Missing data never proves a HOLD reason; it only means a human must look, so it escalates.
    if any(h.effect is Effect.HOLD and h.result is HitResult.FIRED for h in hits):
        return Outcome.HOLD
    if any(h.effect is not Effect.ALLOW and h.result in _FIRING for h in hits):
        return Outcome.ESCALATE
    return Outcome.PAY


def _evaluate_rule(rule: Rule, facts: Facts) -> RuleHit:
    observed: dict[str, Scalar] = {}
    threshold: dict = {}

    def hit(result: HitResult) -> RuleHit:
        return RuleHit(rule.id, rule.name, rule.effect, result, observed, threshold)

    for cond in rule.conditions:
        refs = [cond.left] + ([cond.value_ref] if cond.value_ref else [])
        if any(not facts.has_row(r.source) for r in refs):
            return hit(HitResult.NOT_APPLICABLE)
        left = facts.value(cond.left)
        observed[str(cond.left)] = left
        if cond.value_ref is not None:
            right = facts.value(cond.value_ref)
            threshold[str(cond.value_ref)] = right
        else:
            right = cond.value
            if cond.operator not in _NULL_OPERATORS:
                threshold[str(cond.left)] = list(right) if isinstance(right, list) else right
        try:
            holds = _holds(cond, left, right)
        except (ValueError, TypeError, ArithmeticError):
            # Malformed rule: fail closed instead of crashing the whole decision.
            return hit(HitResult.MISSING_DATA)
        if holds is None:
            return hit(HitResult.MISSING_DATA)
        if not holds:
            return hit(HitResult.PASSED)
    return hit(HitResult.FIRED)


def _holds(cond: Condition, left: Scalar, right) -> bool | None:
    """True/False, or None when an operand is NULL. Raises ValueError/TypeError on malformed input."""
    operator = cond.operator
    if operator is Operator.IS_NULL:
        return left is None
    if operator is Operator.IS_NOT_NULL:
        return left is not None
    if left is None or right is None:
        return None
    if operator is Operator.EQ:
        return _eq(left, right)
    if operator is Operator.NEQ:
        return not _eq(left, right)
    if operator in _ORDERING:
        return _ORDERING[operator](*_comparable(left, right))
    if operator in (Operator.IN, Operator.NOT_IN):
        if not isinstance(right, list):
            raise TypeError("IN needs a list")
        found = any(_eq(left, item) for item in right if item is not None)
        return found if operator is Operator.IN else not found
    if operator in (Operator.BETWEEN, Operator.NOT_BETWEEN):
        if not isinstance(right, list) or len(right) != 2 or None in right:
            raise TypeError("BETWEEN needs [low, high]")
        low, value = _comparable(right[0], left)
        value2, high = _comparable(left, right[1])
        inside = low <= value and value2 <= high
        return inside if operator is Operator.BETWEEN else not inside
    raise ValueError(f"unknown operator {operator}")


def _as_decimal(v: Scalar) -> Decimal | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, Decimal)):
        d = Decimal(v)
    elif isinstance(v, (float, str)):
        try:
            d = Decimal(str(v).strip())
        except InvalidOperation:
            return None
    else:
        return None
    return d if d.is_finite() else None


def _as_date(v: Scalar) -> date | None:
    if isinstance(v, str) and _ISO_DATE.match(v):
        try:
            return date.fromisoformat(v)
        except ValueError:
            return None
    return None


def _as_bool(v: Scalar) -> bool | None:
    if isinstance(v, bool):
        return v
    if isinstance(v, str) and v.strip().lower() in ("true", "false"):
        return v.strip().lower() == "true"
    return None


def _comparable(a: Scalar, b: Scalar) -> tuple:
    """Coerce both sides to one comparable type, or raise TypeError."""
    if isinstance(a, bool) or isinstance(b, bool):
        raise TypeError("booleans have no ordering")
    da, db = _as_date(a), _as_date(b)
    if da is not None and db is not None:
        return da, db
    na, nb = _as_decimal(a), _as_decimal(b)
    if na is not None and nb is not None:
        return na, nb
    if isinstance(a, str) and isinstance(b, str):
        return a, b
    raise TypeError("incomparable types")


def _eq(a: Scalar, b: Scalar) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        ba, bb = _as_bool(a), _as_bool(b)
        return ba is not None and bb is not None and ba == bb
    if isinstance(a, str) and isinstance(b, str):
        # Two strings are identifiers or dates, never numbers: "0012" must not equal "12".
        da, db = _as_date(a), _as_date(b)
        return da == db if da is not None and db is not None else a == b
    na, nb = _as_decimal(a), _as_decimal(b)
    if na is not None and nb is not None:
        return na == nb
    return str(a) == str(b)
