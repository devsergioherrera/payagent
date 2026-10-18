"use client";

import { useState } from "react";
import { ArrowUp, Check, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { InvoiceSummary, RuleDraft } from "@/lib/api-types";
import { Mascot } from "@/components/mascot/mascot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DraftPreview } from "./draft-preview";
import { CONFIRM_LABEL } from "./rule-sentence";

const EXAMPLES = [
  "No paguen más de 5 mil dólares sin que yo apruebe",
  "A Northwind déjalo pasar sin orden de compra",
  "Frena facturas de Brasil de más de 3.000 dólares",
];

function Reading() {
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-brand" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </span>
      Leyendo tus fuentes de datos
    </div>
  );
}

interface Props {
  onCreated: () => void;
  fromInvoice?: InvoiceSummary | null;
  onClearInvoice?: () => void;
}

export function RuleComposer({ onCreated, fromInvoice, onClearInvoice }: Props) {
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
      const res = await api.draftRule(text.trim(), fromInvoice?.id);
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
      await api.createRule(draft);
      toast.success("Regla creada");
      setDraft(null);
      setText("");
      onCreated();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <header className="flex items-center gap-3">
        <Mascot state={busy ? "thinking" : "idle"} size={56} className="shrink-0" />
        <div className="min-w-0">
          <h2 className="text-xs font-medium text-brand">Nueva regla</h2>
          <p className="text-[15px] leading-snug font-medium">Dime la regla como se la dirías a una persona.</p>
        </div>
      </header>

      <div className="mt-4 rounded-2xl border bg-background p-3 focus-within:ring-3 focus-within:ring-ring/30">
        {fromInvoice && (
          <span className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-xs text-brand">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              A partir de {fromInvoice.invoice_number ?? fromInvoice.id}{fromInvoice.vendor_name ? ` · ${fromInvoice.vendor_name}` : ""}
            </span>
            <button type="button" onClick={onClearInvoice} aria-label="Quitar la factura" className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-brand/10">
              <X className="size-3.5" />
            </button>
          </span>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && translate()}
          placeholder={fromInvoice ? "Ej.: pide mi aprobación en casos como este" : "Ej.: no paguen más de 5 mil dólares sin que yo apruebe"}
          rows={2}
          aria-label="Describe una regla"
          className="min-h-12 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {busy ? <Reading /> : <span className="text-xs text-muted-foreground">Ctrl + Enter para enviar</span>}
          <Button size="icon" onClick={translate} disabled={!text.trim() || busy} aria-label="Redactar la regla" className="size-8 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}
          </Button>
        </div>
      </div>

      {!draft && !busy && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-hold-soft px-3.5 py-3 text-sm text-hold">{error}</p>}
      {draft && (
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <DraftPreview draft={draft}>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={saving} className="bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]">
                <Check />{CONFIRM_LABEL[draft.effect]}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving} className="active:scale-[0.98]"><X />Descartar</Button>
            </div>
          </DraftPreview>
        </div>
      )}
    </section>
  );
}
