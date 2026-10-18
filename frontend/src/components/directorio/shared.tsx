import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { InvoiceSummary, VendorView } from "@/lib/api-types";
import { money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OutcomeBadge } from "@/components/outcome-badge";

export const TAX_LABEL: Record<VendorView["country"], string> = { CO: "NIT", MX: "RFC", BR: "CNPJ", US: "EIN" };
export const RAIL_LABEL: Record<VendorView["bank_rail"], string> = { ACH: "ACH", WIRE: "Wire", BRE_B: "Bre-B", SPEI: "SPEI", PIX: "PIX" };

export function StatusPill({ blocked, labels, neutral }: { blocked: boolean; labels: [string, string]; neutral?: boolean }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", blocked && !neutral ? "bg-hold-soft text-hold" : "bg-muted text-muted-foreground")}>
      {blocked ? labels[1] : labels[0]}
    </span>
  );
}

export function Section({ icon: Icon, title, aside, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; aside?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-[13px] font-medium"><Icon className="size-4 text-muted-foreground" />{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function InvoiceLinks({ invoices }: { invoices: InvoiceSummary[] }) {
  if (invoices.length === 0) return <p className="px-4 py-3 text-xs text-muted-foreground">Sin facturas.</p>;
  return (
    <ul className="divide-y">
      {invoices.map((i) => (
        <li key={i.id}>
          <Link href={`/facturas/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{i.invoice_number ?? "Sin número"}</p>
              <p className="text-xs text-muted-foreground">{shortDate(i.received_at)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              {i.outcome ? <OutcomeBadge outcome={i.outcome} /> : <span className="text-xs text-muted-foreground">Procesando</span>}
              <span className="text-sm font-medium tabular-nums sm:w-28 sm:text-right">{money(i.amount, i.currency ?? "USD")}</span>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4 p-5" aria-hidden>
      <div className="h-6 w-2/5 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
