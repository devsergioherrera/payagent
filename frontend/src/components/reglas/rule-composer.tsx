"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { RuleDraft } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DraftPreview } from "./draft-preview";

const EXAMPLES = [
  "No paguen más de 5 mil dólares sin que yo apruebe",
  "A Northwind déjalo pasar sin orden de compra",
  "Frena facturas de Brasil de más de 3.000 dólares",
];

function Reading() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-brand-soft px-3.5 py-3 text-sm text-brand" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-pulse rounded-full bg-brand" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </span>
      El agente está leyendo tus fuentes de datos…
    </div>
  );
}

export function RuleComposer({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  async function translate() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const res = await api.draftRule(text.trim());
      setDraft(res.draft);
      setError(res.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.createRule(draft);
      toast.success("Regla creada");
      setDraft(null);
      setText("");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="rounded-xl border bg-background p-3 focus-within:ring-3 focus-within:ring-ring/30">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && translate()}
          placeholder="Ej.: no paguen más de 5 mil dólares sin que yo apruebe"
          rows={2}
          aria-label="Describe una regla"
          className="min-h-14 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={translate} disabled={!text.trim() || busy} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Traducir
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      {busy && <div className="mt-4"><Reading /></div>}
      {error && <p className="mt-4 rounded-xl bg-hold-soft px-3.5 py-3 text-sm text-hold">{error}</p>}
      {draft && (
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <DraftPreview draft={draft}>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={saving} className="bg-brand text-brand-foreground hover:bg-brand/90">
                Confirmar regla
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>Descartar</Button>
            </div>
          </DraftPreview>
        </div>
      )}
    </section>
  );
}
