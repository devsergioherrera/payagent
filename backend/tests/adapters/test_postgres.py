import uuid
from collections.abc import Iterator
from datetime import date, timedelta
from decimal import Decimal

import pytest

from payagent.adapters.postgres import (
    PostgresDecisions,
    PostgresFeedbackLog,
    PostgresInvoices,
    PostgresOperations,
    PostgresRuleCatalog,
    PostgresRules,
    PostgresUsageMeter,
    get_pool,
)
from payagent.domain.decision import Decision, HitResult, Outcome, RuleHit
from payagent.domain.invoice import ExtractedInvoice
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator
from payagent.ports.invoice_source import IncomingDocument, SourceType

pytestmark = pytest.mark.db

AURORA = "10000000-0000-0000-0000-000000000001"
SEED_SOURCES = {"invoice", "vendor", "purchase_order", "invoice_checks", "po_check", "budget_status"}


def _extracted(**over) -> ExtractedInvoice:
    base = dict(
        vendor_name_raw="Comercializadora Aurora S.A.S.",
        vendor_tax_id="9001234567",
        invoice_number="T-1",
        amount=Decimal("1000000"),
        currency="COP",
        issue_date=date.today() - timedelta(days=3),
        due_date=date.today() + timedelta(days=20),
        po_number="PO-1001",
        bank_account="0012345678901",
        confidence=0.95,
    )
    return ExtractedInvoice(**{**base, **over})


@pytest.fixture
def created() -> Iterator[dict[str, list[str]]]:
    """Tracks ids created by a test and removes them, with dependent rows, afterwards."""
    ids: dict[str, list[str]] = {"invoice": [], "operation": [], "rule": []}
    yield ids
    with get_pool().connection() as conn:
        inv = ids["invoice"]
        conn.execute(
            "delete from approval where decision_id in (select id from decision where invoice_id = any(%s::uuid[]))",
            (inv,),
        )
        conn.execute(
            "delete from decision_rule_hit where decision_id in "
            "(select id from decision where invoice_id = any(%s::uuid[]))",
            (inv,),
        )
        conn.execute("delete from decision where invoice_id = any(%s::uuid[])", (inv,))
        conn.execute("delete from notification where invoice_id = any(%s::uuid[])", (inv,))
        conn.execute("delete from llm_usage where operation_id = any(%s::uuid[])", (ids["operation"],))
        conn.execute("delete from operation where id = any(%s::uuid[]) or invoice_id = any(%s::uuid[])",
                     (ids["operation"], inv))
        conn.execute("delete from invoice where id = any(%s::uuid[])", (inv,))
        conn.execute("delete from rule_condition where rule_id = any(%s::uuid[])", (ids["rule"],))
        conn.execute("delete from rule where id = any(%s::uuid[])", (ids["rule"],))


def _doc() -> IncomingDocument:
    return IncomingDocument(SourceType.TEXT, "test", "t.txt", "text/plain", b"x")


def _new_invoice(created, extracted: ExtractedInvoice | None = None) -> str:
    invoices = PostgresInvoices()
    invoice_id = invoices.create(_doc(), f"test-{uuid.uuid4()}", "/tmp/t")
    assert invoice_id
    created["invoice"].append(invoice_id)
    if extracted:
        invoices.save_extraction(invoice_id, extracted)
    return invoice_id


def _row(invoice_id: str) -> dict:
    with get_pool().connection() as conn:
        cur = conn.execute(
            "select vendor_id, fx_rate, amount_usd, status from invoice where id = %s", (invoice_id,)
        )
        return dict(zip([d.name for d in cur.description], cur.fetchone(), strict=True))


def test_create_is_idempotent(created):
    invoices = PostgresInvoices()
    sha = f"test-{uuid.uuid4()}"
    first = invoices.create(_doc(), sha, "/tmp/a")
    created["invoice"].append(first)
    assert first is not None
    assert invoices.create(_doc(), sha, "/tmp/a") is None


def test_vendor_resolved_by_tax_id_then_by_name(created):
    by_tax = _new_invoice(created, _extracted(vendor_tax_id="900.123.456-7", vendor_name_raw="Otro"))
    assert str(_row(by_tax)["vendor_id"]) == AURORA
    by_name = _new_invoice(created, _extracted(vendor_tax_id=None, vendor_name_raw="  COMERCIALIZADORA aurora s.a.s. "))
    assert str(_row(by_name)["vendor_id"]) == AURORA
    unknown = _new_invoice(created, _extracted(vendor_tax_id="1", vendor_name_raw="Nadie S.A."))
    assert _row(unknown)["vendor_id"] is None


def test_fx_conversion_and_unknown_currency(created):
    cop = _row(_new_invoice(created, _extracted(amount=Decimal("1000000"), currency="cop")))
    assert cop["fx_rate"] == Decimal("0.00025")
    assert cop["amount_usd"] == Decimal("250.00")
    odd = _row(_new_invoice(created, _extracted(currency="XYZ")))
    assert odd["fx_rate"] is None and odd["amount_usd"] is None


