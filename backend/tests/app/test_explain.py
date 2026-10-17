from decimal import Decimal

from payagent.app.explain import decision_prompt, template_explanation
from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit
from payagent.domain.rule import Effect


def hit(result: HitResult, observed=None, threshold=None, name="Límite por pago") -> RuleHit:
    return RuleHit("r1", name, Effect.ESCALATE, result, observed or {}, threshold or {})


def test_pay_when_nothing_fired():
    d = Decision(Outcome.PAY, (hit(HitResult.PASSED),))
    assert template_explanation(d) == "Pagada: ninguna regla se disparó."


def test_escalated_mentions_rule_and_numbers():
    h = hit(HitResult.FIRED, {"invoice.amount_usd": Decimal("12400")}, {"invoice.amount_usd": 5000})
    text = template_explanation(Decision(Outcome.ESCALATE, (h, hit(HitResult.PASSED, name="Otra"))))
    assert text == "Escalada por: Límite por pago (observado invoice.amount_usd 12400, límite invoice.amount_usd 5000)."


def test_missing_data_is_reported():
    h = hit(HitResult.MISSING_DATA, {"vendor.risk": None})
    assert "falta un dato" in template_explanation(Decision(Outcome.ESCALATE, (h,)))


def test_prompt_lists_fired_and_overridden():
    fired = hit(HitResult.FIRED, {"a.b": 1}, {"a.b": 0})
    over = hit(HitResult.OVERRIDDEN, name="Vieja")
    p = decision_prompt(Decision(Outcome.HOLD, (fired, over)), "ACME 100 USD")
    assert "ACME 100 USD" in p and "Decisión del agente: Frenada" in p
    assert "Límite por pago" in p and "Vieja" in p
