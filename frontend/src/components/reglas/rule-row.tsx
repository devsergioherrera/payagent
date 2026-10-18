"use client";

import { useState } from "react";
import { Bot, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { RuleView } from "@/lib/api-types";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EFFECT } from "./effect-badge";
import { RuleRevise } from "./rule-revise";
import { TechnicalCondition } from "./rule-sentence";

export function RuleRow({ rule, onChange }: { rule: RuleView; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { icon: EffectIcon, style, label } = EFFECT[rule.effect];
  const OriginIcon = rule.origin === "AGENT" ? Bot : User;

  async function toggle(next: boolean) {
    if (!next) return setConfirming(true);
    setBusy(true);
    try {
      await api.activateRule(rule.id);
      toast("Regla activada");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
    <li className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", !rule.active && "opacity-60")}>
          <p className="text-sm leading-snug font-medium">{rule.summary}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 font-medium", style, "bg-transparent")}>
              <EffectIcon className="size-3.5" aria-hidden />{label}
            </span>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate">{rule.name}</span>
            {rule.overridable && <><span aria-hidden>·</span><span>Se puede anular</span></>}
            {!rule.active && <><span aria-hidden>·</span><span>Desactivada</span></>}
          </p>
          <TechnicalCondition rule={rule} />
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <OriginIcon className="size-3.5" aria-label={rule.origin === "AGENT" ? "Propuesta por el agente" : "Escrita por una persona"} />
            <span>{rule.approved_by} · {shortDate(rule.approved_at)}</span>
            <span aria-hidden>·</span>
            <span>se disparó {rule.times_fired} {rule.times_fired === 1 ? "vez" : "veces"}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {rule.active && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing((v) => !v)}
              aria-label={`Editar con el agente: ${rule.name}`}
              aria-expanded={editing}
              className={cn("size-8 rounded-full text-muted-foreground hover:text-brand active:scale-[0.98]", editing && "bg-brand-soft text-brand")}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Switch checked={rule.active} disabled={busy} onCheckedChange={toggle} aria-label={`Regla activa: ${rule.name}`} />
        </div>
      </div>
      {editing && rule.active && (
        <RuleRevise rule={rule} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChange(); }} />
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar “{rule.name}”</DialogTitle>
            <DialogDescription>La regla deja de aplicarse. Puedes volver a activarla cuando quieras.</DialogDescription>
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