def test_load_facts_for_all_seed_sources(created):
    invoice_id = _new_invoice(created, _extracted())
    with PostgresDecisions().session() as session:
        facts = session.load_facts(invoice_id, SEED_SOURCES)
    assert set(facts.rows) == SEED_SOURCES
    assert all(facts.has_row(s) for s in SEED_SOURCES)
    assert facts.value(ColumnRef("invoice", "id")) == invoice_id
    assert facts.value(ColumnRef("invoice", "amount_usd")) == Decimal("250.00")
    assert facts.value(ColumnRef("invoice", "issue_date")) == (date.today() - timedelta(days=3)).isoformat()
    assert facts.value(ColumnRef("vendor", "status")) == "ALLOWED"
    assert facts.value(ColumnRef("purchase_order", "po_number")) == "PO-1001"
    assert facts.value(ColumnRef("invoice_checks", "duplicada")) is False
    assert facts.value(ColumnRef("invoice_checks", "dias_emision")) == 3
    assert facts.value(ColumnRef("po_check", "orden_encontrada")) is True
    assert facts.value(ColumnRef("po_check", "moneda_coincide")) is True
    assert facts.value(ColumnRef("budget_status", "presupuesto_usd")) == Decimal("60000.00")


def test_not_applicable_shape_without_vendor_or_po(created):
    invoice_id = _new_invoice(created, _extracted(vendor_tax_id="1", vendor_name_raw="Nadie", po_number=None))
    with PostgresDecisions().session() as session:
        facts = session.load_facts(invoice_id, {"vendor", "purchase_order", "invoice"})
    assert facts.rows["vendor"] is None
    assert facts.rows["purchase_order"] is None
    assert not facts.has_row("vendor")
    assert facts.value(ColumnRef("vendor", "status")) is None
    assert facts.has_row("invoice")


def test_unknown_source_is_rejected(created):
    invoice_id = _new_invoice(created, _extracted())
    with PostgresDecisions().session() as session:
        with pytest.raises(KeyError):
            session.load_facts(invoice_id, {"pg_user; drop table invoice"})


def test_rule_with_unknown_column_is_rejected(created):
    rules = PostgresRules()
    bad = Condition(ColumnRef("invoice", "no_such_column"), Operator.GT, 1)
    with pytest.raises(ValueError):
        rules.create_rule(
            name="test-bad", natural_language="x", effect=Effect.ESCALATE, overridable=True,
            conditions=[bad], origin="HUMAN", proposed_by="t", approved_by="t",
        )
    with pytest.raises(ValueError):
        rules.create_rule(
            name="test-bad", natural_language="x", effect=Effect.ESCALATE, overridable=True,
            conditions=[Condition(ColumnRef("secret", "x"), Operator.GT, 1)],
            origin="HUMAN", proposed_by="t", approved_by="t",
        )
    with get_pool().connection() as conn:
        assert conn.execute("select count(*) from rule where name = 'test-bad'").fetchone()[0] == 0


def test_create_rule_roundtrip_and_deactivate(created):
    rules = PostgresRules()
    rule_id = rules.create_rule(
        name="test-rule", natural_language="x", effect=Effect.ESCALATE, overridable=True,
        conditions=[
            Condition(ColumnRef("invoice", "amount_usd"), Operator.GT, Decimal("7500.5")),
            Condition(ColumnRef("invoice", "bank_account"), Operator.NEQ, value_ref=ColumnRef("vendor", "bank_account")),
        ],
        origin="AGENT", proposed_by="t", approved_by="t",
    )
    created["rule"].append(rule_id)
    with PostgresDecisions().session() as session:
        loaded = {r.id: r for r in session.active_rules()}
    assert len(loaded) >= 16
    mine = loaded[rule_id]
    assert [c.left.column for c in mine.conditions] == ["amount_usd", "bank_account"]
    assert mine.conditions[1].value_ref == ColumnRef("vendor", "bank_account")
    rules.deactivate(rule_id)
    with PostgresDecisions().session() as session:
        assert rule_id not in {r.id for r in session.active_rules()}


def test_catalog():
    catalog = PostgresRuleCatalog()
    assert SEED_SOURCES <= {s.name for s in catalog.list_sources()}
    cols = {c.name: c for c in catalog.describe_source("invoice")}
    assert cols["amount_usd"].data_type == "number"
    assert cols["issue_date"].data_type == "date"
    assert cols["vendor_tax_id"].description
    assert {c.name: c.data_type for c in catalog.describe_source("invoice_checks")}["duplicada"] == "boolean"
    with pytest.raises(KeyError):
        catalog.describe_source("nope")


