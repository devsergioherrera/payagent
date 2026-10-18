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

    def reply_to_sender(self, origin, body, html=None):
        if self.fail:
            raise OSError("smtp down")
        self.replies.append((origin, body))

    def notify_escalation(self, subject, body, html=None):
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


class FakeLog:
    def __init__(self):
        self.rows: list[tuple] = []

    def record(self, invoice_id, kind, recipient, status, error=None):
        self.rows.append((invoice_id, kind, recipient, status, error))


def _process(outcome, notifier, log, tmp_path):
    return process_invoice(_doc(), FileStorage(tmp_path), FixedPipeline(outcome), notifier, "http://x", log, "boss@x.test")


def test_every_mail_is_logged_with_recipient_and_status(tmp_path):
    log = FakeLog()
    _process(Outcome.ESCALATE, FakeNotifier(), log, tmp_path)
    assert log.rows == [
        ("inv-1", "ESCALATION", "boss@x.test", "SENT", None),
        ("inv-1", "REPLY", "ap@vendor.test", "SENT", None),
    ]


def test_failed_mail_is_logged_with_its_error(tmp_path):
    log = FakeLog()
    _process(Outcome.ESCALATE, FakeNotifier(fail=True), log, tmp_path)
    assert [r[3] for r in log.rows] == ["FAILED", "FAILED"]
    assert "smtp down" in log.rows[0][4]


def test_hold_is_final_no_approver_mail_but_sender_is_answered(tmp_path):
    notifier, log = FakeNotifier(), FakeLog()
    _process(Outcome.HOLD, notifier, log, tmp_path)
    assert notifier.escalations == []
    assert [r[1] for r in log.rows] == ["REPLY"]


def test_escalate_subject_asks_for_approval(tmp_path):
    notifier = FakeNotifier()
    _process(Outcome.ESCALATE, notifier, FakeLog(), tmp_path)
    assert notifier.escalations[0].startswith("[Escalada]")


def test_escalation_body_has_the_facts_a_human_needs(tmp_path):
    from payagent.app.process_invoice import _escalation_body

    result = ProcessedInvoice("inv-1", Outcome.ESCALATE, "Escalada: algo.", "Acme", "500", "EUR", "540.00", "Límite por pago")
    body = _escalation_body(result, _doc(), "http://x/facturas/inv-1")
    for expected in ("Acme", "500 EUR", "USD 540.00", "Límite por pago", "Escalada: algo.", "http://x/facturas/inv-1"):
        assert expected in body


def test_paid_invoice_sends_no_escalation(tmp_path):
    log = FakeLog()
    _process(Outcome.PAY, FakeNotifier(), log, tmp_path)
    assert [r[1] for r in log.rows] == ["REPLY"]


def test_inbox_files_are_handled_in_order_and_moved(tmp_path):
    from payagent.ports.invoice_source import SourceType
    from payagent.worker.main import poll_inbox

    (tmp_path / "b.txt").write_text("two")
    (tmp_path / "a.pdf").write_bytes(b"%PDF")
    (tmp_path / ".hidden").write_text("x")
    seen = []
    assert poll_inbox(tmp_path, seen.append) == 2
    assert [d.filename for d in seen] == ["a.pdf", "b.txt"]
    assert seen[0].source_type is SourceType.INBOX and seen[0].content_type == "application/pdf"
    assert sorted(p.name for p in (tmp_path / "processed").iterdir()) == ["a.pdf", "b.txt"]
    assert poll_inbox(tmp_path, seen.append) == 0


def test_emails_come_as_text_and_branded_html():
    from payagent.app.email_templates import escalation_email, reply_email

    result = ProcessedInvoice("inv-1", Outcome.HOLD, "Frenada: <duplicada>.", "Acme", "500", "EUR", "540.00", "Duplicado exacto")
    text, html = escalation_email(result, _doc(), "http://x/facturas/inv-1")
    assert "Esta factura fue frenada porque la regla que decidió fue **Duplicado exacto**" in text
    assert text.index("Duplicado exacto") < text.index("Acme") and "ID de factura: inv-1" in text and "Tercero: Acme" in text
    assert "<strong>Duplicado exacto</strong>" in html
    assert "<table" in html and "Frenar" in html and "&lt;duplicada&gt;" in html and 'href="http://x/facturas/inv-1"' in html
    assert reply_email(result, "http://x/f")[0].startswith("FacturaYa · Factura frenada")
