"""Plain-text and HTML bodies for the emails the agent sends. Pure functions: no I/O, easy to test."""

from html import escape
from typing import TYPE_CHECKING

from payagent.domain.decision import Outcome

if TYPE_CHECKING:
    from payagent.app.process_invoice import ProcessedInvoice
    from payagent.ports.invoice_source import IncomingDocument

BRAND = "#5B3DF5"
_TONE = {Outcome.PAY: "#2E9E68", Outcome.ESCALATE: "#C98A1B", Outcome.HOLD: "#D2453D"}
_LABEL = {Outcome.PAY: "Pagar", Outcome.ESCALATE: "Escalar", Outcome.HOLD: "Frenar"}
_HEADLINE = {
    Outcome.PAY: "Factura aprobada para pago",
    Outcome.ESCALATE: "Factura pendiente de tu aprobación",
    Outcome.HOLD: "Factura frenada",
}
_VERB = {Outcome.PAY: "pagada", Outcome.ESCALATE: "escalada", Outcome.HOLD: "frenada"}
_NOTE = {
    Outcome.PAY: "Todas las reglas se cumplieron.",
    Outcome.ESCALATE: "El agente no decide solo esta factura. Espera tu aprobación.",
    Outcome.HOLD: "Decisión final del agente: nadie la libera.",
}


def _amount(result: "ProcessedInvoice") -> str:
    base = f"{result.amount} {result.currency or ''}".strip() if result.amount else "—"
    return f"{base} (USD {result.amount_usd})" if result.amount_usd and result.currency != "USD" else base


def _lead(result: "ProcessedInvoice") -> tuple[str, str]:
    """(before, bold): 'Esta factura fue escalada porque la regla que decidió fue' + the rule name."""
    if result.rule:
        return f"Esta factura fue {_VERB[result.outcome]} porque la regla que decidió fue ", result.rule
    return f"Esta factura fue {_VERB[result.outcome]}.", ""


def _facts(result: "ProcessedInvoice", doc: "IncomingDocument | None" = None) -> list[tuple[str, str]]:
    rows = [("ID de factura", result.invoice_id or "—"), ("Tercero", result.vendor or "—"), ("Monto", _amount(result))]
    if doc:
        rows.append(("Origen", f"{doc.source_type} ({doc.filename})"))
    return rows


def _text(result: "ProcessedInvoice", link: str, cta: str, doc: "IncomingDocument | None" = None) -> str:
    facts = "\n".join(f"{k}: {v}" for k, v in _facts(result, doc))
    before, rule = _lead(result)
    lead = f"{before}**{rule}**" if rule else before
    return (
        f"FacturaYa · {_HEADLINE[result.outcome]}\n\n"
        f"{lead}\n{_NOTE[result.outcome]}\n\nDecisión: {_LABEL[result.outcome].upper()}\n"
        f"{facts}\n\n"
        f"Por qué:\n{result.explanation}\n\n"
        f"{cta}: {link}\n"
    )


def _html(result: "ProcessedInvoice", link: str, cta: str, doc: "IncomingDocument | None" = None) -> str:
    tone = _TONE[result.outcome]
    rows = "".join(
        f'<tr><td style="padding:8px 0;color:#6b6b78;width:42%">{escape(k)}</td>'
        f'<td style="padding:8px 0;font-weight:600;color:#0b0b0f">{escape(v)}</td></tr>'
        for k, v in _facts(result, doc)
    )
    why = escape(result.explanation).replace("\n", "<br>")
    before, rule = _lead(result)
    lead = escape(before) + (f"<strong>{escape(rule)}</strong>" if rule else "")
    return f"""<!doctype html>
<html><body style="margin:0;background:#f2f2f5;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:{BRAND};padding:18px 28px;color:#ffffff;font-size:18px;font-weight:700">FacturaYa</td></tr>
<tr><td style="padding:28px 28px 8px">
<span style="display:inline-block;background:{tone};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 12px;border-radius:999px">{_LABEL[result.outcome]}</span>
<h1 style="margin:14px 0 4px;font-size:22px;line-height:1.25;color:#0b0b0f">{_HEADLINE[result.outcome]}</h1>
<p style="margin:0 0 4px;font-size:16px;line-height:1.5;color:#0b0b0f">{lead}</p>
<p style="margin:0;color:#6b6b78;font-size:14px">{_NOTE[result.outcome]}</p>
</td></tr>
<tr><td style="padding:12px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e6e6ec;border-bottom:1px solid #e6e6ec">{rows}</table></td></tr>
<tr><td style="padding:8px 28px 4px"><p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b6b78">Por qué</p>
<p style="margin:0;font-size:15px;line-height:1.55;color:#0b0b0f">{why}</p></td></tr>
<tr><td style="padding:24px 28px 32px"><a href="{escape(link, quote=True)}" style="display:inline-block;background:{BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">{cta}</a></td></tr>
</table>
<p style="margin:14px 0 0;font-size:12px;color:#8a8a96">Enviado por el agente de pagos de FacturaYa</p>
</td></tr></table></body></html>"""


def escalation_email(result: "ProcessedInvoice", doc: "IncomingDocument", link: str) -> tuple[str, str]:
    return _text(result, link, "Revisar factura", doc), _html(result, link, "Revisar factura", doc)


def reply_email(result: "ProcessedInvoice", link: str) -> tuple[str, str]:
    return _text(result, link, "Ver el detalle"), _html(result, link, "Ver el detalle")
