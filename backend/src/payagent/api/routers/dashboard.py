from fastapi import APIRouter, Depends, HTTPException, Query

from payagent.adapters.postgres.queries import ApiQueries, NotFound
from payagent.api.deps import get_queries
from payagent.api.schemas import ActivityItem, Costs, Page, Summary, VendorView
from payagent.config import settings

router = APIRouter()


@router.get("/summary")
def summary(queries: ApiQueries = Depends(get_queries)) -> Summary:
    return queries.summary(stale_after_s=max(60, 3 * settings.imap_poll_seconds))


@router.get("/vendors")
def vendors(
    q: str | None = None, status: str | None = None, country: str | None = None,
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    queries: ApiQueries = Depends(get_queries),
) -> Page[VendorView]:
    return queries.vendors(q, status or None, country or None, limit, offset)


@router.get("/vendors/{vendor_id}")
def vendor(vendor_id: str, queries: ApiQueries = Depends(get_queries)) -> VendorView:
    try:
        return queries.vendor(vendor_id)
    except NotFound:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado") from None


@router.get("/costs")
def costs(queries: ApiQueries = Depends(get_queries)) -> Costs:
    return queries.costs()


@router.get("/activity")
def activity(limit: int = Query(20, ge=1, le=100), queries: ApiQueries = Depends(get_queries)) -> list[ActivityItem]:
    return queries.activity(limit)
