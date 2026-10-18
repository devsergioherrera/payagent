"use client";

import { useState } from "react";
import type { Policy, PolicyLimit, RuleView } from "@/lib/api-types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetCard } from "./budget-card";
import { LimitCards, REVISE_PREFILL } from "./limit-cards";
import { RuleRevise } from "./rule-revise";

interface Props {
  policy: Policy;
  rules: RuleView[];
  onChange: () => void;
  onShowExceptions: () => void;
  budgetEditing?: boolean;
}

// "Cambiar" reuses the edit-with-agent flow, so every limit change is a traceable rule version.
export function PolicyStrip({ policy, rules, onChange, onShowExceptions, budgetEditing }: Props) {
  const [revising, setRevising] = useState<PolicyLimit | null>(null);
  const rule = revising ? rules.find((r) => r.id === revising.rule_id) : undefined;
  const close = () => setRevising(null);

  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BudgetCard budget={policy.budget} onSaved={onChange} defaultEditing={budgetEditing} />
      <LimitCards policy={policy} onChange={setRevising} onShowExceptions={onShowExceptions} />
      <Dialog open={revising !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar: {revising?.label}</DialogTitle>
            <DialogDescription>{rule ? rule.summary : "No encontré la regla de este límite."}</DialogDescription>
          </DialogHeader>
          {rule && revising && (
            <RuleRevise rule={rule} initialText={REVISE_PREFILL[revising.key]} onClose={close} onSaved={() => { close(); onChange(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PolicySkeleton() {
  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-hidden>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}
