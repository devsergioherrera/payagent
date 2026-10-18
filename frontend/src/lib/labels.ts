// Plain-Spanish wording for rule hits. COLUMN_LABEL mirrors backend/src/payagent/app/rule_text.py.
import type { Hit, Value } from "./api-types";

export const COLUMN_LABEL: Record<string, string> = {
  amount_usd: "monto en USD", amount: "monto", currency: "moneda", vendor_id: "proveedor registrado",
  vendor_tax_id: "NIT", tax_id: "NIT", bank_account: "cuenta bancaria", po_number: "orden de compra",
  due_date: "fecha de vencimiento", issue_date: "fecha de emisión", confidence: "confianza de lectura",
  status: "estado del proveedor", country: "país", name: "nombre", duplicada: "duplicada",
  similares_30d: "cobros iguales en 30 días", campos_faltantes: "datos faltantes",
  dias_emision: "días desde la emisión", dias_para_vencer: "días para vencer",
  orden_encontrada: "orden encontrada", desviacion_pct: "desviación", moneda_coincide: "moneda coincide",
  proveedor_coincide: "proveedor coincide", saldo_despues_usd: "saldo tras pagar (USD)",
  comprometido_usd: "comprometido en el mes (USD)", presupuesto_usd: "presupuesto del mes (USD)",
  comprometido_oc: "ya comprometido en la orden", saldo_oc_despues_pct: "saldo de la orden tras pagar",
};

const VALUE_LABEL: Record<string, string> = { BLOCKED: "bloqueado", ALLOWED: "permitido", OPEN: "abierta", CLOSED: "cerrada" };

const column = (key: string) => key.split(".").pop() ?? key;
const source = (key: string) => (key.includes(".") ? key.split(".")[0] : "");

export const label = (key: string) => COLUMN_LABEL[column(key)] ?? column(key).replaceAll("_", " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const number = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);

function show(key: string, v: Value | undefined): string {
  if (column(key) === "vendor_id") return v ? "sí" : "no";
  if (v === undefined || v === null) return "sin dato";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") return column(key).endsWith("_pct") ? `${number(v)} %` : number(v);
  if (Array.isArray(v)) return v.map((x) => show(key, x)).join(" y ");
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(v));
  }
  return VALUE_LABEL[v] ?? v;
}

function sentence(hit: Hit, key: string): string {
  const obs = hit.observed[key];
  const thr = hit.threshold[key] ?? Object.values(hit.threshold)[0];
  const name = cap(label(key));
  if (typeof obs === "number" && typeof thr === "number") {
    const fired = hit.result === "FIRED";
    const rel = obs === thr ? "es igual a" : obs > thr ? (fired ? "supera el límite de" : "está por encima de") : (fired ? "está por debajo del mínimo de" : "no supera el límite de");
    return `${name} ${show(key, obs)} ${rel} ${show(key, thr)}`;
  }
  if (obs != null && thr !== undefined && thr !== null && typeof obs === "string" && typeof thr === "string") {
    const registered = Object.keys(hit.threshold).find((k) => column(k) === column(key) && k !== key);
    if (registered) {
      return obs === thr ? `${name} ${show(key, obs)} coincide con la registrada` : `${name} ${show(key, obs)} no coincide con la registrada (${show(registered, thr)})`;
    }
  }
  return `${name}: ${show(key, obs)}`;
}

export function hitSentence(hit: Hit): string {
  const keys = Object.keys(hit.observed);
  if (hit.result === "MISSING_DATA") {
    const missing = keys.filter((k) => hit.observed[k] === null).map(label);
    return `No se pudo leer: ${(missing.length ? missing : keys.map(label)).join(", ")}`;
  }
  if (hit.result === "NOT_APPLICABLE") return notApplicableReason(hit);
  if (keys.length === 0) return "Sin datos para comparar";
  const only = keys.length === 1 ? keys[0] : null;
  if (only && column(only) === "vendor_id") return hit.observed[only] ? "El proveedor está registrado" : "No hay un proveedor registrado con estos datos";
  if (only && column(only) === "campos_faltantes") {
    const n = Number(hit.observed[only]);
    return n === 0 ? "No falta ningún dato" : `Faltan ${n} ${n === 1 ? "dato obligatorio" : "datos obligatorios"}`;
  }
  return keys.map((k) => sentence(hit, k)).join(" · ");
}

export function notApplicableReason(hit: Hit): string {
  const sources = [...Object.keys(hit.observed), ...Object.keys(hit.threshold)].map(source);
  if (sources.includes("vendor")) return "No hay proveedor registrado";
  if (sources.includes("po_check")) return "No hay orden de compra";
  return "No aplica a esta factura";
}
