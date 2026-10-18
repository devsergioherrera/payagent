import { ArrowUpRight, OctagonX, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Effect } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export const EFFECT: Record<Effect, { label: string; style: string; icon: LucideIcon }> = {
  ALLOW: { label: "Permitir", style: "bg-brand-soft text-brand", icon: ShieldCheck },
  ESCALATE: { label: "Escalar", style: "bg-escalate-soft text-escalate", icon: ArrowUpRight },
  HOLD: { label: "Frenar", style: "bg-hold-soft text-hold", icon: OctagonX },
};

// Display order: the strictest effect first. The check below fails to compile if an Effect is left out.
export const EFFECT_ORDER = ["HOLD", "ESCALATE", "ALLOW"] as const satisfies readonly Effect[];
const _allEffectsOrdered: Exclude<Effect, (typeof EFFECT_ORDER)[number]> extends never ? true : never = true;
void _allEffectsOrdered;

export function EffectBadge({ effect, className }: { effect: Effect; className?: string }) {
  const { label, style, icon: Icon } = EFFECT[effect];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", style, className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
