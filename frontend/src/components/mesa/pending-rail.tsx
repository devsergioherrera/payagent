"use client";

import Link from "next/link";
import { ArrowUpRight, Hand, OctagonX, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { InvoiceSummary } from "@/lib/api-types";
import { money } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  invoices: InvoiceSummary[] | null;
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function PendingRail({ invoices, className, collapsed, onToggle }: Props) {
  const rows = (invoices ?? []).filter((i) => i.state === "WAITING");

  if (collapsed) {
    return (
      <aside className={cn("flex min-h-0 flex-col items-center gap-3 py-3", className)}>
        <button aria-label="Mostrar pendientes" onClick={onToggle} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,transform] hover:bg-secondary hover:text-foreground active:scale-[0.98]">
          <PanelRightOpen className="size-4" />
        </button>
        <span className="relative flex size-9 items-center justify-center rounded-xl bg-escalate-soft text-escalate">
          <Hand className="size-4" />
          {rows.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-escalate px-1 text-[10px] font-semibold tabular-nums leading-none text-background">{rows.length}</span>
          )}
        </span>
      </aside>
    );
  }

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Hand className="size-4 text-escalate" />
        <h2 className="flex-1 text-sm font-semibold">Esperan tu decisión</h2>
        {invoices && <span className="rounded-full bg-escalate-soft px-2 py-0.5 text-xs font-medium tabular-nums text-escalate">{rows.length}</span>}
        {onToggle && (
          <button aria-label="Ocultar pendientes" onClick={onToggle} className="hidden size-7 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,transform] hover:bg-secondary hover:text-foreground active:scale-[0.98] lg:flex">
            <PanelRightClose className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        {!invoices ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
            <Hand className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nada escalado por ahora.</p>
          </div>
        ) : (
          rows.map((i) => (
            <div key={i.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.vendor_name ?? "Proveedor sin leer"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-medium text-escalate">{i.headline ?? "Requiere revisión"}</span>
                <Link href={`/facturas/${i.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 active:scale-[0.98]")}>Revisar</Link>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t px-4 py-3">
        <Link href="/facturas?state=HELD" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <OctagonX className="size-3.5" /> Ver frenadas <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </aside>
  );
}
