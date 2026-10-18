"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import type { Effect, InvoiceSummary } from "@/lib/api-types";
import { PolicySkeleton, PolicyStrip } from "@/components/reglas/policy-strip";
import { ProposalsSection } from "@/components/reglas/proposals-section";
import { RuleComposer } from "@/components/reglas/rule-composer";
import { RuleList } from "@/components/reglas/rule-list";
import { RulesSkeleton } from "@/components/reglas/rules-skeleton";

function Reglas() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");
  const budgetEditing = params.get("budget") === "edit";
  const [fetched, setFetched] = useState<InvoiceSummary | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  const invoice = from && fetched?.id === from ? fetched : null;
  const missing = from !== null && missingId === from;
  const rules = usePolling(() => api.rules(), 3000);
  const proposals = usePolling(() => api.proposals(), 3000);
  const policy = usePolling(() => api.policy(), 3000);
  const [onlyEffects, setOnlyEffects] = useState<{ key: number; effects: Effect[] }>({ key: 0, effects: [] });
  const refresh = useCallback(() => {
    rules.refresh();
    proposals.refresh();
    policy.refresh();
  }, [rules, proposals, policy]);

  useEffect(() => {
    if (!from) return;
    let alive = true;
    api.invoice(from).then((d) => alive && setFetched(d.summary)).catch(() => alive && setMissingId(from));
    return () => { alive = false; };
  }, [from]);

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-4 lg:h-[max(calc(100dvh-9rem),52rem)]">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-semibold tracking-tight">Política de pagos</h1>
        <p className="text-sm text-muted-foreground">Lo que el agente aplica en cada factura.</p>
      </header>

      {policy.data && rules.data ? (
        <PolicyStrip
          policy={policy.data}
          rules={rules.data}
          onChange={refresh}
          budgetEditing={budgetEditing}
          onShowExceptions={() => setOnlyEffects((c) => ({ key: c.key + 1, effects: ["ALLOW"] }))}
        />
      ) : policy.error ? (
        <p className="text-sm text-hold">No se pudo cargar la política.</p>
      ) : (
        <PolicySkeleton />
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex flex-col gap-4 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto">
          {missing && (
            <p role="status" className="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
              <SearchX className="size-4 shrink-0" aria-hidden />
              No encontré esa factura
              <button type="button" onClick={() => router.replace("/reglas")} className="ml-auto font-medium text-brand hover:underline">
                Quitar
              </button>
            </p>
          )}
          <RuleComposer onCreated={refresh} fromInvoice={invoice} onClearInvoice={() => router.replace("/reglas")} />
          <ProposalsSection proposals={proposals.data ?? []} onChange={refresh} />
        </aside>
        {rules.error && !rules.data ? (
          <p className="text-sm text-hold">No se pudieron cargar las reglas.</p>
        ) : rules.data ? (
          <RuleList key={onlyEffects.key} rules={rules.data} onChange={refresh} initialEffects={onlyEffects.effects} focusRuleId={params.get("rule")} />
        ) : (
          <RulesSkeleton />
        )}
      </div>
    </div>
  );
}

export default function ReglasPage() {
  return (
    <Suspense>
      <Reglas />
    </Suspense>
  );
}
