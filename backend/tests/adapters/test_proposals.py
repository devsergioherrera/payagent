import uuid
from collections.abc import Iterator
from types import SimpleNamespace

import pytest

from payagent.adapters.postgres import (
    PostgresFeedbackLog,
    PostgresOperations,
    PostgresProposals,
    PostgresRuleCatalog,
    PostgresRules,
    get_pool,
)
from payagent.app.propose_rules import NewProposal, ProposalNotPending, ProposalService
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator

pytestmark = pytest.mark.db

NORTHWIND = "10000000-0000-0000-0000-000000000006"
PO_RULE = "20000000-0000-0000-0000-000000000010"


def add_resolved_cases(n: int, tag: str) -> list[str]:
    """n Northwind invoices escalated by 'Sin orden de compra' and approved by a human (test- prefixed)."""
    ids = []
    with get_pool().connection() as conn:
        for i in range(n):
            inv = conn.execute(
                """
                insert into invoice (file_sha256, source, source_ref, status, vendor_id, vendor_name_raw, vendor_tax_id,
                                     invoice_number, amount, currency, amount_usd)
                values (%s, 'SEED', %s, 'DECIDED', %s, 'Northwind Software Inc.', '841234567', %s, 900, 'USD', 900)
                returning id
                """,
                (f"test-{tag}-{i}", f"test-{tag}", NORTHWIND, f"TEST-{tag}-{i}"),
            ).fetchone()[0]
            dec = conn.execute(
                "insert into decision (invoice_id, outcome, status, explanation, explained_by) "
                "values (%s, 'ESCALATE', 'PENDING_HUMAN', 'test', 'TEMPLATE') returning id",
                (inv,),
            ).fetchone()[0]
            conn.execute(
                "insert into decision_rule_hit (decision_id, rule_id, rule_name, effect, result) "
                "values (%s, %s, 'Sin orden de compra', 'ESCALATE', 'FIRED')",
                (dec, PO_RULE),
            )
            conn.execute(
                "insert into approval (decision_id, verdict, note, approver) values (%s, 'APPROVED', 'ok', 'Sergio')",
                (dec,),
            )
            ids.append(str(inv))
    return ids


def remove_cases(ids: list[str]) -> None:
    with get_pool().connection() as conn:
        conn.execute("delete from rule_proposal where evidence_invoice_ids && %s::uuid[]", (ids,))
        conn.execute(
            "delete from approval where decision_id in (select id from decision where invoice_id = any(%s::uuid[]))",
            (ids,),
        )
        conn.execute(
            "delete from decision_rule_hit where decision_id in (select id from decision where invoice_id = any(%s::uuid[]))",
            (ids,),
        )
        conn.execute("delete from decision where invoice_id = any(%s::uuid[])", (ids,))
        conn.execute("delete from invoice where id = any(%s::uuid[])", (ids,))


@pytest.fixture
def cases() -> Iterator[list[str]]:
    ids = add_resolved_cases(3, uuid.uuid4().hex[:8])
    yield ids
    remove_cases(ids)


@pytest.fixture
def cleanup() -> Iterator[dict[str, list[str]]]:
    made: dict[str, list[str]] = {"operation": [], "rule": []}
    yield made
    with get_pool().connection() as conn:
        conn.execute("update approval set reviewed_in_operation_id = null where reviewed_in_operation_id = any(%s::uuid[])",
                     (made["operation"],))
        conn.execute("delete from rule_proposal where operation_id = any(%s::uuid[])", (made["operation"],))
        conn.execute("delete from rule_condition where rule_id = any(%s::uuid[])", (made["rule"],))
        conn.execute("delete from rule where id = any(%s::uuid[])", (made["rule"],))
        conn.execute("delete from llm_usage where operation_id = any(%s::uuid[])", (made["operation"],))
        conn.execute("delete from operation where id = any(%s::uuid[])", (made["operation"],))


def service() -> ProposalService:
    return ProposalService(
        client=None, feedback=PostgresFeedbackLog(), operations=PostgresOperations(), meter=SimpleNamespace(),
        catalog=PostgresRuleCatalog(), rules=PostgresRules(), proposals=PostgresProposals(),
    )


def new_proposal(evidence: list[str], name: str) -> NewProposal:
    return NewProposal(
        name=name, natural_language="Permitir Northwind sin orden.", effect=Effect.ALLOW, overridable=True,
        conditions=(
            Condition(ColumnRef("vendor", "tax_id"), Operator.EQ, "841234567"),
            Condition(ColumnRef("po_check", "orden_encontrada"), Operator.EQ, False),
        ),
        rationale="porque si", evidence_invoice_ids=tuple(evidence),
    )


def save(cases, cleanup, name="test-allow") -> str:
    op = PostgresOperations().start("PROPOSE_RULES")
    cleanup["operation"].append(op)
    ids = PostgresProposals().save(op, [new_proposal(cases, name)], cases)
    return ids[0]


def test_save_marks_cases_reviewed_and_lists_with_evidence(cases, cleanup):
    pid = save(cases, cleanup)
    assert not [c for c in PostgresFeedbackLog().unreviewed(50) if c.invoice_id in cases]
    [view] = [p for p in service().list("PENDING") if p.id == pid]
    assert view.draft.effect == "ALLOW" and len(view.evidence) == 3
    assert {e.decided_by for e in view.evidence} == {"HUMAN"}
    assert view.evidence[0].headline == "Sin orden de compra"
    assert view.draft.conditions[1].value is False and "Proveedor" in view.draft.conditions[0].text


def test_accept_creates_agent_rule_and_cannot_repeat(cases, cleanup):
    pid = save(cases, cleanup, "test-accept")
    rule = service().accept(pid, "Sergio")
    cleanup["rule"].append(rule.id)
    assert (rule.origin, rule.proposed_by, rule.approved_by, rule.active) == ("AGENT", "Agente", "Sergio", True)
    assert [c.column for c in rule.conditions] == ["tax_id", "orden_encontrada"]
    with get_pool().connection() as conn:
        status, created = conn.execute(
            "select status, created_rule_id from rule_proposal where id = %s", (pid,)
        ).fetchone()
    assert status == "ACCEPTED" and str(created) == rule.id
    with pytest.raises(ProposalNotPending):
        service().accept(pid, "Sergio")


def test_reject_and_recent_rejections_are_remembered(cases, cleanup):
    pid = save(cases, cleanup, "test-reject")
    view = service().reject(pid, "Sergio")
    assert view.status == "REJECTED"
    rejected = PostgresProposals().recently_rejected(30)
    assert new_proposal(cases, "x").conditions in rejected


def test_second_running_proposal_run_is_refused(cleanup):
    ops = PostgresOperations()
    first = ops.start("PROPOSE_RULES")
    cleanup["operation"].append(first)
    from payagent.app.propose_rules import ProposalRunInProgress

    with pytest.raises(ProposalRunInProgress):
        service().run()
    ops.finish(first)
