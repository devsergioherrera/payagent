from collections.abc import Sequence
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
    "comprometido_oc": "ya comprometido en la orden", "saldo_oc_despues_pct": "saldo de la orden tras pagar (%)",
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


_LEAD = {
    Effect.ESCALATE: "Pide tu aprobación",
    Effect.HOLD: "Frena el pago",
    Effect.ALLOW: "Deja pasar el pago",
}

_GENERIC_OP = {
    Operator.EQ: "sea igual a", Operator.NEQ: "sea distinto de", Operator.GT: "sea mayor que",
    Operator.GTE: "sea al menos", Operator.LT: "sea menor que", Operator.LTE: "sea como máximo",
    Operator.IN: "sea uno de", Operator.NOT_IN: "no sea ninguno de",
    Operator.BETWEEN: "esté entre", Operator.NOT_BETWEEN: "esté fuera de",
    Operator.IS_NULL: "esté vacío", Operator.IS_NOT_NULL: "tenga dato",
}

# Clause for "money > n" style comparisons, already in the subjunctive after "cuando".
_MONEY_OP = {
    Operator.GT: "supere {v}", Operator.GTE: "sea de {v} o más", Operator.LT: "sea menor que {v}",
    Operator.LTE: "no pase de {v}", Operator.EQ: "sea exactamente {v}", Operator.NEQ: "sea distinto de {v}",
}


def _num(v: object) -> str:
    return _value(v)


def _money(v: object) -> str:
    return f"USD {_num(v)}"


def _flag(cond: Condition, yes: str, no: str) -> str | None:
    """A boolean column compared with true/false."""
    if cond.operator not in (Operator.EQ, Operator.NEQ) or not isinstance(cond.value, bool):
        return None
    return yes if (cond.value is True) == (cond.operator is Operator.EQ) else no


def _specific(cond: Condition) -> str | None:
    """Plain wording for the columns the seed rules use; None means 'use the generic form'."""
    ref = cond.value_ref
    col, op, v = cond.left.column, cond.operator, cond.value
    if ref is not None:
        if col == "bank_account" and op is Operator.NEQ:
            return "la cuenta bancaria no sea la del proveedor"
        if col == "vendor_tax_id" and op is Operator.NEQ:
            return "el NIT no sea el del proveedor"
        return None
    if col == "vendor_id" and op is Operator.IS_NULL:
        return "el proveedor no esté registrado"
    if col == "status" and cond.left.source == "vendor" and op is Operator.EQ and v == "BLOCKED":
        return "el proveedor esté bloqueado"
    if col == "amount_usd" and op in _MONEY_OP:
        return "el monto " + _MONEY_OP[op].format(v=_money(v))
    if col == "saldo_despues_usd" and op is Operator.LT:
        return f"el pago deje el presupuesto del mes por debajo de {_money(v)}"
    if col == "duplicada":
        return _flag(cond, "la factura esté duplicada", "la factura no esté duplicada")
    if col == "similares_30d" and op is Operator.GT:
        return "haya cobros iguales en los últimos 30 días" if v == 0 else f"haya más de {_num(v)} cobros iguales en 30 días"
    if col == "orden_encontrada":
        return _flag(cond, "la factura tenga una orden de compra", "la factura no tenga una orden de compra válida")
    if col == "desviacion_pct" and op is Operator.GT:
        return f"el monto se desvíe más de {_num(v)} % de la orden"
    if col == "saldo_oc_despues_pct" and op in (Operator.LT, Operator.LTE):
        return "la factura sobregire la orden de compra"
    if col == "moneda_coincide":
        return _flag(cond, "la moneda coincida con la de la orden", "la moneda sea distinta a la de la orden")
    if col == "proveedor_coincide":
        return _flag(cond, "el proveedor coincida con el de la orden", "el proveedor sea distinto al de la orden")
    if col == "campos_faltantes" and op is Operator.GT and v == 0:
        return "falten datos en la factura"
    if col == "dias_emision" and op is Operator.NOT_BETWEEN and isinstance(v, list) and len(v) == 2:
        return f"la fecha de emisión esté fuera de los últimos {_num(v[1])} días"
    if col == "due_date" and op is Operator.IS_NOT_NULL:
        return "la factura tenga fecha de vencimiento"
    if col == "dias_para_vencer" and op is Operator.LT and v == 0:
        return "la factura ya esté vencida"
    return None


def _clause(cond: Condition, labels: dict[str, str]) -> str:
    specific = _specific(cond)
    if specific:
        return specific
    subject = f"el dato «{COLUMN_LABEL.get(cond.left.column, cond.left.column)}»"
    verb = _GENERIC_OP[cond.operator]
    if cond.operator in (Operator.IS_NULL, Operator.IS_NOT_NULL):
        return f"{subject} {verb}"
    if cond.value_ref is not None:
        other = COLUMN_LABEL.get(cond.value_ref.column, cond.value_ref.column)
        return f"{subject} {verb} «{other}»"
    return f"{subject} {verb} {_value(cond.value)}"


def rule_summary(effect: Effect, conditions: Sequence[Condition], labels: dict[str, str] | None = None) -> str:
    """One plain Spanish sentence for a rule, e.g. 'Pide tu aprobación cuando el monto supere USD 5.000'.

    Deterministic (no LLM). Seed columns have hand-written wording; any other column falls back to a generic form.
    """
    clauses = [_clause(c, labels or {}) for c in conditions]
    if not clauses:
        return _LEAD[effect]
    return f"{_LEAD[effect]} cuando {' y '.join(clauses)}"
