import json
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from payagent.app.propose_rules import (
    NewProposal,
    ProposalNotPending,
    ProposalRunInProgress,
    ProposalService,
    StoredProposal,
    find_patterns,
    shared_rules,
    could_complete_pattern,
)
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule
from payagent.ports.repositories import ColumnInfo, ResolvedCase, SourceInfo

NORTHWIND = "Northwind Traders"
SOURCES = {
    "vendor": [ColumnInfo("tax_id", "text", ""), ColumnInfo("status", "text", "")],
    "po_check": [ColumnInfo("orden_encontrada", "boolean", ""), ColumnInfo("desviacion_pct", "number", "")],
    "invoice": [ColumnInfo("amount_usd", "number", "")],
}


def case(i: int, verdict="APPROVED", vendor=NORTHWIND, rules=("Sin orden de compra",)) -> ResolvedCase:
    return ResolvedCase(f"inv-{i}", vendor, Decimal("900"), "ESCALATE", list(rules), verdict, None if verdict == "APPROVED" else "no")


class FakeCatalog:
    def list_sources(self):
        return [SourceInfo(n, n.title(), "") for n in SOURCES]

    def describe_source(self, name):
        return SOURCES[name]


class FakeOps:
    def __init__(self, running=False):
        self.running, self.finished = running, []

    def start(self, type, invoice_id=None):
        if self.running:
            raise RuntimeError('duplicate key value violates unique constraint "operation_one_running_proposal"')
        return "op-1"

    def finish(self, operation_id, error=None, detail=None):
        self.finished.append((operation_id, error))
        self.detail = detail


class FakeFeedback:
    def __init__(self, cases):
        self.cases, self.marked = cases, []

    def unreviewed(self, limit=20):
        return iter(self.cases[:limit])

    def mark_reviewed(self, invoice_ids, operation_id):
        self.marked += invoice_ids


class FakeProposals:
    def __init__(self, feedback, rules=(), rejected=()):
        self.feedback, self.rules, self.rejected = feedback, list(rules), list(rejected)
        self.rows: dict[str, StoredProposal] = {}
        self.fail_on_save = False

    def vendor_tax_ids(self, ids):
        return {i: "841234567" for i in ids}

    def active_rules(self):
        return self.rules

    def recently_rejected(self, days=30):
        return self.rejected

    def save(self, operation_id, proposals, reviewed_invoice_ids):
        if self.fail_on_save:
            raise RuntimeError("db down")
        ids = []
        for p in proposals:
            pid = f"p{len(self.rows) + 1}"
            self.rows[pid] = StoredProposal(pid, p.name, p.natural_language, p.effect, p.overridable, p.conditions,
                                            p.rationale, [], "PENDING", datetime.now(UTC))
            ids.append(pid)
        self.feedback.marked += reviewed_invoice_ids
        return ids

    def list(self, status):
        return [p for p in self.rows.values() if p.status == status]

    def get(self, pid):
        return self.rows.get(pid)

    def resolve(self, pid, status, by, created_rule_id=None):
        p = self.rows[pid]
        if p.status != "PENDING":
            return False
        self.rows[pid] = StoredProposal(**{**p.__dict__, "status": status})
        return True


def call(**over):
    args = {
        "name": "Northwind sin orden",
        "natural_language": "Permitir facturas de Northwind sin orden de compra.",
        "effect": "ALLOW",
        "overridable": False,
        "conditions": [
            {"source": "vendor", "column": "tax_id", "operator": "EQ", "value": "841234567"},
            {"source": "po_check", "column": "orden_encontrada", "operator": "EQ", "value": "false"},
        ],
        "rationale": "Sergio aprobó 3 veces.",
        "evidence_invoice_ids": ["inv-1", "inv-2", "inv-3"],
    }
    return SimpleNamespace(name="proponer_regla", args={**args, **over})


class FakeClient:
    def __init__(self, calls):
        self.prompts = []
        self.models = SimpleNamespace(generate_content=self._gen)
        self._calls = calls

    def _gen(self, model, contents, config):
        self.prompts.append(contents)
        return SimpleNamespace(function_calls=self._calls, usage_metadata=None)


