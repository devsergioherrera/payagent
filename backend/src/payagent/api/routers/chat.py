from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile

from payagent.adapters.postgres.queries import ApiQueries
from payagent.api.deps import get_chat, get_invoices, get_notifier, get_pipeline, get_queries, get_storage
from payagent.api.routers.invoices import document_from_upload, receive_document
from payagent.api.schemas import ChatCard, ChatReply
from payagent.app.chat import RECEIVED

router = APIRouter()


@router.post("/chat")
def chat(
    background: BackgroundTasks,
    message: str = Form(default=""),
    file: UploadFile | None = None,
    queries: ApiQueries = Depends(get_queries),
    service=Depends(get_chat),
    storage=Depends(get_storage),
    invoices=Depends(get_invoices),
    pipeline=Depends(get_pipeline),
    notifier=Depends(get_notifier),
) -> ChatReply:
    if file is not None and file.filename:
        created = receive_document(
            document_from_upload(file), background, queries, storage, invoices, pipeline, notifier
        )
        invoice_id = created.invoice_id or created.duplicate_of
        if invoice_id is None:
            raise HTTPException(status_code=422, detail="No pude recibir la factura")
        text = RECEIVED if created.invoice_id else "Esa factura ya la había recibido."
        card = ChatCard(kind="invoice", invoice=queries.invoice_summary(invoice_id))
        return ChatReply(text=text, cards=[card], invoice_id=invoice_id)
    if not message.strip():
        raise HTTPException(status_code=422, detail="Escribe un mensaje o adjunta una factura")
    return service.reply(message.strip())
