from types import SimpleNamespace

import pytest
from google.genai import types

from payagent.app.draft_rule import NO_DRAFT, RuleDrafter
from payagent.ports.repositories import ColumnInfo, SourceInfo

SOURCES = [
    SourceInfo("invoice", "Factura", "La factura"),
    SourceInfo("vendor", "Proveedor", "El proveedor"),
    SourceInfo("po_check", "Orden de compra", "Chequeo de la orden"),
]
COLUMNS = {
    "invoice": [
        ColumnInfo("amount_usd", "number", "Monto en USD"),
        ColumnInfo("vendor_tax_id", "text", "NIT"),
        ColumnInfo("issue_date", "date", "Emisión"),
        ColumnInfo("country", "text", "País"),
    ],
    "vendor": [ColumnInfo("tax_id", "text", "NIT"), ColumnInfo("approved", "boolean", "Aprobado")],
    "po_check": [ColumnInfo("orden_encontrada", "boolean", "Hay orden"), ColumnInfo("desviacion_pct", "number", "%")],
}


class FakeCatalog:
    def list_sources(self):
        return SOURCES

    def describe_source(self, name):
        return COLUMNS[name]


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


def call(tool, **args):
    return [types.Part(function_call=types.FunctionCall(name=tool, args=args))]


def say(text):
    return [types.Part.from_text(text=text)]


class FakeClient:
    """Replays scripted model turns (lists of parts) and records what it was sent."""

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


def drafter(turns):
    client, ops, meter = FakeClient(turns), FakeOps(), FakeMeter()
    return RuleDrafter(client, FakeCatalog(), meter, ops), client, ops, meter


def rule(conditions, effect="ESCALATE", overridable=True, **extra):
    return call("redactar_regla", name="R", natural_language="n", effect=effect, overridable=overridable,
                conditions=conditions, **extra)


def cond(op, column="amount_usd", source="invoice", **kw):
    return {"source": source, "column": column, "operator": op, **kw}


def error_of(conditions, **kw):
    """Run a draft whose first redactar_regla is invalid; return the error text the model got back."""
    d, client, *_ = drafter([rule(conditions, **kw), say("no puedo")])
    d.draft("x")
    reply = client.sent[1][-1].parts[0].function_response.response
    assert "error" in reply
    return reply["error"]


def test_valid_draft_through_lookups():
    d, client, ops, meter = drafter([
        call("listar_fuentes"),
        call("describir_fuente", nombre="invoice"),
        rule([cond("GT", value=5000)]),
    ])
    out = d.draft("no paguen más de 5 mil dólares sin que yo apruebe")
    assert out.error is None
    assert out.draft.effect == "ESCALATE"
    c = out.draft.conditions[0]
    assert (c.source, c.column, c.operator, c.value) == ("invoice", "amount_usd", "GT", 5000.0)
    assert c.text == "Factura · monto en USD > 5.000"
    assert ops.started == ["RULE_DRAFT"] and ops.finished == [("op1", None)]
    assert len(meter.calls) == 3 and all(m[1] == "DRAFT_RULE" for m in meter.calls)
    sources = client.sent[1][-1].parts[0].function_response.response["fuentes"]
    assert [s["name"] for s in sources] == ["invoice", "vendor", "po_check"]


def test_invalid_column_then_fixed():
    d, client, *_ = drafter([rule([cond("GT", column="monto", value=5000)]), rule([cond("GT", value=5000)])])
    out = d.draft("x")
    assert out.error is None and out.draft.conditions[0].column == "amount_usd"
    assert "no column 'monto'" in client.sent[1][-1].parts[0].function_response.response["error"]


def test_gives_up_after_repeated_failures():
    bad = rule([cond("GT", column="monto", value=1)])
    d, _, ops, _ = drafter([bad, bad, bad])
    out = d.draft("x")
    assert out.draft is None and out.error == NO_DRAFT
    assert ops.finished == [("op1", None)]


