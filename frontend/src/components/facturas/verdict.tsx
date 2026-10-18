"use client";

import { Bot, CircleCheck, OctagonX, ShieldAlert } from "lucide-react";
import { OUTCOME_LABEL, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Stepper } from "./stepper";
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
  const rule = decidingHit(hits, outcome);
  const Icon = outcome ? ICON[outcome] : Bot;
  const title = processing || !outcome
    ? "El agente está leyendo y evaluando esta factura"
    : outcome === "PAY" ? "Todas las reglas se cumplieron" : (rule?.rule_name ?? summary.headline ?? "Sin regla decisiva");
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            outcome ? OUTCOME_STYLE[outcome] : "bg-brand-soft text-brand",
          )}>
            <Icon className={cn("size-4", !outcome && "animate-pulse")} />
            {outcome ? OUTCOME_LABEL[outcome] : "Procesando"}
          </span>
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {explanation && !processing && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
        )}
      </div>
      {!processing && <Stepper invoice={invoice} />}
    </section>
  );
}
