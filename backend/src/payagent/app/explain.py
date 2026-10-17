from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit

_HEADLINE = {Outcome.PAY: "Pagada", Outcome.HOLD: "Frenada", Outcome.ESCALATE: "Escalada"}
_COUNTED = (HitResult.FIRED, HitResult.MISSING_DATA)


def _fmt(value: object) -> str:
    return "sin dato" if value is None else str(value)


def _detail(hit: RuleHit) -> str:
    if hit.result is HitResult.MISSING_DATA:
        return f"{hit.rule_name} (falta un dato: {', '.join(hit.observed) or 'desconocido'})"
    observed = ", ".join(f"{k} {_fmt(v)}" for k, v in hit.observed.items())
    limit = ", ".join(f"{k} {_fmt(v)}" for k, v in hit.threshold.items())
    return f"{hit.rule_name} (observado {observed}, límite {limit})"


def _fired(decision: Decision) -> list[RuleHit]:
    return [h for h in decision.hits if h.result in _COUNTED]


def template_explanation(decision: Decision) -> str:
    fired = _fired(decision)
    head = _HEADLINE[decision.outcome]
    if not fired:
        return f"{head}: ninguna regla se disparó."
    return f"{head} por: {'; '.join(_detail(h) for h in fired)}."


def decision_prompt(decision: Decision, invoice_summary: str) -> str:
    lines = [f"Factura: {invoice_summary}", f"Decisión del agente: {_HEADLINE[decision.outcome]}"]
    fired = _fired(decision)
    if fired:
        lines.append("Reglas disparadas:")
        lines += [f"- [{h.effect.value}] {_detail(h)}" for h in fired]
    else:
        lines.append("Ninguna regla se disparó.")
    overridden = [h for h in decision.hits if h.result is HitResult.OVERRIDDEN]
    if overridden:
        lines.append("Reglas anuladas por una excepción:")
        lines += [f"- {_detail(h)}" for h in overridden]
    return "\n".join(lines)
