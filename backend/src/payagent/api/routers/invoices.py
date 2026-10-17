import mimetypes
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from payagent.adapters.postgres.queries import ApiQueries, NotFound, NotPending
from payagent.api.deps import get_invoices, get_notifier, get_pipeline, get_queries, get_storage
from payagent.api.schemas import Created, InvoiceDetail, InvoiceSummary, ResolveRequest
from payagent.adapters.postgres.notifications import PostgresNotifications
from payagent.app.process_invoice import process_invoice
from payagent.config import settings
from payagent.ports.invoice_source import IncomingDocument, SourceType

router = APIRouter(prefix="/invoices")


@router.get("")
def list_invoices(
    outcome: str | None = None, status: str | None = None, q: str | None = None,
    queries: ApiQueries = Depends(get_queries),
) -> list[InvoiceSummary]:
    return queries.list_invoices(outcome or None, status or None, q)


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
        content = file.file.read()
        content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        doc = IncomingDocument(SourceType.UPLOAD, f"upload:{file.filename}", file.filename, content_type, content)
    elif text and text.strip():
        doc = IncomingDocument(SourceType.TEXT, "web:text", "pegado.txt", "text/plain", text.encode())
    else:
        raise HTTPException(status_code=422, detail="Sube un archivo o pega el texto de la factura")
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
def resolve(invoice_id: str, body: ResolveRequest, queries: ApiQueries = Depends(get_queries)) -> InvoiceDetail:
    note = (body.note or "").strip() or None
    if body.verdict == "REJECTED" and note is None:
        raise HTTPException(status_code=422, detail="Rechazar requiere una nota")
    try:
        return queries.resolve(invoice_id, body.verdict, note, settings.admin_name)
    except NotFound:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    except NotPending:
        raise HTTPException(status_code=409, detail="Esta factura no está pendiente de revisión")
