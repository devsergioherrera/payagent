"use client";

import Link from "next/link";
import { Ban, Gauge, HandCoins, Pencil, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Policy, PolicyKey, PolicyLimit } from "@/lib/api-types";
import { moneyWhole as money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const REVISE_PREFILL: Record<PolicyKey, string> = {
  payment_limit: "Cambia el límite por pago a ",
  human_approval: "Cambia el umbral de aprobación humana a ",
  po_tolerance: "Cambia la tolerancia de la orden a ",
  po_overdraft: "Cambia el sobregiro permitido de la orden a ",
  date_window: "Cambia la ventana de fechas a ",
};

export function limitValue(l: PolicyLimit | undefined) {
  if (!l || l.value == null) return "—";
  if (l.unit === "USD") return money(l.value);
  return `${new Intl.NumberFormat("es-CO").format(l.value)} ${l.unit}`;
}

const ACTION = "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand active:scale-[0.98]";

function ChangeButton({ limit, onChange }: { limit: PolicyLimit; onChange: (l: PolicyLimit) => void }) {
  return (
    <button type="button" onClick={() => onChange(limit)} aria-label={`Cambiar: ${limit.label}`} className={ACTION}>
      <Pencil className="size-3" aria-hidden />Cambiar
    </button>
  );
}

function Segment({ className, flex, children }: { className: string; flex: number; children: React.ReactNode }) {
  return (
    <div className={cn("flex h-9 items-center justify-center overflow-hidden px-2 text-xs font-medium whitespace-nowrap", className)} style={{ flexGrow: flex, flexBasis: 0 }}>
      {children}
    </div>
  );
}

// The two money thresholds as one scale: where the agent pays alone, asks, and always asks.
function PaymentLadder({ low, high, onChange }: { low?: PolicyLimit; high?: PolicyLimit; onChange: (l: PolicyLimit) => void }) {
  return (
    <section aria-label="Cuánto paga solo el agente" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <HandCoins className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">Cuánto paga solo el agente</h2>
      </div>
      <div className="flex gap-0.5 overflow-hidden rounded-xl">
        <Segment flex={4} className="bg-pay-soft text-pay">Paga solo</Segment>
        <Segment flex={3} className="bg-escalate-soft text-escalate">Tu aprobación</Segment>
        <Segment flex={3} className="bg-escalate text-background">Siempre tú</Segment>
      </div>
      <div className="relative h-14">
        {[{ at: 40, limit: low, align: "-translate-x-1/2" }, { at: 70, limit: high, align: "-translate-x-1/2" }].map(({ at, limit, align }) =>
          limit ? (
            <div key={limit.key} className={cn("absolute top-0 flex flex-col items-center gap-0.5", align)} style={{ left: `${at}%` }}>
              <span className="h-2 w-px bg-border" aria-hidden />
              <span className={cn("text-[15px] font-semibold tabular-nums", !limit.active && "text-muted-foreground line-through")}>{limitValue(limit)}</span>
              <ChangeButton limit={limit} onChange={onChange} />
            </div>
          ) : null,
        )}
        <span className="absolute top-2 left-0 text-xs text-muted-foreground">USD 0</span>
      </div>
    </section>
  );
}

function MiniCard({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-2xl border bg-card p-3.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 text-[13px] leading-tight text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xl font-semibold tracking-tight tabular-nums">{value}</p>
        {children}
      </div>
    </div>
  );
}

interface Props {
  policy: Policy;
  onChange: (l: PolicyLimit) => void;
  onShowExceptions: () => void;
}

export function LimitCards({ policy, onChange, onShowExceptions }: Props) {
  const by = (k: PolicyKey) => policy.limits.find((l) => l.key === k);
  const tolerance = by("po_tolerance");
  const overdraft = by("po_overdraft");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PaymentLadder low={by("payment_limit")} high={by("human_approval")} onChange={onChange} />
      <div className="grid flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniCard icon={Scale} label="Tolerancia de la orden" value={limitValue(tolerance)}>
          {tolerance && <ChangeButton limit={tolerance} onChange={onChange} />}
        </MiniCard>
        <MiniCard icon={Gauge} label="Sobregiro de la orden" value={limitValue(overdraft)}>
          {overdraft && <ChangeButton limit={overdraft} onChange={onChange} />}
        </MiniCard>
        <MiniCard icon={Ban} label="Proveedores bloqueados" value={String(policy.blocked_vendors)}>
          <Link href="/proveedores" className={ACTION}>Ver</Link>
        </MiniCard>
        <MiniCard icon={ShieldCheck} label="Excepciones activas" value={String(policy.exceptions)}>
          <button type="button" onClick={onShowExceptions} className={ACTION}>Ver</button>
        </MiniCard>
      </div>
    </div>
  );
}
