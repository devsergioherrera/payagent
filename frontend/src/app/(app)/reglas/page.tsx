"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { ProposeButton } from "@/components/reglas/propose-button";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reglas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            El agente decide con estas reglas. Escríbelas como se las dirías a una persona.
          </p>
        </div>
        <ProposeButton onDone={refresh} />
      </header>

      <RuleComposer onCreated={refresh} />
      <ProposalsSection proposals={proposals.data ?? []} onChange={refresh} />

      {rules.error && !rules.data ? (
        <p className="text-sm text-hold">No se pudieron cargar las reglas.</p>
      ) : rules.data ? (
        <RuleList rules={rules.data} onChange={refresh} />
      ) : (
        <RulesSkeleton />
      )}
    </div>
  );
}
