import type { InvoiceState } from "@/lib/api-types";
import { STATE } from "@/lib/state";
import { cn } from "@/lib/utils";

export function StateBadge({ state, className }: { state: InvoiceState; className?: string }) {
  const { label, tone, icon: Icon } = STATE[state];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}>
      <Icon className={cn("size-3", state === "PROCESSING" && "animate-spin motion-reduce:animate-none")} />
      {label}
    </span>
  );
}
