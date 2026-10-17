"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, CircleMinus, ListChecks, OctagonX, ShieldAlert, ShieldCheck, Undo2, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hitSentence } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Section } from "./section";
import type { Hit } from "@/lib/api-types";

interface Group { key: string; title: string; icon: LucideIcon; tone: string; open: boolean; hits: Hit[] }

function groups(hits: Hit[]): Group[] {
  const by = (f: (h: Hit) => boolean) => hits.filter(f);
  return [
    { key: "hold", title: "Frena el pago", icon: OctagonX, tone: "text-hold", open: true, hits: by((h) => h.result === "FIRED" && h.effect === "HOLD") },
    { key: "escalate", title: "Pide tu aprobación", icon: ShieldAlert, tone: "text-escalate", open: true, hits: by((h) => h.result === "FIRED" && h.effect !== "HOLD") },
    { key: "missing", title: "Faltó un dato", icon: CircleAlert, tone: "text-escalate", open: true, hits: by((h) => h.result === "MISSING_DATA") },
    { key: "overridden", title: "Anulada por una excepción", icon: Undo2, tone: "text-brand", open: true, hits: by((h) => h.result === "OVERRIDDEN") },
    { key: "passed", title: "Cumplió", icon: CircleCheck, tone: "text-pay", open: false, hits: by((h) => h.result === "PASSED") },
    { key: "na", title: "No aplica", icon: CircleMinus, tone: "text-muted-foreground", open: false, hits: by((h) => h.result === "NOT_APPLICABLE") },
  ].filter((g) => g.hits.length > 0);
}

function Row({ hit, group }: { hit: Hit; group: Group }) {
  const Icon = group.icon;
  const text = hit.result === "OVERRIDDEN" ? `Anulada por la regla «${hit.overridden_by ?? "excepción"}»` : hitSentence(hit);
  return (
    <li className="flex items-start gap-3 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", group.tone)} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{hit.rule_name}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function GroupBlock({ group }: { group: Group }) {
  const [open, setOpen] = useState(group.open);
  const Icon = group.icon;
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-md py-1.5 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Icon className={cn("size-4", group.tone)} />
        <span className="text-[13px] font-semibold">{group.title}</span>
        <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">{group.hits.length}</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <ul className="divide-y divide-border/60 pl-1">{group.hits.map((h) => <Row key={h.rule_id} hit={h} group={group} />)}</ul>}
    </div>
  );
}

function DeterministicBadge() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" />}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ShieldCheck className="size-3" />
        <span className="hidden sm:inline">Decisión determinista · sin IA</span>
        <span className="sm:hidden">Sin IA</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">Las reglas las evalúa código, no el modelo de lenguaje. La IA solo lee la factura y redacta la explicación.</TooltipContent>
    </Tooltip>
  );
}

export function Rules({ hits }: { hits: Hit[] }) {
  return (
    <Section title="Reglas evaluadas" icon={ListChecks} aside={<DeterministicBadge />} bodyClassName="p-0">
      <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">Cada regla se compara con los datos de esta factura. Primero lo que cambió el resultado.</p>
      <div className="max-h-[420px] space-y-1 overflow-y-auto px-4 py-3 lg:max-h-[260px]">
        {groups(hits).map((g) => <GroupBlock key={g.key} group={g} />)}
      </div>
    </Section>
  );
}
