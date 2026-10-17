import imaplib
import logging
from collections.abc import Callable
from email import message_from_bytes, policy
from email.message import EmailMessage
from email.utils import parseaddr

from payagent.ports.invoice_source import EmailOrigin, IncomingDocument, SourceType

log = logging.getLogger(__name__)

INVOICE_TYPES = {"application/pdf", "image/png", "image/jpeg"}


def documents_from_message(uid: str, raw: bytes) -> list[IncomingDocument]:
    """Each PDF/image attachment is one invoice; with none, the body text is the invoice (RF-01.3)."""
    msg = message_from_bytes(raw, policy=policy.default)
    assert isinstance(msg, EmailMessage)
    origin = EmailOrigin(
        message_id=msg.get("Message-ID", ""),
        sender=parseaddr(msg.get("Reply-To") or msg.get("From", ""))[1],
        subject=msg.get("Subject", ""),
    )
    ref = f"imap:{uid}"

    docs = []
    for part in msg.iter_attachments():
        content_type = part.get_content_type()
        if content_type == "application/octet-stream":
            content_type = _type_from_name(part.get_filename() or "")
        if content_type not in INVOICE_TYPES:
            continue
        docs.append(
            IncomingDocument(
                source_type=SourceType.EMAIL,
                source_ref=ref,
                filename=part.get_filename() or f"{uid}-{len(docs)}",
                content_type=content_type,
                content=part.get_payload(decode=True) or b"",
                email=origin,
            )
        )
    if docs:
        return docs

    body = msg.get_body(preferencelist=("plain", "html"))
    text = body.get_content().strip() if body else ""
    if not text:
        return []
    return [
        IncomingDocument(
            source_type=SourceType.EMAIL,
            source_ref=ref,
            filename=f"{uid}.txt",
            content_type="text/plain",
            content=text.encode(),
            email=origin,
        )
    ]


def _type_from_name(filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith(".png"):
        return "image/png"
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return "application/octet-stream"


class ImapInvoiceSource:
    """Reads UNSEEN mail from the dedicated Gmail inbox.

    Fetches with BODY.PEEK so nothing is marked read until every document of the
    message was handled. A crash means the message is retried next poll; the file
    hash in process_invoice keeps that retry from creating a second invoice.
    """

    def __init__(self, address: str, app_password: str, host: str = "imap.gmail.com") -> None:
        self.address = address
        self.app_password = app_password
        self.host = host

    def poll(self, handle: Callable[[IncomingDocument], None]) -> int:
        handled = 0
        with imaplib.IMAP4_SSL(self.host) as imap:
            imap.login(self.address, self.app_password)
            imap.select("INBOX")
            _, data = imap.uid("SEARCH", None, "UNSEEN")
            for uid in data[0].decode().split():
                _, fetched = imap.uid("FETCH", uid, "(BODY.PEEK[])")
                raw = fetched[0][1]
                try:
                    if self._should_skip(raw):
                        docs = []
                    else:
                        docs = documents_from_message(uid, raw)
                    for doc in docs:
                        handle(doc)
                        handled += 1
                except Exception:
                    log.exception("imap message %s failed, will retry next poll", uid)
                    continue
                imap.uid("STORE", uid, "+FLAGS", "(\\Seen)")
        return handled

    def _should_skip(self, raw: bytes) -> bool:
        msg = message_from_bytes(raw, policy=policy.default)
        return is_automated_sender(parseaddr(msg.get("From", ""))[1], self.address)


AUTOMATED_MARKERS = ("no-reply", "noreply", "donotreply", "do-not-reply", "mailer-daemon", "postmaster")


def is_automated_sender(sender: str, own_address: str) -> bool:
    """Our own mail and machine senders are never invoices; answering them would loop."""
    sender = sender.lower()
    local = sender.split("@")[0]
    return sender == own_address.lower() or any(m in local for m in AUTOMATED_MARKERS)
