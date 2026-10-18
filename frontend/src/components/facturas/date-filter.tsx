"use client";

import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

const PRESETS = [
  { key: "today", label: "Hoy", range: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { key: "7d", label: "7 días", range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { key: "30d", label: "30 días", range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  { key: "month", label: "Este mes", range: () => ({ from: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: daysAgo(0) }) },
] as const;

export interface DateRange { from: string; to: string }

const dateInput =
  "h-8 w-[132px] rounded-xl border bg-card px-2 text-[13px] tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DateFilter({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const active = PRESETS.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  })?.key;
  const set = value.from !== "" || value.to !== "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex gap-0.5 rounded-full bg-secondary p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(active === p.key ? { from: "", to: "" } : p.range())}
            className={cn(
              "h-7 whitespace-nowrap rounded-full px-3 text-[13px] text-muted-foreground transition-colors active:scale-[0.98]",
              active === p.key && "bg-card font-medium text-foreground shadow-xs",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" aria-label="Desde" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className={dateInput} />
      <span className="text-xs text-muted-foreground">a</span>
      <input type="date" aria-label="Hasta" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className={dateInput} />
      {set && (
        <button type="button" aria-label="Quitar fechas" onClick={() => onChange({ from: "", to: "" })} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary active:scale-[0.98]">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
