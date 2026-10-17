from fastapi import APIRouter, Depends, HTTPException, Query

from payagent.adapters.postgres.queries import ApiQueries, NotFound
from payagent.api.deps import get_queries
from payagent.api.schemas import Page, PurchaseOrderDetail, PurchaseOrderRow

router = APIRouter(prefix="/purchase-orders")


@router.get("")
def list_purchase_orders(
    q: str | None = None, vendor_id: str | None = None, status: str | None = None, with_balance: bool = False,
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    queries: ApiQueries = Depends(get_queries),
) -> Page[PurchaseOrderRow]:
    return queries.purchase_orders(q, vendor_id or None, status or None, with_balance, limit, offset)


@router.get("/{po_number}")
def purchase_order(po_number: str, queries: ApiQueries = Depends(get_queries)) -> PurchaseOrderDetail:
    try:
        return queries.purchase_order(po_number)
    except NotFound:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada") from None
