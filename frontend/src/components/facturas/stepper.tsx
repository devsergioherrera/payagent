"use client";

import { useState } from "react";
import { Bell, Eye, Gavel, Inbox, ListChecks, UserCheck, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { costUsd, duration, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceDetail } from "@/lib/api-types";

interface Step { key: string; label: string; icon: LucideIcon; at: string | null; lines: string[]; failed?: boolean }

const find = (invoice: InvoiceDetail, prefix: string) => invoice.timeline.find((s) => s.label.startsWith(prefix));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ruleCounts(invoice: InvoiceDetail): string[] {
  const n = (r: string, effect?: string) => invoice.hits.filter((h) => h.result === r && (!effect || h.effect === effect)).length;
  const parts = [
    n("FIRED", "ESCALATE") && plural(n("FIRED", "ESCALATE"), "escala", "escalan"),
    n("FIRED", "HOLD") && plural(n("FIRED", "HOLD"), "frena", "frenan"),
    n("MISSING_DATA") && plural(n("MISSING_DATA"), "sin dato", "sin dato"),
    n("OVERRIDDEN") && plural(n("OVERRIDDEN"), "anulada", "anuladas"),
    n("PASSED") && plural(n("PASSED"), "cumple", "cumplen"),
    n("NOT_APPLICABLE") && plural(n("NOT_APPLICABLE"), "no aplica", "no aplican"),
  ].filter(Boolean);
  return [`${invoice.hits.length} reglas: ${parts.join(", ")}`];
}

export function buildSteps(invoice: InvoiceDetail): Step[] {
  const { cost, extracted, approval } = invoice;
  const received = find(invoice, "Factura recibida");
  const read = find(invoice, "Datos extraídos");
  const decision = find(invoice, "Decisión");
  const notice = find(invoice, "Notificación");
  const human = find(invoice, "Resolución humana");
  const steps: Step[] = [
    { key: "received", label: "Recibida", icon: Inbox, at: received?.at ?? null, lines: received?.detail ? [received.detail] : [] },
    {
      key: "read", label: "Leída", icon: Eye, at: read?.at ?? null,
      lines: [
        ...(extracted.confidence != null ? [`Confianza de lectura ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(extracted.confidence)}`] : []),
        ...(cost ? [`${costUsd(cost.cost_usd)} · ${duration(cost.duration_ms)}`, `${new Intl.NumberFormat("es-CO").format(cost.input_tokens + cost.output_tokens)} tokens`] : []),
      ],
    },
    { key: "rules", label: "Reglas", icon: ListChecks, at: decision?.at ?? null, lines: invoice.hits.length ? ruleCounts(invoice) : [] },
    { key: "decision", label: "Decisión", icon: Gavel, at: decision?.at ?? null, lines: decision ? [decision.label.replace("Decisión: ", ""), ...(decision.detail ? [decision.detail] : [])] : [] },
  ];
  // Only an escalation notifies the approver; a hold is final and has no such step.
  if (notice && invoice.summary.outcome === "ESCALATE") {
    steps.push({ key: "notice", label: "Notificación", icon: Bell, at: notice.at, lines: [notice.label, ...(notice.detail ? [`A ${notice.detail}`] : [])], failed: notice.label.includes("fallida") });
  }
  if (approval || human) {
    steps.push({
      key: "human", label: "Tu decisión", icon: UserCheck, at: human?.at ?? approval?.created_at ?? null,
      lines: [approval ? `${approval.verdict === "APPROVED" ? "Aprobada" : "Rechazada"} por ${approval.approver}` : (human?.label ?? ""), ...(approval?.note ? [`«${approval.note}»`] : [])],
    });
  }
  // A step without data never happened for this invoice (history rows have no read): leave it out.
  return steps.filter((s) => s.at != null);
}

function StepItem({ step, last }: { step: Step; last: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = step.icon;
  return (
    <li className="relative flex min-w-0 flex-1 flex-col items-center gap-1">
      {!last && <span aria-hidden className="absolute left-1/2 top-3.5 h-0.5 w-full bg-brand/40" />}
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<button type="button" onClick={() => setOpen((v) => !v)} aria-label={`${step.label}: detalle`} />}
          className="relative z-10 rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className={cn(
            "grid size-7 place-items-center rounded-full border-2 bg-card",
            step.failed ? "border-hold text-hold" : "border-brand bg-brand-soft text-brand",
          )}>
            <Icon className="size-3.5" />
          </span>
        </TooltipTrigger>
        {step.lines.length > 0 && (
          <TooltipContent side="bottom" className="flex-col items-start gap-0.5 py-2">
            <span className="font-medium">{step.label}</span>
            {step.lines.map((l) => <span key={l} className="opacity-80">{l}</span>)}
          </TooltipContent>
        )}
      </Tooltip>
      <p className="max-w-full text-[10px] font-medium leading-none sm:text-[11px]">{step.label}</p>
      <p className="whitespace-nowrap text-[10px] leading-none tabular-nums text-muted-foreground sm:text-[11px]">{time(step.at!)}</p>
    </li>
  );
}

export function Stepper({ invoice, className }: { invoice: InvoiceDetail; className?: string }) {
  const steps = buildSteps(invoice);
  return (
    <nav aria-label="Trazabilidad" className={className}>
      <ol className="flex">
        {steps.map((s, i) => <StepItem key={s.key} step={s} last={i === steps.length - 1} />)}
      </ol>
    </nav>
  );
}
