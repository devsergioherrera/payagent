"use client";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import Link from "next/link";
import { Summary, InvoiceSummary } from "@/lib/api-types";
import { money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutcomeBadge } from "@/components/outcome-badge";

export function SummaryColumn({ className }: { className?: string }) {
  const { data: summary, error: summaryError } = usePolling(
    () => api.summary(),
    3000
  );
  const { data: invoices, error: invoicesError } = usePolling(
    () => api.invoices({}),
    3000
  );

  if (summaryError) {
    return <div className="p-4 text-sm text-destructive">Error cargando resumen</div>
  }
  if (invoicesError) {
    return <div className="p-4 text-sm text-destructive">Error cargando facturas</div>
  }

  const newestInvoice = invoices?.[0] ?? null;

  return (
    <section className={`${className} flex flex-col gap-4 py-4 overflow-y-auto`}>
      <div className="flex items-center gap-4">
        <div id="mascot-slot" className="flex-shrink-0 size-16 rounded-border border-muted-background bg-muted-background"></div>
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium">
            Sabado, 17 de octubre
          </div>
          <div className="text-xl font-semibold tracking-tight">
            Hola, Sergio.
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            Tienes {summary?.pending_human ?? 0} escaladas esperando tu decisión.
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary">
              Escaladas: {summary?.escalated ?? 0}
            </Badge>
            <Badge variant="secondary">
              Pagadas: {summary?.paid ?? 0}
            </Badge>
            <Badge variant="secondary">
              Frenadas: {summary?.held ?? 0}
            </Badge>
            <span className="text-xs text-muted-foreground">
              El agente decidió solo el {summary?.autonomy_pct ?? 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
        <div className="flex-shrink-0 size-2 rounded-full bg-green-500"></div>
        <span>Correo conectado · revisado hace 8 s</span>
      </div>

      {/* Newest invoice card */}
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
         <article className="rounded-border border p-4">
           {newestInvoice && newestInvoice.outcome ? (
            <div className="mb-3 flex h-9 items-center justify-center rounded-border bg-muted">
              <span className="text-xs font-medium tracking-wider">
                Recibida → Leyendo → Evaluando reglas → Decidida
              </span>
            </div>
          ) : (
            <div className="mb-3 flex h-9 items-center justify-center rounded-border bg-brand/20">
              <span className="text-xs font-medium tracking-wider text-brand">
                Recibida → Leyendo → Evaluando reglas → Decidida
              </span>
            </div>
           )}
           {newestInvoice && newestInvoice.outcome ? (
             <div className="mb-4">
               <div className="flex items-baseline gap-2">
                 <span className="text-sm font-semibold">
                   {newestInvoice.vendor_name ?? "Proveedor desconocido"}
                 </span>
                 <span className="text-xs text-muted-foreground">
                   FV-{newestInvoice.invoice_number ?? "----"}
                 </span>
               </div>
               <div className="text-2xl font-semibold tabular-nums mt-1">
                 {money(newestInvoice.amount_usd ?? 0, newestInvoice.currency ?? "USD")}
               </div>
               <p className="mt-2 text-sm text-muted-foreground">
                 {newestInvoice?.headline ?? "Regla aplicada"}
               </p>
              <div className="mt-3 flex w-full justify-end">
                 <Link
                   href={`/facturas/${newestInvoice?.id}`}
                   className="rounded-border border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                 >
                  Ver factura
                </Link>
              </div>
             </div>
           ) : (
             <div className="space-y-2">
               <div className="flex items-baseline gap-2">
                 <span className="text-sm font-semibold">
                   {newestInvoice?.vendor_name ?? "Proveedor desconocido"}
                 </span>
                 <span className="text-xs text-muted-foreground">
                   FV-{newestInvoice?.invoice_number ?? "----"}
                 </span>
               </div>
               <div className="text-2xl font-semibold tabular-nums mt-1">
                 {money(newestInvoice?.amount_usd ?? 0, newestInvoice?.currency ?? "USD")}
               </div>
              <div className="mt-2 flex h-9 items-center justify-center rounded-border bg-brand/20">
                <span className="text-xs font-medium tracking-wider text-brand">
                  Recibida → Leyendo → Evaluando reglas
                </span>
              </div>
            </div>
          )}
        </article>
      )}

      {/* Pending decisions tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="escaladas">
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-border bg-muted">
            <TabsTrigger value="escaladas" className="flex flex-col items-center justify-center px-2 py-1.5 text-sm font-semibold rounded-border hover:bg-muted-background">
              Escaladas ({summary?.escalated ?? 0})
            </TabsTrigger>
            <TabsTrigger value="frenadas" className="flex flex-col items-center justify-center px-2 py-1.5 text-sm font-semibold rounded-border hover:bg-muted-background">
              Frenadas ({summary?.held ?? 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="escaladas" className="mt-2 space-y-2">
            {/* Escalated invoices list would go here */}
            <div className="text-sm text-muted-foreground text-center py-4">
              Lista de escaladas
            </div>
          </TabsContent>
          <TabsContent value="frenadas" className="mt-2 space-y-2">
            {/* Held invoices list would go here */}
            <div className="text-sm text-muted-foreground text-center py-4">
              Lista de frenadas
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}