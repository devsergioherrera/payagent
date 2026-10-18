// Example data with the exact API shapes. Screens build against this until the API is live.
import type {
  ActivityItem, Costs, Hit, InvoiceDetail, InvoiceSummary, OperationRow, Page, Policy, ProposalView, PurchaseOrderDetail,
  PurchaseOrderRow, RuleView,
  Summary, TraceStep, VendorView,
} from "./api-types";

export const summary: Summary = {
  paid: 7, waiting: 2, held: 2, rejected: 1, processing: 1,
  autonomy_pct: 54.5, email_connected: true, email_checked_at: "2026-10-17T21:40:08Z",
};

const inv = (p: Partial<InvoiceSummary> & Pick<InvoiceSummary, "id">): InvoiceSummary => ({
  status: "DECIDED", state: "PAID", vendor_name: null, invoice_number: null, amount: null, currency: "USD",
  amount_usd: null, received_at: "2026-10-17T14:12:00Z", source: "EMAIL", outcome: "PAY",
  decision_status: "FINAL", headline: null, decided_by: "AGENT", ...p,
});

export const invoices: InvoiceSummary[] = [
  inv({ id: "i-2045", status: "EVALUATING", vendor_name: "Comercializadora Aurora S.A.S.", invoice_number: "FV-2045", amount: 5920000, currency: "COP", amount_usd: 1480, state: "PROCESSING", outcome: null, decision_status: null, decided_by: null }),
  inv({ id: "i-2044", vendor_name: "Northwind Software Inc.", invoice_number: "NW-8812", amount: 1950, amount_usd: 1950, state: "WAITING", outcome: "ESCALATE", decision_status: "PENDING_HUMAN", headline: "Sin orden de compra" }),
  inv({ id: "i-2043", vendor_name: "Servicios Cloud Andinos S.A.S.", invoice_number: "FV-2043", amount: 12400, amount_usd: 12400, state: "WAITING", outcome: "ESCALATE", decision_status: "PENDING_HUMAN", headline: "Umbral de aprobación humana" }),
  inv({ id: "i-2042", vendor_name: "Logística del Bajío S.A. de C.V.", invoice_number: "A-3391", amount: 58000, currency: "MXN", amount_usd: 3190, source: "UPLOAD" }),
  inv({ id: "i-2041", vendor_name: "Tecnologia Paulista Ltda.", invoice_number: "NF-7781", amount: 15000, currency: "BRL", amount_usd: 2700 }),
  inv({ id: "i-2040", vendor_name: "Comercializadora Aurora S.A.S.", invoice_number: "FV-2031", amount: 4800000, currency: "COP", amount_usd: 1200, state: "HELD", outcome: "HOLD", decision_status: "FINAL", headline: "Presupuesto del mes" }),
  inv({ id: "i-2039", vendor_name: "Distribuciones Orión S.A.S.", invoice_number: "DO-114", amount: 3560000, currency: "COP", amount_usd: 890, state: "HELD", outcome: "HOLD", decision_status: "FINAL", headline: "Proveedor bloqueado" }),
  inv({ id: "i-2038", vendor_name: "Servicios Cloud Andinos S.A.S.", invoice_number: "FV-2030", amount: 4500, amount_usd: 4500, source: "CHAT", state: "APPROVED", outcome: "ESCALATE", decision_status: "RESOLVED", decided_by: "HUMAN", headline: "Sin orden de compra válida" }),
  inv({ id: "i-2037", vendor_name: "Northwind Software Inc.", invoice_number: "NW-8790", amount: 2100, amount_usd: 2100, state: "REJECTED", outcome: "ESCALATE", decision_status: "RESOLVED", decided_by: "HUMAN", headline: "Monto distinto de la orden", received_at: "2026-10-16T10:00:00Z" }),
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
  learned_rule: null,
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
  ],
  cost: { cost_usd: 0.0018, duration_ms: 3900, input_tokens: 3010, output_tokens: 420 },
  file_url: "/mock/factura-2040.txt",
  error: null,
  learned_rule: null,
};

// A second final hold, to open from the list.
export const invoiceDetailHold2: InvoiceDetail = {
  ...invoiceDetailHold,
  summary: { ...invoices[6], headline: "Proveedor bloqueado" },
};

