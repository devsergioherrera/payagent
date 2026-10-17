"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ProposalView } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { DraftPreview } from "./draft-preview";

function Proposal({ proposal, onChange }: { proposal: ProposalView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function act(kind: "accept" | "reject") {
    setBusy(true);
    try {
      await (kind === "accept" ? api.acceptProposal(proposal.id) : api.rejectProposal(proposal.id));
      toast(kind === "accept" ? "Regla aceptada" : "Propuesta rechazada");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border bg-background p-4">
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
          <Button size="sm" disabled={busy} onClick={() => act("accept")} className="bg-brand text-brand-foreground hover:bg-brand/90">Aceptar</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("reject")}>Rechazar</Button>
        </div>
      </DraftPreview>
    </li>
  );
}

export function ProposalsSection({ proposals, onChange }: { proposals: ProposalView[]; onChange: () => void }) {
  if (proposals.length === 0) return null;
  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">Propuestas del agente</h2>
      <ul className="flex flex-col gap-3">
        {proposals.map((p) => <Proposal key={p.id} proposal={p} onChange={onChange} />)}
      </ul>
    </section>
  );
}
