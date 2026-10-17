"use client";

import { useState } from "react";
import { Bot, ChevronDown, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { RuleView } from "@/lib/api-types";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EFFECT } from "./effect-badge";
import { OverridableNote, RuleSentence } from "./rule-sentence";

export function RuleRow({ rule, onChange }: { rule: RuleView; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { icon: EffectIcon, style } = EFFECT[rule.effect];
  const OriginIcon = rule.origin === "AGENT" ? Bot : User;

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
    <li className={cn("flex items-start gap-3 px-4 py-3", !rule.active && "opacity-60")}>
      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", style)}>
        <EffectIcon className="size-4" aria-label={EFFECT[rule.effect].label} />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 text-left"
        >
          <span className="min-w-0 truncate text-sm font-medium">{rule.name}</span>
          {!rule.active && <span className="shrink-0 text-xs text-muted-foreground">Desactivada</span>}
          <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <RuleSentence rule={rule} plainEffect className="mt-1" />
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <OriginIcon className="size-3.5" aria-label={rule.origin === "AGENT" ? "Propuesta por el agente" : "Escrita por una persona"} />
          <span>aprobada por {rule.approved_by} · {shortDate(rule.approved_at)}</span>
          <span aria-hidden>·</span>
          <span>se disparó {rule.times_fired} {rule.times_fired === 1 ? "vez" : "veces"}</span>
        </p>
        {open && (
          <div className="mt-2 flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[13px] text-muted-foreground">“{rule.natural_language}”</p>
            <OverridableNote rule={rule} />
          </div>
        )}
      </div>
      <Switch
        checked={rule.active}
        disabled={!rule.active}
        onCheckedChange={() => setConfirming(true)}
        aria-label={`Regla activa: ${rule.name}`}
        className="mt-1"
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
