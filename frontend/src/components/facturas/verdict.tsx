"use client";

import { useState } from "react";
import { Bot, CircleCheck, OctagonX, ShieldAlert } from "lucide-react";
import { OUTCOME_LABEL, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Hit, InvoiceDetail, Outcome } from "@/lib/api-types";

const ICON = { PAY: CircleCheck, HOLD: OctagonX, ESCALATE: ShieldAlert } as const;

export function decidingHit(hits: Hit[], outcome: Outcome | null): Hit | undefined {
  if (outcome === "PAY") return undefined;
  const effect = outcome === "HOLD" ? "HOLD" : "ESCALATE";
  return hits.find((h) => h.result === "FIRED" && h.effect === effect) ?? hits.find((h) => h.result === "FIRED");
}

export function Verdict({ invoice, processing }: { invoice: InvoiceDetail; processing: boolean }) {
  const { summary, hits, explanation } = invoice;
  const outcome = summary.outcome;
  const [more, setMore] = useState(false);
  const rule = decidingHit(hits, outcome);
  const Icon = outcome ? ICON[outcome] : Bot;
  const title = processing || !outcome
    ? "El agente está leyendo y evaluando esta factura"
    : outcome === "PAY" ? "Todas las reglas se cumplieron" : (rule?.rule_name ?? summary.headline ?? "Sin regla decisiva");
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-start sm:gap-5">
      <span className={cn(
        "inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-base font-semibold",
        outcome ? OUTCOME_STYLE[outcome] : "bg-brand-soft text-brand",
      )}>
        <Icon className={cn("size-5", !outcome && "animate-pulse")} />
        {outcome ? OUTCOME_LABEL[outcome] : "Procesando"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{outcome === "PAY" ? "Resultado" : "Regla decisiva"}</p>
        <h2 className="text-lg font-semibold leading-snug tracking-tight">{title}</h2>
        {explanation && !processing && (
          <>
            <p className={cn("mt-1 text-sm leading-relaxed text-muted-foreground", !more && "line-clamp-2")}>{explanation}</p>
            {explanation.length > 140 && (
              <button type="button" onClick={() => setMore((v) => !v)} className="mt-0.5 text-[13px] font-medium text-brand hover:underline">
                {more ? "Ver menos" : "Ver más"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
