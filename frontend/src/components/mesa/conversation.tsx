"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatCard, RuleDraft } from "@/lib/api-types";
import { money } from "@/lib/format";
import { OutcomeBadge } from "@/components/outcome-badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "./status-dot";

export type Message =
  | { role: "user"; text: string; file?: string }
  | { role: "agent"; text: string; cards: ChatCard[] };

const EFFECT: Record<RuleDraft["effect"], string> = { ALLOW: "Permitir", ESCALATE: "Escalar", HOLD: "Frenar" };

function RuleDraftCard({ draft }: { draft: RuleDraft }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const confirm = async () => {
    setState("saving");
    try {
      await api.createRule(draft);
      setState("done");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">Regla propuesta · {EFFECT[draft.effect]}</p>
      <p className="mt-1 text-sm font-medium">{draft.name}</p>
      <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
        {draft.conditions.map((c, i) => <li key={i}>{c.text}</li>)}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        {state === "done" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-pay"><Check className="size-3.5" /> Regla activa</span>
        ) : (
          <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" disabled={state === "saving"} onClick={confirm}>
            Confirmar regla
          </Button>
        )}
        {state === "error" && <span className="text-xs text-destructive">No se pudo guardar.</span>}
      </div>
    </div>
  );
}

function Card({ card }: { card: ChatCard }) {
  if (card.kind === "invoice" && card.invoice) {
    const i = card.invoice;
    return (
      <Link href={`/facturas/${i.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary">
        <StatusDot invoice={i} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{i.vendor_name ?? "Leyendo factura"}</p>
          <p className="text-xs text-muted-foreground">{i.invoice_number}</p>
        </div>
        {i.outcome && <OutcomeBadge outcome={i.outcome} />}
        <span className="shrink-0 text-sm font-medium tabular-nums">{money(i.amount, i.currency ?? "USD")}</span>
      </Link>
    );
  }
  if (card.kind === "vendor" && card.vendor) {
    const v = card.vendor;
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="truncate text-sm font-medium">{v.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          NIT {v.tax_id} · {v.status === "ALLOWED" ? "Habilitado" : "Bloqueado"} · {v.invoices} facturas · {money(v.paid_usd)} pagados
        </p>
      </div>
    );
  }
  if (card.kind === "rule_draft" && card.rule_draft) return <RuleDraftCard draft={card.rule_draft} />;
  return null;
}

export function Conversation({ messages, waiting }: { messages: Message[]; waiting: boolean }) {
  return (
    <div className="space-y-5">
      {messages.map((m, idx) =>
        m.role === "user" ? (
          <div key={idx} className="flex flex-col items-end gap-1">
            {m.file && <span className="text-xs text-muted-foreground">{m.file}</span>}
            {m.text && <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-sm">{m.text}</p>}
          </div>
        ) : (
          <div key={idx} className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
              {m.cards.map((c, i) => <Card key={i} card={c} />)}
            </div>
          </div>
        ),
      )}
      {waiting && (
        <div className="flex items-center gap-3" aria-label="El agente está escribiendo">
          <span className="size-2 shrink-0 rounded-full bg-brand" />
          <span className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
