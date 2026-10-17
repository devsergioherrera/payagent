"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { ProposalsSection } from "@/components/reglas/proposals-section";
import { RuleComposer } from "@/components/reglas/rule-composer";
import { RuleList } from "@/components/reglas/rule-list";
import { RulesSkeleton } from "@/components/reglas/rules-skeleton";

export default function ReglasPage() {
  const rules = usePolling(() => api.rules(), 3000);
  const proposals = usePolling(() => api.proposals(), 3000);
  const refresh = useCallback(() => {
    rules.refresh();
    proposals.refresh();
  }, [rules, proposals]);

  return (
    <div className="mx-auto flex flex-col gap-4 lg:h-[calc(100dvh-9rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reglas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El agente decide con estas reglas. Escríbelas como se las dirías a una persona.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex flex-col gap-4 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto">
          <RuleComposer onCreated={refresh} />
          <ProposalsSection proposals={proposals.data ?? []} onChange={refresh} />
        </aside>
        {rules.error && !rules.data ? (
          <p className="text-sm text-hold">No se pudieron cargar las reglas.</p>
        ) : rules.data ? (
          <RuleList rules={rules.data} onChange={refresh} />
        ) : (
          <RulesSkeleton />
        )}
      </div>
    </div>
  );
}
