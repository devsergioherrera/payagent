import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from payagent.adapters.upload.storage import FileStorage
from payagent.domain.decision import Outcome
from payagent.ports.invoice_source import IncomingDocument
from payagent.ports.notifier import Notifier

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoredDocument:
    doc: IncomingDocument
    sha256: str
    path: Path


@dataclass(frozen=True)
class ProcessedInvoice:
    invoice_id: str | None
    outcome: Outcome
    explanation: str
    vendor: str | None = None
    amount: str | None = None
    currency: str | None = None
    amount_usd: str | None = None
    rule: str | None = None  # the rule that decided it


class AlreadyProcessed(Exception):
    """The same file was already decided (idempotency, NFR-4). Unreadable ones may be retried."""


class InvoicePipeline(Protocol):
    """Extract -> evaluate rules -> persist -> explain. Same for email, upload and inbox/."""

    def run(self, stored: StoredDocument) -> ProcessedInvoice: ...


class NotificationLog(Protocol):
    def record(
        self,
        invoice_id: str | None,
        kind: Literal["ESCALATION", "REPLY"],
        recipient: str,
        status: Literal["SENT", "FAILED"],
        error: str | None = None,
    ) -> None: ...


def process_invoice(
    doc: IncomingDocument,
    storage: FileStorage,
    pipeline: InvoicePipeline,
    notifier: Notifier,
    public_base_url: str,
    notifications: NotificationLog | None = None,
    approver_email: str = "",
) -> ProcessedInvoice | None:
    """Returns None when the exact same file was already decided (idempotency, NFR-4)."""
    stored = storage.save(doc.content, doc.filename)
    try:
        result = pipeline.run(StoredDocument(doc, stored.sha256, stored.path))
    except AlreadyProcessed:
        log.info("skipping %s from %s: already processed", stored.sha256[:12], doc.source_ref)
        return None
    except Exception:
        # Fail-closed (invariant 5): anything unexpected becomes ESCALATE, never PAY.
        log.exception("pipeline failed for %s", doc.source_ref)
        result = ProcessedInvoice(
            invoice_id=None,
            outcome=Outcome.ESCALATE,
            explanation="Escalada: no se pudo procesar la factura automáticamente.",
        )

    link = f"{public_base_url.rstrip('/')}/facturas/{result.invoice_id}" if result.invoice_id else public_base_url

    def send(kind: Literal["ESCALATION", "REPLY"], recipient: str, fn, *args) -> None:
        error = _safely(fn, *args)
        if notifications:
            notifications.record(result.invoice_id, kind, recipient, "FAILED" if error else "SENT", error)

    if result.outcome is not Outcome.PAY:  # both ESCALATE and HOLD need a human
        send("ESCALATION", approver_email, notifier.notify_escalation, _escalation_subject(result), _escalation_body(result, doc, link))
    if doc.email:
        send("REPLY", doc.email.sender, notifier.reply_to_sender, doc.email, _reply_body(result, link))
    return result


def _safely(send, *args) -> str | None:
    """RF-07.3: a mail failure never blocks or changes the decision. Returns the error text, if any."""
    try:
        send(*args)
    except Exception as exc:
        log.exception("notification failed")
        return str(exc)[:500] or type(exc).__name__
    return None


def _escalation_subject(result: ProcessedInvoice) -> str:
    tag = "[Frenada]" if result.outcome is Outcome.HOLD else "[Escalada]"
    vendor = result.vendor or "proveedor desconocido"
    return f"{tag} {vendor} · {result.amount or '?'} {result.currency or ''}".strip()


def _escalation_body(result: ProcessedInvoice, doc: IncomingDocument, link: str) -> str:
    amount_usd = f"USD {result.amount_usd}" if result.amount_usd else "—"
    return (
        f"Proveedor: {result.vendor or '—'}\n"
        f"Monto: {result.amount or '—'} {result.currency or ''}\n"
        f"Monto en USD: {amount_usd}\n"
        f"Regla que decidió: {result.rule or '—'}\n"
        f"Origen: {doc.source_type} ({doc.filename})\n\n"
        f"Motivo: {result.explanation}\n\n"
        f"Revisar: {link}\n"
    )


_OUTCOME_LABEL = {
    Outcome.PAY: "PAGAR",
    Outcome.HOLD: "FRENAR",
    Outcome.ESCALATE: "ESCALAR (pendiente de aprobación humana)",
}


def _reply_body(result: ProcessedInvoice, link: str) -> str:
    return f"Decisión: {_OUTCOME_LABEL[result.outcome]}\n\n{result.explanation}\n\nDetalle: {link}\n"
