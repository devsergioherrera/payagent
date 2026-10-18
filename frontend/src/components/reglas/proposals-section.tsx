"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { ProposalView } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DraftPreview } from "./draft-preview";
import { ProposeButton } from "./propose-button";

function Proposal({ proposal, onChange }: { proposal: ProposalView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

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

export function ProposalsSection({ proposals, onChange }: { proposals: ProposalView[]; onChange: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border bg-card">
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
        <ProposeButton onDone={onChange} />
      </div>
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
