from types import SimpleNamespace

from google.genai import types

from payagent.api.schemas import ConditionView, DraftResponse, InvoiceSummary, RuleDraft, VendorView
from payagent.app.chat import FAILED, MAX_TURNS, ChatService


def call(tool, **args):
    return [types.Part(function_call=types.FunctionCall(name=tool, args=args))]


def say(text):
    return [types.Part.from_text(text=text)]


class FakeClient:
    def __init__(self, turns):
        self._turns = list(turns)
        self.sent = []
        self.models = self

    def generate_content(self, *, model, contents, config):
        self.sent.append(list(contents))
        parts = self._turns.pop(0)
        return SimpleNamespace(
            candidates=[SimpleNamespace(content=types.Content(role="model", parts=parts))],
            usage_metadata=SimpleNamespace(prompt_token_count=10, candidates_token_count=5),
        )


class FakeOps:
    def __init__(self):
        self.started, self.finished = [], []

    def start(self, type, invoice_id=None):
        self.started.append(type)
        return "op1"

    def finish(self, operation_id, error=None):
        self.finished.append((operation_id, error))


class FakeMeter:
    def __init__(self):
        self.calls = []

    def record(self, *args):
        self.calls.append(args)


def summary(n="F-1"):
    return InvoiceSummary(id="i-" + n, status="DECIDED", state="WAITING", vendor_name="Servicios Cloud", invoice_number=n,
                          amount=10.0, currency="USD", amount_usd=10.0, received_at="2026-01-01T00:00:00Z",
                          source="UPLOAD", outcome="ESCALATE", decision_status="PENDING_HUMAN", headline=None,
                          decided_by="AGENT")


VENDOR = VendorView(id="v1", name="Servicios Cloud", tax_id="900", country="CO", currency="COP", bank_rail="ACH",
                    bank_account="1", status="ALLOWED", purchase_orders=[], invoices=2, paid_usd=0.0)
DRAFT = RuleDraft(name="Tope", natural_language="n", effect="ESCALATE", overridable=True, conditions=[
    ConditionView(source="invoice", column="amount_usd", operator="GT", value=8000, text="x")])


class FakeQueries:
    def __init__(self):
        self.searched = []

    def search_invoices(self, text, limit=10):
        self.searched.append(text)
        return [summary("F-1"), summary("F-2")]

    def pending_invoices(self, limit=10):
        return [summary("F-3")]

    def vendors_by_id(self, ids):
        return [VENDOR] if "v1" in ids else []


class FakeDrafter:
    def __init__(self, response):
        self.response, self.texts = response, []

    def draft(self, text):
        self.texts.append(text)
        return self.response


def service(turns, drafter=None):
    client, ops, meter, queries = FakeClient(turns), FakeOps(), FakeMeter(), FakeQueries()
    svc = ChatService(client, drafter or FakeDrafter(DraftResponse(draft=DRAFT, error=None)), queries,
                      lambda text, limit=5: [{"id": "v1"}] if "cloud" in text.lower() else [], meter, ops)
    return svc, client, ops, meter, queries


def test_pending_becomes_invoice_cards_and_is_metered():
    svc, client, ops, meter, _ = service([call("pendientes"), say("Tienes una factura pendiente.")])
    out = svc.reply("¿qué tengo pendiente?")
    assert out.text == "Tienes una factura pendiente."
    assert [c.kind for c in out.cards] == ["invoice"] and out.cards[0].invoice.invoice_number == "F-3"
    assert ops.started == ["CHAT"] and ops.finished == [("op1", None)]
    assert len(meter.calls) == 2 and all(c[1] == "CHAT" for c in meter.calls)


def test_search_vendor_and_invoices_in_one_turn():
    svc, client, *_, queries = service([
        [*call("buscar_proveedor", texto="Cloud"), *call("buscar_factura", texto="Cloud")],
        say("Encontré el proveedor y dos facturas."),
    ])
    out = svc.reply("busca Servicios Cloud")
    assert [c.kind for c in out.cards] == ["vendor", "invoice", "invoice"]
    assert queries.searched == ["Cloud"]
    replies = client.sent[1][-1].parts
    assert len(replies) == 2 and replies[0].function_response.response["proveedores"][0]["nombre"] == "Servicios Cloud"


def test_rule_draft_card_never_saves():
    drafter = FakeDrafter(DraftResponse(draft=DRAFT, error=None))
    svc, client, *_ = service([call("redactar_regla", texto="no más de 8 mil"), say("Revisa el borrador.")], drafter)
    out = svc.reply("no paguen más de 8 mil dólares sin mi aprobación")
    assert drafter.texts == ["no más de 8 mil"]
    assert out.cards[0].kind == "rule_draft" and out.cards[0].rule_draft.name == "Tope"
    assert client.sent[1][-1].parts[0].function_response.response == {"borrador": "Tope", "guardado": False}


def test_draft_error_goes_back_to_model_without_card():
    drafter = FakeDrafter(DraftResponse(draft=None, error="Falta la fuente"))
    svc, client, *_ = service([call("redactar_regla", texto="x"), say("No puedo redactarla.")], drafter)
    out = svc.reply("x")
    assert out.cards == []
    assert client.sent[1][-1].parts[0].function_response.response == {"error": "Falta la fuente"}


def test_refusal_needs_no_tool():
    svc, *_ = service([say("Solo puedo recibir facturas, crear reglas y buscar facturas o proveedores.")])
    out = svc.reply("¿qué hora es en Tokio?")
    assert out.cards == [] and "Solo puedo" in out.text


def test_unknown_tool_is_rejected_not_executed():
    svc, client, *_ = service([call("aprobar_factura", id="1"), say("No puedo.")])
    out = svc.reply("aprueba la factura")
    assert out.cards == []
    assert "error" in client.sent[1][-1].parts[0].function_response.response


def test_turn_limit_and_failure_fallback():
    svc, client, ops, *_ = service([call("pendientes")] * MAX_TURNS)
    assert svc.reply("x").text == FAILED and len(client.sent) == MAX_TURNS
    broken, _, ops2, *_ = service([])  # empty script: the fake raises IndexError
    assert broken.reply("x").text == FAILED and ops2.finished[0][1]
