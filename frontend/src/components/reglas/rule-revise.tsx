"use client";

import { useState } from "react";
import { ArrowUp, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { RuleDraft, RuleView } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { EffectBadge } from "./effect-badge";
import { AllowWarning, CONFIRM_LABEL, TechnicalCondition } from "./rule-sentence";

// Inline "edit with the agent": ask, read the agent's new version next to the old one, confirm to replace.
export function RuleRevise({ rule, onClose, onSaved }: { rule: RuleView; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft | null>(null);

  async function ask() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const res = await api.reviseRule(rule.id, text.trim());
      setDraft(res.draft);
      setError(res.error);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.createRule(draft, rule.id);
      toast.success("Regla actualizada");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border bg-background p-3.5">
      <label htmlFor={`revise-${rule.id}`} className="text-[13px] font-medium">
        ¿Qué quieres cambiar de esta regla?
      </label>
      <div className="flex items-center gap-2 rounded-xl border bg-card py-1 pr-1 pl-3 focus-within:ring-3 focus-within:ring-ring/30">
        <input
          id={`revise-${rule.id}`}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ej.: súbelo a 8 mil"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button size="icon" onClick={ask} disabled={!text.trim() || busy} aria-label="Pedir el cambio" className="size-8 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}
        </Button>
      </div>
      {error && <p className="text-[13px] text-hold">{error}</p>}
      {draft && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3.5">
          <p className="text-xs text-muted-foreground">Antes</p>
          <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">{rule.summary}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-brand">Ahora <EffectBadge effect={draft.effect} /></p>
          <p className="text-[15px] leading-snug font-medium">{draft.summary}</p>
          <TechnicalCondition rule={draft} />
          <AllowWarning rule={draft} />
        </div>
      )}
      <div className="flex gap-2">
        {draft && (
          <Button size="sm" onClick={confirm} disabled={saving} className="bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
            <Check />{draft.effect === "ALLOW" ? CONFIRM_LABEL.ALLOW : "Confirmar"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose} disabled={saving} className="active:scale-[0.98]"><X />Cancelar</Button>
      </div>
    </div>
  );
}