def test_lock_and_save_decision_roundtrip(created):
    invoice_id = _new_invoice(created, _extracted(amount=Decimal("100000000")))
    ops = PostgresOperations()
    op = ops.start("PROCESS_INVOICE", invoice_id)
    created["operation"].append(op)
    hit = RuleHit(
        rule_id="20000000-0000-0000-0000-000000000005", rule_name="Límite por pago", effect=Effect.ESCALATE,
        result=HitResult.FIRED, observed={"invoice.amount_usd": Decimal("25000.00")},
        threshold={"invoice.amount_usd": 5000},
    )
    with PostgresDecisions().session() as session:
        with get_pool().connection() as other:
            # The advisory lock is held by the session transaction.
            assert other.execute("select pg_try_advisory_xact_lock(4242)").fetchone()[0] is False
        decision_id = session.save_decision(invoice_id, op, Decision(Outcome.ESCALATE, (hit,)), "needs a human")
    ops.finish(op)
    PostgresInvoices().set_explanation(decision_id, "llm text", "LLM")
    with get_pool().connection() as conn:
        d = conn.execute("select outcome, status, explanation, explained_by from decision where id = %s",
                         (decision_id,)).fetchone()
        assert d == ("ESCALATE", "PENDING_HUMAN", "llm text", "LLM")
        h = conn.execute("select result, observed, threshold from decision_rule_hit where decision_id = %s",
                         (decision_id,)).fetchone()
        assert h[0] == "FIRED" and h[1] == {"invoice.amount_usd": 25000} and h[2] == {"invoice.amount_usd": 5000}
        assert conn.execute("select status from operation where id = %s", (op,)).fetchone()[0] == "DONE"
    assert _row(invoice_id)["status"] == "DECIDED"


def test_feedback_log_and_mark_reviewed(created):
    invoice_id = _new_invoice(created, _extracted(amount=Decimal("100000000")))
    ops = PostgresOperations()
    op = ops.start("PROCESS_INVOICE", invoice_id)
    created["operation"].append(op)
    hit = RuleHit("20000000-0000-0000-0000-000000000005", "Límite por pago", Effect.ESCALATE, HitResult.FIRED, {}, {})
    with PostgresDecisions().session() as session:
        decision_id = session.save_decision(invoice_id, op, Decision(Outcome.ESCALATE, (hit,)), "x")
    with get_pool().connection() as conn:
        conn.execute("insert into approval (decision_id, verdict, approver) values (%s, 'APPROVED', 'test')",
                     (decision_id,))
    log = PostgresFeedbackLog()
    mine = [c for c in log.unreviewed(limit=1000) if c.invoice_id == invoice_id]
    assert len(mine) == 1
    assert mine[0].fired_rules == ["Límite por pago"] and mine[0].verdict == "APPROVED"
    assert mine[0].vendor_name == "Comercializadora Aurora S.A.S."
    log.mark_reviewed([invoice_id], op)
    assert invoice_id not in {c.invoice_id for c in log.unreviewed(limit=1000)}


def test_usage_meter_cost_and_never_raises(created):
    ops = PostgresOperations()
    op = ops.start("CHAT")
    created["operation"].append(op)
    meter = PostgresUsageMeter()
    meter.record(op, "CHAT", "gemini-2.5-flash", 1_000_000, 100_000, 10)
    meter.record(op, "CHAT", "mystery-model", 5, 5, 1)
    meter.record(str(uuid.uuid4()), "CHAT", "gemini-2.5-flash", 1, 1, 1)  # FK violation: swallowed
    with get_pool().connection() as conn:
        costs = [r[0] for r in conn.execute(
            "select cost_usd from llm_usage where operation_id = %s order by cost_usd desc", (op,)).fetchall()]
    assert costs == [Decimal("0.550000"), Decimal("0")]


def test_second_invoice_that_overdraws_the_po_fires_rule_16(created):
    from payagent.domain.engine import evaluate

    first = _new_invoice(created, _extracted(amount=Decimal("3200000"), invoice_number="T-PO-1"))
    with get_pool().connection() as conn:
        conn.execute(
            "insert into decision (invoice_id, outcome, status, explanation, explained_by) "
            "values (%s, 'PAY', 'FINAL', 'test', 'TEMPLATE')", (first,),
        )
    second = _new_invoice(created, _extracted(amount=Decimal("4800000"), invoice_number="T-PO-2"))
    with PostgresDecisions().session() as session:
        facts = session.load_facts(second, {"invoice", "po_check"})
        rules = [r for r in session.active_rules() if r.id.endswith("0016")]
    assert facts.value(ColumnRef("po_check", "comprometido_oc")) >= Decimal("3200000")
    assert facts.value(ColumnRef("po_check", "saldo_oc_despues_pct")) < -5
    decision = evaluate(rules, facts)
    assert [h.result for h in decision.hits] == [HitResult.FIRED] and decision.outcome is Outcome.ESCALATE


@pytest.mark.db
def test_backfill_seed_hits_is_idempotent():
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parents[2] / "scripts"))
    from backfill_seed_hits import backfill

    backfill()
    with get_pool().connection() as conn:
        counts = conn.execute(
            "select count(*) from decision_rule_hit h join decision d on d.id = h.decision_id"
            " join invoice i on i.id = d.invoice_id where i.source = 'SEED'"
        ).fetchone()[0]
    assert backfill() == 0
    with get_pool().connection() as conn:
        again = conn.execute(
            "select count(*) from decision_rule_hit h join decision d on d.id = h.decision_id"
            " join invoice i on i.id = d.invoice_id where i.source = 'SEED'"
        ).fetchone()[0]
    assert again == counts
