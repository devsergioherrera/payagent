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
