import logging
import mimetypes
from datetime import date
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse

from payagent.adapters.postgres.queries import ApiQueries, NotFound, NotPending
from payagent.api.deps import get_invoices, get_notifier, get_pipeline, get_proposals, get_queries, get_storage
from payagent.api.schemas import Created, InvoiceDetail, InvoiceState, InvoiceSummary, ResolveRequest
from payagent.adapters.postgres.notifications import PostgresNotifications
from payagent.app.process_invoice import process_invoice
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument, SourceType

log = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices")


@router.get("")
def list_invoices(
    response: Response,
    state: InvoiceState | None = None, q: str | None = None, vendor_id: str | None = None,
    date_from: date | None = Query(None, alias="from"), date_to: date | None = Query(None, alias="to"),
    limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0),
    queries: ApiQueries = Depends(get_queries),
) -> list[InvoiceSummary]:
    vendor_id = vendor_id or None
    response.headers["X-Total-Count"] = str(queries.count_invoices(state, q, vendor_id, date_from, date_to))
    return queries.list_invoices(state, q, limit, offset, vendor_id, date_from, date_to)


@router.post("")
def create_invoice(
    background: BackgroundTasks,
    file: UploadFile | None = None,
    text: str | None = Form(default=None),
    queries: ApiQueries = Depends(get_queries),
    storage=Depends(get_storage),
    invoices=Depends(get_invoices),
    pipeline=Depends(get_pipeline),
    notifier=Depends(get_notifier),
) -> Created:
    if file is not None and file.filename:
        doc = document_from_upload(file)
    elif text and text.strip():
        doc = IncomingDocument(SourceType.TEXT, "web:text", "pegado.txt", "text/plain", text.encode())
    else:
        raise HTTPException(status_code=422, detail="Sube un archivo o pega el texto de la factura")
    return receive_document(doc, background, queries, storage, invoices, pipeline, notifier)


def document_from_upload(file: UploadFile) -> IncomingDocument:
    content = file.file.read()
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    return IncomingDocument(SourceType.UPLOAD, f"upload:{file.filename}", file.filename, content_type, content)


def receive_document(doc, background, queries, storage, invoices, pipeline, notifier) -> Created:
    """Store the document, create its invoice and process it in the background. Shared with POST /chat."""
    if not doc.content:
        raise HTTPException(status_code=422, detail="El archivo está vacío")

    stored = storage.save(doc.content, doc.filename)
    invoice_id = invoices.create(doc, stored.sha256, str(stored.path))
    if invoice_id is None:
        # Same file again: only an unreadable one is retried, on its existing invoice.
        invoice_id = invoices.retryable(stored.sha256)
        if invoice_id is None:
            return Created(invoice_id=None, duplicate_of=queries.invoice_id_by_sha(stored.sha256))
    background.add_task(
        process_invoice, doc, storage, pipeline, notifier, settings.public_base_url,
        notifications=PostgresNotifications(), approver_email=settings.approver_email, invoice_id=invoice_id,
    )
    return Created(invoice_id=invoice_id)


@router.get("/{invoice_id}")
def invoice_detail(invoice_id: str, queries: ApiQueries = Depends(get_queries)) -> InvoiceDetail:
    try:
        return queries.invoice_detail(invoice_id)
    except NotFound:
        raise HTTPException(status_code=404, detail="Factura no encontrada")


@router.get("/{invoice_id}/file")
def invoice_file(invoice_id: str, queries: ApiQueries = Depends(get_queries)) -> FileResponse:
    try:
        path, content_type = queries.invoice_file(invoice_id)
    except NotFound:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if not Path(path).is_file():
        raise HTTPException(status_code=404, detail="El archivo ya no está disponible")
    return FileResponse(path, media_type=content_type or "application/octet-stream")


@router.post("/{invoice_id}/resolve")
def resolve(
    invoice_id: str, body: ResolveRequest, background: BackgroundTasks,
    queries: ApiQueries = Depends(get_queries), proposals=Depends(get_proposals),
) -> InvoiceDetail:
    note = (body.note or "").strip() or None
    if body.verdict == "REJECTED" and note is None:
        raise HTTPException(status_code=422, detail="Rechazar requiere una nota")
    try:
        detail = queries.resolve(invoice_id, body.verdict, note, settings.admin_name)
    except NotFound:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    except NotPending:
        raise HTTPException(status_code=409, detail="Esta factura no está pendiente de revisión")
    background.add_task(learn_from_resolution, proposals, invoice_id)
    return detail


def learn_from_resolution(proposals, invoice_id: str) -> None:
    """The agent notices a pattern on its own. Never raises: the resolution already succeeded."""
    try:
        proposals.learn_from(invoice_id)
    except Exception:
        log.exception("could not learn from resolution of %s", invoice_id)