// A paid invoice: every rule passed.
export const invoiceDetailPay: InvoiceDetail = {
  ...invoiceDetail,
  summary: invoices[3],
  explanation: "La factura de Logística del Bajío cumple todas las reglas: proveedor registrado, orden de compra vigente y monto dentro del límite. El agente la pagó sin intervención.",
  hits: invoiceDetail.hits.map((h) => ({ ...h, result: h.result === "FIRED" ? "PASSED" as const : h.result })),
  learned_rule: { id: "r16", name: "Northwind sin orden de compra", approved_at: "2026-10-18T09:20:00Z" },
  timeline: [
    { label: "Factura recibida", detail: "Carga manual", at: "2026-10-17T14:12:00Z" },
    { label: "Datos extraídos", detail: null, at: "2026-10-17T14:12:04Z" },
    { label: "Decisión: Pagada", detail: null, at: "2026-10-17T14:12:05Z" },
  ],
};

// Escalated, then approved by the user. A history invoice: no read step and no file.
export const invoiceDetailApproved: InvoiceDetail = {
  ...invoiceDetail,
  summary: invoices[7],
  explanation: "La factura no cita una orden de compra registrada. El resto de las reglas se cumplió y la aprobaste para pagarla.",
  hits: [
    hit(["r10", "Sin orden de compra válida", "ESCALATE", "FIRED", { "po_check.orden_encontrada": false }, { "po_check.orden_encontrada": false }]),
    hit(["r16", "Orden de compra sobregirada", "ESCALATE", "FIRED", { "po_check.orden_encontrada": true, "po_check.saldo_oc_despues_pct": -67 }, { "po_check.orden_encontrada": true, "po_check.saldo_oc_despues_pct": -5 }]),
    hit(["r8", "Duplicado exacto", "HOLD", "FIRED", { "invoice_checks.duplicada": true }, { "invoice_checks.duplicada": true }]),
    hit(["r9", "Posible duplicado (30 días)", "ESCALATE", "PASSED", { "invoice_checks.similares_30d": 0 }, { "invoice_checks.similares_30d": 0 }]),
    hit(["r14", "Fecha fuera de rango", "ESCALATE", "PASSED", { "invoice_checks.dias_emision": 12 }, { "invoice_checks.dias_emision": [0, 90] }]),
    hit(["r15", "Factura vencida", "ESCALATE", "FIRED", { "invoice_checks.dias_para_vencer": -6 }, { "invoice_checks.dias_para_vencer": 0 }]),
    hit(["r4", "NIT distinto", "ESCALATE", "FIRED", { "invoice.vendor_tax_id": "9015552221" }, { "vendor.tax_id": "9015552000" }]),
    hit(["r3", "Cuenta bancaria distinta", "ESCALATE", "PASSED", { "invoice.bank_account": "BCOL55522201" }, { "vendor.bank_account": "BCOL55522201" }]),
  ],
  approval: { verdict: "APPROVED", note: "Es la orden de octubre, se cierra la próxima semana.", approver: "Sergio", created_at: "2026-10-09T15:20:00Z" },
  timeline: [
    { label: "Factura recibida", detail: "Chat", at: "2026-10-09T15:00:00Z" },
    { label: "Decisión: Escalada", detail: "Sin orden de compra válida", at: "2026-10-09T15:00:05Z" },
    { label: "Resolución humana", detail: null, at: "2026-10-09T15:20:00Z" },
  ],
  cost: null,
  file_url: "/mock/none.pdf",
};

export const invoiceDetails: Record<string, InvoiceDetail> = {
  "i-2038": invoiceDetailApproved,
  "i-2040": invoiceDetailHold,
  "i-2039": invoiceDetailHold2,
  "i-2042": invoiceDetailPay,
};

