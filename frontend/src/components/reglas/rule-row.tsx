"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { RuleView } from "@/lib/api-types";
import { dayTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { OverridableNote, RuleSentence } from "./rule-sentence";

function approvalLine(r: RuleView) {
  const who = r.origin === "AGENT" ? "Propuesta por el agente" : `Escrita por ${r.proposed_by}`;
  return `${who} · aprobada por ${r.approved_by}, ${dayTime(r.approved_at)}`;
}

export function RuleRow({ rule, onChange }: { rule: RuleView; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deactivate() {
    setBusy(true);
    try {
      await api.deactivateRule(rule.id);
      toast("Regla desactivada");
      setConfirming(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("flex items-start gap-4 p-4", !rule.active && "opacity-60")}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-medium">{rule.name}</p>
          {!rule.active && <span className="text-xs text-muted-foreground">Desactivada</span>}
        </div>
        <p className="text-[13px] text-muted-foreground">“{rule.natural_language}”</p>
        <RuleSentence rule={rule} />
        <OverridableNote rule={rule} />
        <p className="text-xs text-muted-foreground">
          {approvalLine(rule)} · Se disparó {rule.times_fired} {rule.times_fired === 1 ? "vez" : "veces"}
        </p>
      </div>
      <Switch
        checked={rule.active}
        disabled={!rule.active}
        onCheckedChange={() => setConfirming(true)}
        aria-label={`Regla activa: ${rule.name}`}
        className="mt-0.5"
      />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar “{rule.name}”</DialogTitle>
            <DialogDescription>La regla queda en el historial y deja de aplicarse. No se puede volver a activar.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</Button>
            <Button variant="destructive" onClick={deactivate} disabled={busy}>Desactivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
