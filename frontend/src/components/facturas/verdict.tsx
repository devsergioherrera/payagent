"use client";

import { Bot, CircleCheck, OctagonX, ShieldAlert } from "lucide-react";
import { dayTime, OUTCOME_LABEL, OUTCOME_STYLE } from "@/lib/format";
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
  const { summary, hits, explanation, approval } = invoice;
  const outcome = summary.outcome;
  const rule = decidingHit(hits, outcome);
  // The header shows where the invoice ended up: a human resolution replaces "Escalada".
  const approved = approval?.verdict === "APPROVED";
  const pending = outcome === "ESCALATE" && summary.decision_status === "PENDING_HUMAN";
  const Icon = approval ? (approved ? CircleCheck : OctagonX) : outcome ? ICON[outcome] : Bot;
  const pillStyle = approval ? OUTCOME_STYLE[approved ? "PAY" : "HOLD"] : outcome ? OUTCOME_STYLE[outcome] : "bg-brand-soft text-brand";
  const pillText = approval ? `${approved ? "Aprobada" : "Rechazada"} por ti` : pending ? `${OUTCOME_LABEL.ESCALATE} · espera tu decisión` : outcome ? OUTCOME_LABEL[outcome] : "Procesando";
  const title = processing || !outcome
    ? "El agente está leyendo y evaluando esta factura"
    : outcome === "PAY" ? "Todas las reglas se cumplieron" : (rule?.rule_name ?? summary.headline ?? "Sin regla decisiva");
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:flex-nowrap">
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            pillStyle,
          )}>
            <Icon className={cn("size-4", !outcome && "animate-pulse")} />
            {pillText}
          </span>
          <h2 className="min-w-0 text-base sm:truncate font-semibold tracking-tight">{title}</h2>
        </div>
        {approval && !processing && (
          <p className="mt-2 text-sm font-medium">
            {dayTime(approval.created_at)}
            {approval.note && <span className="font-normal text-muted-foreground"> · «{approval.note}»</span>}
          </p>
        )}
        {explanation && !processing && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {approval && <span className="font-medium text-foreground">Por qué la escaló el agente: </span>}
            {approval ? explanation.replace(/^(Escalada|Frenada|Pagada):\s*/, "") : explanation}
          </p>
        )}
      </div>
      {!processing && <Stepper invoice={invoice} />}
    </section>
  );
}
