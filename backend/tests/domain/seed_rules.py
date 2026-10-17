"""The 15 seed rules, mirroring db/migrations/002_seed.sql (same ids, order, effects)."""

from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule

E, H = Effect.ESCALATE, Effect.HOLD


def _c(source: str, column: str, op: Operator, value=None, ref: tuple[str, str] | None = None) -> Condition:
    return Condition(ColumnRef(source, column), op, value, ColumnRef(*ref) if ref else None)


def _r(n: int, name: str, effect: Effect, overridable: bool, *conditions: Condition) -> Rule:
    return Rule(f"20000000-0000-0000-0000-{n:012d}", name, effect, overridable, tuple(conditions))


def seed_rules() -> list[Rule]:
    O = Operator
    return [
        _r(1, "Proveedor no registrado", E, False, _c("invoice", "vendor_id", O.IS_NULL)),
        _r(2, "Proveedor bloqueado", H, False, _c("vendor", "status", O.EQ, "BLOCKED")),
        _r(3, "Cuenta bancaria distinta", E, False,
           _c("invoice", "bank_account", O.NEQ, ref=("vendor", "bank_account"))),
        _r(4, "NIT distinto al registrado", E, True,
           _c("invoice", "vendor_tax_id", O.NEQ, ref=("vendor", "tax_id"))),
        _r(5, "Límite por pago", E, True, _c("invoice", "amount_usd", O.GT, 5000)),
        _r(6, "Umbral de aprobación humana", E, False, _c("invoice", "amount_usd", O.GTE, 10000)),
        _r(7, "Presupuesto del mes", H, False, _c("budget_status", "saldo_despues_usd", O.LT, 0)),
        _r(8, "Factura duplicada", H, False, _c("invoice_checks", "duplicada", O.EQ, True)),
        _r(9, "Posible cobro repetido", E, True, _c("invoice_checks", "similares_30d", O.GT, 0)),
        _r(10, "Sin orden de compra", E, True, _c("po_check", "orden_encontrada", O.EQ, False)),
        _r(11, "Fuera de la tolerancia de la orden", E, True,
           _c("po_check", "orden_encontrada", O.EQ, True), _c("po_check", "desviacion_pct", O.GT, 5)),
        _r(12, "Moneda distinta a la orden", E, True,
           _c("po_check", "orden_encontrada", O.EQ, True), _c("po_check", "moneda_coincide", O.EQ, False)),
        _r(13, "Faltan datos", E, False, _c("invoice_checks", "campos_faltantes", O.GT, 0)),
        _r(14, "Fecha fuera de rango", E, True, _c("invoice_checks", "dias_emision", O.NOT_BETWEEN, [0, 90])),
        _r(15, "Factura vencida", E, True, _c("invoice", "due_date", O.IS_NOT_NULL, None), _c("invoice_checks", "dias_para_vencer", O.LT, 0)),
    ]
