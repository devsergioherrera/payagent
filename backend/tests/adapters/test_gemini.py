from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from payagent.adapters.gemini import _call
from payagent.adapters.gemini.explainer import GeminiExplainer
from payagent.adapters.gemini.extractor import GeminiExtractor


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(_call.time, "sleep", lambda _s: None)


class FakeMeter:
    def __init__(self, fail=False):
        self.calls, self.fail = [], fail

    def record(self, *args):
        self.calls.append(args)
        if self.fail:
            raise RuntimeError("db down")


class FakeClient:
    def __init__(self, text, errors=0):
        self.errors, self.text, self.requests = errors, text, []
        self.models = SimpleNamespace(generate_content=self._gen)

    def _gen(self, **kwargs):
        self.requests.append(kwargs)
        if self.errors:
            self.errors -= 1
            raise ConnectionError("boom")
        return SimpleNamespace(
            text=self.text,
            parsed=None,
            usage_metadata=SimpleNamespace(prompt_token_count=11, candidates_token_count=7),
        )


FULL = """{"vendor_name": " ACME SAS ", "vendor_tax_id": "900.123.456-7", "invoice_number": "F-1",
"amount": "12,400.50", "currency": "usd", "issue_date": "2026-01-05", "due_date": "bad",
"po_number": null, "bank_account": "ES91 2100-0418", "confidence": 1.7}"""


def test_extract_normalizes_and_meters():
    meter, client = FakeMeter(), FakeClient(FULL)
    inv = GeminiExtractor(client, meter).extract(b"hello", "text/plain", "op1")
    assert inv.vendor_name_raw == "ACME SAS"
    assert inv.vendor_tax_id == "9001234567"
    assert inv.bank_account == "ES9121000418"
    assert inv.amount == Decimal("12400.50")
    assert inv.currency == "USD"
    assert inv.issue_date == date(2026, 1, 5)
    assert inv.due_date is None
    assert inv.po_number is None
    assert inv.confidence == 1.0
    op, purpose, model, tin, tout, _ms = meter.calls[0]
    assert (op, purpose, model, tin, tout) == ("op1", "EXTRACT", "gemini-3.8-flash", 11, 7)


def test_extract_all_null():
    inv = GeminiExtractor(FakeClient("{}"), FakeMeter()).extract(b"%PDF", "application/pdf", "op")
    assert inv.amount is None and inv.currency is None and inv.vendor_tax_id is None
    assert inv.confidence == 0.0


def test_pdf_is_sent_inline_with_mime_type():
    client = FakeClient("{}")
    GeminiExtractor(client, FakeMeter()).extract(b"%PDF", "application/pdf", "op")
    part = client.requests[0]["contents"][1]
    assert part.inline_data.mime_type == "application/pdf"


def test_retry_once_then_succeeds():
    client = FakeClient("{}", errors=1)
    GeminiExtractor(client, FakeMeter()).extract(b"x", "text/plain", "op")
    assert len(client.requests) == 2


def test_retry_once_then_raises():
    client = FakeClient("{}", errors=5)
    with pytest.raises(ConnectionError):
        GeminiExtractor(client, FakeMeter()).extract(b"x", "text/plain", "op")
    assert len(client.requests) == 2


def test_metering_failure_does_not_break_extraction():
    inv = GeminiExtractor(FakeClient(FULL), FakeMeter(fail=True)).extract(b"x", "text/plain", "op")
    assert inv.invoice_number == "F-1"


def test_explainer_returns_text_and_meters():
    meter = FakeMeter()
    out = GeminiExplainer(FakeClient("  Escalada por límite.  "), meter).explain("prompt", "op2")
    assert out == "Escalada por límite."
    assert meter.calls[0][1] == "EXPLAIN"


def test_explainer_empty_raises():
    with pytest.raises(ValueError):
        GeminiExplainer(FakeClient(""), FakeMeter()).explain("p", "op")
