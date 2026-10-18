"""Give every SEED decision one rule hit per active rule: uv run python scripts/backfill_seed_hits.py

Runs the real engine on each seed invoice and rewrites ONLY its decision_rule_hit rows (observed and threshold
included). The stored outcome, status and explanation are never touched. Idempotent: a decision that already
has one hit per active rule is skipped.
"""
from psycopg.types.json import Jsonb

from payagent.adapters.postgres import close_pool, get_pool
from payagent.adapters.postgres.db import json_dumps
from payagent.adapters.postgres.repositories import PostgresDecisions
from payagent.domain.engine import evaluate

SEED_DECISIONS = """select d.id, d.invoice_id::text from decision d join invoice i on i.id = d.invoice_id
                    where i.source = 'SEED' order by d.decided_at"""


def backfill(decisions: PostgresDecisions | None = None) -> int:
    """Return how many decisions were rewritten."""
    done = 0
    with (decisions or PostgresDecisions()).session() as session:
        conn = session._conn
        rules = session.active_rules()
        active = {r.id for r in rules}
        sources = {"invoice"}.union(*(r.sources() for r in rules))
        for decision_id, invoice_id in conn.execute(SEED_DECISIONS).fetchall():
            have = {str(r[0]) for r in conn.execute(
                "select rule_id from decision_rule_hit where decision_id = %s", (decision_id,)).fetchall()}
            if have == active:
                continue
            decision = evaluate(rules, session.load_facts(invoice_id, sources))
            conn.execute("delete from decision_rule_hit where decision_id = %s", (decision_id,))
            for h in decision.hits:
                conn.execute(
                    """insert into decision_rule_hit (decision_id, rule_id, rule_name, effect, result, observed,
                                                      threshold, overridden_by_rule_id)
                       values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (decision_id, h.rule_id, h.rule_name, h.effect.value, h.result.value,
                     Jsonb(h.observed, dumps=json_dumps), Jsonb(h.threshold, dumps=json_dumps), h.overridden_by),
                )
            done += 1
    return done


if __name__ == "__main__":
    try:
        print(f"Backfilled hits for {backfill()} seed decisions.")
    finally:
        close_pool()
