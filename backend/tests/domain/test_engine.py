from decimal import Decimal

import pytest

from payagent.domain.decision import HitResult, Outcome
from payagent.domain.engine import evaluate
from payagent.domain.facts import Facts
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule
from tests.domain.seed_rules import seed_rules

VENDOR = {"tax_id": "841234567", "bank_account": "021000021987654321", "status": "ALLOWED"}


def clean_rows() -> dict:
    return {
        "invoice": {"vendor_id": "v1", "vendor_tax_id": "841234567", "bank_account": "021000021987654321",
                    "amount_usd": Decimal("1000")},
        "vendor": dict(VENDOR),
        "budget_status": {"saldo_despues_usd": Decimal("100")},
        "invoice_checks": {"duplicada": False, "similares_30d": 0, "campos_faltantes": 0,
                           "dias_emision": 10, "dias_para_vencer": 20},
        "po_check": {"orden_encontrada": True, "desviacion_pct": Decimal("1"), "moneda_coincide": True},
    }


def facts(**patch) -> Facts:
    """Clean facts with `source={...}` patches merged per source; `source=None` drops the row."""
    rows = clean_rows()
    for source, change in patch.items():
        rows[source] = None if change is None else {**rows[source], **change}
    return Facts(rows)


def hits_by_number(decision) -> dict[int, HitResult]:
    return {int(h.rule_id[-2:]): h.result for h in decision.hits if h.rule_id.startswith("2000")}


# (rule number, facts that fire it, facts that do not fire it)
CASES = {
    1: (dict(invoice={"vendor_id": None}, vendor=None), dict()),
    2: (dict(vendor={"status": "BLOCKED"}), dict()),
    3: (dict(invoice={"bank_account": "999"}), dict()),
    4: (dict(invoice={"vendor_tax_id": "111"}), dict()),
    5: (dict(invoice={"amount_usd": Decimal("5000.01")}), dict(invoice={"amount_usd": Decimal("5000")})),
    6: (dict(invoice={"amount_usd": 10000}), dict(invoice={"amount_usd": Decimal("9999.99")})),
    7: (dict(budget_status={"saldo_despues_usd": Decimal("-0.01")}), dict(budget_status={"saldo_despues_usd": 0})),
    8: (dict(invoice_checks={"duplicada": True}), dict()),
    9: (dict(invoice_checks={"similares_30d": 1}), dict()),
    10: (dict(po_check={"orden_encontrada": False}), dict()),
    11: (dict(po_check={"desviacion_pct": Decimal("5.1")}), dict(po_check={"desviacion_pct": 5})),
    12: (dict(po_check={"moneda_coincide": False}), dict()),
    13: (dict(invoice_checks={"campos_faltantes": 2}), dict()),
    14: (dict(invoice_checks={"dias_emision": -1}), dict(invoice_checks={"dias_emision": 90})),
    15: (dict(invoice_checks={"dias_para_vencer": -1}), dict(invoice_checks={"dias_para_vencer": 0})),
}


def isolate(n: int, **patch):
    """Decision on the seed rule `n` alone."""
    return evaluate([seed_rules()[n - 1]], facts(**patch))


@pytest.mark.parametrize("n", sorted(CASES))
def test_seed_rule_fires(n):
    firing, _ = CASES[n]
    assert isolate(n, **firing).hits[0].result is HitResult.FIRED


@pytest.mark.parametrize("n", sorted(CASES))
def test_seed_rule_passes(n):
    _, passing = CASES[n]
    result = isolate(n, **passing).hits[0].result
    assert result is HitResult.PASSED


def test_clean_invoice_pays():
    decision = evaluate(seed_rules(), facts())
    assert decision.outcome is Outcome.PAY
    assert all(h.result is HitResult.PASSED for h in decision.hits)
    assert not decision.needs_human


@pytest.mark.parametrize("n", [n for n, r in enumerate(seed_rules(), 1) if r.effect is not Effect.ALLOW])
def test_never_pay_when_any_block_fires(n):
    decision = evaluate(seed_rules(), facts(**CASES[n][0]))
    assert decision.outcome is not Outcome.PAY
    rule = seed_rules()[n - 1]
    assert decision.outcome is (Outcome.HOLD if rule.effect is Effect.HOLD else Outcome.ESCALATE)