def test_impossible_request_returns_model_reason():
    d, _, *_ = drafter([call("listar_fuentes"), say("No hay datos de inventario en las fuentes registradas.")])
    out = d.draft("no pagues si la mercancía no ha llegado")
    assert out.draft is None
    assert out.error == "No hay datos de inventario en las fuentes registradas."


def test_unknown_source_for_describe():
    d, client, *_ = drafter([call("describir_fuente", nombre="stock"), say("nada")])
    d.draft("x")
    assert "unknown source" in client.sent[1][-1].parts[0].function_response.response["error"]


def test_llm_failure_closes_operation_with_error(monkeypatch):
    monkeypatch.setattr("payagent.adapters.gemini._call.time.sleep", lambda s: None)
    d, client, ops, _ = drafter([])
    out = d.draft("x")  # empty script -> pop from empty list raises on both attempts
    assert out.draft is None and out.error == NO_DRAFT
    assert ops.finished[0][1]


def test_max_turns():
    d, _, *_ = drafter([call("listar_fuentes")] * 6)
    assert d.draft("x").error == NO_DRAFT


def test_allow_must_be_overridable():
    assert "Permitir" in error_of([cond("GT", value=1)], effect="ALLOW", overridable=False)


def test_allow_draft_with_normalized_tax_id_and_boolean():
    d, *_ = drafter([rule(
        [cond("EQ", column="tax_id", source="vendor", value="841.234.567-"),
         cond("EQ", column="orden_encontrada", source="po_check", value=False)],
        effect="ALLOW")])
    out = d.draft("Northwind déjalo pasar sin orden")
    assert out.draft.effect == "ALLOW"
    assert out.draft.conditions[0].value == "841234567"
    assert out.draft.conditions[1].value is False
    assert out.draft.conditions[1].text == "Orden de compra · orden encontrada = no"


@pytest.mark.parametrize("conditions,fragment", [
    ([cond("GT", column="country", value="BR")], "no se puede usar con invoice.country"),
    ([cond("GT", column="approved", source="vendor", value=True)], "no se puede usar"),
    ([cond("BETWEEN", value=5)], "[mínimo, máximo]"),
    ([cond("BETWEEN", value=[10, 1])], "el mínimo debe ser menor"),
    ([cond("IN", column="country", value="BR")], "al menos un valor"),
    ([cond("EQ", value=[1, 2])], "un solo valor"),
    ([cond("IS_NULL", value=3)], "no lleva valor"),
    ([cond("GT", value="mucho")], "(number)"),
    ([cond("EQ", column="country", value=3)], "(text)"),
    ([cond("EQ", column="approved", source="vendor", value="yes")], "(boolean)"),
    ([cond("GT", column="issue_date", value="ayer")], "(date)"),
    ([cond("GT")], "necesita un valor"),
    ([cond("GT", value=1, value_source="vendor", value_column="tax_id")], "no los dos"),
    ([cond("GT", value_source="vendor")], "van juntos"),
    ([cond("GT", value_source="vendor", value_column="tax_id")], "No se puede comparar"),
    ([cond("IN", value_source="vendor", value_column="tax_id")], "valores fijos"),
    ([cond("GT", source="stock", value=1)], "unknown source"),
    ([cond("MUCHO", value=1)], "no es válido"),
    ([], "al menos una condición"),
])
def test_validation_errors(conditions, fragment):
    assert fragment in error_of(conditions)


def test_between_in_and_column_comparison_are_accepted():
    d, *_ = drafter([rule([
        cond("BETWEEN", column="desviacion_pct", source="po_check", value=[0, "5"]),
        cond("NOT_IN", column="country", value=["BR", "MX"]),
        cond("IS_NOT_NULL", column="issue_date"),
        cond("NEQ", column="vendor_tax_id", value_source="vendor", value_column="tax_id"),
    ], effect="HOLD", overridable=False)])
    out = d.draft("x")
    assert out.error is None
    texts = [c.text for c in out.draft.conditions]
    assert texts[0] == "Orden de compra · desviación % entre 0 y 5"
    assert texts[3] == "Factura · NIT ≠ Proveedor · NIT"
    assert out.draft.conditions[3].value_source == "vendor"
