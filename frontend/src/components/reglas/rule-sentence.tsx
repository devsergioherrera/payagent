import type { RuleDraft } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { EFFECT, EffectBadge } from "./effect-badge";

export function ConditionChip({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border bg-muted/50 px-2 py-0.5 text-[13px] font-medium">
      <span className="truncate">{text}</span>
    </span>
  );
}

// "Si <condition> y <condition> → Escalar": the rule read as a sentence.
export function RuleSentence({ rule, plainEffect, className }: { rule: RuleDraft; plainEffect?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm", className)}>
      <span className="text-muted-foreground">Si</span>
      {rule.conditions.map((c, i) => (
        <span key={i} className="inline-flex min-w-0 max-w-full items-center gap-2">
          {i > 0 && <span className="text-muted-foreground">y</span>}
          <ConditionChip text={c.text} />
        </span>
      ))}
      <span className="text-muted-foreground" aria-hidden>→</span>
      {plainEffect ? <span className="font-medium">{EFFECT[rule.effect].label}</span> : <EffectBadge effect={rule.effect} />}
    </div>
  );
}

export function OverridableNote({ rule }: { rule: RuleDraft }) {
  if (!rule.overridable) return null;
  return <p className="text-xs text-muted-foreground">Se puede anular con una excepción</p>;
}