export const rules: RuleView[] = [
  {
    id: "r5", name: "Límite por pago", natural_language: "No paguen más de 5 mil dólares sin que yo apruebe.",
    effect: "ESCALATE", overridable: true, origin: "HUMAN", proposed_by: "Sergio", proposed_at: "2026-10-17T18:00:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T18:00:00Z", active: true, times_fired: 4,
    replaced_by: null, deactivated_at: null, deactivated_by: null,
    conditions: [{ source: "invoice", column: "amount_usd", operator: "GT", value: 5000, text: "Factura · monto en USD > 5.000" }],
    summary: "Pide tu aprobación cuando el monto supere USD 5.000",
  },
  {
    id: "r2", name: "Proveedor bloqueado", natural_language: "Nunca le pagues a un proveedor bloqueado.",
    effect: "HOLD", overridable: false, origin: "HUMAN", proposed_by: "Sergio", proposed_at: "2026-10-17T18:00:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T18:00:00Z", active: true, times_fired: 1,
    replaced_by: null, deactivated_at: null, deactivated_by: null,
    conditions: [{ source: "vendor", column: "status", operator: "EQ", value: "BLOCKED", text: "Proveedor · estado = bloqueado" }],
    summary: "Frena el pago cuando el proveedor esté bloqueado",
  },
  {
    id: "r16", name: "Northwind sin orden de compra", natural_language: "Aprobaste 3 de 3 facturas de Northwind sin orden de compra.",
    effect: "ALLOW", overridable: true, origin: "AGENT", proposed_by: "Agente", proposed_at: "2026-10-17T22:05:00Z",
    approved_by: "Sergio", approved_at: "2026-10-17T22:07:00Z", active: true, times_fired: 0,
    replaced_by: null, deactivated_at: null, deactivated_by: null,
    conditions: [
      { source: "vendor", column: "tax_id", operator: "EQ", value: "841234567", text: "Proveedor · NIT = 841234567" },
      { source: "po_check", column: "orden_encontrada", operator: "EQ", value: false, text: "Cruce con la orden · orden encontrada = no" },
    ],
    summary: "Deja pasar el pago cuando el proveedor sea Northwind y la factura no tenga orden de compra",
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
  approved_by: "Sergio", approved_at: "2026-10-16T15:20:00Z", active: true, times_fired, conditions, summary: "",
  replaced_by: null, deactivated_at: null, deactivated_by: null, ...more,
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
    [cond("invoice", "amount_usd", "GTE", 10000, "Factura · monto en USD >= 10.000")],
    { active: false, deactivated_by: "Sergio", deactivated_at: "2026-10-17T20:40:00Z", replaced_by: { id: "r27", name: "Pago pequeño" } }),
  extra("r36", "Proveedor de prueba", "Regla de pruebas del piloto.", "ALLOW", "HUMAN", 0,
    [cond("vendor", "tax_id", "EQ", "000000000", "Proveedor · NIT = 000000000")],
    { active: false, deactivated_by: "Sergio", deactivated_at: "2026-10-17T19:10:00Z" }),
];
const policyRules: RuleView[] = [
  extra("p-human", "Umbral de aprobación humana", "Todo pago de 10 mil dólares o más lo apruebo yo, siempre.", "ESCALATE", "HUMAN", 3,
    [cond("invoice", "amount_usd", "GTE", 10000, "Factura · monto en USD >= 10.000")],
    { overridable: false, summary: "Pide tu aprobación cuando el monto sea de USD 10.000 o más" }),
  extra("p-tol", "Fuera de la tolerancia de la orden", "Si el monto se aleja más de 5 % de la orden de compra, escálalo.", "ESCALATE", "HUMAN", 2,
    [cond("po_check", "desviacion_pct", "GT", 5, "Cruce con la orden · desviación % > 5")],
    { summary: "Pide tu aprobación cuando el monto se desvíe más de 5 % de la orden" }),
  extra("p-over", "Supera el saldo de la orden de compra", "Si con esta factura la orden queda sobregirada más de 5 %, escálala.", "ESCALATE", "HUMAN", 1,
    [cond("po_check", "saldo_oc_despues_pct", "LT", -5, "Cruce con la orden · saldo de la orden tras pagar (%) < -5")],
    { summary: "Pide tu aprobación cuando la factura sobregire la orden de compra más de 5 %" }),
  extra("p-date", "Fecha fuera de rango", "Si la factura es de fecha futura o de hace más de 90 días, escálala.", "ESCALATE", "HUMAN", 0,
    [cond("invoice_checks", "dias_emision", "NOT_BETWEEN", [0, 90], "Validaciones · días desde la emisión fuera de 0 y 90")],
    { summary: "Pide tu aprobación cuando la fecha de emisión esté fuera de los últimos 90 días" }),
];
rules.push(...moreRules, ...policyRules);

const LEAD = { ESCALATE: "Pide tu aprobación", HOLD: "Frena el pago", ALLOW: "Deja pasar el pago" } as const;
for (const r of rules) {
  r.summary ||= `${LEAD[r.effect]} cuando ${r.conditions.map((c) => c.text.split(" · ").pop()!.replace(/^./, (m) => m.toLowerCase())).join(" y ")}`;
}

// Mock of POST /rules/{id}/revise: raises the first money threshold to 8.000, enough to show before and after.
export const revised = (id: string, instruction: string): RuleView => {
  const rule = rules.find((r) => r.id === id) ?? rules[0];
  return {
    ...rule,
    natural_language: `${rule.natural_language} (${instruction})`,
    conditions: rule.conditions.map((c) => (typeof c.value === "number" ? { ...c, value: 8000, text: c.text.replace(/[\d.,]+$/, "8.000") } : c)),
    summary: rule.summary.replace(/\d[\d.]*/, "8.000"),
  };
};

