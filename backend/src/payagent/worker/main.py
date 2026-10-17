import logging
import mimetypes
import time
from collections.abc import Callable
from pathlib import Path

from payagent.adapters.email.imap_source import ImapInvoiceSource
from payagent.adapters.email.smtp_notifier import SmtpNotifier
from payagent.adapters.postgres import PostgresHeartbeat, PostgresNotifications
from payagent.adapters.upload.storage import FileStorage
from payagent.app.process_invoice import process_invoice
from payagent.app.wiring import build_pipeline
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument, SourceType

log = logging.getLogger("payagent.worker")

PROCESSED_DIR = "processed"


def poll_inbox(inbox: Path, handle: Callable[[IncomingDocument], None]) -> int:
    """Hand every file dropped in `inbox` to `handle`, then move it to inbox/processed/."""
    if not inbox.is_dir():
        return 0
    done = inbox / PROCESSED_DIR
    count = 0
    for path in sorted(p for p in inbox.iterdir() if p.is_file() and not p.name.startswith(".")):
        content_type = mimetypes.guess_type(path.name)[0] or "text/plain"
        handle(IncomingDocument(SourceType.INBOX, f"inbox:{path.name}", path.name, content_type, path.read_bytes()))
        done.mkdir(exist_ok=True)
        target = done / path.name
        if target.exists():
            target = done / f"{int(time.time())}-{path.name}"
        path.replace(target)
        count += 1
    return count


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not (settings.gmail_address and settings.gmail_app_password):
        raise SystemExit("GMAIL_ADDRESS and GMAIL_APP_PASSWORD are required for the worker")

    storage = FileStorage(settings.storage_dir)
    pipeline = build_pipeline()
    notifications = PostgresNotifications()
    heartbeat = PostgresHeartbeat()
    notifier = SmtpNotifier(settings.gmail_address, settings.gmail_app_password, settings.approver_email)
    source = ImapInvoiceSource(settings.gmail_address, settings.gmail_app_password)

    def handle(doc: IncomingDocument) -> None:
        result = process_invoice(
            doc, storage, pipeline, notifier, settings.public_base_url, notifications, settings.approver_email
        )
        if result:
            log.info("%s from %s -> %s", doc.filename, doc.email.sender if doc.email else doc.source_ref, result.outcome)

    log.info("polling %s every %ss, watching %s", settings.gmail_address, settings.imap_poll_seconds, settings.inbox_dir)
    while True:
        try:
            source.poll(handle)
            ok = True
        except Exception:
            log.exception("imap poll failed")
            ok = False
        try:
            heartbeat.beat(ok)
        except Exception:
            log.exception("heartbeat failed")
        try:
            poll_inbox(Path(settings.inbox_dir), handle)
        except Exception:
            log.exception("inbox poll failed")
        time.sleep(settings.imap_poll_seconds)


if __name__ == "__main__":
    main()
