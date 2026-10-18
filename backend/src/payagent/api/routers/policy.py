from fastapi import APIRouter, Depends

from payagent.adapters.postgres.policy import PolicyQueries
from payagent.api.deps import get_policy_queries
from payagent.api.schemas import BudgetUpdate, Policy

router = APIRouter()


@router.get("/policy")
def policy(queries: PolicyQueries = Depends(get_policy_queries)) -> Policy:
    return queries.policy()


# The app has a single admin session, so the session check on the router is the admin check.
@router.put("/budget")
def set_budget(body: BudgetUpdate, queries: PolicyQueries = Depends(get_policy_queries)) -> Policy:
    return queries.set_budget(body.period, body.amount_usd)
