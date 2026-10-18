"use client";

import { useState } from "react";
import { Check, Pencil, TriangleAlert, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { BudgetStatus } from "@/lib/api-types";
import { moneyWhole as money, monthName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LOW_SHARE = 0.15;

function Legend({ dot, label, amount, share, tone }: { dot: string; label: string; amount: number; share: number; tone?: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="hidden w-9 shrink-0 text-right text-xs sm:block tabular-nums text-muted-foreground">{Math.round(share * 100)} %</span>
      <span className={cn("w-24 shrink-0 text-right font-medium tabular-nums", tone)}>{money(amount)}</span>
    </li>
  );
}

export function BudgetCard({ budget, onSaved, defaultEditing = false }: { budget: BudgetStatus; onSaved: () => void; defaultEditing?: boolean }) {
  const [editing, setEditing] = useState(defaultEditing);
  const [value, setValue] = useState(String(budget.amount_usd));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { amount_usd: total, paid_usd: paid, approved_usd: approved, available_usd: available } = budget;
  const span = Math.max(total, paid + approved, 1);
  const share = (n: number) => Math.max(0, n) / span;
  const low = total > 0 && available / total < LOW_SHARE;
  const parsed = Number(value.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.setBudget({ period: budget.period, amount_usd: parsed });
      toast.success("Presupuesto actualizado");
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setValue(String(total));
    setError(null);
    setEditing(true);
  }

  return (
    <section aria-label="Presupuesto del mes" className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Wallet className="size-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">Presupuesto de {monthName(budget.period)}</h2>
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={startEditing}
            aria-label="Editar el presupuesto"
            className="size-8 rounded-full text-muted-foreground hover:text-brand active:scale-[0.98]"
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="budget-amount" className="text-xs text-muted-foreground">Total del mes en USD</label>
          <div className="flex items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/30">
              <span className="text-sm text-muted-foreground">USD</span>
              <input
                id="budget-amount"
                autoFocus
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums outline-none"
              />
            </div>
            <Button type="submit" disabled={!valid || saving} className="h-10 rounded-xl bg-brand px-4 text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
              <Check />Guardar
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancelar" className="size-10 rounded-xl active:scale-[0.98]">
              <X />
            </Button>
          </div>
          {error && <p role="alert" className="text-[13px] text-hold">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">{money(total)}</p>
          <p className="text-xs text-muted-foreground">
            {budget.invoices_paid} {budget.invoices_paid === 1 ? "factura contada" : "facturas contadas"}
          </p>
        </div>
      )}

      <div
        role="img"
        aria-label={`Pagado ${money(paid)}, aprobado ${money(approved)}, disponible ${money(available)}`}
        className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-brand transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${share(paid) * 100}%` }} />
        <div className="h-full bg-brand/40 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${share(approved) * 100}%` }} />
        <div
          className={cn("h-full transition-[width] duration-500 motion-reduce:transition-none", low ? "bg-escalate/60" : "bg-foreground/10")}
          style={{ width: `${share(available) * 100}%` }}
        />
      </div>

      <ul className="flex flex-col gap-2">
        <Legend dot="bg-brand" label="Pagado por el agente" amount={paid} share={share(paid)} />
        <Legend dot="bg-brand/40" label="Aprobado por ti" amount={approved} share={share(approved)} />
        <Legend
          dot={low ? "bg-escalate/60" : "bg-foreground/15"}
          label="Disponible"
          amount={available}
          share={share(available)}
          tone={low ? "text-escalate" : undefined}
        />
      </ul>

      {low && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-escalate-soft px-3 py-2 text-[13px] text-escalate">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {available < 0 ? "El mes está sobregirado." : "Queda menos del 15 % del presupuesto."}
        </p>
      )}
    </section>
  );
}
