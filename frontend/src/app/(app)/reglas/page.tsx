"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import type { InvoiceSummary } from "@/lib/api-types";
import { ProposalsSection } from "@/components/reglas/proposals-section";
import { RuleComposer } from "@/components/reglas/rule-composer";
import { RuleList } from "@/components/reglas/rule-list";
import { RulesSkeleton } from "@/components/reglas/rules-skeleton";

function Reglas() {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const [fetched, setFetched] = useState<InvoiceSummary | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  const invoice = from && fetched?.id === from ? fetched : null;
  const missing = from !== null && missingId === from;
  const rules = usePolling(() => api.rules(), 3000);
  const proposals = usePolling(() => api.proposals(), 3000);
  const refresh = useCallback(() => {
    rules.refresh();
    proposals.refresh();
  }, [rules, proposals]);

  useEffect(() => {
    if (!from) return;
    let alive = true;
    api.invoice(from).then((d) => alive && setFetched(d.summary)).catch(() => alive && setMissingId(from));
    return () => { alive = false; };
  }, [from]);

  return (
    <div className="mx-auto flex flex-col gap-4 lg:h-[calc(100dvh-9rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reglas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lo que el agente aplica en cada factura.</p>
      </header>

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
          <RuleList rules={rules.data} onChange={refresh} />
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
