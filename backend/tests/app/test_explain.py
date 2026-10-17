from decimal import Decimal

from payagent.app.explain import decision_prompt, template_explanation
from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit
from payagent.domain.rule import Effect


def hit(result: HitResult, observed=None, threshold=None, name="Límite por pago") -> RuleHit:
    return RuleHit("r1", name, Effect.ESCALATE, result, observed or {}, threshold or {})


def test_pay_when_nothing_fired():
    d = Decision(Outcome.PAY, (hit(HitResult.PASSED),))
    assert template_explanation(d) == "Pagada: ninguna regla se disparó."


def test_escalated_reads_like_a_person_wrote_it():
    amount = Decimal("12400")
    limit = hit(HitResult.FIRED, {"invoice.amount_usd": amount}, {"invoice.amount_usd": Decimal("5000")})
    umbral = hit(HitResult.FIRED, {"invoice.amount_usd": amount}, {"invoice.amount_usd": 10000}, name="Umbral de aprobación humana")
    text = template_explanation(Decision(Outcome.ESCALATE, (limit, umbral, hit(HitResult.PASSED, name="Otra"))))
    assert text == (
        "Escalada: el monto en USD de USD 12.400 supera el límite por pago de USD 5.000 "
        "y el umbral de aprobación humana de USD 10.000."
    )


def test_missing_data_names_what_could_not_be_read():
    hits = (
        hit(HitResult.MISSING_DATA, {"invoice.amount_usd": None}, name="Límite por pago"),
        hit(HitResult.MISSING_DATA, {"invoice.currency": None}, name="Moneda"),
        hit(HitResult.MISSING_DATA, {"invoice.issue_date": None}, name="Fecha"),
        hit(HitResult.FIRED, {"invoice_checks.campos_faltantes": 3}, {"invoice_checks.campos_faltantes": 0}, name="Faltan datos"),
    )
    text = template_explanation(Decision(Outcome.ESCALATE, hits))
    assert text == "Escalada: no se pudo leer el monto en USD, la moneda ni la fecha de la factura."


def test_no_raw_keys_leak():
    h = hit(HitResult.FIRED, {"budget_status.saldo_despues_usd": Decimal("-300")}, {"budget_status.saldo_despues_usd": 0}, name="Presupuesto del mes")
    text = template_explanation(Decision(Outcome.HOLD, (h,)))
    assert "budget_status" not in text and "saldo_despues_usd" not in text
    assert text == "Frenada: Presupuesto del mes (saldo del presupuesto tras el pago: USD -300, límite USD 0)."


def test_unknown_column_falls_back_to_its_name():
    h = hit(HitResult.MISSING_DATA, {"vendor.risk_score": None})
    assert "no se pudo leer risk_score" in template_explanation(Decision(Outcome.ESCALATE, (h,)))


def test_prompt_lists_fired_and_overridden():
    fired = hit(HitResult.FIRED, {"a.b": 1}, {"a.b": 0})
    over = hit(HitResult.OVERRIDDEN, name="Vieja")
    p = decision_prompt(Decision(Outcome.HOLD, (fired, over)), "ACME 100 USD")
    assert "ACME 100 USD" in p and "Decisión del agente: Frenada" in p
    assert "límite por pago de 0" in p and "Vieja" in p and "a.b" not in p