def allow_all() -> Rule:
    return Rule("allow-all", "Allow all", Effect.ALLOW, False,
                (Condition(ColumnRef("invoice", "vendor_id"), Operator.IS_NOT_NULL),))


def test_allow_never_overrides_hard_rules():
    rules = [*seed_rules(), allow_all()]
    # HOLD rules (2, 7, 8) and non-overridable ESCALATE rules (1, 3, 6, 13) survive an ALLOW.
    for n in (2, 3, 6, 7, 8, 13):
        decision = evaluate(rules, facts(**CASES[n][0]))
        assert hits_by_number(decision)[n] is HitResult.FIRED
        assert decision.outcome is not Outcome.PAY
    assert evaluate(rules, facts(**CASES[1][0])).outcome is Outcome.ESCALATE


@pytest.mark.parametrize("n", [4, 5, 9, 10, 11, 12, 14, 15])
def test_allow_cancels_overridable_escalate(n):
    decision = evaluate([*seed_rules(), allow_all()], facts(**CASES[n][0]))
    hit = next(h for h in decision.hits if h.rule_id.endswith(f"{n:02d}"))
    assert hit.result is HitResult.OVERRIDDEN
    assert hit.overridden_by == "allow-all"
    assert decision.outcome is Outcome.PAY


def test_overridden_by_is_first_fired_allow():
    never = Rule("allow-no", "never", Effect.ALLOW, False,
                 (Condition(ColumnRef("invoice", "vendor_id"), Operator.IS_NULL),))
    second = Rule("allow-2", "second", Effect.ALLOW, False,
                  (Condition(ColumnRef("invoice", "vendor_id"), Operator.EQ, "v1"),))
    decision = evaluate([*seed_rules(), never, allow_all(), second], facts(**CASES[5][0]))
    assert next(h for h in decision.hits if h.rule_id.endswith("05")).overridden_by == "allow-all"


def test_overridable_missing_data_is_overridden_too():
    rules = [*seed_rules(), allow_all()]
    decision = evaluate(rules, facts(invoice={"amount_usd": None}))
    assert hits_by_number(decision)[5] is HitResult.OVERRIDDEN
    assert hits_by_number(decision)[6] is HitResult.MISSING_DATA  # non-overridable: still escalates
    assert decision.outcome is Outcome.ESCALATE


def test_null_amount_escalates():
    decision = evaluate(seed_rules(), facts(invoice={"amount_usd": None}))
    assert decision.outcome is Outcome.ESCALATE
    assert hits_by_number(decision)[5] is HitResult.MISSING_DATA
    assert hits_by_number(decision)[6] is HitResult.MISSING_DATA


def test_missing_vendor_row():
    decision = evaluate(seed_rules(), facts(invoice={"vendor_id": None}, vendor=None))
    got = hits_by_number(decision)
    assert got[1] is HitResult.FIRED
    for n in (2, 3, 4):  # 3 and 4 compare against vendor columns
        assert got[n] is HitResult.NOT_APPLICABLE
    assert decision.outcome is Outcome.ESCALATE


def test_allow_missing_data_counts_as_passed():
    rule = Rule("a", "a", Effect.ALLOW, False, (Condition(ColumnRef("invoice", "x"), Operator.EQ, 1),))
    f = Facts({"invoice": {"x": None}})
    decision = evaluate([rule], f)
    assert decision.outcome is Outcome.PAY
    assert decision.hits[0].result is HitResult.MISSING_DATA


def test_empty_rules_escalate():
    decision = evaluate([], facts())
    assert decision.outcome is Outcome.ESCALATE
    assert decision.hits == ()


def test_deterministic_and_ordered():
    f = facts(**CASES[5][0])
    assert evaluate(seed_rules(), f) == evaluate(seed_rules(), f)
    assert [h.rule_id for h in evaluate(seed_rules(), f).hits] == [r.id for r in seed_rules()]


def test_observed_and_threshold():
    decision = evaluate(seed_rules(), facts(invoice={"vendor_tax_id": "111"}))
    h4 = decision.hits[3]
    assert h4.observed == {"invoice.vendor_tax_id": "111"}
    assert h4.threshold == {"vendor.tax_id": "841234567"}
    h5 = decision.hits[4]
    assert h5.observed == {"invoice.amount_usd": Decimal("1000")}
    assert h5.threshold == {"invoice.amount_usd": 5000}


