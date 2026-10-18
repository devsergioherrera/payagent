"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { ProposalView } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TraceList } from "@/components/trace-list";

const TYPING_MS = 1100;
const played = new Set<string>(); // the performance runs once per proposal, not on every poll or visit

// What the agent says, built from the proposal itself: its rationale and the effect it wants.
export function proposalText(p: ProposalView) {
  const ask = p.draft.effect === "ALLOW" ? "¿Quieres que las pague yo de ahora en adelante?" : p.draft.effect === "HOLD" ? "¿Quieres que las frene yo de ahora en adelante?" : "¿Quieres que me quede con esta regla?";
  return `Noté un patrón. ${p.rationale} ${ask}`;
}

interface Props {
  proposal: ProposalView;
  onThinking: (thinking: boolean) => void;
  onLearned: () => void;
  onResolved: (kind: "accept" | "reject") => void;
}

export function AgentMessage({ proposal, onThinking, onLearned, onResolved }: Props) {
  const [first] = useState(() => !played.has(proposal.id));
  const [phase, setPhase] = useState<"typing" | "text" | "done">(first ? "typing" : "done");
  const [busy, setBusy] = useState(false);
  const hasTrace = proposal.trace.length > 0;

  useEffect(() => {
    played.add(proposal.id);
    if (!first) return;
    const t = setTimeout(() => setPhase(hasTrace ? "text" : "done"), TYPING_MS);
    return () => clearTimeout(t);
  }, [proposal.id, first, hasTrace]);

  useEffect(() => {
    onThinking(phase === "typing");
  }, [phase, onThinking]);

  async function answer(kind: "accept" | "reject") {
    setBusy(true);
    try {
      await (kind === "accept" ? api.acceptProposal(proposal.id) : api.rejectProposal(proposal.id));
      if (kind === "accept") {
        toast("Aprendido");
        onLearned();
      } else {
        toast("Entendido, no lo aplicaré");
      }
      onResolved(kind);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  const showText = phase !== "typing";
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />
      <div className="min-w-0 flex-1 space-y-3.5">
        {!showText ? (
          <div className="flex items-center gap-1 py-1.5" aria-label="El agente está escribiendo">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : (
          <div className={cn("space-y-3.5", first && "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none")}>
            <p className="text-[15px] leading-relaxed">{proposalText(proposal)}</p>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Regla que propongo</p>
              <p className="mt-1 text-sm font-medium">{proposal.draft.summary}</p>
              {proposal.evidence.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Evidencia</span>
                  {proposal.evidence.map((inv) => (
                    <Link key={inv.id} href={`/facturas/${inv.id}`} className="rounded-full border px-2 py-0.5 transition-colors hover:bg-secondary hover:text-foreground">
                      {inv.invoice_number ?? inv.id}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {proposal.trace.length > 0 && (
              <div className="px-1">
                <p className="mb-2.5 text-xs text-muted-foreground">Cómo lo pensé</p>
                <TraceList steps={proposal.trace} animate={first} onDone={() => setPhase("done")} className="space-y-2" />
              </div>
            )}
            <div className={cn("flex items-center gap-2 transition-opacity duration-300 motion-reduce:transition-none", phase === "done" ? "opacity-100" : "pointer-events-none opacity-0")}>
              <Button size="sm" disabled={busy || phase !== "done"} onClick={() => answer("accept")} className="bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
                <Check /> Sí, enséñame
              </Button>
              <Button size="sm" variant="outline" disabled={busy || phase !== "done"} onClick={() => answer("reject")} className="active:scale-[0.98]">
                <X /> No
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
