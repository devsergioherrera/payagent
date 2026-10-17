"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { InvoiceSummary, Summary } from "@/lib/api-types";
import { ago, invoiceState, money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "./status-dot";

function matches(i: InvoiceSummary, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (i.vendor_name?.toLowerCase().includes(q) || i.invoice_number?.toLowerCase().includes(q)) return true;
  const digits = q.replace(/[.,\s]/g, "");
  return /^\d+$/.test(digits) && i.amount != null && String(i.amount).includes(digits);
}

function EmailStatus({ summary }: { summary: Summary | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!summary) return <Skeleton className="h-4 w-44" />;
  const on = summary.email_connected;
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", on ? "bg-pay" : "bg-muted-foreground/40")} />
      {on
        ? `Correo conectado${summary.email_checked_at ? ` · revisado hace ${ago(summary.email_checked_at, now)}` : ""}`
        : "Correo sin conexión"}
    </p>
  );
}

export function InvoiceRail({ invoices, summary, className }: { invoices: InvoiceSummary[] | null; summary: Summary | null; className?: string }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => (invoices ?? []).filter((i) => matches(i, query)), [invoices, query]);

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Facturas</h2>
          <EmailStatus summary={summary} />
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proveedor, número o monto"
            className="h-9 w-full rounded-lg border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!invoices ? (
          <div className="space-y-1 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 py-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /></div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{query ? "Ninguna factura coincide." : "Aún no hay facturas."}</p>
        ) : (
          rows.map((i) => (
            <Link key={i.id} href={`/facturas/${i.id}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
              <div className="flex items-center gap-2.5">
                <StatusDot invoice={i} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.vendor_name ?? "Leyendo factura"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</span>
              </div>
              <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
                {[i.invoice_number, shortDate(i.received_at), invoiceState(i)].filter(Boolean).join(" · ")}
              </p>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}
