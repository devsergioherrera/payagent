"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import type { InvoiceSummary } from "@/lib/api-types";
import { money } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PendingRail({ invoices, className }: { invoices: InvoiceSummary[] | null; className?: string }) {
  const rows = (invoices ?? []).filter((i) => i.outcome === "ESCALATE" && i.decision_status === "PENDING_HUMAN");

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-escalate" />
          Esperan tu decisión ({rows.length})
        </h2>
        <Link href="/facturas?outcome=HOLD" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Ver frenadas <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {!invoices ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada espera tu decisión por ahora.</p>
        ) : (
          rows.map((i) => (
            <div key={i.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.vendor_name ?? "Proveedor sin leer"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-medium text-escalate">{i.headline ?? "Requiere revisión"}</span>
                <Link href={`/facturas/${i.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>Revisar</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
