import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _drop_leftover_test_rules():
    """Tests share the demo database: whatever "test-*" rule a test leaves behind is removed at the end."""
    yield
    if not os.environ.get("DATABASE_URL"):
        return
    from payagent.adapters.postgres import get_pool
    from payagent.adapters.postgres.maintenance import drop_test_rules

    with get_pool().connection() as conn:
        drop_test_rules(conn)
