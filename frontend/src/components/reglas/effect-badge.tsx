import type { Effect } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const EFFECT: Record<Effect, { label: string; style: string }> = {
  ALLOW: { label: "Permitir", style: "bg-brand-soft text-brand" },
  ESCALATE: { label: "Escalar", style: "bg-escalate-soft text-escalate" },
  HOLD: { label: "Frenar", style: "bg-hold-soft text-hold" },
};

export function EffectBadge({ effect, className }: { effect: Effect; className?: string }) {
  const { label, style } = EFFECT[effect];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", style, className)}>
      {label}
    </span>
  );
}
