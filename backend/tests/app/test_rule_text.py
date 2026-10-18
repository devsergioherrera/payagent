from payagent.app.rule_text import rule_summary
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator

O = Operator


def c(source, column, op, value=None, ref=None):
    return Condition(ColumnRef(source, column), op, value, ColumnRef(*ref) if ref else None)


def test_seed_style_summaries():
    assert rule_summary(Effect.ESCALATE, [c("invoice", "amount_usd", O.GT, 5000)]) == (
        "Pide tu aprobación cuando el monto supere USD 5.000")
    assert rule_summary(Effect.HOLD, [c("vendor", "status", O.EQ, "BLOCKED")]) == (
        "Frena el pago cuando el proveedor esté bloqueado")
    assert rule_summary(Effect.ESCALATE, [c("invoice", "bank_account", O.NEQ, ref=("vendor", "bank_account"))]) == (
        "Pide tu aprobación cuando la cuenta bancaria no sea la del proveedor")
    assert rule_summary(Effect.ESCALATE, [
        c("po_check", "orden_encontrada", O.EQ, True), c("po_check", "desviacion_pct", O.GT, 5)]) == (
        "Pide tu aprobación cuando el monto se desvíe más de 5 % de la orden")
    assert rule_summary(Effect.ESCALATE, [
        c("po_check", "orden_encontrada", O.EQ, True), c("po_check", "saldo_oc_despues_pct", O.LT, -5)]) == (
        "Pide tu aprobación cuando la factura sobregire la orden de compra más de 5 %")
    # A lone guard is the whole rule, so it stays.
    assert rule_summary(Effect.HOLD, [c("po_check", "orden_encontrada", O.EQ, True)]) == (
        "Frena el pago cuando la factura tenga una orden de compra")


def test_generic_fallback_names_the_column():
    text = rule_summary(Effect.ALLOW, [c("vendor", "country", O.IN, ["CO", "MX"])])
    assert text == "Deja pasar el pago cuando el dato «país» sea uno de CO y MX"
