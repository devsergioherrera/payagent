// Example data with the exact API shapes. Screens build against this until the API is live.
import type {
  Costs, Hit, InvoiceDetail, InvoiceSummary, ProposalView, RuleView, Summary, VendorView,
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
  inv({ id: "i-2040", vendor_name: "Comercializadora Aurora S.A.S.", invoice_number: "FV-2031", amount: 4800000, currency: "COP", amount_usd: 1200, outcome: "HOLD", decision_status: "PENDING_HUMAN", headline: "Presupuesto del mes" }),
  inv({ id: "i-2039", vendor_name: "Distribuciones Orión S.A.S.", invoice_number: "DO-114", amount: 3560000, currency: "COP", amount_usd: 890, outcome: "HOLD", decision_status: "RESOLVED", headline: "Proveedor bloqueado", decided_by: "HUMAN" }),
  inv({ id: "i-2038", vendor_name: "Servicios Cloud Andinos S.A.S.", invoice_number: "FV-2030", amount: 4500, amount_usd: 4500, source: "CHAT" }),
];

type HitRow = [string, string, Hit["effect"], Hit["result"], Hit["observed"], Hit["threshold"]];

const hit = ([rule_id, rule_name, effect, result, observed, threshold]: HitRow, overridden_by: string | null = null): Hit => ({
  rule_id, rule_name, effect, result, observed, threshold, overridden_by,
});

export const invoiceDetail: InvoiceDetail = {
  summary: invoices[2],
  vendor_id: "10000000-0000-0000-0000-000000000002",
  extracted: {
    vendor_name_raw: "Servicios Cloud Andinos SAS", vendor_tax_id: "9015552221", invoice_number: "FV-2043",
    amount: 12400, currency: "USD", fx_rate: 1, amount_usd: 12400, issue_date: "2026-10-16",
    due_date: "2026-10-30", po_number: "PO-1006", bank_account: "BCOL55522201", confidence: 0.97,
  },
  explanation:
    "La factura de Servicios Cloud Andinos por USD 12.400 supera el umbral de aprobación humana de USD 10.000. El proveedor, la cuenta bancaria y la orden de compra PO-1006 cumplen. Necesita tu aprobación antes de pagarse.",
  hits: [
    hit(["r6", "Umbral de aprobación humana", "ESCALATE", "FIRED", { "invoice.amount_usd": 12400 }, { "invoice.amount_usd": 10000 }]),
    hit(["r5", "Límite por pago", "ESCALATE", "FIRED", { "invoice.amount_usd": 12400 }, { "invoice.amount_usd": 5000 }]),
    hit(["r1", "Proveedor no registrado", "ESCALATE", "PASSED", { "invoice.vendor_id": "10000000-0000-0000-0000-000000000002" }, {}]),
    hit(["r2", "Proveedor bloqueado", "HOLD", "PASSED", { "vendor.status": "ALLOWED" }, { "vendor.status": "BLOCKED" }]),
    hit(["r3", "Cuenta bancaria distinta", "ESCALATE", "PASSED", { "invoice.bank_account": "BCOL55522201" }, { "vendor.bank_account": "BCOL55522201" }]),
    hit(["r4", "NIT distinto", "ESCALATE", "PASSED", { "invoice.vendor_tax_id": "9015552221" }, { "vendor.tax_id": "9015552221" }]),
    hit(["r7", "Presupuesto del mes", "HOLD", "PASSED", { "budget_status.saldo_despues_usd": 31600 }, { "budget_status.saldo_despues_usd": 0 }]),
    hit(["r8", "Duplicado exacto", "HOLD", "PASSED", { "invoice_checks.duplicada": false }, { "invoice_checks.duplicada": true }]),
    hit(["r9", "Posible duplicado (30 días)", "ESCALATE", "PASSED", { "invoice_checks.similares_30d": 0 }, { "invoice_checks.similares_30d": 0 }]),
    hit(["r10", "Sin orden de compra válida", "ESCALATE", "PASSED", { "po_check.orden_encontrada": true }, { "po_check.orden_encontrada": false }]),
    hit(["r11", "Fuera de tolerancia de la orden", "ESCALATE", "PASSED", { "po_check.desviacion_pct": 3.3 }, { "po_check.desviacion_pct": 5 }]),
    hit(["r12", "Moneda distinta a la orden", "ESCALATE", "PASSED", { "po_check.moneda_coincide": true }, { "po_check.moneda_coincide": false }]),
    hit(["r13", "Faltan datos", "ESCALATE", "PASSED", { "invoice_checks.campos_faltantes": 0 }, { "invoice_checks.campos_faltantes": 0 }]),
    hit(["r14", "Fecha fuera de rango", "ESCALATE", "PASSED", { "invoice_checks.dias_emision": 1 }, { "invoice_checks.dias_emision": [0, 90] }]),
    hit(["r15", "Factura vencida", "ESCALATE", "PASSED", { "invoice_checks.dias_para_vencer": 13 }, { "invoice_checks.dias_para_vencer": 0 }]),
  ],
  approval: null,
  timeline: [
    { label: "Factura recibida", detail: "PDF por correo de cuentas@serviciosandinos.co", at: "2026-10-17T14:12:00Z" },
    { label: "Datos extraídos", detail: null, at: "2026-10-17T14:12:04Z" },
    { label: "Decisión: Escalada", detail: "Umbral de aprobación humana", at: "2026-10-17T14:12:05Z" },
    { label: "Notificación enviada", detail: "sergio@facturaya.co", at: "2026-10-17T14:12:07Z" },
  ],
  cost: { cost_usd: 0.0011, duration_ms: 2300, input_tokens: 2140, output_tokens: 310 },
  file_url: "/mock/factura-2043.svg",
  error: null,
};

