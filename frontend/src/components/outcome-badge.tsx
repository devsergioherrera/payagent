import type { Outcome } from "@/lib/api-types";
import { OUTCOME_LABEL, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OutcomeBadge({ outcome, className }: { outcome: Outcome; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", OUTCOME_STYLE[outcome], className)}>
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}
