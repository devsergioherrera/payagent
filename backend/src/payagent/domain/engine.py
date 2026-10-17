from collections.abc import Sequence

from payagent.domain.decision import Decision
from payagent.domain.facts import Facts
from payagent.domain.rule import Rule


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
      - outcome: HOLD if any HOLD rule fired or missed data; else ESCALATE if any ESCALATE rule
        fired or missed data; else PAY.
      - no rules at all -> ESCALATE (fail-closed).
    Comparisons: numbers compare numerically whatever their Python type; ISO date strings compare
    as dates; EQ/NEQ on mixed types compare as strings.
    """
    raise NotImplementedError
