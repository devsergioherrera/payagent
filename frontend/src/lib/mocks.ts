// Example data with the exact API shapes. Screens build against this until the API is live.
import type {
  Costs, InvoiceDetail, InvoiceSummary, ProposalView, RuleView, Summary, VendorView,
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

type Cond = RuleView["conditions"][number];
const cond = (source: string, column: string, operator: Cond["operator"], value: Cond["value"], text: string): Cond => ({ source, column, operator, value, text });
const extra = (
  id: string, name: string, natural_language: string, effect: RuleView["effect"], origin: RuleView["origin"],
  times_fired: number, conditions: Cond[], more: Partial<RuleView> = {},
): RuleView => ({
  id, name, natural_language, effect, overridable: effect !== "HOLD", origin,
  proposed_by: origin === "AGENT" ? "Agente" : "Sergio", proposed_at: "2026-10-16T15:00:00Z",
  approved_by: "Sergio", approved_at: "2026-10-16T15:20:00Z", active: true, times_fired, conditions, ...more,
});

const moreRules: RuleView[] = [
  extra("r3", "Cuenta bancaria distinta", "Si la cuenta de la factura no es la del proveedor, avísame.", "ESCALATE", "HUMAN", 2,
    [cond("invoice_checks", "cuenta_distinta", "EQ", true, "Validaciones · cuenta bancaria distinta = sí")]),
  extra("r8", "Factura duplicada", "No pagues dos veces la misma factura.", "HOLD", "HUMAN", 3,
    [cond("invoice_checks", "duplicada", "EQ", true, "Validaciones · duplicada = sí")]),
  extra("r20", "Fecha de emisión futura", "Una factura con fecha del futuro es sospechosa.", "HOLD", "HUMAN", 0,
    [cond("invoice_checks", "fecha_futura", "EQ", true, "Validaciones · fecha de emisión futura = sí")]),
  extra("r21", "Sin fecha de vencimiento", "Si no dice cuándo vence, que lo revise una persona.", "ESCALATE", "AGENT", 5,
    [cond("invoice_checks", "sin_vencimiento", "EQ", true, "Validaciones · sin fecha de vencimiento = sí")]),
  extra("r22", "Número de factura inválido", "Los números de factura raros se revisan.", "ESCALATE", "HUMAN", 1,
    [cond("invoice_checks", "numero_valido", "EQ", false, "Validaciones · número válido = no")]),
  extra("r4", "País restringido", "No pagues a proveedores de países fuera de la lista.", "HOLD", "HUMAN", 0,
    [cond("vendor", "country", "NOT_IN", ["CO", "MX", "BR", "US"], "Proveedor · país no está en CO, MX, BR, US")]),
  extra("r23", "Proveedor nuevo", "El primer pago a un proveedor nuevo lo apruebo yo.", "ESCALATE", "HUMAN", 6,
    [cond("vendor", "invoices", "EQ", 0, "Proveedor · facturas previas = 0")]),
  extra("r24", "Proveedor sin cuenta registrada", "Sin cuenta bancaria registrada no se paga.", "HOLD", "AGENT", 0,
    [cond("vendor", "bank_account", "IS_NULL", null, "Proveedor · cuenta bancaria vacía")]),
  extra("r6", "Facturas de Brasil sobre 3.000", "Frena facturas de Brasil de más de 3.000 dólares.", "HOLD", "HUMAN", 2,
    [cond("invoice", "amount_usd", "GT", 3000, "Factura · monto en USD > 3.000"), cond("vendor", "country", "EQ", "BR", "Proveedor · país = BR")]),
  extra("r25", "Factura vencida hace más de 60 días", "Si ya pasaron dos meses del vencimiento, frénala.", "HOLD", "AGENT", 1,
    [cond("invoice", "days_overdue", "GT", 60, "Factura · días de atraso > 60")]),
  extra("r26", "Lectura con baja confianza", "Si el agente no está seguro de lo que leyó, que me pregunte.", "ESCALATE", "HUMAN", 8,
    [cond("invoice", "confidence", "LT", 0.8, "Factura · confianza de lectura < 0,8")]),
  extra("r27", "Pago pequeño", "Hasta 200 dólares paga sin preguntar.", "ALLOW", "HUMAN", 19,
    [cond("invoice", "amount_usd", "LTE", 200, "Factura · monto en USD <= 200")]),
  extra("r28", "Moneda no habitual", "Si viene en una moneda rara, que lo vea alguien.", "ESCALATE", "AGENT", 0,
    [cond("invoice", "currency", "NOT_IN", ["USD", "COP", "MXN", "BRL"], "Factura · moneda no está en USD, COP, MXN, BRL")]),
  extra("r29", "Sin orden de compra", "Toda factura grande necesita orden de compra.", "ESCALATE", "HUMAN", 7,
    [cond("po_check", "orden_encontrada", "EQ", false, "Cruce con la orden · orden encontrada = no")]),
  extra("r30", "Monto mayor a la orden", "No pagues más de lo que dice la orden.", "HOLD", "HUMAN", 2,
    [cond("po_check", "excede_orden", "EQ", true, "Cruce con la orden · excede la orden = sí")]),
  extra("r31", "Orden de compra cerrada", "Una orden cerrada ya no admite pagos.", "HOLD", "HUMAN", 1,
    [cond("purchase_order", "status", "EQ", "CLOSED", "Orden de compra · estado = cerrada")]),
  extra("r32", "Presupuesto del mes agotado", "Si ya se gastó el presupuesto, frena.", "HOLD", "HUMAN", 0,
    [cond("budget_status", "remaining_usd", "LTE", 0, "Presupuesto · saldo en USD <= 0")]),
  extra("r33", "Presupuesto casi agotado", "Cuando quede menos del 10 por ciento, avísame.", "ESCALATE", "AGENT", 3,
    [cond("budget_status", "remaining_pct", "LT", 10, "Presupuesto · saldo restante < 10 %")]),
  extra("r34", "Compras recurrentes de oficina", "Los pagos de papelería con presupuesto disponible pasan solos.", "ALLOW", "AGENT", 4,
    [cond("budget_status", "remaining_pct", "GTE", 30, "Presupuesto · saldo restante >= 30 %")]),
  extra("r35", "Monto redondo sospechoso", "Montos redondos muy altos me dan desconfianza.", "ESCALATE", "HUMAN", 0,
    [cond("invoice", "amount_usd", "GTE", 10000, "Factura · monto en USD >= 10.000")], { active: false }),
  extra("r36", "Proveedor de prueba", "Regla de pruebas del piloto.", "ALLOW", "HUMAN", 0,
    [cond("vendor", "tax_id", "EQ", "000000000", "Proveedor · NIT = 000000000")], { active: false }),
];
rules.push(...moreRules);

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
