"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RuleDraft } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function ConditionChip({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs">
      <span className="truncate">{text}</span>
    </span>
  );
}

// The raw conditions, closed by default: the summary sentence is what people read.
export function TechnicalCondition({ rule, className }: { rule: RuleDraft; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        Ver condición técnica
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          {rule.conditions.map((c, i) => (
            <span key={i} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              {i > 0 && <span className="text-xs text-muted-foreground">y</span>}
              <ConditionChip text={c.text} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function OverridableNote({ rule }: { rule: RuleDraft }) {
  if (!rule.overridable) return null;
  return <p className="text-xs text-muted-foreground">Se puede anular con una excepción</p>;
}
