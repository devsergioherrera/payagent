from psycopg import Connection

# Rules left behind by tests ("test-*"). A replacement points at the rule it replaced, so unlink before deleting.
_TEST_RULES = (
    "delete from decision_rule_hit where rule_id in (select id from rule where name like 'test-%')",
    "delete from rule_condition where rule_id in (select id from rule where name like 'test-%')",
    "update rule set replaces_rule_id = null where name like 'test-%'",
    "delete from rule where name like 'test-%'",
)


def drop_test_rules(conn: Connection) -> int:
    count = conn.execute("select count(*) from rule where name like 'test-%'").fetchone()[0]
    for statement in _TEST_RULES:
        conn.execute(statement)
    return count
