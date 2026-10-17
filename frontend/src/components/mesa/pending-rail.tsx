"use client";

import Link from "next/link";
import { useState } from "react";
import type { InvoiceSummary, Outcome } from "@/lib/api-types";
import { money } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TEXT: Record<Outcome, string> = { PAY: "text-pay", ESCALATE: "text-escalate", HOLD: "text-hold" };

export function PendingRail({ invoices, className }: { invoices: InvoiceSummary[] | null; className?: string }) {
  const [tab, setTab] = useState<"ESCALATE" | "HOLD">("ESCALATE");
  const pending = (invoices ?? []).filter((i) => i.decision_status === "PENDING_HUMAN");
  const counts = { ESCALATE: pending.filter((i) => i.outcome === "ESCALATE").length, HOLD: pending.filter((i) => i.outcome === "HOLD").length };
  const rows = pending.filter((i) => i.outcome === tab);

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="space-y-3 px-4 pb-3 pt-4">
        <h2 className="text-sm font-semibold">Esperan tu decisión</h2>
        <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-secondary p-0.5">
          {(["ESCALATE", "HOLD"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-md text-[13px] text-muted-foreground transition-colors",
                tab === t && "bg-card font-medium text-foreground shadow-xs",
              )}
            >
              {t === "ESCALATE" ? "Escaladas" : "Frenadas"} ({counts[t]})
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {!invoices ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada {tab === "ESCALATE" ? "escalado" : "frenado"} por ahora.</p>
        ) : (
          rows.map((i) => (
            <div key={i.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.vendor_name ?? "Proveedor sin leer"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className={cn("min-w-0 truncate text-xs font-medium", TEXT[tab])}>{i.headline ?? "Requiere revisión"}</span>
                <Link href={`/facturas/${i.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>Revisar</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