class FakeRules:
    def __init__(self):
        self.created = []

    def create_rule(self, **kw):
        self.created.append(kw)
        return "rule-1"

    def deactivate(self, rule_id):
        self.created.clear()


def service(cases, calls, *, rules=(), rejected=(), running=False):
    feedback = FakeFeedback(cases)
    proposals = FakeProposals(feedback, rules, rejected)
    client = FakeClient(calls)
    svc = ProposalService(client, feedback, FakeOps(running), SimpleNamespace(record=lambda *a: None), FakeCatalog(),
                          FakeRules(), proposals)
    return svc, feedback, proposals, client


THREE = [case(1), case(2), case(3)]


def test_find_patterns_needs_three_with_same_verdict_vendor_and_rules():
    cases = THREE + [case(4, verdict="REJECTED"), case(5, vendor="Otro"), case(6, rules=("Límite por pago",))]
    groups = find_patterns(cases)
    assert [[c.invoice_id for c in g] for g in groups] == [["inv-1", "inv-2", "inv-3"]]
    assert find_patterns(THREE[:2]) == []


def test_find_patterns_tolerates_an_extra_rule_in_some_cases():
    cases = [case(1), case(2, rules=("Sin orden de compra", "Posible cobro repetido")),
             case(3, rules=("Sin orden de compra", "Posible cobro repetido"))]
    groups = find_patterns(cases)
    assert [[c.invoice_id for c in g] for g in groups] == [["inv-1", "inv-2", "inv-3"]]
    assert shared_rules(groups[0]) == ["Sin orden de compra"]


def test_run_creates_allow_proposal_and_marks_cases_reviewed():
    svc, feedback, proposals, client = service(THREE, [call()])
    run = svc.run()
    assert run.reviewed == 3 and len(run.created) == 1
    draft = run.created[0].draft
    assert draft.effect == "ALLOW" and draft.overridable is True  # forced: an ALLOW is always overridable
    assert [c.column for c in draft.conditions] == ["tax_id", "orden_encontrada"]
    assert draft.conditions[1].value is False and draft.conditions[0].value == "841234567"
    assert feedback.marked == ["inv-1", "inv-2", "inv-3"]
    assert svc.operations.finished == [("op-1", None)]
    prompt = json.loads(client.prompts[0])
    assert prompt["patterns"][0]["vendor_tax_id"] == "841234567"


def test_no_pattern_means_no_llm_call_but_cases_are_reviewed():
    svc, feedback, _, client = service(THREE[:2], [call()])
    run = svc.run()
    assert run.created == [] and run.reviewed == 2 and client.prompts == []
    assert feedback.marked == ["inv-1", "inv-2"]


@pytest.mark.parametrize(
    "bad",
    [
        {"effect": "HOLD"},  # approved evidence cannot back a HOLD
        {"evidence_invoice_ids": ["inv-1", "inv-2"]},
        {"evidence_invoice_ids": ["inv-1", "inv-2", "ghost"]},
        {"conditions": []},
        {"conditions": [{"source": "secret", "column": "x", "operator": "EQ", "value": "1"}]},
        {"conditions": [{"source": "vendor", "column": "nope", "operator": "EQ", "value": "1"}]},
        {"conditions": [{"source": "vendor", "column": "tax_id", "operator": "LIKE", "value": "1"}]},
        {"conditions": [{"source": "invoice", "column": "amount_usd", "operator": "GT", "value": "mucho"}]},
        {"conditions": [{"source": "invoice", "column": "amount_usd", "operator": "BETWEEN", "value": "5"}]},
        {"conditions": [{"source": "invoice", "column": "amount_usd", "operator": "GT"}]},
    ],
)
def test_invalid_proposals_are_discarded(bad):
    svc, feedback, _, _ = service(THREE, [call(**bad)])
    run = svc.run()
    assert run.created == [] and feedback.marked == ["inv-1", "inv-2", "inv-3"]


def test_skips_duplicates_of_active_rules_and_recent_rejections_and_caps_at_three():
    conds = tuple(
        Condition(ColumnRef(s, c), Operator.EQ, v)
        for s, c, v in [("vendor", "tax_id", "841234567"), ("po_check", "orden_encontrada", False)]
    )
    active = Rule("r", "x", Effect.ALLOW, True, conds)
    assert service(THREE, [call()], rules=[active])[0].run().created == []
    assert service(THREE, [call()], rejected=[conds])[0].run().created == []
    distinct = [call(name=f"r{i}", conditions=[{"source": "invoice", "column": "amount_usd", "operator": "GT", "value": str(i)}])
                for i in range(5)]
    assert len(service(THREE, distinct)[0].run().created) == 3


