from decimal import Decimal

from payagent.domain.rule import Condition, Effect, Operator

EFFECT_LABEL = {Effect.ALLOW: "Permitir", Effect.ESCALATE: "Escalar", Effect.HOLD: "Frenar"}

_OP = {
    Operator.EQ: "=", Operator.NEQ: "≠", Operator.GT: ">", Operator.GTE: "≥", Operator.LT: "<", Operator.LTE: "≤",
    Operator.IN: "es uno de", Operator.NOT_IN: "no es ninguno de",
    Operator.BETWEEN: "entre", Operator.NOT_BETWEEN: "fuera de",
    Operator.IS_NULL: "está vacío", Operator.IS_NOT_NULL: "tiene dato",
}


# Short Spanish names for the seed sources' columns; unknown columns show their raw name.
COLUMN_LABEL = {
    "amount_usd": "monto en USD", "amount": "monto", "currency": "moneda", "vendor_id": "proveedor registrado",
    "vendor_tax_id": "NIT", "tax_id": "NIT", "bank_account": "cuenta bancaria", "po_number": "orden de compra",
    "due_date": "fecha de vencimiento", "issue_date": "fecha de emisión", "confidence": "confianza de lectura",
    "status": "estado", "country": "país", "name": "nombre", "duplicada": "duplicada",
    "similares_30d": "cobros iguales en 30 días", "campos_faltantes": "datos faltantes",
    "dias_emision": "días desde la emisión", "dias_para_vencer": "días para vencer",
    "orden_encontrada": "orden encontrada", "desviacion_pct": "desviación %", "moneda_coincide": "moneda coincide",
    "proveedor_coincide": "proveedor coincide", "saldo_despues_usd": "saldo tras pagar (USD)",
    "comprometido_usd": "comprometido en el mes (USD)", "presupuesto_usd": "presupuesto del mes (USD)",
}


def _value(v: object) -> str:
    if isinstance(v, bool):
        return "sí" if v else "no"
    if isinstance(v, list):
        return " y ".join(_value(x) for x in v) if len(v) == 2 else ", ".join(_value(x) for x in v)
    # Only real numbers get thousands separators; digit strings are ids (tax ids, accounts).
    if isinstance(v, (int, float, Decimal)):
        return f"{float(v):,.0f}".replace(",", ".") if float(v) == int(float(v)) else str(v)
    return str(v)


def condition_text(cond: Condition, labels: dict[str, str]) -> str:
    """'Factura · amount_usd > 5.000'. `labels` maps source name -> its rule_source label."""
    left = f"{labels.get(cond.left.source, cond.left.source)} · {COLUMN_LABEL.get(cond.left.column, cond.left.column)}"
    if cond.operator in (Operator.IS_NULL, Operator.IS_NOT_NULL):
        return f"{left} {_OP[cond.operator]}"
    if cond.value_ref is not None:
        right = f"{labels.get(cond.value_ref.source, cond.value_ref.source)} · {COLUMN_LABEL.get(cond.value_ref.column, cond.value_ref.column)}"
    else:
        right = _value(cond.value)
    return f"{left} {_OP[cond.operator]} {right}"
