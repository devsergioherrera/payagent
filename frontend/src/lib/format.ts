import type { Outcome } from "./api-types";

export const OUTCOME_LABEL: Record<Outcome, string> = { PAY: "Pagada", HOLD: "Frenada", ESCALATE: "Escalada" };

// Tailwind classes per outcome: semantic colors are reserved for these three states.
export const OUTCOME_STYLE: Record<Outcome, string> = {
  PAY: "bg-pay-soft text-pay",
  HOLD: "bg-hold-soft text-hold",
  ESCALATE: "bg-escalate-soft text-escalate",
};

export function money(amount: number | null | undefined, currency = "USD") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function time(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

// Where an invoice is in its life, in one short phrase.
export function invoiceState(i: {
  status: string; outcome: Outcome | null; decision_status: string | null; decided_by: string | null;
}) {
  if (i.status === "FAILED") return "No se pudo leer";
  if (i.status !== "DECIDED" || !i.outcome) return "Procesando";
  const pending = i.decision_status === "PENDING_HUMAN";
  if (i.outcome === "PAY") return i.decided_by === "HUMAN" ? "Pagada con tu aprobación" : "Pagada por el agente";
  if (i.outcome === "ESCALATE") return pending ? "Espera tu decisión" : "Escalada y resuelta";
  return pending ? "Frenada, espera tu decisión" : "Frenada y resuelta";
}

export const isProcessing = (status: string) => status !== "DECIDED" && status !== "FAILED";