def test_failure_finishes_failed_and_leaves_cases_unreviewed():
    svc, feedback, proposals, _ = service(THREE, [call()])
    proposals.fail_on_save = True
    with pytest.raises(RuntimeError):
        svc.run()
    assert feedback.marked == []
    assert svc.operations.finished == [("op-1", "db down")]

    svc, feedback, _, client = service(THREE, [call()])
    client._gen = None
    client.models = SimpleNamespace(generate_content=lambda **kw: (_ for _ in ()).throw(ValueError("boom")))
    with pytest.raises(ValueError):
        svc.run()
    assert feedback.marked == [] and svc.operations.finished[0][1] == "boom"


def test_second_running_operation_raises():
    svc, feedback, _, _ = service(THREE, [call()], running=True)
    with pytest.raises(ProposalRunInProgress):
        svc.run()
    assert feedback.marked == []


def test_accept_and_reject_flow():
    svc, _, proposals, _ = service(THREE, [call()])
    svc.run()
    proposals.rule_info = lambda rid: SimpleNamespace(
        id=rid, name="n", natural_language="t", effect=Effect.ALLOW, overridable=True, conditions=(), origin="AGENT",
        proposed_by="Agente", proposed_at=datetime.now(UTC), approved_by="Sergio", approved_at=datetime.now(UTC),
        active=True, times_fired=0)
    rule = svc.accept("p1", "Sergio")
    assert rule.origin == "AGENT" and rule.proposed_by == "Agente" and rule.approved_by == "Sergio"
    assert svc.proposals.get("p1").status == "ACCEPTED"
    with pytest.raises(ProposalNotPending):
        svc.accept("p1", "Sergio")
    with pytest.raises(ProposalNotPending):
        svc.reject("p1", "Sergio")


def test_run_trace_is_built_from_the_real_run():
    svc, _, _, _ = service(THREE, [call()])
    run = svc.run()
    labels = [t.label for t in run.trace]
    assert labels[0] == "Revisé 3 decisiones tuyas" and run.trace[0].detail == "3 aprobadas, 0 rechazadas"
    assert run.trace[1].label == "Encontré un patrón"
    assert run.trace[1].detail == f"{NORTHWIND}, aprobadas 3 de 3, todas con «Sin orden de compra»"
    assert "Comprobé que no anula ningún Frenar ni el umbral de aprobación" in labels
    assert run.trace[-1].label == "Propuesta lista" and run.trace[-1].detail == "Northwind sin orden"
    assert svc.operations.detail == [{"label": t.label, "detail": t.detail} for t in run.trace]


def test_trace_without_pattern_says_so():
    svc, _, _, _ = service(THREE[:2], [])
    assert [t.label for t in svc.run().trace] == ["Revisé 2 decisiones tuyas", "No encontré un patrón todavía"]


def test_trace_counts_discarded_proposals():
    svc, _, _, _ = service(THREE, [call(conditions=[])])
    run = svc.run()
    assert run.created == [] and "Descarté 1 propuesta" in [t.label for t in run.trace]


def test_could_complete_pattern_needs_two_earlier_matching_resolutions():
    assert could_complete_pattern(THREE, "inv-3")
    assert not could_complete_pattern(THREE[:2], "inv-2")
    assert not could_complete_pattern(THREE + [case(4, verdict="REJECTED")], "inv-4")
    assert not could_complete_pattern(THREE, "ghost")


def test_learn_from_runs_only_when_a_pattern_is_in_reach():
    svc, _, _, client = service(THREE[:2], [call()])
    assert svc.learn_from("inv-2") is None and client.prompts == []
    svc, _, _, client = service(THREE, [call()])
    run = svc.learn_from("inv-3")
    assert run is not None and len(run.created) == 1
    busy, _, _, _ = service(THREE, [call()], running=True)
    assert busy.learn_from("inv-3") is None
