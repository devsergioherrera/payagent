"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot, type MascotState } from "@/components/mascot/mascot";
import { api } from "@/lib/api";
import type { InvoiceSummary, Summary } from "@/lib/api-types";
import { greeting, isProcessing, OUTCOME_STYLE } from "@/lib/format";
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

const OUTCOME_MASCOT = { PAY: "paid", ESCALATE: "escalated", HOLD: "held" } as const;

// Thinking while the newest invoice is processed, then its outcome for a few seconds, then idle.
function useMascotState(latest: InvoiceSummary | undefined, busy: boolean): MascotState {
  const [prev, setPrev] = useState<{ id?: string; processing: boolean }>({ processing: false });
  const [reveal, setReveal] = useState<MascotState | null>(null);
  const processing = !!latest && isProcessing(latest.status);
  if (latest && (prev.id !== latest.id || prev.processing !== processing)) {
    setPrev({ id: latest.id, processing });
    if (prev.id !== undefined && !processing && latest.outcome) setReveal(OUTCOME_MASCOT[latest.outcome]);
  }
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(null), 6000);
    return () => clearTimeout(t);
  }, [reveal]);
  if (processing || busy) return "thinking";
  return reveal ?? "idle";
}

function Home({ summary, latest, mascot }: { summary: Summary | null; latest: InvoiceSummary | undefined; mascot: MascotState }) {
  if (!summary) {
    return (
      <div className="space-y-5">
        <Skeleton className="size-28 rounded-[32%]" />
        <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <Skeleton className="h-7 w-96 max-w-full rounded-full" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }
  const n = summary.pending_human;
  return (
    <div className="space-y-6">
      <Mascot state={mascot} size={112} className="-ml-1" />
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

  const mascot = useMascotState(latest, waiting);

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
          {messages.length === 0 ? <Home summary={summary} latest={latest} mascot={mascot} /> : <Conversation messages={messages} waiting={waiting} />}
          <div ref={end} />
        </div>
      </div>
      <div className="px-4">
        <div className="mx-auto w-full max-w-2xl"><Composer disabled={waiting} onSend={send} /></div>
      </div>
    </section>
  );
}
