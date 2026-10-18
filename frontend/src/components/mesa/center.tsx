"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot, type MascotState } from "@/components/mascot/mascot";
import { api, ApiError } from "@/lib/api";
import type { InvoiceState, InvoiceSummary, ProposalView, Summary, TraceStep } from "@/lib/api-types";
import { usePolling } from "@/hooks/use-polling";
import { ago, greeting, isProcessing } from "@/lib/format";
import { STATE } from "@/lib/state";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ACTIVITY_KIND } from "@/components/shell/notifications";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Composer } from "./composer";
import { AgentMessage } from "./agent-message";
import { Conversation, type Message } from "./conversation";
import { LatestCard } from "./latest-card";

// A zero is not news: it stays neutral instead of borrowing the decision color.
function Chip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px]", value === 0 ? "bg-secondary text-muted-foreground" : className)}>
      <span className="font-semibold tabular-nums">{value}</span> {label}
    </span>
  );
}

const STATE_MASCOT: Partial<Record<InvoiceState, MascotState>> = {
  PAID: "paid", APPROVED: "paid", WAITING: "escalated", HELD: "held", REJECTED: "held",
};

// Thinking while the newest invoice is processed, then its outcome for a few seconds, then idle.
function useMascotState(latest: InvoiceSummary | undefined, busy: boolean): MascotState {
  const [prev, setPrev] = useState<{ id?: string; processing: boolean }>({ processing: false });
  const [reveal, setReveal] = useState<MascotState | null>(null);
  const processing = !!latest && isProcessing(latest.status);
  if (latest && (prev.id !== latest.id || prev.processing !== processing)) {
    setPrev({ id: latest.id, processing });
    const mood = STATE_MASCOT[latest.state];
    if (prev.id !== undefined && !processing && mood) setReveal(mood);
  }
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(null), 6000);
    return () => clearTimeout(t);
  }, [reveal]);
  if (processing || busy) return "thinking";
  return reveal ?? "idle";
}

interface HomeProps {
  summary: Summary | null;
  latest: InvoiceSummary | undefined;
  mascot: MascotState;
  proposal: ProposalView | undefined;
  onThinking: (thinking: boolean) => void;
  onLearned: () => void;
  onResolved: () => void;
}

function Home({ summary, latest, mascot, proposal, onThinking, onLearned, onResolved }: HomeProps) {
  if (!summary) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-[32%]" />
          <div className="space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-56 max-w-full" /></div>
        </div>
        <Skeleton className="h-7 w-96 max-w-full rounded-full" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }
  const n = summary.waiting;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Mascot state={mascot} size={80} className="-ml-1" />
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{greeting()}, Sergio.</h1>
          <p className="text-sm text-muted-foreground">
            {n === 0 ? "No tienes facturas esperando tu decisión." : `Tienes ${n} ${n === 1 ? "factura esperando" : "facturas esperando"} tu decisión.`}
          </p>
        </div>
      </div>
      <div className={cn("flex flex-wrap items-center gap-2", proposal && "hidden")}>
        <Chip label="Pagadas" value={summary.paid} className={STATE.PAID.tone} />
        <Chip label="Esperan tu decisión" value={summary.waiting} className={STATE.WAITING.tone} />
        <Chip label="Frenadas" value={summary.held} className={STATE.HELD.tone} />
        <Chip label="Rechazadas" value={summary.rejected} className={STATE.REJECTED.tone} />
        <span className="ml-1 text-[13px] font-medium text-brand">Autonomía {Math.round(summary.autonomy_pct)} %</span>
      </div>
      {proposal && <AgentMessage key={proposal.id} proposal={proposal} onThinking={onThinking} onLearned={onLearned} onResolved={onResolved} />}
      {latest && !proposal && <LatestCard invoice={latest} />}
      {!proposal && <RecentActivity />}
    </div>
  );
}

