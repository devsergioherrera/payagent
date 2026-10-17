"use client";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import Link from "next/link";
import { InvoiceSummary } from "@/lib/api-types";
import { money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutcomeBadge } from "@/components/outcome-badge";

export function PendingColumn({ className }: { className?: string }) {
  const { data: invoices, error, refresh } = usePolling(
    () => api.invoices({}),
    3000
  );

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error cargando facturas</div>
  }

  const pendingInvoices = invoices?.filter(
    (invoice) => invoice.decision_status === "PENDING_HUMAN"
  ) ?? [];

  return (
    <aside className={`${className} flex flex-col gap-2 py-4 overflow-y-auto`}>
      <div className="flex items-center justify-between px-4">
        <h3 className="text-sm font-semibold">Esperan tu decisión</h3>
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
      ) : pendingInvoices.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No hay facturas pendientes
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="escaladas">
            <TabsList className="grid w-full grid-cols-2 gap-1 rounded-border bg-muted">
              <TabsTrigger value="escaladas" className="flex flex-col items-center justify-center px-2 py-1.5 text-sm font-semibold rounded-border hover:bg-muted-background">
                Escaladas ({pendingInvoices.filter(i => i.outcome === "ESCALATE").length})
              </TabsTrigger>
              <TabsTrigger value="frenadas" className="flex flex-col items-center justify-center px-2 py-1.5 text-sm font-semibold rounded-border hover:bg-muted-background">
                Frenadas ({pendingInvoices.filter(i => i.outcome === "HOLD").length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="escaladas" className="mt-2 space-y-2">
              {pendingInvoices
                .filter((invoice) => invoice.outcome === "ESCALATE")
                .map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/facturas/${invoice.id}`}
                    className="flex flex-row items-start gap-3 rounded-border border p-3 hover:bg-muted"
                  >
                    <div className="flex-shrink-0 size-5 rounded-full border bg-escalate-soft">
                      <span className="size-4 flex items-center justify-center bg-escalate text-escalate">
                        !
                      </span>
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
                        <span className="font-medium text-escalate">
                          Lo decidió el agente
                        </span>
                        <span className="text-escalate">
                          Escalada
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </TabsContent>
            <TabsContent value="frenadas" className="mt-2 space-y-2">
              {pendingInvoices
                .filter((invoice) => invoice.outcome === "HOLD")
                .map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/facturas/${invoice.id}`}
                    className="flex flex-row items-start gap-3 rounded-border border p-3 hover:bg-muted"
                  >
                    <div className="flex-shrink-0 size-5 rounded-full border bg-hold-soft">
                      <span className="size-4 flex items-center justify-center bg-hold text-hold">
                        !
                      </span>
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
                        <span className="font-medium text-hold">
                          Lo decidió el agente
                        </span>
                        <span className="text-hold">
                          Frenada
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </aside>
  );
}