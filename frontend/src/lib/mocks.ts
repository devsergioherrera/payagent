// Example data with the exact API shapes. Screens build against this until the API is live.
import type {
  Costs, InvoiceDetail, InvoiceSummary, Page, ProposalView, PurchaseOrderDetail, PurchaseOrderRow, RuleView, Summary,
  VendorView,
} from "./api-types";

export const summary: Summary = {
  paid: 6, held: 2, escalated: 3, pending_human: 3, processing: 1,
  autonomy_pct: 54.5, email_connected: true, email_checked_at: "2026-10-17T21:40:08Z",
};

const inv = (p: Partial<InvoiceSummary> & Pick<InvoiceSummary, "id">): InvoiceSummary => ({
  status: "DECIDED", vendor_name: null, invoice_number: null, amount: null, currency: "USD",
  amount_usd: null, received_at: "2026-10-17T14:12:00Z", source: "EMAIL", outcome: "PAY",
  decision_status: "FINAL", headline: null, decided_by: "AGENT", ...p,
});

export const invoices: InvoiceSummary[] = [
  inv({ id: "i-2045", status: "EVALUATING", vendor_name: "Comercializadora Aurora S.A.S.", invoice_number: "FV-2045", amount: 5920000, currency: "COP", amount_usd: 1480, outcome: null, decision_status: null, decided_by: null }),
  inv({ id: "i-2044", vendor_name: "Northwind Software Inc.", invoice_number: "NW-8812", amount: 1950, amount_usd: 1950, outcome: "ESCALATE", decision_status: "PENDING_HUMAN", headline: "Sin orden de compra" }),
  inv({ id: "i-2043", vendor_name: "Servicios Cloud Andinos S.A.S.", invoice_number: "FV-2043", amount: 12400, amount_usd: 12400, outcome: "ESCALATE", decision_status: "PENDING_HUMAN", headline: "Umbral de aprobación humana" }),
  inv({ id: "i-2042", vendor_name: "Logística del Bajío S.A. de C.V.", invoice_number: "A-3391", amount: 58000, currency: "MXN", amount_usd: 3190, source: "UPLOAD" }),
  inv({ id: "i-2041", vendor_name: "Tecnologia Paulista Ltda.", invoice_number: "NF-7781", amount: 15000, currency: "BRL", amount_usd: 2700 }),
  inv({ id: "i-2040", vendor_name: "Comercializadora Aurora S.A.S.", invoice_number: "FV-2031", amount: 4800000, currency: "COP", amount_usd: 1200, outcome: "HOLD", decision_status: "PENDING_HUMAN", headline: "Factura duplicada" }),
  inv({ id: "i-2039", vendor_name: "Distribuciones Orión S.A.S.", invoice_number: "DO-114", amount: 3560000, currency: "COP", amount_usd: 890, outcome: "HOLD", decision_status: "RESOLVED", headline: "Proveedor bloqueado", decided_by: "HUMAN" }),
  inv({ id: "i-2038", vendor_name: "Servicios Cloud Andinos S.A.S.", invoice_number: "FV-2030", amount: 4500, amount_usd: 4500, source: "CHAT" }),
];

export const invoiceDetail: InvoiceDetail = {
  summary: invoices[2],
  vendor_id: "10000000-0000-0000-0000-000000000002",
  extracted: {
    vendor_name_raw: "Servicios Cloud Andinos SAS", vendor_tax_id: "9015552221", invoice_number: "FV-2043",
    amount: 12400, currency: "USD", fx_rate: 1, amount_usd: 12400, issue_date: "2026-10-16",
    due_date: "2026-10-30", po_number: "PO-1006", bank_account: "BCOL55522201", confidence: 0.97,
  },
  explanation:
    "La factura de Servicios Cloud Andinos por USD 12,400 supera el umbral de aprobación humana de USD 10,000. El proveedor, la cuenta bancaria y la orden de compra PO-1006 cumplen. Necesita tu aprobación.",
  hits: [
    { rule_id: "r6", rule_name: "Umbral de aprobación humana", effect: "ESCALATE", result: "FIRED", observed: { "invoice.amount_usd": 12400 }, threshold: { "invoice.amount_usd": 10000 }, overridden_by: null },
    { rule_id: "r5", rule_name: "Límite por pago", effect: "ESCALATE", result: "FIRED", observed: { "invoice.amount_usd": 12400 }, threshold: { "invoice.amount_usd": 5000 }, overridden_by: null },
    { rule_id: "r2", rule_name: "Proveedor bloqueado", effect: "HOLD", result: "PASSED", observed: { "vendor.status": "ALLOWED" }, threshold: { "vendor.status": "BLOCKED" }, overridden_by: null },
    { rule_id: "r3", rule_name: "Cuenta bancaria distinta", effect: "ESCALATE", result: "PASSED", observed: { "invoice.bank_account": "BCOL55522201" }, threshold: { "vendor.bank_account": "BCOL55522201" }, overridden_by: null },
    { rule_id: "r8", rule_name: "Factura duplicada", effect: "HOLD", result: "PASSED", observed: { "invoice_checks.duplicada": false }, threshold: { "invoice_checks.duplicada": true }, overridden_by: null },
  ],
  approval: null,
  timeline: [
    { label: "Factura recibida", detail: "PDF por correo", at: "2026-10-17T14:12:00Z" },
    { label: "Datos extraídos", detail: "Confianza de lectura 0.97", at: "2026-10-17T14:12:04Z" },
    { label: "Reglas evaluadas", detail: "15 reglas, 2 se dispararon", at: "2026-10-17T14:12:05Z" },
    { label: "Decisión: Escalada", detail: "Notificación enviada al aprobador", at: "2026-10-17T14:12:07Z" },
  ],
  cost: { cost_usd: 0.0011, duration_ms: 2300, input_tokens: 2140, output_tokens: 310 },
  file_url: "/api/invoices/i-2043/file",
  error: null,
};

