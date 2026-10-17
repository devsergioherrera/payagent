"use client";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import Link from "next/link";
import { InvoiceSummary } from "@/lib/api-types";
import { money, shortDate, OUTCOME_LABEL } from "@/lib/format";
import { OutcomeBadge } from "@/components/outcome-badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MoneyColumn({ className }: { className?: string }) {
  const { data: invoices, error, refresh } = usePolling(
    () => api.invoices({}),
    3000
  );

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error cargando facturas</div>
  }

  return (
    <aside className={`${className} flex flex-col gap-2 py-4 overflow-y-auto`}>
      <div className="flex items-center justify-between px-4">
        <label htmlFor="invoice-search" className="sr-only">Buscar facturas</label>
        <input
          id="invoice-search"
          type="text"
          placeholder="Proveedor, número o monto"
          className="flex-1 min-w-0 rounded-border border-input bg-input px-3 py-2 text-sm ring-offset-background file-input:focus-visible:outline-none file-input:focus-visible:ring-2 file-input:focus-visible:ring-ring file-input:focus-visible:ring-offset-0 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Trigger search
            }
          }}
        />
        <button onClick={refresh} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          Actualizar
        </button>
      </div>

      {!invoices ? (
        <div className="flex h-[200px] items-center justify-center">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-2" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No hay facturas
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/facturas/${invoice.id}`}
                className="flex flex-row items-start gap-3 rounded-border border p-3 hover:bg-muted"
              >
                <div className="flex-shrink-0 size-5 rounded-full border">
                  {invoice.outcome ? (
                    <span className={`${getOutcomeRingClass(invoice.outcome!)} flex items-center justify-center size-4`}
                    ></span>
                  ) : (
                    <span className="animate-spin size-4 rounded-full border-2 border-brand"></span>
                  )}
                </div>
                <div className="flex-1 flex-col space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {invoice.vendor_name ?? "Proveedor desconocido"}
                    </span>
                    <span className="flex-xs text-muted-foreground">
                      FV-{invoice.invoice_number ?? "----"} · {shortDate(invoice.received_at)} · {money(invoice.amount_usd, invoice.currency ?? "USD")}
                    </span>
                  </div>
                  <div className="text-xs flex items-baseline gap-2">
                    <span className="font-medium">
                      {invoice.decided_by === "AGENT"
                        ? "Lo decidió el agente"
                        : "Lo decidiste tú"}
                    </span>
                    <span className={getOutcomeTextClass(invoice.outcome!)}>{invoice.outcome ? OUTCOME_LABEL[invoice.outcome!] : "—"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function getOutcomeRingClass(outcome: "PAY" | "HOLD" | "ESCALATE"): string {
  switch (outcome) {
    case "PAY":
      return "bg-pay-soft";
    case "HOLD":
      return "bg-hold-soft";
    case "ESCALATE":
      return "bg-escalate-soft";
    default:
      return "bg-muted";
  }
}

function getOutcomeTextClass(outcome: "PAY" | "HOLD" | "ESCALATE" | null): string {
  if (!outcome) return "text-muted-foreground";
  switch (outcome) {
    case "PAY":
      return "text-pay";
    case "HOLD":
      return "text-hold";
    case "ESCALATE":
      return "text-escalate";
    default:
      return "text-muted-foreground";
  }
}