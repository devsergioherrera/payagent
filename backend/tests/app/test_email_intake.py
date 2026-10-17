from email.message import EmailMessage

from payagent.adapters.email.imap_source import documents_from_message
from payagent.adapters.upload.storage import FileStorage
from payagent.app.process_invoice import AlreadyProcessed, ProcessedInvoice, StoredDocument, process_invoice
from payagent.domain.decision import Outcome
from payagent.ports.invoice_source import EmailOrigin


def _mail(body: str = "", attachments: list[tuple[str, str, bytes]] = ()) -> bytes:
    msg = EmailMessage()
    msg["From"] = "Vendor <ap@vendor.test>"
    msg["To"] = "invoices@facturaya.test"
    msg["Subject"] = "Invoice 123"
    msg["Message-ID"] = "<abc@vendor.test>"
    msg.set_content(body)
    for name, mime, data in attachments:
        maintype, subtype = mime.split("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=name)
    return msg.as_bytes()


def test_each_pdf_or_image_attachment_is_one_document():
    raw = _mail("see attached", [("a.pdf", "application/pdf", b"%PDF"), ("b.png", "image/png", b"PNG"), ("x.zip", "application/zip", b"PK")])
    docs = documents_from_message("7", raw)
    assert [d.filename for d in docs] == ["a.pdf", "b.png"]
    assert docs[0].email == EmailOrigin("<abc@vendor.test>", "ap@vendor.test", "Invoice 123")
    assert docs[0].source_ref == "imap:7"


def test_body_is_the_invoice_when_there_are_no_attachments():
    docs = documents_from_message("8", _mail("Invoice 123 from Acme, total 500 USD"))
    assert len(docs) == 1
    assert docs[0].content_type == "text/plain"
    assert b"500 USD" in docs[0].content


def test_octet_stream_pdf_is_detected_by_extension():
    docs = documents_from_message("9", _mail("", [("inv.PDF", "application/octet-stream", b"%PDF")]))
    assert docs[0].content_type == "application/pdf"


class FakeNotifier:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.replies: list[tuple[EmailOrigin, str]] = []
        self.escalations: list[str] = []

    def reply_to_sender(self, origin, body):
        if self.fail:
            raise OSError("smtp down")
        self.replies.append((origin, body))

    def notify_escalation(self, subject, body):
        if self.fail:
            raise OSError("smtp down")
        self.escalations.append(subject)


class FixedPipeline:
    def __init__(self, outcome: Outcome):
        self.outcome = outcome
        self.calls: list[StoredDocument] = []

    def run(self, stored):
        if any(c.sha256 == stored.sha256 for c in self.calls):
            raise AlreadyProcessed(stored.sha256)
        self.calls.append(stored)
        return ProcessedInvoice("inv-1", self.outcome, "Todo en regla.", "Acme", "500", "USD")


class BrokenPipeline:
    def run(self, stored):
        raise RuntimeError("gemini timeout")


def _doc():
    return documents_from_message("1", _mail("", [("a.pdf", "application/pdf", b"%PDF-1")]))[0]


def test_same_file_twice_is_processed_once(tmp_path):
    pipeline, notifier = FixedPipeline(Outcome.PAY), FakeNotifier()
    storage = FileStorage(tmp_path)
    assert process_invoice(_doc(), storage, pipeline, notifier, "http://x") is not None
    assert process_invoice(_doc(), storage, pipeline, notifier, "http://x") is None
    assert len(pipeline.calls) == 1
    assert len(notifier.replies) == 1


def test_mailed_invoice_gets_reply_in_thread_with_decision(tmp_path):
    notifier = FakeNotifier()
    process_invoice(_doc(), FileStorage(tmp_path), FixedPipeline(Outcome.PAY), notifier, "http://x")
    origin, body = notifier.replies[0]
    assert origin.message_id == "<abc@vendor.test>"
    assert "PAGAR" in body and "http://x/facturas/inv-1" in body
    assert notifier.escalations == []


def test_pipeline_crash_fails_closed_to_escalate(tmp_path):
    notifier = FakeNotifier()
    result = process_invoice(_doc(), FileStorage(tmp_path), BrokenPipeline(), notifier, "http://x")
    assert result.outcome is Outcome.ESCALATE
    assert len(notifier.escalations) == 1
    assert "ESCALAR" in notifier.replies[0][1]


def test_mail_failure_does_not_block_the_decision(tmp_path):
    result = process_invoice(_doc(), FileStorage(tmp_path), FixedPipeline(Outcome.ESCALATE), FakeNotifier(fail=True), "http://x")
    assert result.outcome is Outcome.ESCALATE


def test_own_and_machine_senders_are_skipped():
    from payagent.adapters.email.imap_source import is_automated_sender

    own = "facturaya.pagos@gmail.com"
    assert is_automated_sender("no-reply@accounts.google.com", own)
    assert is_automated_sender("MAILER-DAEMON@googlemail.com", own)
    assert is_automated_sender("Facturaya.Pagos@gmail.com", own)
    assert not is_automated_sender("ap@vendor.test", own)
