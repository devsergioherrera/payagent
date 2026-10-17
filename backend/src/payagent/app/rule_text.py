from payagent.domain.rule import Condition, Effect, Operator

EFFECT_LABEL = {Effect.ALLOW: "Permitir", Effect.ESCALATE: "Escalar", Effect.HOLD: "Frenar"}

_OP = {
    Operator.EQ: "=", Operator.NEQ: "≠", Operator.GT: ">", Operator.GTE: "≥", Operator.LT: "<", Operator.LTE: "≤",
    Operator.IN: "es uno de", Operator.NOT_IN: "no es ninguno de",
    Operator.BETWEEN: "entre", Operator.NOT_BETWEEN: "fuera de",
    Operator.IS_NULL: "está vacío", Operator.IS_NOT_NULL: "tiene dato",
}


def _value(v: object) -> str:
    if isinstance(v, bool):
        return "sí" if v else "no"
    if isinstance(v, list):
        return " y ".join(_value(x) for x in v) if len(v) == 2 else ", ".join(_value(x) for x in v)
    if isinstance(v, (int, float)) or (isinstance(v, str) and v.replace(".", "", 1).isdigit()):
        return f"{float(v):,.0f}".replace(",", ".") if float(v) == int(float(v)) else str(v)
    return str(v)


def condition_text(cond: Condition, labels: dict[str, str]) -> str:
    """'Factura · amount_usd > 5.000'. `labels` maps source name -> its rule_source label."""
    left = f"{labels.get(cond.left.source, cond.left.source)} · {cond.left.column}"
    if cond.operator in (Operator.IS_NULL, Operator.IS_NOT_NULL):
        return f"{left} {_OP[cond.operator]}"
    if cond.value_ref is not None:
        right = f"{labels.get(cond.value_ref.source, cond.value_ref.source)} · {cond.value_ref.column}"
    else:
        right = _value(cond.value)
    return f"{left} {_OP[cond.operator]} {right}"
