"""HTTP contract. Mirrored by frontend/src/lib/api-types.ts: change both or neither.

Endpoints (all under /api, all but /auth/login need the session cookie):
  POST /auth/login            LoginRequest -> 204 + cookie       POST /auth/logout -> 204
  GET  /summary               -> Summary
  GET  /invoices?outcome=&status=&q=&vendor_id=&limit=200&offset=0   -> list[InvoiceSummary] + header X-Total-Count
  POST /invoices              multipart (file) or form field `text` -> Created
  GET  /invoices/{id}         -> InvoiceDetail
  GET  /invoices/{id}/file    -> original document
  POST /invoices/{id}/resolve ResolveRequest -> InvoiceDetail    (409 unless decision.status == PENDING_HUMAN)
  GET  /rules                 -> list[RuleView]
  POST /rules/draft           DraftRequest -> DraftResponse      (never saves)
  POST /rules                 RuleDraft -> RuleView               (the human confirmation)
  POST /rules/{id}/deactivate -> RuleView
  GET  /rule-sources          -> list[RuleSourceView]
  GET  /proposals?status=     -> list[ProposalView]
  POST /proposals/run         -> ProposalRun                      (409 if one is already running)
  POST /proposals/{id}/accept -> RuleView      POST /proposals/{id}/reject -> ProposalView
  GET  /vendors?q=&status=&country=&limit=50&offset=0   -> Page[VendorView]
  GET  /purchase-orders?q=&vendor_id=&status=&with_balance=&limit=50&offset=0   -> Page[PurchaseOrderRow]
  GET  /purchase-orders/{po_number}   -> PurchaseOrderDetail
  GET  /costs                 -> Costs
  POST /chat                  multipart: `message` + optional `file` -> ChatReply
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

Outcome = Literal["PAY", "HOLD", "ESCALATE"]
DecisionStatus = Literal["FINAL", "PENDING_HUMAN", "RESOLVED"]
InvoiceStatus = Literal["RECEIVED", "EXTRACTING", "EVALUATING", "DECIDED", "FAILED"]
Effect = Literal["ALLOW", "ESCALATE", "HOLD"]
Operator = Literal[
    "EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "BETWEEN", "NOT_BETWEEN", "IS_NULL", "IS_NOT_NULL"
]
HitResult = Literal["FIRED", "PASSED", "OVERRIDDEN", "MISSING_DATA", "NOT_APPLICABLE"]
Value = str | float | bool | None | list[str | float | bool]


class LoginRequest(BaseModel):
    password: str


class Created(BaseModel):
    invoice_id: str | None  # None: the same file was already received
    duplicate_of: str | None = None


class Summary(BaseModel):
    paid: int
    held: int
    escalated: int
    pending_human: int
    processing: int
    autonomy_pct: float  # decided without a human / decided
    email_connected: bool
    email_checked_at: datetime | None


class InvoiceSummary(BaseModel):
    id: str
    status: InvoiceStatus
    vendor_name: str | None  # registered name, else the raw one
    invoice_number: str | None
    amount: float | None
    currency: str | None
    amount_usd: float | None
    received_at: datetime
    source: Literal["EMAIL", "UPLOAD", "TEXT", "CHAT", "INBOX", "SEED"]
    outcome: Outcome | None
    decision_status: DecisionStatus | None
    headline: str | None  # name of the deciding rule, e.g. "Supera el límite por pago"
    decided_by: Literal["AGENT", "HUMAN"] | None


class Hit(BaseModel):
    rule_id: str
    rule_name: str
    effect: Effect
    result: HitResult
    observed: dict[str, Value]
    threshold: dict[str, Value]
    overridden_by: str | None


class Approval(BaseModel):
    verdict: Literal["APPROVED", "REJECTED"]
    note: str | None
    approver: str
    created_at: datetime


class OperationCost(BaseModel):
    cost_usd: float
    duration_ms: int
    input_tokens: int
    output_tokens: int


class Extracted(BaseModel):
    vendor_name_raw: str | None
    vendor_tax_id: str | None
    invoice_number: str | None
    amount: float | None
    currency: str | None
    fx_rate: float | None
    amount_usd: float | None
    issue_date: date | None
    due_date: date | None
    po_number: str | None
    bank_account: str | None
    confidence: float | None


class TimelineStep(BaseModel):
    label: str  # "Factura recibida", "Datos extraídos", "Decisión: Escalada", "Notificación enviada"
    detail: str | None
    at: datetime


class InvoiceDetail(BaseModel):
    summary: InvoiceSummary
    vendor_id: str | None
    extracted: Extracted
    explanation: str | None
    hits: list[Hit]
    approval: Approval | None
    timeline: list[TimelineStep]
    cost: OperationCost | None
    file_url: str
    error: str | None


class ResolveRequest(BaseModel):
    verdict: Literal["APPROVED", "REJECTED"]
    note: str | None = None  # required when REJECTED


class ConditionView(BaseModel):
    source: str
    column: str
    operator: Operator
    value: Value = None
    value_source: str | None = None
    value_column: str | None = None
    text: str  # human reading, e.g. "Factura · monto en USD > 5.000"


class RuleDraft(BaseModel):
    name: str
    natural_language: str
    effect: Effect
    overridable: bool
    conditions: list[ConditionView]


class RuleView(RuleDraft):
    id: str
    origin: Literal["HUMAN", "AGENT"]
    proposed_by: str
    proposed_at: datetime
    approved_by: str
    approved_at: datetime
    active: bool
    times_fired: int


class DraftRequest(BaseModel):
    text: str


class DraftResponse(BaseModel):
    draft: RuleDraft | None
    error: str | None  # e.g. "No hay una fuente con datos de inventario"


class ColumnView(BaseModel):
    name: str
    data_type: Literal["number", "text", "boolean", "date"]
    description: str


class RuleSourceView(BaseModel):
    name: str
    label: str
    description: str
    columns: list[ColumnView]


class ProposalView(BaseModel):
    id: str
    draft: RuleDraft
    rationale: str
    evidence: list[InvoiceSummary]
    status: Literal["PENDING", "ACCEPTED", "REJECTED"]
    created_at: datetime


class ProposalRun(BaseModel):
    operation_id: str
    reviewed: int
    created: list[ProposalView]


class PurchaseOrderView(BaseModel):
    po_number: str
    amount: float
    currency: str
    status: Literal["OPEN", "CLOSED"]
    description: str | None


class VendorView(BaseModel):
    id: str
    name: str
    tax_id: str
    country: Literal["CO", "MX", "BR", "US"]
    currency: str
    bank_rail: Literal["ACH", "WIRE", "BRE_B", "SPEI", "PIX"]
    bank_account: str
    status: Literal["ALLOWED", "BLOCKED"]
    purchase_orders: list[PurchaseOrderView]
    invoices: int
    paid_usd: float


class Page[T](BaseModel):
    items: list[T]
    total: int


class PurchaseOrderRow(BaseModel):
    po_number: str
    vendor_id: str
    vendor_name: str
    description: str | None
    amount: float
    currency: str
    amount_usd: float
    invoiced_usd: float  # invoices citing the PO that were paid or approved
    remaining_usd: float
    invoices: int
    status: Literal["OPEN", "CLOSED"]
    last_invoice_at: datetime | None


class PurchaseOrderDetail(BaseModel):
    po: PurchaseOrderRow
    invoices: list[InvoiceSummary]


class OperationRow(BaseModel):
    id: str
    type: Literal["PROCESS_INVOICE", "PROPOSE_RULES", "CHAT", "RULE_DRAFT"]
    status: Literal["RUNNING", "DONE", "FAILED"]
    invoice_id: str | None
    started_at: datetime
    cost: OperationCost


class CostByType(BaseModel):
    type: str
    operations: int
    total_usd: float
    avg_usd: float


class Costs(BaseModel):
    today_usd: float
    month_usd: float
    operations: int
    input_tokens: int
    output_tokens: int
    by_type: list[CostByType]
    recent: list[OperationRow]


class ChatCard(BaseModel):
    kind: Literal["invoice", "vendor", "rule_draft"]
    invoice: InvoiceSummary | None = None
    vendor: VendorView | None = None
    rule_draft: RuleDraft | None = None


class ChatReply(BaseModel):
    text: str
    cards: list[ChatCard]
    invoice_id: str | None = None  # set when the message carried an invoice to process
