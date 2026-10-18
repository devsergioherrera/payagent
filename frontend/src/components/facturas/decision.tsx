"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Section } from "./section";
import { cn } from "@/lib/utils";

export function Decision({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ busy: boolean; ok: boolean; message: string }>({ busy: false, ok: false, message: "" });

  const submit = async (verdict: "APPROVED" | "REJECTED") => {
    if (verdict === "REJECTED" && !note.trim()) {
      setState({ busy: false, ok: false, message: "El motivo es obligatorio si rechazas." });
      return;
    }
    setState({ busy: true, ok: false, message: "" });
    try {
      await api.resolve(id, { verdict, note: note || null });
      setState({ busy: false, ok: true, message: verdict === "APPROVED" ? "Pago aprobado." : "Pago rechazado." });
      setNote("");
      onDone();
    } catch {
      setState({ busy: false, ok: false, message: "No se pudo registrar la decisión." });
    }
  };

  return (
    <Section title="Tu decisión" icon={Gavel} className="border-brand/40">
      <p className="text-sm font-semibold">Este pago necesita tu aprobación</p>
      <label htmlFor="resolve-note" className="mb-1.5 mt-3 block text-xs text-muted-foreground">Motivo (obligatorio si rechazas)</label>
      <textarea
        id="resolve-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={1}
        placeholder="Explica tu decisión"
        className="block w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.message && <p className={cn("mt-2 text-sm", state.ok ? "text-pay" : "text-destructive")}>{state.message}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-9 border-hold/50 text-hold hover:bg-hold-soft hover:text-hold" disabled={state.busy} onClick={() => submit("REJECTED")}>Rechazar</Button>
        <Button className="h-9 bg-pay text-white hover:bg-pay/90" disabled={state.busy} onClick={() => submit("APPROVED")}>Aprobar pago</Button>
      </div>
    </Section>
  );
}
