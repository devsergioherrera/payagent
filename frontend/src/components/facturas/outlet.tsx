import Link from "next/link";
import type { InvoiceSummary, Source } from "@/lib/api-types";
import { invoiceState, money, shortDate } from "@/lib/format";
import { OutcomeBadge } from "@/components/outcome-badge";
import { StatusDot } from "@/components/mesa/status-dot";

const SOURCE: Record<Source, string> = {
  EMAIL: "Correo", UPLOAD: "Carga", TEXT: "Texto", CHAT: "Chat", INBOX: "Bandeja", SEED: "Histórico",
};
const DECIDER = { AGENT: "Agente", HUMAN: "Tú" } as const;

// One grid for header and rows so the columns line up; below md each row collapses to two lines.
const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_88px_72px_150px_80px_104px_72px] md:items-center md:gap-4";

export default function Outlet({ invoices, listClassName }: { invoices: InvoiceSummary[]; listClassName?: string }) {
  if (invoices.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No hay facturas que coincidan.</p>;
  }
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card">
      <div className={`hidden border-b px-5 py-3 text-xs text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_88px_72px_150px_80px_104px_72px] md:gap-4`}>
        <span>Proveedor</span><span>Número</span><span>Fecha</span><span className="text-right">Monto</span>
        <span>Fuente</span><span>Resultado</span><span>Decidió</span>
      </div>
      <ul className={`min-h-0 divide-y overflow-y-auto ${listClassName ?? ""}`}>
        {invoices.map((i) => (
          <li key={i.id}>
            <Link href={`/facturas/${i.id}`} className={`block px-5 py-3.5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none ${COLS}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusDot invoice={i} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.vendor_name ?? "Leyendo factura"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums md:hidden">{money(i.amount, i.currency ?? "USD")}</span>
              </div>
              <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground md:hidden">
                {[i.invoice_number, shortDate(i.received_at), invoiceState(i)].filter(Boolean).join(" · ")}
              </p>
              <span className="hidden text-[13px] tabular-nums md:block">{i.invoice_number ?? "—"}</span>
              <span className="hidden text-[13px] tabular-nums text-muted-foreground md:block">{shortDate(i.received_at)}</span>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</p>
                {i.currency && i.currency !== "USD" && i.amount_usd != null && (
                  <p className="text-xs tabular-nums text-muted-foreground">{money(i.amount_usd, "USD")}</p>
                )}
              </div>
              <span className="hidden text-[13px] text-muted-foreground md:block">{SOURCE[i.source]}</span>
              <span className="hidden md:block">
                {i.outcome ? <OutcomeBadge outcome={i.outcome} /> : <span className="text-xs text-muted-foreground">Procesando</span>}
              </span>
              <span className="hidden text-[13px] text-muted-foreground md:block">{i.decided_by ? DECIDER[i.decided_by] : "—"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