export const rules: RuleView[] = [
  {
    id: "r5", name: "Límite por pago", natural_language: "No paguen más de 5 mil dólares sin que yo apruebe.",
    effect: "ESCALATE", overridable: true, origin: "HUMAN", proposed_by: "Sergio", proposed_at: "2026-10-17T18:00:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T18:00:00Z", active: true, times_fired: 4,
    conditions: [{ source: "invoice", column: "amount_usd", operator: "GT", value: 5000, text: "Factura · monto en USD > 5.000" }],
  },
  {
    id: "r2", name: "Proveedor bloqueado", natural_language: "Nunca le pagues a un proveedor bloqueado.",
    effect: "HOLD", overridable: false, origin: "HUMAN", proposed_by: "Sergio", proposed_at: "2026-10-17T18:00:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T18:00:00Z", active: true, times_fired: 1,
    conditions: [{ source: "vendor", column: "status", operator: "EQ", value: "BLOCKED", text: "Proveedor · estado = bloqueado" }],
  },
  {
    id: "r16", name: "Northwind sin orden de compra", natural_language: "Aprobaste 3 de 3 facturas de Northwind sin orden de compra.",
    effect: "ALLOW", overridable: true, origin: "AGENT", proposed_by: "Agente", proposed_at: "2026-10-17T22:05:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T22:07:00Z", active: true, times_fired: 0,
    conditions: [
      { source: "vendor", column: "tax_id", operator: "EQ", value: "841234567", text: "Proveedor · NIT = 841234567" },
      { source: "po_check", column: "orden_encontrada", operator: "EQ", value: false, text: "Cruce con la orden · orden encontrada = no" },
    ],
  },
];

export const proposals: ProposalView[] = [
  {
    id: "p1", status: "PENDING", created_at: "2026-10-17T22:05:00Z", evidence: [invoices[1]],
    rationale: "Aprobaste 3 de 3 facturas de Northwind Software que escalaron por no tener orden de compra.",
    draft: { ...rules[2], name: "Northwind sin orden de compra" },
  },
];

const baseVendors: VendorView[] = [
  {
    id: "10000000-0000-0000-0000-000000000002", name: "Servicios Cloud Andinos S.A.S.", tax_id: "9015552221",
    country: "CO", currency: "USD", bank_rail: "WIRE", bank_account: "BCOL55522201", status: "ALLOWED",
    purchase_orders: [], invoices: 3, paid_usd: 4500,
  },
  {
    id: "10000000-0000-0000-0000-000000000005", name: "Distribuciones Orión S.A.S.", tax_id: "9009998883",
    country: "CO", currency: "COP", bank_rail: "BRE_B", bank_account: "0098765432101", status: "BLOCKED",
    purchase_orders: [], invoices: 1, paid_usd: 0,
  },
];

const EXTRA: Array<[string, VendorView["country"]]> = [
  ["Northwind Software Inc.", "US"], ["Logística del Bajío S.A. de C.V.", "MX"], ["Tecnologia Paulista Ltda.", "BR"],
  ["Comercializadora Aurora S.A.S.", "CO"], ["Grupo Industrial Sonora S.A.", "MX"], ["Atlas Office Supplies LLC", "US"],
  ["Construtora Horizonte Ltda.", "BR"], ["Papelería Cafetera S.A.S.", "CO"], ["Cobalt Analytics Inc.", "US"],
  ["Transportes Pacífico S.A.S.", "CO"], ["Manufacturas del Norte S.A. de C.V.", "MX"], ["Soluções Digitais do Sul Ltda.", "BR"],
];
const COUNTRY = {
  CO: { currency: "COP", rail: "BRE_B", fx: 0.00025 }, MX: { currency: "MXN", rail: "SPEI", fx: 0.055 },
  BR: { currency: "BRL", rail: "PIX", fx: 0.18 }, US: { currency: "USD", rail: "ACH", fx: 1 },
} as const;
const FX: Record<string, number> = { COP: 0.00025, MXN: 0.055, BRL: 0.18, USD: 1 };
const DESCRIPTIONS = [
  "Hosting y soporte", "Migración de infraestructura", "Licencias de software", "Mantenimiento de flota",
  "Material de oficina", "Servicios de consultoría", "Equipos de cómputo", "Transporte de mercancía",
  "Auditoría anual", "Campaña de mercadeo", "Obra civil, fase 2", "Suministro de insumos",
];

