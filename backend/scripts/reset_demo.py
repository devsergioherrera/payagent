"""Wipe everything a demo run created: uv run python scripts/reset_demo.py [--yes]

Deletes every invoice whose source is not 'SEED' with its operations, LLM usage, decisions, rule hits,
approvals, notifications and proposals built on it, and the stored files of those invoices.
Rules, vendors, budgets and seed invoices stay.
"""
import sys
from pathlib import Path

from payagent.adapters.postgres import close_pool, get_pool
from payagent.adapters.postgres.maintenance import drop_test_rules

# One transaction: either the whole demo state goes or none of it.
DELETES = [
    "delete from approval where decision_id in (select id from decision where invoice_id = any(%(ids)s))",
    "delete from decision_rule_hit where decision_id in (select id from decision where invoice_id = any(%(ids)s))",
    "delete from decision where invoice_id = any(%(ids)s)",
    "delete from notification where invoice_id = any(%(ids)s)",
    "delete from llm_usage where operation_id in (select id from operation where invoice_id = any(%(ids)s))",
    """delete from rule_proposal
       where operation_id in (select id from operation where invoice_id = any(%(ids)s))
          or evidence_invoice_ids && %(ids)s""",
    "delete from operation where invoice_id = any(%(ids)s)",
    "delete from invoice where id = any(%(ids)s)",
]


def main(assume_yes: bool) -> None:
    with get_pool().connection() as conn:
        if dropped := drop_test_rules(conn):
            print(f"Deleted {dropped} test rules.")
        # The feedback loop must find the seed approvals unreviewed and no learned rules or proposals.
        conn.execute("update approval set reviewed_in_operation_id = null")
        conn.execute("delete from rule_proposal")
        agent_rules = "select id from rule where origin = 'AGENT'"
        conn.execute(f"delete from decision_rule_hit where rule_id in ({agent_rules})")
        conn.execute(f"delete from rule_condition where rule_id in ({agent_rules})")
        conn.execute("update rule set replaces_rule_id = null where origin = 'AGENT'")
        conn.execute("delete from rule where origin = 'AGENT'")
        rows = conn.execute("select id, file_path from invoice where source <> 'SEED'").fetchall()
        ids = [r[0] for r in rows]
        if not ids:
            print("Nothing to delete: only seed invoices.")
            return
        if not assume_yes and input(f"Delete {len(ids)} demo invoices and their files? [y/N] ").lower() != "y":
            print("Cancelled.")
            return
        for statement in DELETES:
            conn.execute(statement, {"ids": ids})
        kept = {r[0] for r in conn.execute("select file_path from invoice where file_path is not null").fetchall()}
    removed = 0
    for path in {Path(r[1]) for r in rows if r[1]} - {Path(p) for p in kept}:
        if path.is_file():
            path.unlink()
            removed += 1
    print(f"Deleted {len(ids)} invoices and {removed} stored files.")


if __name__ == "__main__":
    try:
        main("--yes" in sys.argv[1:])
    finally:
        close_pool()
