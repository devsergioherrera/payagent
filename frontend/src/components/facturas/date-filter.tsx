"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import type { DateRange as PickerRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const fromIso = (v: string) => (v ? new Date(`${v}T00:00:00`) : undefined);
const label = (v: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(fromIso(v)).replace(".", "").replace(" de ", " ");
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

export function DateFilter({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const active = PRESETS.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  })?.key;
  const [open, setOpen] = useState(false);
  const set = value.from !== "" || value.to !== "";
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-xl border bg-card px-3 text-[13px] tabular-nums outline-none transition-[background-color,transform] hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
            !set && "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          {set ? `${value.from ? label(value.from) : "…"} a ${value.to ? label(value.to) : "…"}` : "Elegir fechas"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
          <Calendar
            mode="range"
            locale={es}
            weekStartsOn={1}
            numberOfMonths={2}
            defaultMonth={fromIso(value.from)}
            selected={{ from: fromIso(value.from), to: fromIso(value.to) }}
            onSelect={(r: PickerRange | undefined) => {
              onChange({ from: r?.from ? iso(r.from) : "", to: r?.to ? iso(r.to) : r?.from ? iso(r.from) : "" });
              if (r?.from && r?.to && r.to > r.from) setOpen(false);
            }}
            className="max-w-[calc(100vw-2rem)] [&_.rdp-months]:flex-col sm:[&_.rdp-months]:flex-row"
          />
        </PopoverContent>
      </Popover>
      {set && (
        <button type="button" aria-label="Quitar fechas" onClick={() => onChange({ from: "", to: "" })} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary active:scale-[0.98]">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
