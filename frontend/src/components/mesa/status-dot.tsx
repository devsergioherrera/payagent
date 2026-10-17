import type { InvoiceSummary, Outcome } from "@/lib/api-types";
import { isProcessing } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOT: Record<Outcome, string> = { PAY: "bg-pay", ESCALATE: "bg-escalate", HOLD: "bg-hold" };

export function StatusDot({ invoice }: { invoice: Pick<InvoiceSummary, "status" | "outcome"> }) {
  if (isProcessing(invoice.status)) {
    return <span className="size-2.5 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />;
  }
  return <span className={cn("size-2.5 shrink-0 rounded-full", invoice.outcome ? DOT[invoice.outcome] : "bg-muted-foreground/40")} />;
}