// Hard case: unregistered vendor, unreadable amount and due date, and a budget hold.
export const invoiceDetailHold: InvoiceDetail = {
  summary: { ...invoices[5], amount_usd: null, headline: "Presupuesto del mes" },
  vendor_id: null,
  extracted: {
    vendor_name_raw: "Comercializadora Aurora S.A.S.", vendor_tax_id: "9007771114", invoice_number: "FV-2031",
    amount: 4800000, currency: "COP", fx_rate: null, amount_usd: null, issue_date: "2026-10-15",
    due_date: null, po_number: null, bank_account: "0012345678901", confidence: 0.71,
  },
  explanation:
    "El agente frenó el pago porque el presupuesto del mes no alcanza para cubrir esta factura: quedaría USD 420 por debajo de cero. Además no se pudo leer la fecha de vencimiento ni el monto en dólares, y el proveedor no está registrado. Puedes liberarla si autorizas el gasto.",
  hits: [
    hit(["r7", "Presupuesto del mes", "HOLD", "FIRED", { "budget_status.saldo_despues_usd": -420 }, { "budget_status.saldo_despues_usd": 0 }]),
    hit(["r1", "Proveedor no registrado", "ESCALATE", "FIRED", { "invoice.vendor_id": null }, {}]),
    hit(["r13", "Faltan datos", "ESCALATE", "FIRED", { "invoice_checks.campos_faltantes": 3 }, { "invoice_checks.campos_faltantes": 0 }]),
    hit(["r5", "Límite por pago", "ESCALATE", "MISSING_DATA", { "invoice.amount_usd": null }, { "invoice.amount_usd": 5000 }]),
    hit(["r6", "Umbral de aprobación humana", "ESCALATE", "MISSING_DATA", { "invoice.amount_usd": null }, { "invoice.amount_usd": 10000 }]),
    hit(["r15", "Factura vencida", "ESCALATE", "MISSING_DATA", { "invoice_checks.dias_para_vencer": null }, { "invoice_checks.dias_para_vencer": 0 }]),
    hit(["r9", "Posible duplicado (30 días)", "ESCALATE", "OVERRIDDEN", { "invoice_checks.similares_30d": 1 }, { "invoice_checks.similares_30d": 0 }], "Pagos recurrentes de Aurora"),
    hit(["r2", "Proveedor bloqueado", "HOLD", "NOT_APPLICABLE", { "vendor.status": null }, { "vendor.status": "BLOCKED" }]),
    hit(["r3", "Cuenta bancaria distinta", "ESCALATE", "NOT_APPLICABLE", { "invoice.bank_account": "0012345678901" }, { "vendor.bank_account": null }]),
    hit(["r4", "NIT distinto", "ESCALATE", "NOT_APPLICABLE", { "invoice.vendor_tax_id": "9007771114" }, { "vendor.tax_id": null }]),
    hit(["r10", "Sin orden de compra válida", "ESCALATE", "NOT_APPLICABLE", { "po_check.orden_encontrada": null }, { "po_check.orden_encontrada": false }]),
    hit(["r11", "Fuera de tolerancia de la orden", "ESCALATE", "NOT_APPLICABLE", { "po_check.desviacion_pct": null }, { "po_check.desviacion_pct": 5 }]),
    hit(["r8", "Duplicado exacto", "HOLD", "PASSED", { "invoice_checks.duplicada": false }, { "invoice_checks.duplicada": true }]),
    hit(["r12", "Moneda distinta a la orden", "ESCALATE", "PASSED", { "po_check.moneda_coincide": true }, { "po_check.moneda_coincide": false }]),
    hit(["r14", "Fecha fuera de rango", "ESCALATE", "PASSED", { "invoice_checks.dias_emision": 2 }, { "invoice_checks.dias_emision": [0, 90] }]),
  ],
  approval: null,
  timeline: [
    { label: "Factura recibida", detail: "Carga manual", at: "2026-10-17T15:40:00Z" },
    { label: "Datos extraídos", detail: null, at: "2026-10-17T15:40:05Z" },
    { label: "Decisión: Frenada", detail: "Presupuesto del mes", at: "2026-10-17T15:40:07Z" },
    { label: "Notificación enviada", detail: "sergio@facturaya.co", at: "2026-10-17T15:40:09Z" },
  ],
  cost: { cost_usd: 0.0018, duration_ms: 3900, input_tokens: 3010, output_tokens: 420 },
  file_url: "/mock/factura-2040.txt",
  error: null,
};

