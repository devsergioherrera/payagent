"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { ProposalView, TraceStep } from "@/lib/api-types";
import { Mascot } from "@/components/mascot/mascot";
import { TraceList } from "@/components/trace-list";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DraftPreview } from "./draft-preview";
import { ProposeButton } from "./propose-button";

function Proposal({ proposal, onChange }: { proposal: ProposalView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [thought, setThought] = useState(false);

  async function act(kind: "accept" | "reject") {
    setBusy(true);
    try {
      await (kind === "accept" ? api.acceptProposal(proposal.id) : api.rejectProposal(proposal.id));
      toast(kind === "accept" ? "Regla aceptada" : "Propuesta rechazada");
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border bg-background p-3.5">
      <DraftPreview draft={proposal.draft}>
        <p className="text-[13px] text-muted-foreground">{proposal.rationale}</p>
        {proposal.evidence.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Evidencia</span>
            {proposal.evidence.map((inv) => (
              <Link key={inv.id} href={`/facturas/${inv.id}`} className="rounded-md border px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
                {inv.invoice_number ?? inv.id}
              </Link>
            ))}
          </div>
        )}
        {proposal.trace.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setThought((v) => !v)}
              aria-expanded={thought}
              className="flex items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", !thought && "-rotate-90")} aria-hidden />
              Cómo lo pensé
            </button>
            {thought && <TraceList steps={proposal.trace} className="mt-3" />}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => act("accept")} className="bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
            {proposal.draft.effect === "ALLOW" ? "Confirmar excepción" : "Aceptar"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("reject")}>Rechazar</Button>
        </div>
      </DraftPreview>
    </li>
  );
}

type Run = { phase: "idle" } | { phase: "running" } | { phase: "tracing" | "shown"; trace: TraceStep[]; created: number };

// The run panel: the agent thinks, then its real trace ticks by, then it fades and the proposal cards take over.
function RunPanel({ run, onDone }: { run: Exclude<Run, { phase: "idle" }>; onDone: (created: number) => void }) {
  return (
    <div className="flex gap-3 bg-brand-soft/40 p-4">
      <Mascot state={run.phase === "running" ? "thinking" : run.created > 0 ? "paid" : "idle"} size={44} />
      <div className="min-w-0 flex-1">
        <p className="mb-3 text-[13px] font-medium">
          {run.phase === "running" ? "Revisando tus decisiones" : run.created > 0 ? "Esto es lo que pensé" : "Esto es lo que encontré"}
        </p>
        {run.phase === "running" ? (
          <div className="space-y-2.5" aria-hidden>
            {[56, 72, 40].map((w) => <div key={w} className="h-3.5 animate-pulse rounded-full bg-brand/10 motion-reduce:animate-none" style={{ width: `${w}%` }} />)}
          </div>
        ) : (
          <TraceList steps={run.trace} animate onDone={() => onDone(run.created)} />
        )}
      </div>
    </div>
  );
}

export function ProposalsSection({ proposals, onChange }: { proposals: ProposalView[]; onChange: () => void }) {
  const [open, setOpen] = useState(true);
  const [run, setRun] = useState<Run>({ phase: "idle" });
  const shown = run.phase === "shown";
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setRun({ phase: "idle" }), 3500);
    return () => clearTimeout(t);
  }, [shown]);

  async function start() {
    setOpen(true);
    setRun({ phase: "running" });
    // The section can sit below the fold: bring the agent's thinking into view.
    setTimeout(() => section.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
    try {
      const r = await api.runProposals();
      setRun({ phase: "tracing", trace: r.trace, created: r.created.length });
      if (r.trace.length === 0) finish(r.created.length);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 409 ? "Ya hay una revisión en curso" : errorMessage(e));
      setRun({ phase: "idle" });
    }
  }

  function finish(created: number) {
    toast(created ? `${created} ${created === 1 ? "propuesta nueva" : "propuestas nuevas"}` : "No hay patrones nuevos");
    setRun((r) => (r.phase === "tracing" ? { ...r, phase: "shown" } : r));
    onChange();
  }
  return (
    <section ref={section} className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-3 pl-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-2 text-left sm:flex-1"
        >
          <Lightbulb className="size-4 shrink-0 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold">Propuestas del agente</h2>
          <span className="rounded-full bg-brand-soft px-1.5 text-xs font-medium tabular-nums text-brand">{proposals.length}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} aria-hidden />
        </button>
        <ProposeButton busy={run.phase === "running" || run.phase === "tracing"} onClick={start} />
      </div>
      {open && run.phase !== "idle" && <div className="border-t"><RunPanel run={run} onDone={finish} /></div>}
      {open && (
        <div className="border-t p-3">
          {proposals.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-muted-foreground">Sin propuestas pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proposals.map((p) => <Proposal key={p.id} proposal={p} onChange={onChange} />)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
