"use client";

import { useMemo, useState } from "react";
import { Bot, Eye, EyeOff, Search, SearchX, User } from "lucide-react";
import type { Effect, RuleView } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { EFFECT } from "./effect-badge";
import { RuleRow } from "./rule-row";

const GROUPS = [
  { key: "vendor", label: "Proveedor", sources: ["vendor"] },
  { key: "invoice", label: "Factura", sources: ["invoice"] },
  { key: "checks", label: "Validaciones", sources: ["invoice_checks"] },
  { key: "po", label: "Orden de compra", sources: ["po_check", "purchase_order"] },
  { key: "budget", label: "Presupuesto", sources: ["budget_status"] },
];
const PAGE = 25;

const groupOf = (r: RuleView) => (GROUPS.find((g) => g.sources.includes(r.conditions[0]?.source ?? "")) ?? GROUPS[1]).key;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        active ? "border-foreground/20 bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function RuleList({ rules, onChange }: { rules: RuleView[]; onChange: () => void }) {
  const [query, setQuery] = useState("");
  const [effects, setEffects] = useState<Effect[]>([]);
  const [origin, setOrigin] = useState<RuleView["origin"] | null>(null);
  const [showOff, setShowOff] = useState(false);
  const [group, setGroup] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimit(PAGE); };

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((r) => {
      if (!showOff && !r.active) return false;
      if (effects.length && !effects.includes(r.effect)) return false;
      if (origin && r.origin !== origin) return false;
      if (!q) return true;
      return [r.name, r.summary, r.natural_language, ...r.conditions.map((c) => c.text)].some((t) => t.toLowerCase().includes(q));
    });
  }, [rules, query, effects, origin, showOff]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const r of base) c[groupOf(r)] = (c[groupOf(r)] ?? 0) + 1;
    return c;
  }, [base]);

  const shown = group === "all" ? base : base.filter((r) => groupOf(r) === group);
  const toggleEffect = (e: Effect) => reset(setEffects)(effects.includes(e) ? effects.filter((x) => x !== e) : [...effects, e]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Reglas activas</h2>
          <Chip active={showOff} onClick={() => reset(setShowOff)(!showOff)}>
            {showOff ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Ver desactivadas
          </Chip>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="Buscar reglas"
            aria-label="Buscar reglas"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EFFECT) as Effect[]).reverse().map((e) => {
            const { icon: Icon, label } = EFFECT[e];
            return (
              <Chip key={e} active={effects.includes(e)} onClick={() => toggleEffect(e)}>
                <Icon className="size-3.5" aria-hidden />{label}
              </Chip>
            );
          })}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          <Chip active={origin === "HUMAN"} onClick={() => reset(setOrigin)(origin === "HUMAN" ? null : "HUMAN")}>
            <User className="size-3.5" aria-hidden />Humano
          </Chip>
          <Chip active={origin === "AGENT"} onClick={() => reset(setOrigin)(origin === "AGENT" ? null : "AGENT")}>
            <Bot className="size-3.5" aria-hidden />Agente
          </Chip>
        </div>
        <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {[{ key: "all", label: "Todas" }, ...GROUPS].map((g) => (
            <button
              key={g.key}
              role="tab"
              type="button"
              aria-selected={group === g.key}
              onClick={() => reset(setGroup)(g.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] transition-colors",
                group === g.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
              <span className="text-xs tabular-nums text-muted-foreground">{counts[g.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[480px] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
        {shown.length === 0 ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <SearchX className="size-4" aria-hidden />
            {rules.length === 0 ? "Aún no hay reglas." : "Ninguna regla coincide con los filtros."}
          </p>
        ) : (
          <ul className="divide-y">
            {shown.slice(0, limit).map((r) => <RuleRow key={r.id} rule={r} onChange={onChange} />)}
          </ul>
        )}
        {shown.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="w-full border-t p-3 text-[13px] text-muted-foreground hover:bg-muted/50">
            Mostrar más ({shown.length - limit})
          </button>
        )}
      </div>
    </section>
  );
}
