import Link from "next/link";
import { Check } from "lucide-react";
import type { InvoiceSummary } from "@/lib/api-types";
import { isProcessing, money } from "@/lib/format";
import { OutcomeBadge } from "@/components/outcome-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = ["Recibida", "Leyendo", "Evaluando reglas", "Decidida"];
const STEP_OF: Record<string, number> = { RECEIVED: 0, EXTRACTING: 1, EVALUATING: 2, DECIDED: 3 };

function Stepper({ status }: { status: string }) {
  const active = STEP_OF[status] ?? 0;
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className="space-y-2">
          <div className={cn("h-1 rounded-full bg-secondary", i < active && "bg-brand/40", i === active && "animate-pulse bg-brand")} />
          <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", i === active && "font-medium text-brand")}>
            {i < active && <Check className="size-3" />}
            {label}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function LatestCard({ invoice }: { invoice: InvoiceSummary }) {
  const processing = isProcessing(invoice.status);
  return (
    <section className="rounded-2xl border bg-card p-5">
      <p className="mb-3 text-xs text-muted-foreground">Lo último</p>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{invoice.vendor_name ?? "Leyendo factura"}</p>
          {invoice.invoice_number && <p className="text-xs text-muted-foreground">{invoice.invoice_number}</p>}
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums">{money(invoice.amount, invoice.currency ?? "USD")}</p>
      </div>
      <div className="mt-4">
        {invoice.status === "FAILED" ? (
          <p className="text-sm text-muted-foreground">No se pudo leer esta factura.</p>
        ) : processing ? (
          <Stepper status={invoice.status} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {invoice.outcome && <OutcomeBadge outcome={invoice.outcome} />}
            <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">{invoice.headline ?? "Sin reglas disparadas"}</span>
            <Link href={`/facturas/${invoice.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver factura</Link>
          </div>
        )}
      </div>
    </section>
  );
}
