// The only way screens talk to the backend. With NEXT_PUBLIC_USE_MOCKS=1 every call returns lib/mocks.ts data.
import type {
  ChatReply, Costs, Created, DraftResponse, InvoiceDetail, InvoiceSummary, Outcome, ProposalRun,
  ProposalView, ResolveRequest, RuleDraft, RuleSourceView, RuleView, Summary, VendorView,
} from "./api-types";
import * as mocks from "./mocks";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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

export interface InvoiceFilters { outcome?: Outcome; status?: string; q?: string }

export const api = {
  login: (password: string) => (USE_MOCKS ? mock(undefined) : request<void>("/auth/login", json({ password }))),
  logout: () => (USE_MOCKS ? mock(undefined) : request<void>("/auth/logout", { method: "POST" })),

  summary: () => (USE_MOCKS ? mock<Summary>(mocks.summary) : request<Summary>("/summary")),

  invoices: (f: InvoiceFilters = {}) => {
    if (USE_MOCKS) return mock(mocks.invoices.filter((i) => !f.outcome || i.outcome === f.outcome));
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    return request<InvoiceSummary[]>(`/invoices?${qs}`);
  },
  invoice: (id: string) =>
    USE_MOCKS ? mock<InvoiceDetail>(mocks.invoiceDetail) : request<InvoiceDetail>(`/invoices/${id}`),
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
  draftRule: (text: string) =>
    USE_MOCKS
      ? mock<DraftResponse>({ draft: { ...mocks.rules[0], natural_language: text }, error: null })
      : request<DraftResponse>("/rules/draft", json({ text })),
  createRule: (draft: RuleDraft) =>
    USE_MOCKS ? mock<RuleView>({ ...mocks.rules[0], ...draft, id: "new" }) : request<RuleView>("/rules", json(draft)),
  deactivateRule: (id: string) =>
    USE_MOCKS ? mock<RuleView>({ ...mocks.rules[0], active: false }) : request<RuleView>(`/rules/${id}/deactivate`, { method: "POST" }),
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

  vendors: () => (USE_MOCKS ? mock<VendorView[]>(mocks.vendors) : request<VendorView[]>("/vendors")),
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
