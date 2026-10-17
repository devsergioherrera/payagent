import type { InvoiceSummary } from "@/lib/api-types";
import { money } from "@/lib/format";
import { shortDate } from "@/lib/format";
import { Source } from "@/lib/api-types";
import { OutcomeBadge } from "@/components/outcome-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";

export interface OutletProps {
  invoices: InvoiceSummary[];
}

export default function Outlet({ invoices }: OutletProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se encontraron facturas</p>
      </div>
    );
  }

  const sourceLabels: Record<Source, string> = {
    EMAIL: "Correo",
    UPLOAD: "Carga",
    TEXT: "Texto",
    CHAT: "Chat",
    INBOX: "Bandeja",
    SEED: "Semilla",
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHead>
            <TableRow>
              <TableHead className="w-20">Proveedor</TableHead>
              <TableHead className="w-16">Número</TableHead>
              <TableHead className="w-16">Fecha</TableHead>
              <TableHead className="w-20">Monto</TableHead>
              <TableHead className="w-16">Fuente</TableHead>
              <TableHead className="w-20">Resultado</TableHead>
              <TableHead className="w-16">Decidido por</TableHead>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} onClick={() => {
                // Navigate to invoice detail
                // In a real app, we'd use router.push here
                console.log(`Navigating to invoice ${invoice.id}`);
              }}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      {invoice.vendor_name ? invoice.vendor_name[0] : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invoice.vendor_name ?? "—"}</p>
                      {invoice.vendor_name && (
                        <p className="text-xs text-muted-foreground">NIT: —</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono tabular-nums">
                  {invoice.invoice_number ?? "—"}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {shortDate(invoice.received_at)}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                   <div className="flex flex-col">
                     <p className="font-medium">{money(invoice.amount, invoice.currency || "USD")}</p>
                     {invoice.amount_usd !== null && (
                       <p className="text-xs text-muted-foreground">
                         ~{money(invoice.amount_usd, "USD")}
                       </p>
                     )}
                   </div>
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {sourceLabels[invoice.source as Source] ?? invoice.source}
                </TableCell>
                <TableCell>
                  {invoice.outcome ? (
                    <OutcomeBadge outcome={invoice.outcome} className="h-8 w-24" />
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">
                      Procesando
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {invoice.decided_by ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
   );
 }