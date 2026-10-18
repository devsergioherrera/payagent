import type { InvoiceSummary } from "@/lib/api-types";
import { STATE } from "@/lib/state";
import { cn } from "@/lib/utils";

export function StatusDot({ invoice }: { invoice: Pick<InvoiceSummary, "state"> }) {
  if (invoice.state === "PROCESSING") {
    return <span className="size-2.5 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand motion-reduce:animate-none" />;
  }
  return <span className={cn("size-2.5 shrink-0 rounded-full", STATE[invoice.state].dot)} />;
}
