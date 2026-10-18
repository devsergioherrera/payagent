// The only way screens talk to the backend. With NEXT_PUBLIC_USE_MOCKS=1 every call returns lib/mocks.ts data.
import type {
  ActivityItem, BudgetUpdate, ChatReply, Costs, Created, DraftResponse, InvoiceDetail, InvoiceSummary, Outcome, ProposalRun,
  Page, ProposalView, PurchaseOrderDetail, Policy, PurchaseOrderRow, ResolveRequest, RuleDraft, RuleSourceView, RuleView, Summary, VendorView,
} from "./api-types";
import * as mocks from "./mocks";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof Error) return e.message;
  return "Algo salió mal";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include", ...init });
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const mock = <T,>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(value)), 150));

export interface InvoiceFilters {
  outcome?: Outcome; status?: string; q?: string; vendor_id?: string; from?: string; to?: string;
  limit?: number; offset?: number;
}
export interface VendorFilters { q?: string; status?: string; country?: string; limit?: number; offset?: number }
export interface PurchaseOrderFilters {
  q?: string; vendor_id?: string; status?: string; with_balance?: boolean; limit?: number; offset?: number;
}

const query = (f: object) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && v !== false).map(([k, v]) => [k, String(v)]));

export const api = {
  login: (password: string) => (USE_MOCKS ? mock(undefined) : request<void>("/auth/login", json({ password }))),
  logout: () => (USE_MOCKS ? mock(undefined) : request<void>("/auth/logout", { method: "POST" })),

  summary: () => (USE_MOCKS ? mock<Summary>(mocks.summary) : request<Summary>("/summary")),

  invoices: (f: InvoiceFilters = {}) => {
    if (USE_MOCKS) return mock(mocks.invoicesFor(f).items);
    return request<InvoiceSummary[]>(`/invoices?${query(f)}`);
  },
  // Same list with the total behind the filters (X-Total-Count), for pagination.
  invoicesPage: async (f: InvoiceFilters = {}): Promise<Page<InvoiceSummary>> => {
    if (USE_MOCKS) return mock(mocks.invoicesFor(f));
    const res = await fetch(`/api/invoices?${query(f)}`, { credentials: "include" });
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    if (!res.ok) throw new ApiError(res.status, `Error ${res.status}`);
    const items: InvoiceSummary[] = await res.json();
    return { items, total: Number(res.headers.get("X-Total-Count") ?? items.length) };
  },
  invoice: (id: string) =>
    USE_MOCKS
      ? mocks.invoiceDetails[id] || /^i-\d+$/.test(id)
        ? mock<InvoiceDetail>(mocks.invoiceDetails[id] ?? mocks.invoiceDetail)
        : Promise.reject(new ApiError(404, "Factura no encontrada"))
      : request<InvoiceDetail>(`/invoices/${id}`),
  upload: (file: File | null, text?: string) => {
    if (USE_MOCKS) return mock<Created>({ invoice_id: "i-2045", duplicate_of: null });
    const form = new FormData();
    if (file) form.append("file", file);
    if (text) form.append("text", text);
    return request<Created>("/invoices", { method: "POST", body: form });
  },
  resolve: (id: string, body: ResolveRequest) =>
    USE_MOCKS ? mock<InvoiceDetail>(mocks.invoiceDetail) : request<InvoiceDetail>(`/invoices/${id}/resolve`, json(body)),

  rules: () => (USE_MOCKS ? mock<RuleView[]>(mocks.rules) : request<RuleView[]>("/rules")),
  draftRule: (text: string, invoiceId?: string | null) =>
    USE_MOCKS
      ? mock<DraftResponse>({ draft: { ...mocks.rules[/déjalo|permite|pase/i.test(text) ? 2 : 0], natural_language: text }, error: null })
      : request<DraftResponse>("/rules/draft", json({ text, invoice_id: invoiceId ?? null })),
  reviseRule: (id: string, instruction: string) =>
    USE_MOCKS
      ? mock<DraftResponse>({ draft: mocks.revised(id, instruction), error: null })
      : request<DraftResponse>(`/rules/${id}/revise`, json({ instruction })),
  createRule: (draft: RuleDraft, replacesRuleId?: string) =>
    USE_MOCKS
      ? mock<RuleView>({ ...mocks.rules[0], ...draft, id: "new" })
      : request<RuleView>("/rules", json({ ...draft, replaces_rule_id: replacesRuleId ?? null })),
  deactivateRule: (id: string) =>
    USE_MOCKS ? mock<RuleView>({ ...mocks.rules[0], active: false }) : request<RuleView>(`/rules/${id}/deactivate`, { method: "POST" }),
  activateRule: (id: string) =>
    USE_MOCKS ? mock<RuleView>({ ...mocks.rules[0], active: true }) : request<RuleView>(`/rules/${id}/activate`, { method: "POST" }),
  ruleSources: () => (USE_MOCKS ? mock<RuleSourceView[]>([]) : request<RuleSourceView[]>("/rule-sources")),

  proposals: (status = "PENDING") =>
    USE_MOCKS ? mock<ProposalView[]>(mocks.proposals) : request<ProposalView[]>(`/proposals?status=${status}`),
  runProposals: () =>
    USE_MOCKS
      ? mock<ProposalRun>({ operation_id: "o2", reviewed: 3, created: mocks.proposals })
      : request<ProposalRun>("/proposals/run", { method: "POST" }),
  acceptProposal: (id: string) =>
    USE_MOCKS ? mock<RuleView>(mocks.rules[2]) : request<RuleView>(`/proposals/${id}/accept`, { method: "POST" }),
  rejectProposal: (id: string) =>
    USE_MOCKS
      ? mock<ProposalView>({ ...mocks.proposals[0], status: "REJECTED" })
      : request<ProposalView>(`/proposals/${id}/reject`, { method: "POST" }),

  vendors: (f: VendorFilters = {}) =>
    USE_MOCKS ? mock<Page<VendorView>>(mocks.vendorPage(f)) : request<Page<VendorView>>(`/vendors?${query(f)}`),
  vendor: (id: string) =>
    USE_MOCKS
      ? mock<VendorView>(mocks.vendors.find((v) => v.id === id) ?? mocks.vendors[0])
      : request<VendorView>(`/vendors/${id}`),
  purchaseOrders: (f: PurchaseOrderFilters = {}) =>
    USE_MOCKS
      ? mock<Page<PurchaseOrderRow>>(mocks.purchaseOrderPage(f))
      : request<Page<PurchaseOrderRow>>(`/purchase-orders?${query(f)}`),
  purchaseOrder: (poNumber: string) =>
    USE_MOCKS
      ? mock<PurchaseOrderDetail>(mocks.purchaseOrderDetail(poNumber))
      : request<PurchaseOrderDetail>(`/purchase-orders/${encodeURIComponent(poNumber)}`),
  activity: (limit = 20) =>
    USE_MOCKS ? mock<ActivityItem[]>(mocks.activity()) : request<ActivityItem[]>(`/activity?limit=${limit}`),
  policy: () => (USE_MOCKS ? mock<Policy>(mocks.policy) : request<Policy>("/policy")),
  setBudget: (body: BudgetUpdate) => {
    if (!USE_MOCKS) return request<Policy>("/budget", { ...json(body), method: "PUT" });
    mocks.policy.budget.amount_usd = body.amount_usd;
    mocks.policy.budget.available_usd = body.amount_usd - mocks.policy.budget.paid_usd - mocks.policy.budget.approved_usd;
    return mock<Policy>(mocks.policy);
  },
  costs: () => (USE_MOCKS ? mock<Costs>(mocks.costs) : request<Costs>("/costs")),

  chat: (message: string, file?: File | null) => {
    if (USE_MOCKS) {
      return mock<ChatReply>({
        text: "Encontré 2 facturas de Servicios Cloud Andinos.",
        cards: mocks.invoices.slice(2, 4).map((invoice) => ({ kind: "invoice" as const, invoice })),
      });
    }
    const form = new FormData();
    form.append("message", message);
    if (file) form.append("file", file);
    return request<ChatReply>("/chat", { method: "POST", body: form });
  },
};
