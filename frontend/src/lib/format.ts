// `digits` raises the precision for tiny amounts such as model costs (4 decimals).
export function money(amount: number | null | undefined, currency = "USD", digits = 2) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: digits > 2 ? digits : undefined, maximumFractionDigits: digits }).format(amount);
}

// A bare "2026-10-09" parses as UTC midnight, which is the 8th in Colombia: read date-only values at local noon.
const toDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(toDate(iso));
}

export function time(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

export function dayTime(iso: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(d).replace(".", "").replace(" de ", " ");
  const hm = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day} ${hm}`;
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

export const isProcessing = (status: string) => status !== "DECIDED" && status !== "FAILED";

export function duration(ms: number) {
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000)} s`;
}

export function costUsd(v: number) {
  return money(v, "USD", 4);
}

// "17 oct" style date used for final states.
export function dayMonth(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(toDate(iso)).replace(".", "").replace(" de ", " ");
}

// "2026-10-01" -> "octubre". Noon avoids a timezone shift to the previous day.
export function monthName(isoDate: string) {
  return new Intl.DateTimeFormat("es-CO", { month: "long" }).format(new Date(`${isoDate}T12:00:00`));
}

// Whole dollars for headline figures; cents only when they exist.
export function moneyWhole(amount: number, currency = "USD") {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  }).format(amount);
}