export const proposalTrace: TraceStep[] = [
  { label: "Revisé 4 decisiones tuyas", detail: "4 aprobadas, 0 rechazadas" },
  { label: "Encontré un patrón", detail: "Northwind Software Inc., aprobadas 3 de 3, todas con «Sin orden de compra»" },
  { label: "Comprobé que no anula ningún Frenar ni el umbral de aprobación", detail: "Una regla de permitir solo levanta escalaciones anulables" },
  { label: "Propuesta lista", detail: "Northwind sin orden de compra" },
];

export const proposals: ProposalView[] = [
  {
    id: "p1", status: "PENDING", created_at: "2026-10-17T22:05:00Z", evidence: [invoices[1], invoices[8], { ...invoices[8], id: "i-2036", invoice_number: "NW-8771", state: "APPROVED" }],
    trace: proposalTrace,
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
  const share = closed ? 1 : [0, 0.25, 0.5, 0.8, 1.67][n % 5];
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

export function invoicesFor(f: {
  state?: string; q?: string; from?: string; to?: string; vendor_id?: string; limit?: number; offset?: number;
}) {
  let all = invoices.filter((i) => !f.state || i.state === f.state);
  if (f.q) all = all.filter((i) => `${i.vendor_name} ${i.invoice_number} ${i.amount}`.toLowerCase().includes(f.q!.toLowerCase()));
  if (f.from) all = all.filter((i) => i.received_at.slice(0, 10) >= f.from!);
  if (f.to) all = all.filter((i) => i.received_at.slice(0, 10) <= f.to!);
  if (f.vendor_id) {
    const v = vendors.find((x) => x.id === f.vendor_id);
    const own = all.filter((i) => i.vendor_name === v?.name);
    // Generated vendors have no matching sample invoice: rotate a few so the detail pane has content.
    all = own.length ? own : all.slice(Math.max(0, vendors.findIndex((x) => x.id === f.vendor_id)) % 4).slice(0, 3);
  }
  return { total: all.length, items: all.slice(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 200)) };
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
  recent: Array.from({ length: 19 }, (_, n): OperationRow => ({
    id: `o${n + 1}`, type: (["PROCESS_INVOICE", "PROCESS_INVOICE", "RULE_DRAFT", "PROPOSE_RULES"] as const)[n % 4], status: "DONE",
    invoice_id: n % 4 < 2 ? `i-${2043 - n}` : null, started_at: new Date(Date.UTC(2026, 9, 17, 14, 12) - n * 1_800_000).toISOString(),
    cost: { cost_usd: 0.0011 + (n % 3) * 0.0004, duration_ms: 2300 + n * 90, input_tokens: 2140, output_tokens: 310 },
  })),
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
export const activity = (): ActivityItem[] => [
  { id: "d1", kind: "WAITING", title: "Espera tu decisión: Northwind Software", detail: "4,200.00 USD", invoice_id: "i-2043", at: minutesAgo(2) },
  { id: "p1", kind: "LEARNED", title: "El agente aprendió algo", detail: "Northwind sin orden de compra", proposal_id: "p1", at: minutesAgo(18) },
  { id: "d2", kind: "HELD", title: "Frenada: Servicios Cloud Andinos", detail: "12,900.00 USD", invoice_id: "i-2041", at: minutesAgo(55) },
  { id: "n1", kind: "EMAIL_FAILED", title: "No se pudo enviar un correo", detail: "A compras@andinos.example", invoice_id: "i-2041", at: minutesAgo(56) },
  { id: "d3", kind: "PAID", title: "Pagada: Papelería Central", detail: "320.50 USD", invoice_id: "i-2040", at: minutesAgo(190) },
];

export const policy: Policy = {
  budget: { period: "2026-10-01", amount_usd: 60000, paid_usd: 16717, approved_usd: 3900, available_usd: 39383, invoices_paid: 9 },
  limits: [
    { key: "payment_limit", label: "Límite por pago", rule_id: "r5", value: 5000, unit: "USD", effect: "ESCALATE", active: true },
    { key: "human_approval", label: "Aprobación humana desde", rule_id: "p-human", value: 10000, unit: "USD", effect: "ESCALATE", active: true },
    { key: "po_tolerance", label: "Tolerancia de la orden", rule_id: "p-tol", value: 5, unit: "%", effect: "ESCALATE", active: true },
    { key: "po_overdraft", label: "Sobregiro de la orden", rule_id: "p-over", value: 5, unit: "%", effect: "ESCALATE", active: true },
    { key: "date_window", label: "Ventana de fechas", rule_id: "p-date", value: 90, unit: "días", effect: "ESCALATE", active: true },
  ],
  blocked_vendors: 1,
  exceptions: 1,
};