// Same case once the owner released it: shows the resolved state.
export const invoiceDetailResolved: InvoiceDetail = {
  ...invoiceDetailHold,
  summary: { ...invoices[6], vendor_name: "Comercializadora Aurora S.A.S.", headline: "Presupuesto del mes" },
  approval: { verdict: "APPROVED", note: "Gasto autorizado por cierre de trimestre", approver: "Sergio", created_at: "2026-10-17T22:10:00Z" },
  timeline: [
    ...invoiceDetailHold.timeline,
    { label: "Resolución humana: aprobada", detail: "Sergio · Gasto autorizado por cierre de trimestre", at: "2026-10-17T22:10:00Z" },
  ],
};

export const invoiceDetails: Record<string, InvoiceDetail> = {
  "i-2040": invoiceDetailHold,
  "i-2039": invoiceDetailResolved,
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

export const vendors: VendorView[] = [
  {
    id: "10000000-0000-0000-0000-000000000002", name: "Servicios Cloud Andinos S.A.S.", tax_id: "9015552221",
    country: "CO", currency: "USD", bank_rail: "WIRE", bank_account: "BCOL55522201", status: "ALLOWED",
    purchase_orders: [
      { po_number: "PO-1002", amount: 4500, currency: "USD", status: "OPEN", description: "Hosting y soporte, octubre" },
      { po_number: "PO-1006", amount: 12000, currency: "USD", status: "OPEN", description: "Migración de infraestructura" },
    ],
    invoices: 3, paid_usd: 4500,
  },
  {
    id: "10000000-0000-0000-0000-000000000005", name: "Distribuciones Orión S.A.S.", tax_id: "9009998883",
    country: "CO", currency: "COP", bank_rail: "BRE_B", bank_account: "0098765432101", status: "BLOCKED",
    purchase_orders: [], invoices: 1, paid_usd: 0,
  },
];

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