// Fills the room under "Lo último" on tall screens; hidden when the viewport is short.
function RecentActivity() {
  const { data } = usePolling(() => api.activity(4), 5000);
  const [now] = useState(() => Date.now());
  if (!data || data.length === 0) return null;
  return (
    <section className="hidden lg:[@media(min-height:820px)]:block">
      <p className="mb-2 px-1 text-xs text-muted-foreground">Actividad reciente</p>
      <ul className="divide-y rounded-2xl border bg-card">
        {data.slice(0, 4).map((a) => {
          const { icon: Icon, tone } = ACTIVITY_KIND[a.kind];
          return (
            <li key={a.id}>
              <Link href={a.invoice_id ? `/facturas/${a.invoice_id}` : a.proposal_id ? "/reglas" : "/facturas"} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", tone)}><Icon className="size-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{a.title}</span>
                  {a.detail && <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago(a.at, now)}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Center({ summary, invoices, className }: { summary: Summary | null; invoices: InvoiceSummary[] | null; className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [waiting, setWaiting] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const latest = invoices ? [...invoices].sort((a, b) => b.received_at.localeCompare(a.received_at))[0] : undefined;

  // The agent speaks first when it has learned something; a dismissed proposal stays hidden until the poll catches up.
  const proposals = usePolling(() => api.proposals(), 3000);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [learning, setLearning] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const proposal = proposals.data?.find((p) => p.status === "PENDING" && !dismissed.includes(p.id));
  const base = useMascotState(latest, waiting || typing || transcribing);
  const mascot = celebrating ? "paid" : base;
  const home = messages.length === 0;

  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => setCelebrating(false), 6000);
    return () => clearTimeout(t);
  }, [celebrating]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, waiting, learning]);

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

  const learn = async () => {
    if (learning) return;
    setMessages((m) => [...m, { role: "user", text: "Aprende de mis decisiones" }]);
    setLearning(true);
    const say = (text: string, trace?: TraceStep[]) => setMessages((m) => [...m, { role: "agent", text, cards: [], trace }]);
    try {
      const run = await api.runProposals();
      if (run.created.length > 0) setMessages((m) => [...m, { role: "proposal", proposal: run.created[0] }]);
      else say("Revisé tus decisiones recientes y no encontré un patrón nuevo.", run.trace);
    } catch (e) {
      say(e instanceof ApiError && e.status === 409 ? "Ya estoy revisando." : "No pude revisar tus decisiones ahora. Inténtalo de nuevo.");
    } finally {
      setLearning(false);
    }
  };

  const resolved = (index: number, kind: "accept" | "reject") => {
    const m = messages[index];
    if (m?.role === "proposal") setDismissed((d) => [...d, m.proposal.id]);
    setMessages((all) => all.map((x, i) => (i === index ? { role: "agent", text: kind === "accept" ? "Listo, aprendí la regla y la aplicaré desde ahora." : "Entendido, no aplicaré esa regla.", cards: [] } : x)));
    proposals.refresh();
  };

  return (
    <section className={cn("flex min-h-0 flex-col", home && "justify-center", className)}>
      <div className={cn("min-h-0 overflow-y-auto px-4", !home && "flex-1")}>
        <div className={cn("mx-auto w-full max-w-2xl", home ? "pb-5 pt-6" : "py-8")}>
          {home ? <Home
              summary={summary} latest={latest} mascot={mascot} proposal={proposal}
              onThinking={setTyping} onLearned={() => setCelebrating(true)}
              onResolved={() => { if (proposal) setDismissed((d) => [...d, proposal.id]); proposals.refresh(); }}
            /> : <Conversation messages={messages} waiting={waiting} learning={learning} onThinking={setTyping} onLearned={() => setCelebrating(true)} onResolved={resolved} />}
          <div ref={end} />
        </div>
      </div>
      <div className={cn("px-4", home && "pb-6")}>
        <div className="mx-auto w-full max-w-2xl"><Composer disabled={waiting} learning={learning} onSend={send} onLearn={learn} onTranscribing={setTranscribing} /></div>
      </div>
    </section>
  );
}
