"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { InvoiceSummary, Summary } from "@/lib/api-types";
import { greeting, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Composer } from "./composer";
import { Conversation, type Message } from "./conversation";
import { LatestCard } from "./latest-card";

function Chip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px]", className)}>
      <span className="font-semibold tabular-nums">{value}</span> {label}
    </span>
  );
}

function Home({ summary, latest }: { summary: Summary | null; latest: InvoiceSummary | undefined }) {
  if (!summary) {
    return (
      <div className="space-y-5">
        <Skeleton className="size-20 rounded-2xl" />
        <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <Skeleton className="h-7 w-96 max-w-full rounded-full" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }
  const n = summary.pending_human;
  return (
    <div className="space-y-6">
      <div id="mascot-slot" className="size-20 rounded-2xl bg-brand-soft" />
      <div className="space-y-1.5">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{greeting()}, Sergio.</h1>
        <p className="text-sm text-muted-foreground">
          {n === 0 ? "No tienes facturas esperando tu decisión." : `Tienes ${n} ${n === 1 ? "factura esperando" : "facturas esperando"} tu decisión.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="Pagadas" value={summary.paid} className={OUTCOME_STYLE.PAY} />
        <Chip label="Escaladas" value={summary.escalated} className={OUTCOME_STYLE.ESCALATE} />
        <Chip label="Frenadas" value={summary.held} className={OUTCOME_STYLE.HOLD} />
        <span className="ml-1 text-[13px] font-medium text-brand">Autonomía {Math.round(summary.autonomy_pct)} %</span>
      </div>
      {latest && <LatestCard invoice={latest} />}
    </div>
  );
}

export function Center({ summary, invoices, className }: { summary: Summary | null; invoices: InvoiceSummary[] | null; className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [waiting, setWaiting] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const latest = invoices ? [...invoices].sort((a, b) => b.received_at.localeCompare(a.received_at))[0] : undefined;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, waiting]);

  const send = async (text: string, file: File | null) => {
    setMessages((m) => [...m, { role: "user", text, file: file?.name }]);
    setWaiting(true);
    try {
      const r = await api.chat(text, file);
      setMessages((m) => [...m, { role: "agent", text: r.text, cards: r.cards }]);
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "El chat todavía no está disponible.", cards: [] }]);
    } finally {
      setWaiting(false);
    }
  };

  return (
    <section className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-2xl py-8">
          {messages.length === 0 ? <Home summary={summary} latest={latest} /> : <Conversation messages={messages} waiting={waiting} />}
          <div ref={end} />
        </div>
      </div>
      <div className="px-4">
        <div className="mx-auto w-full max-w-2xl"><Composer disabled={waiting} onSend={send} /></div>
      </div>
    </section>
  );
}
