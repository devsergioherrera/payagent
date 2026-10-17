from decimal import Decimal

from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit

_HEADLINE = {Outcome.PAY: "Pagada", Outcome.HOLD: "Frenada", Outcome.ESCALATE: "Escalada"}
_COUNTED = (HitResult.FIRED, HitResult.MISSING_DATA)

# column -> Spanish noun phrase with its article. Unknown columns fall back to the bare column name.
_LABELS = {
    "amount_usd": "el monto en USD",
    "amount": "el monto",
    "currency": "la moneda",
    "issue_date": "la fecha de la factura",
    "due_date": "la fecha de vencimiento",
    "invoice_number": "el número de factura",
    "vendor_id": "el proveedor",
    "vendor_name_raw": "el nombre del proveedor",
    "vendor_tax_id": "el NIT del proveedor",
    "bank_account": "la cuenta bancaria",
    "po_number": "el número de orden de compra",
    "status": "el estado del proveedor",
    "tax_id": "el NIT registrado",
    "saldo_despues_usd": "el saldo del presupuesto tras el pago",
    "duplicada": "la factura duplicada",
    "similares_30d": "las facturas similares de los últimos 30 días",
    "campos_faltantes": "los campos faltantes",
    "dias_emision": "los días desde la emisión",
    "dias_para_vencer": "los días para vencer",
    "orden_encontrada": "la orden de compra encontrada",
    "desviacion_pct": "la desviación frente a la orden",
    "moneda_coincide": "la moneda coincide con la orden",
}
# Already explained by the "no se pudo leer" sentence when data is missing.
_REDUNDANT_WHEN_MISSING = {"campos_faltantes"}


def _column(key: str) -> str:
    return key.rsplit(".", 1)[-1]


def _label(key: str) -> str:
    col = _column(key)
    return _LABELS.get(col, col)


def _bare(label: str) -> str:
    head, _, rest = label.partition(" ")
    return rest if head in ("el", "la", "los", "las") and rest else label


def _number(v: Decimal | int | float) -> str:
    d = Decimal(str(v))
    if d == d.to_integral_value():
        text = f"{int(d):,}".replace(",", ".")
    else:
        whole, frac = f"{d:,.2f}".split(".")
        text = f"{whole.replace(',', '.')},{frac}"
    return text


def _value(key: str, v: object) -> str:
    if v is None:
        return "sin dato"
    if isinstance(v, bool):
        return "sí" if v else "no"
    if isinstance(v, list):
        return " y ".join(_value(key, x) for x in v)
    if isinstance(v, (int, float, Decimal)):
        col = _column(key)
        if col.endswith("_usd"):
            return f"USD {_number(v)}"
        if col.endswith("_pct"):
            return f"{_number(v)} %"
        return _number(v)
    return str(v)


def _is_number(v: object) -> bool:
    return isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def _pair(hit: RuleHit) -> tuple[str, object, object] | None:
    """(key, observed, limit) when the hit is a plain number-vs-number comparison on one column."""
    if len(hit.observed) != 1:
        return None
    key, observed = next(iter(hit.observed.items()))
    limit = hit.threshold.get(key)
    return (key, observed, limit) if _is_number(observed) and _is_number(limit) else None


def _is_limit_rule(hit: RuleHit) -> bool:
    return _lower_first(hit.rule_name).startswith(("límite", "umbral"))


def _verb(observed: Decimal | int | float, limit: Decimal | int | float) -> str:
    a, b = Decimal(str(observed)), Decimal(str(limit))
    return "supera" if a > b else "alcanza" if a == b else "queda por debajo de"


def _generic(hit: RuleHit) -> str:
    facts = [f"{_bare(_label(k))}: {_value(k, v)}" for k, v in hit.observed.items()]
    limits = [f"límite {_value(k, v)}" for k, v in hit.threshold.items() if k in hit.observed]
    inner = ", ".join(facts + limits)
    return f"{hit.rule_name} ({inner})" if inner else hit.rule_name


def hit_text(hit: RuleHit) -> str:
    """One fired rule as a sentence fragment a person would write."""
    if hit.result is HitResult.MISSING_DATA:
        return f"{hit.rule_name} (falta {_join_and([_label(k) for k in hit.observed]) or 'un dato'})"
    pair = _pair(hit)
    if pair and _is_limit_rule(hit):
        key, observed, limit = pair
        return (
            f"{_label(key)} de {_value(key, observed)} {_verb(observed, limit)} "
            f"el {_lower_first(hit.rule_name)} de {_value(key, limit)}"
        )
    return _generic(hit)


def _join_and(items: list[str], word: str = "y") -> str:
    if len(items) <= 1:
        return "".join(items)
    return f"{', '.join(items[:-1])} {word} {items[-1]}"


def _fired(decision: Decision) -> list[RuleHit]:
    return [h for h in decision.hits if h.result in _COUNTED]


def _missing_sentence(hits: list[RuleHit]) -> str:
    labels: list[str] = []
    for h in hits:
        for key in h.observed:
            if _label(key) not in labels:
                labels.append(_label(key))
    return f"no se pudo leer {_join_and(labels, 'ni')}"


def _clauses(hits: list[RuleHit]) -> list[str]:
    """Limit rules on the same figure share one subject: 'el monto de USD 12.400 supera A y B'."""
    out: list[str] = []
    i = 0
    while i < len(hits):
        pair = _pair(hits[i]) if _is_limit_rule(hits[i]) else None
        if pair is None:
            out.append(hit_text(hits[i]))
            i += 1
            continue
        key, observed, _ = pair
        group = [hits[i]]
        i += 1
        while i < len(hits) and (p := _pair(hits[i])) and _is_limit_rule(hits[i]) and p[0] == key and p[1] == observed:
            group.append(hits[i])
            i += 1
        tails = []
        for h in group:
            _, _, limit = _pair(h)
            tails.append((_verb(observed, limit), f"el {_lower_first(h.rule_name)} de {_value(key, limit)}"))
        parts, last_verb = [], None
        for verb, rest in tails:
            parts.append(rest if verb == last_verb else f"{verb} {rest}")
            last_verb = verb
        out.append(f"{_label(key)} de {_value(key, observed)} {_join_and(parts)}")
    return out


def template_explanation(decision: Decision) -> str:
    fired = _fired(decision)
    head = _HEADLINE[decision.outcome]
    if not fired:
        return f"{head}: ninguna regla se disparó."
    missing = [h for h in fired if h.result is HitResult.MISSING_DATA]
    rest = [h for h in fired if h.result is HitResult.FIRED]
    if missing:
        rest = [h for h in rest if not set(map(_column, h.observed)) <= _REDUNDANT_WHEN_MISSING]
    parts = ([_missing_sentence(missing)] if missing else []) + _clauses(rest)
    return f"{head}: {'; '.join(parts)}."


def decision_prompt(decision: Decision, invoice_summary: str) -> str:
    lines = [f"Factura: {invoice_summary}", f"Decisión del agente: {_HEADLINE[decision.outcome]}"]
    fired = _fired(decision)
    if fired:
        lines.append("Reglas disparadas:")
        lines += [f"- [{h.effect.value}] {hit_text(h)}" for h in fired]
    else:
        lines.append("Ninguna regla se disparó.")
    overridden = [h for h in decision.hits if h.result is HitResult.OVERRIDDEN]
    if overridden:
        lines.append("Reglas anuladas por una excepción:")
        lines += [f"- {hit_text(h)}" for h in overridden]
    return "\n".join(lines)