def test_northwind_case():
    no_po = dict(po_check={"orden_encontrada": False, "desviacion_pct": None, "moneda_coincide": None})
    decision = evaluate(seed_rules(), facts(**no_po))
    assert decision.outcome is Outcome.ESCALATE
    assert hits_by_number(decision)[10] is HitResult.FIRED

    northwind = Rule("allow-northwind", "Northwind sin OC", Effect.ALLOW, False, (
        Condition(ColumnRef("vendor", "tax_id"), Operator.EQ, "841234567"),
        Condition(ColumnRef("po_check", "orden_encontrada"), Operator.EQ, False),
    ))
    decision = evaluate([*seed_rules(), northwind], facts(**no_po))
    assert decision.outcome is Outcome.PAY
    assert hits_by_number(decision)[10] is HitResult.OVERRIDDEN


# --- coercion and operators ---

def one(cond: Condition, **row) -> HitResult:
    rule = Rule("r", "r", Effect.ESCALATE, False, (cond,))
    return evaluate([rule], Facts({"s": row})).hits[0].result


def cond(op: Operator, value=None, column="x", ref=None) -> Condition:
    return Condition(ColumnRef("s", column), op, value, ColumnRef("s", ref) if ref else None)


@pytest.mark.parametrize("x, op, value, expected", [
    ("100", Operator.EQ, 100, True),
    (Decimal("1.50"), Operator.EQ, 1.5, True),
    ("9.5", Operator.GT, "10", False),
    ("2026-01-02", Operator.GT, "2026-01-01", True),
    ("2026-01-01", Operator.EQ, "2026-01-01", True),
    (True, Operator.EQ, 1, False),
    (1, Operator.EQ, True, False),
    (True, Operator.EQ, True, True),
    ("abc", Operator.EQ, 5, False),
    ("0012", Operator.EQ, "12", False),  # identifiers are not numbers
    (5, Operator.IN, [1, "5"], True),
    ("z", Operator.NOT_IN, ["a", "b"], True),
    (5, Operator.BETWEEN, [5, 10], True),
    (10, Operator.BETWEEN, [5, 10], True),
    (11, Operator.NOT_BETWEEN, [5, 10], True),
    ("2026-01-05", Operator.BETWEEN, ["2026-01-01", "2026-01-31"], True),
])
def test_operators(x, op, value, expected):
    result = one(cond(op, value), x=x)
    assert result is (HitResult.FIRED if expected else HitResult.PASSED)


@pytest.mark.parametrize("c", [
    cond(Operator.BETWEEN, 5),
    cond(Operator.BETWEEN, [1]),
    cond(Operator.IN, 5),
    cond(Operator.GT, "abc"),
    cond(Operator.GT, True),
    cond(Operator.EQ, None),
])
def test_malformed_rule_is_missing_data(c):
    assert one(c, x=7) is HitResult.MISSING_DATA


def test_malformed_rule_does_not_break_the_others():
    bad = Rule("bad", "bad", Effect.HOLD, False, (cond(Operator.BETWEEN, "oops"),))
    good = Rule("good", "good", Effect.ESCALATE, False, (cond(Operator.EQ, 7),))
    decision = evaluate([bad, good], Facts({"s": {"x": 7}}))
    assert [h.result for h in decision.hits] == [HitResult.MISSING_DATA, HitResult.FIRED]
    assert decision.outcome is Outcome.HOLD


def test_null_operators_never_missing():
    assert one(cond(Operator.IS_NULL), x=None) is HitResult.FIRED
    assert one(cond(Operator.IS_NOT_NULL), x=None) is HitResult.PASSED
    assert one(cond(Operator.IS_NOT_NULL), x=0) is HitResult.FIRED


def test_value_ref():
    assert one(cond(Operator.NEQ, ref="y"), x="a", y="b") is HitResult.FIRED
    assert one(cond(Operator.NEQ, ref="y"), x="a", y="a") is HitResult.PASSED
    assert one(cond(Operator.NEQ, ref="y"), x="a", y=None) is HitResult.MISSING_DATA
