"use client";

import { useState } from "react";
import { useEffect, useRef } from "react";
import { Bot, CornerDownRight, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { RuleView } from "@/lib/api-types";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EFFECT } from "./effect-badge";
import { RuleRevise } from "./rule-revise";
import { TechnicalCondition } from "./rule-sentence";

interface Props {
  rule: RuleView;
  onChange: () => void;
  highlighted: boolean;
  onShow: (id: string) => void;
}

export function RuleRow({ rule, onChange, highlighted, onShow }: Props) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);
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
      toast.error(errorMessage(e));
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
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li ref={ref} className={cn("px-4 py-3.5 transition-colors duration-700", highlighted && "bg-brand-soft")}>
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
            {!rule.active && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {rule.deactivated_by
                    ? `Desactivada por ${rule.deactivated_by}${rule.deactivated_at ? ` · ${shortDate(rule.deactivated_at)}` : ""}`
                    : "Desactivada"}
                </span>
              </>
            )}
          </p>
          <TechnicalCondition rule={rule} />
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <OriginIcon className="size-3.5" aria-label={rule.origin === "AGENT" ? "Propuesta por el agente" : "Escrita por una persona"} />
            <span>{rule.approved_by} · {shortDate(rule.approved_at)}</span>
            <span aria-hidden>·</span>
            <span>se disparó {rule.times_fired} {rule.times_fired === 1 ? "vez" : "veces"}</span>
          </p>
          {rule.replaced_by && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <CornerDownRight className="size-3.5" aria-hidden />
              Reemplazada por «{rule.replaced_by.name}»
              <button
                type="button"
                onClick={() => rule.replaced_by && onShow(rule.replaced_by.id)}
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                Ver esa versión
              </button>
            </p>
          )}
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Switch
                  checked={rule.active}
                  disabled={busy || rule.replaced_by !== null}
                  onCheckedChange={toggle}
                  aria-label={`Regla activa: ${rule.name}`}
                />
              </TooltipTrigger>
              {rule.replaced_by && <TooltipContent>Reemplazada por «{rule.replaced_by.name}»</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
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
