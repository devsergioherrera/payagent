import type { RuleDraft } from "@/lib/api-types";
import { EffectBadge } from "./effect-badge";
import { OverridableNote, TechnicalCondition } from "./rule-sentence";

export function DraftPreview({ draft, children }: { draft: RuleDraft; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <EffectBadge effect={draft.effect} />
        <p className="min-w-0 truncate text-xs text-muted-foreground">{draft.name}</p>
      </div>
      <p className="text-[15px] leading-snug font-medium">{draft.summary}</p>
      <OverridableNote rule={draft} />
      <TechnicalCondition rule={draft} />
      {children}
    </div>
  );
}
