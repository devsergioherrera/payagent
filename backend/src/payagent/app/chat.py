"""Mesa chat (V11). Gemini picks tools; the tools only read data or draft a rule. It never decides or pays."""
import logging
import time
from dataclasses import dataclass
from typing import Any, Protocol

from google.genai import types

from payagent.adapters.gemini._call import call_with_retry, record_usage
from payagent.api.schemas import ChatCard, ChatReply, InvoiceSummary, VendorView
from payagent.ports.repositories import Operations
from payagent.ports.usage import UsageMeter

log = logging.getLogger(__name__)

MAX_TURNS = 5
MAX_INVOICES = 10
MAX_VENDORS = 5
FAILED = "No pude responder ahora mismo. Inténtalo de nuevo."
RECEIVED = "Recibí la factura. La estoy revisando."

SYSTEM = """\
You are the chat of FacturaYa, a company that pays supplier invoices. You do exactly three things: \
(1) receive invoices (the user attaches the file, you do not need a tool), \
(2) help create payment rules, (3) search invoices and vendors. You never approve, reject, pay or change anything.

Tools: buscar_proveedor, buscar_factura, pendientes, redactar_regla. \
redactar_regla only produces a draft that the user confirms in the screen; tell them to review and confirm it.

The screen shows the found invoices, vendors and rule drafts as cards, so do not list their data in your answer.
Answer in Spanish, at most 2 short sentences, plain text, no markdown, no lists.
If the user asks for anything else (general questions, the time, opinions, approving or paying), refuse in one polite \
Spanish sentence saying what you can do, and call no tool.
If a search finds nothing, say so in one sentence."""

_TEXT = {"type": "object", "properties": {"texto": {"type": "string"}}, "required": ["texto"]}
TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="buscar_proveedor",
            description="Find registered vendors by part of their name or tax id.",
            parameters_json_schema={**_TEXT, "properties": {"texto": {"type": "string", "description": "Name or tax id."}}},
        ),
        types.FunctionDeclaration(
            name="buscar_factura",
            description="Find invoices (newest first, max 10) by vendor name, vendor tax id, vendor id, "
            "invoice number or amount.",
            parameters_json_schema={**_TEXT, "properties": {"texto": {"type": "string", "description": "Search text."}}},
        ),
        types.FunctionDeclaration(
            name="pendientes",
            description="List invoices waiting for a human decision (PENDING_HUMAN).",
        ),
        types.FunctionDeclaration(
            name="redactar_regla",
            description="Draft a payment rule from the user's request in natural language. Never saves it.",
            parameters_json_schema={**_TEXT, "properties": {"texto": {"type": "string", "description": "The rule request."}}},
        ),
    ]
)


class ChatQueries(Protocol):
    def search_invoices(self, text: str, limit: int = ...) -> list[InvoiceSummary]: ...
    def pending_invoices(self, limit: int = ...) -> list[InvoiceSummary]: ...
    def vendors_by_id(self, ids: list[str]) -> list[VendorView]: ...


@dataclass
class ChatService:
    client: Any
    drafter: Any  # RuleDrafter
    queries: ChatQueries
    find_vendors: Any  # Callable[[str], list[dict]]
    meter: UsageMeter
    operations: Operations
    model: str = "gemini-3.8-flash"

    def reply(self, message: str) -> ChatReply:
        op_id = self.operations.start("CHAT")
        try:
            out = self._run(message, op_id)
        except Exception as exc:
            log.exception("Chat failed")
            self.operations.finish(op_id, error=str(exc)[:500])
            return ChatReply(text=FAILED, cards=[])
        self.operations.finish(op_id)
        return out

    def _run(self, message: str, op_id: str) -> ChatReply:
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM,
            tools=[TOOLS],
            temperature=0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        contents: list[types.Content] = [types.Content(role="user", parts=[types.Part.from_text(text=message)])]
        cards: list[ChatCard] = []
        for _ in range(MAX_TURNS):
            started = time.monotonic()
            response = call_with_retry(
                lambda: self.client.models.generate_content(model=self.model, contents=contents, config=config)
            )
            record_usage(self.meter, op_id, "CHAT", self.model, response, started)
            content = response.candidates[0].content
            calls = [p.function_call for p in (content.parts or []) if p.function_call]
            if not calls:
                text = "".join(p.text or "" for p in (content.parts or []) if not p.thought).strip()
                return ChatReply(text=text or FAILED, cards=cards)
            contents.append(content)
            replies = [
                types.Part.from_function_response(name=c.name, response=self._tool(c.name, dict(c.args or {}), cards))
                for c in calls
            ]
            contents.append(types.Content(role="user", parts=replies))
        return ChatReply(text=FAILED, cards=cards)

    def _tool(self, name: str | None, args: dict[str, Any], cards: list[ChatCard]) -> dict[str, Any]:
        text = str(args.get("texto", "")).strip()
        if name == "buscar_proveedor":
            found = self.find_vendors(text, MAX_VENDORS) if text else []
            views = self.queries.vendors_by_id([v["id"] for v in found]) if found else []
            cards.extend(ChatCard(kind="vendor", vendor=v) for v in views)
            return {"proveedores": [{"nombre": v.name, "nit": v.tax_id, "pais": v.country, "estado": v.status}
                                    for v in views]}
        if name in ("buscar_factura", "pendientes"):
            rows = self.queries.search_invoices(text, MAX_INVOICES) if name == "buscar_factura" and text else (
                self.queries.pending_invoices(MAX_INVOICES) if name == "pendientes" else [])
            cards.extend(ChatCard(kind="invoice", invoice=r) for r in rows)
            return {"facturas": [{"proveedor": r.vendor_name, "numero": r.invoice_number, "monto_usd": r.amount_usd,
                                  "estado": r.state} for r in rows]}
        if name == "redactar_regla":
            drafted = self.drafter.draft(text)
            if drafted.draft is None:
                return {"error": drafted.error}
            cards.append(ChatCard(kind="rule_draft", rule_draft=drafted.draft))
            return {"borrador": drafted.draft.name, "guardado": False}
        return {"error": f"unknown tool {name!r}"}
