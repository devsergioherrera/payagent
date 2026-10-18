// Mirror of backend/src/payagent/api/schemas.py. Change both or neither.
// All endpoints live under /api and need the session cookie except POST /api/auth/login.

export type Outcome = "PAY" | "HOLD" | "ESCALATE";
export type DecisionStatus = "FINAL" | "PENDING_HUMAN" | "RESOLVED";
export type InvoiceStatus = "RECEIVED" | "EXTRACTING" | "EVALUATING" | "DECIDED" | "FAILED";
export type InvoiceState = "PROCESSING" | "FAILED" | "PAID" | "HELD" | "WAITING" | "APPROVED" | "REJECTED";
export type Effect = "ALLOW" | "ESCALATE" | "HOLD";
export type Operator =
  | "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "NOT_IN"
  | "BETWEEN" | "NOT_BETWEEN" | "IS_NULL" | "IS_NOT_NULL";
export type HitResult = "FIRED" | "PASSED" | "OVERRIDDEN" | "MISSING_DATA" | "NOT_APPLICABLE";
export type Value = string | number | boolean | null | Array<string | number | boolean>;
export type Source = "EMAIL" | "UPLOAD" | "TEXT" | "CHAT" | "INBOX" | "SEED";

export interface Created { invoice_id: string | null; duplicate_of: string | null }

export interface Summary {
  paid: number; waiting: number; held: number; rejected: number; processing: number;
  autonomy_pct: number; email_connected: boolean; email_checked_at: string | null;
}

export interface InvoiceSummary {
  id: string; status: InvoiceStatus; state: InvoiceState; vendor_name: string | null; invoice_number: string | null;
  amount: number | null; currency: string | null; amount_usd: number | null; received_at: string;
  source: Source; outcome: Outcome | null; decision_status: DecisionStatus | null;
  headline: string | null; decided_by: "AGENT" | "HUMAN" | null;
}

export interface Hit {
  rule_id: string; rule_name: string; effect: Effect; result: HitResult;
  observed: Record<string, Value>; threshold: Record<string, Value>; overridden_by: string | null;
}

export interface Approval { verdict: "APPROVED" | "REJECTED"; note: string | null; approver: string; created_at: string }
export interface OperationCost { cost_usd: number; duration_ms: number; input_tokens: number; output_tokens: number }

export interface Extracted {
  vendor_name_raw: string | null; vendor_tax_id: string | null; invoice_number: string | null;
  amount: number | null; currency: string | null; fx_rate: number | null; amount_usd: number | null;
  issue_date: string | null; due_date: string | null; po_number: string | null;
  bank_account: string | null; confidence: number | null;
}

export interface TimelineStep { label: string; detail: string | null; at: string }

export interface LearnedRule { id: string; name: string; approved_at: string }

export interface InvoiceDetail {
  summary: InvoiceSummary; vendor_id: string | null; extracted: Extracted; explanation: string | null;
  hits: Hit[]; approval: Approval | null; timeline: TimelineStep[]; cost: OperationCost | null;
  file_url: string; error: string | null;
  learned_rule: LearnedRule | null; // an agent-learned rule that let this paid invoice through
}

export interface ResolveRequest { verdict: "APPROVED" | "REJECTED"; note?: string | null }

export interface ConditionView {
  source: string; column: string; operator: Operator; value?: Value;
  value_source?: string | null; value_column?: string | null; text: string;
}

export interface RuleDraft {
  name: string; natural_language: string; effect: Effect; overridable: boolean; conditions: ConditionView[];
  summary: string; // plain sentence, e.g. "Pide tu aprobación cuando el monto supere USD 5.000"
}

export interface RuleCreate extends RuleDraft { replaces_rule_id?: string | null }

export interface RuleView extends RuleDraft {
  id: string; origin: "HUMAN" | "AGENT"; proposed_by: string; proposed_at: string;
  approved_by: string; approved_at: string; active: boolean; times_fired: number;
  replaced_by: { id: string; name: string } | null;
  deactivated_at: string | null; deactivated_by: string | null;
}

export interface DraftResponse { draft: RuleDraft | null; error: string | null }

export interface ColumnView { name: string; data_type: "number" | "text" | "boolean" | "date"; description: string }
export interface RuleSourceView { name: string; label: string; description: string; columns: ColumnView[] }

export interface TraceStep { label: string; detail: string | null }
export interface ProposalView {
  id: string; draft: RuleDraft; rationale: string; evidence: InvoiceSummary[];
  status: "PENDING" | "ACCEPTED" | "REJECTED"; created_at: string;
  trace: TraceStep[]; // how the run that created it reached it
}
export interface ProposalRun { operation_id: string; reviewed: number; created: ProposalView[]; trace: TraceStep[] }

export interface PurchaseOrderView {
  po_number: string; amount: number; currency: string; status: "OPEN" | "CLOSED"; description: string | null;
}
export interface VendorView {
  id: string; name: string; tax_id: string; country: "CO" | "MX" | "BR" | "US"; currency: string;
  bank_rail: "ACH" | "WIRE" | "BRE_B" | "SPEI" | "PIX"; bank_account: string; status: "ALLOWED" | "BLOCKED";
  purchase_orders: PurchaseOrderView[]; invoices: number; paid_usd: number;
}

export interface Page<T> { items: T[]; total: number }
export interface PurchaseOrderRow {
  po_number: string; vendor_id: string; vendor_name: string; description: string | null;
  amount: number; currency: string; amount_usd: number; invoiced_usd: number; remaining_usd: number;
  invoices: number; status: "OPEN" | "CLOSED"; last_invoice_at: string | null;
}
export interface PurchaseOrderDetail { po: PurchaseOrderRow; invoices: InvoiceSummary[] }

export type OperationType = "PROCESS_INVOICE" | "PROPOSE_RULES" | "CHAT" | "RULE_DRAFT";
export interface OperationRow {
  id: string; type: OperationType; status: "RUNNING" | "DONE" | "FAILED"; invoice_id: string | null;
  started_at: string; cost: OperationCost;
}
export interface CostByType { type: string; operations: number; total_usd: number; avg_usd: number }
export interface Costs {
  today_usd: number; month_usd: number; operations: number; input_tokens: number; output_tokens: number;
  by_type: CostByType[]; recent: OperationRow[];
}

export interface ChatCard {
  kind: "invoice" | "vendor" | "rule_draft";
  invoice?: InvoiceSummary | null; vendor?: VendorView | null; rule_draft?: RuleDraft | null;
}
export interface ChatReply { text: string; cards: ChatCard[]; invoice_id?: string | null }

export type ActivityKind = Exclude<InvoiceState, "PROCESSING" | "FAILED"> | "LEARNED" | "EMAIL_FAILED";
export interface ActivityItem {
  id: string; kind: ActivityKind; title: string; detail: string;
  invoice_id?: string | null; proposal_id?: string | null; at: string;
}

export interface BudgetStatus {
  period: string; amount_usd: number; paid_usd: number; approved_usd: number; available_usd: number; invoices_paid: number;
}
export type PolicyKey = "payment_limit" | "human_approval" | "po_tolerance" | "po_overdraft" | "date_window";
export interface PolicyLimit {
  key: PolicyKey; label: string; rule_id: string; value: number | null; unit: "USD" | "%" | "días"; effect: Effect; active: boolean;
}
export interface Policy { budget: BudgetStatus; limits: PolicyLimit[]; blocked_vendors: number; exceptions: number }
export interface BudgetUpdate { period: string; amount_usd: number }
