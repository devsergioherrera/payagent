import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

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


class InvoicePipeline(Protocol):
    """Extract -> evaluate rules -> persist -> explain. Same for email, upload and inbox/."""

    def run(self, stored: StoredDocument) -> ProcessedInvoice: ...


def process_invoice(
    doc: IncomingDocument,
    storage: FileStorage,
    pipeline: InvoicePipeline,
    notifier: Notifier,
    public_base_url: str,
) -> ProcessedInvoice | None:
    """Returns None when the exact same file was already processed (idempotency, NFR-4)."""
    stored = storage.save(doc.content, doc.filename)
    if not stored.is_new:
        log.info("skipping %s from %s: already processed", stored.sha256[:12], doc.source_ref)
        return None

    try:
        result = pipeline.run(StoredDocument(doc, stored.sha256, stored.path))
    except Exception:
        # Fail-closed (invariant 5): anything unexpected becomes ESCALATE, never PAY.
        log.exception("pipeline failed for %s", doc.source_ref)
        result = ProcessedInvoice(
            invoice_id=None,
            outcome=Outcome.ESCALATE,
            explanation="Escalada: no se pudo procesar la factura automáticamente.",
        )

    link = f"{public_base_url.rstrip('/')}/facturas/{result.invoice_id}" if result.invoice_id else public_base_url

    if result.outcome is Outcome.ESCALATE:
        _safely(notifier.notify_escalation, _escalation_subject(result), _escalation_body(result, doc, link))
    if doc.email:
        _safely(notifier.reply_to_sender, doc.email, _reply_body(result, link))
    return result


def _safely(send, *args) -> None:
    # RF-07.3: a mail failure never blocks or changes the decision.
    try:
        send(*args)
    except Exception:
        log.exception("notification failed")


def _escalation_subject(result: ProcessedInvoice) -> str:
    vendor = result.vendor or "proveedor desconocido"
    return f"[Escalada] {vendor} · {result.amount or '?'} {result.currency or ''}".strip()


def _escalation_body(result: ProcessedInvoice, doc: IncomingDocument, link: str) -> str:
    return (
        f"Proveedor: {result.vendor or '—'}\n"
        f"Monto: {result.amount or '—'} {result.currency or ''}\n"
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
