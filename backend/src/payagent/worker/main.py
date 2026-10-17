import logging
import time

from payagent.adapters.email.imap_source import ImapInvoiceSource
from payagent.adapters.email.smtp_notifier import SmtpNotifier
from payagent.adapters.upload.storage import FileStorage
from payagent.app.process_invoice import InvoicePipeline, ProcessedInvoice, StoredDocument, process_invoice
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument

log = logging.getLogger("payagent.worker")


class PipelineNotWired:
    """Placeholder until block B (extractor + engine + Postgres) lands.

    Raising makes process_invoice fail closed, so every mailed invoice is answered
    with ESCALATE and the approver gets the escalation mail: the email loop is testable today.
    """

    def run(self, stored: StoredDocument) -> ProcessedInvoice:
        raise NotImplementedError("extract -> evaluate -> persist is not wired yet")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not (settings.gmail_address and settings.gmail_app_password):
        raise SystemExit("GMAIL_ADDRESS and GMAIL_APP_PASSWORD are required for the worker")

    storage = FileStorage(settings.storage_dir)
    pipeline: InvoicePipeline = PipelineNotWired()
    notifier = SmtpNotifier(settings.gmail_address, settings.gmail_app_password, settings.approver_email)
    source = ImapInvoiceSource(settings.gmail_address, settings.gmail_app_password)

    def handle(doc: IncomingDocument) -> None:
        result = process_invoice(doc, storage, pipeline, notifier, settings.public_base_url)
        if result:
            log.info("%s from %s -> %s", doc.filename, doc.email.sender if doc.email else doc.source_ref, result.outcome)

    log.info("polling %s every %ss", settings.gmail_address, settings.imap_poll_seconds)
    while True:
        try:
            source.poll(handle)
        except Exception:
            log.exception("imap poll failed")
        time.sleep(settings.imap_poll_seconds)


if __name__ == "__main__":
    main()
