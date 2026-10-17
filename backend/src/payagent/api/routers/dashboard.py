from fastapi import APIRouter, Depends

from payagent.adapters.postgres.queries import ApiQueries
from payagent.api.deps import get_queries
from payagent.api.schemas import Costs, Summary, VendorView
from payagent.config import settings

router = APIRouter()


@router.get("/summary")
def summary(queries: ApiQueries = Depends(get_queries)) -> Summary:
    return queries.summary(stale_after_s=max(60, 3 * settings.imap_poll_seconds))


@router.get("/vendors")
def vendors(queries: ApiQueries = Depends(get_queries)) -> list[VendorView]:
    return queries.vendors()


@router.get("/costs")
def costs(queries: ApiQueries = Depends(get_queries)) -> Costs:
    return queries.costs()
