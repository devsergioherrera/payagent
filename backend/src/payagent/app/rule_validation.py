"""The single check every saved rule goes through (drafter, POST /rules, proposal accept)."""
from collections.abc import Callable, Sequence
from datetime import date
from decimal import Decimal
from typing import Any

from payagent.domain.rule import Condition, Effect, Operator
from payagent.ports.repositories import ColumnInfo


class RuleError(ValueError):
    """A validation problem, written in Spanish so it can reach the user or the drafting model."""


_ORDERED = {Operator.GT, Operator.GTE, Operator.LT, Operator.LTE}
_SET = {Operator.IN, Operator.NOT_IN}
_RANGE = {Operator.BETWEEN, Operator.NOT_BETWEEN}
_NULLS = {Operator.IS_NULL, Operator.IS_NOT_NULL}
_EQUALITY = {Operator.EQ, Operator.NEQ}
ALLOWED_OPERATORS: dict[str, set[Operator]] = {
    "number": _EQUALITY | _ORDERED | _SET | _RANGE | _NULLS,
    "date": _EQUALITY | _ORDERED | _RANGE | _NULLS,
    "text": _EQUALITY | _SET | _NULLS,
    "boolean": _EQUALITY | _NULLS,
}

ColumnLookup = Callable[[str, str], ColumnInfo]  # raises RuleError for an unknown source or column


def _is_valid(raw: Any, data_type: str) -> bool:
    if data_type == "boolean":
        return isinstance(raw, bool)
    if data_type == "number":
        return isinstance(raw, (int, float, Decimal)) and not isinstance(raw, bool)
    if data_type == "date":
        try:
            return isinstance(raw, str) and bool(date.fromisoformat(raw))
        except ValueError:
            return False
    return isinstance(raw, str)


def _check_items(items: Sequence[Any], info: ColumnInfo, where: str) -> None:
    for item in items:
        if not _is_valid(item, info.data_type):
            raise RuleError(f"El valor {item!r} no es válido para {where} ({info.data_type})")


def _check_condition(cond: Condition, column: ColumnLookup) -> None:
    left = cond.left
    where = f"{left.source}.{left.column}"
    info = column(left.source, left.column)
    op = cond.operator
    if op not in ALLOWED_OPERATORS[info.data_type]:
        allowed = ", ".join(sorted(o.value for o in ALLOWED_OPERATORS[info.data_type]))
        raise RuleError(f"El operador {op.value} no se puede usar con {where} ({info.data_type}). Permitidos: {allowed}")
    if op in _NULLS:
        if cond.value is not None or cond.value_ref is not None:
            raise RuleError(f"{op.value} sobre {where} no lleva valor")
        return
    if cond.value is not None and cond.value_ref is not None:
        raise RuleError(f"{where}: da un valor o una columna, no los dos")
    if cond.value_ref is not None:
        if op in _SET | _RANGE:
            raise RuleError(f"{op.value} necesita valores fijos, no una columna")
        other = column(cond.value_ref.source, cond.value_ref.column)
        if other.data_type != info.data_type:
            raise RuleError(
                f"No se puede comparar {where} ({info.data_type}) con "
                f"{cond.value_ref.source}.{cond.value_ref.column} ({other.data_type})"
            )
        return
    value = cond.value
    if value is None:
        raise RuleError(f"{op.value} sobre {where} necesita un valor")
    if op in _RANGE:
        if not isinstance(value, list) or len(value) != 2:
            raise RuleError(f"{op.value} sobre {where} necesita una lista [mínimo, máximo]")
        _check_items(value, info, where)
        if value[0] > value[1]:
            raise RuleError(f"{op.value} sobre {where}: el mínimo debe ser menor o igual al máximo")
    elif op in _SET:
        if not isinstance(value, list) or not value:
            raise RuleError(f"{op.value} sobre {where} necesita una lista con al menos un valor")
        _check_items(value, info, where)
    elif isinstance(value, list):
        raise RuleError(f"{op.value} sobre {where} lleva un solo valor, no una lista")
    else:
        _check_items([value], info, where)


def validate_rule(
    *, effect: Effect, overridable: bool, conditions: Sequence[Condition], column: ColumnLookup
) -> None:
    """Raises RuleError with a Spanish message if the rule cannot be saved as it is."""
    if effect is Effect.ALLOW and not overridable:
        raise RuleError("Una regla de excepción (Permitir) debe poder anularse")
    if effect is Effect.HOLD and overridable:
        raise RuleError("Una regla que frena el pago no puede anularse")
    if not conditions:
        raise RuleError("Una regla necesita al menos una condición")
    for cond in conditions:
        _check_condition(cond, column)