export const vendors: VendorView[] = [
  ...baseVendors,
  ...EXTRA.map(([name, country], n): VendorView => {
    const c = COUNTRY[country];
    return {
      id: `10000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`, name, country, currency: c.currency,
      tax_id: String(900100200 + n * 7919), bank_rail: c.rail, bank_account: `${c.rail.slice(0, 3)}${5500000 + n * 3571}`,
      status: n % 7 === 3 ? "BLOCKED" : "ALLOWED", purchase_orders: [], invoices: 2 + (n % 5), paid_usd: n % 7 === 3 ? 0 : 1200 * (n + 2),
    };
  }),
];

export const purchaseOrders: PurchaseOrderRow[] = Array.from({ length: 64 }, (_, n): PurchaseOrderRow => {
  const v = vendors[n % vendors.length];
  const amount = v.currency === "COP" ? (4 + (n % 9)) * 2_500_000 : (3 + (n % 8)) * 1500;
  const amountUsd = Math.round(amount * FX[v.currency] * 100) / 100;
  const closed = n % 6 === 5;
  const share = closed ? 1 : [0, 0.25, 0.5, 0.8, 1.1][n % 5];
  const invoiced = Math.round(amountUsd * share * 100) / 100;
  return {
    po_number: `PO-${1001 + n}`, vendor_id: v.id, vendor_name: v.name,
    description: `${DESCRIPTIONS[n % DESCRIPTIONS.length]}, ${["octubre", "septiembre", "agosto"][n % 3]}`,
    amount, currency: v.currency, amount_usd: amountUsd, invoiced_usd: invoiced,
    remaining_usd: Math.round((amountUsd - invoiced) * 100) / 100, invoices: share === 0 ? 0 : 1 + (n % 3),
    status: closed ? "CLOSED" : "OPEN",
    last_invoice_at: share === 0 ? null : new Date(Date.UTC(2026, 9, 17, 14) - n * 86_400_000 * 0.7).toISOString(),
  };
}).sort((a, b) => (b.last_invoice_at ?? "").localeCompare(a.last_invoice_at ?? ""));

const slice = <T,>(all: T[], f: { limit?: number; offset?: number }): Page<T> => ({
  items: all.slice(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 50)), total: all.length,
});
const has = (text: string | null | undefined, q: string) => (text ?? "").toLowerCase().includes(q.toLowerCase());

export function vendorPage(f: { q?: string; status?: string; country?: string; limit?: number; offset?: number }) {
  const all = vendors.filter(
    (v) => (!f.q || has(v.name, f.q) || has(v.tax_id, f.q)) && (!f.status || v.status === f.status) && (!f.country || v.country === f.country),
  );
  return slice(all, f);
}

export function purchaseOrderPage(f: {
  q?: string; vendor_id?: string; status?: string; with_balance?: boolean; limit?: number; offset?: number;
}) {
  const all = purchaseOrders.filter(
    (p) =>
      (!f.q || has(p.po_number, f.q) || has(p.description, f.q) || has(p.vendor_name, f.q)) &&
      (!f.vendor_id || p.vendor_id === f.vendor_id) && (!f.status || p.status === f.status) &&
      (!f.with_balance || (p.status === "OPEN" && p.remaining_usd > 0)),
  );
  return slice(all, f);
}

export function invoicesFor(f: { outcome?: string; vendor_id?: string; limit?: number; offset?: number }) {
  let all = invoices.filter((i) => !f.outcome || i.outcome === f.outcome);
  if (f.vendor_id) {
    const v = vendors.find((x) => x.id === f.vendor_id);
    const own = all.filter((i) => i.vendor_name === v?.name);
    // Generated vendors have no matching sample invoice: rotate a few so the detail pane has content.
    all = own.length ? own : all.slice(Math.max(0, vendors.findIndex((x) => x.id === f.vendor_id)) % 4).slice(0, 3);
  }
  return all.slice(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 200));
}

export function purchaseOrderDetail(poNumber: string): PurchaseOrderDetail {
  const po = purchaseOrders.find((p) => p.po_number === poNumber) ?? purchaseOrders[0];
  return { po, invoices: po.invoices ? invoices.slice(1, 1 + po.invoices).map((i) => ({ ...i, vendor_name: po.vendor_name })) : [] };
}

export const costs: Costs = {
  today_usd: 0.0214, month_usd: 0.0214, operations: 19, input_tokens: 41200, output_tokens: 6100,
  by_type: [
    { type: "PROCESS_INVOICE", operations: 15, total_usd: 0.0165, avg_usd: 0.0011 },
    { type: "RULE_DRAFT", operations: 3, total_usd: 0.0021, avg_usd: 0.0007 },
    { type: "PROPOSE_RULES", operations: 1, total_usd: 0.0028, avg_usd: 0.0028 },
  ],
  recent: [
    { id: "o1", type: "PROCESS_INVOICE", status: "DONE", invoice_id: "i-2043", started_at: "2026-10-17T14:12:00Z", cost: { cost_usd: 0.0011, duration_ms: 2300, input_tokens: 2140, output_tokens: 310 } },
  ],
};
