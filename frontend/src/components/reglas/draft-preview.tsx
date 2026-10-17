import type { RuleDraft } from "@/lib/api-types";
import { OverridableNote, RuleSentence } from "./rule-sentence";

export function DraftPreview({ draft, children }: { draft: RuleDraft; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{draft.name}</p>
      <RuleSentence rule={draft} />
      <OverridableNote rule={draft} />
      {children}
    </div>
  );
}
