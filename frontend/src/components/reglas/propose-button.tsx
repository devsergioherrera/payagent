"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function ProposeButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const { created } = await api.runProposals();
      toast(created.length ? `${created.length} ${created.length === 1 ? "propuesta nueva" : "propuestas nuevas"}` : "No hay patrones nuevos");
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 409 ? "Ya hay una revisión en curso" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={run} disabled={busy} className="border-brand/40 text-brand hover:bg-brand-soft hover:text-brand">
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {busy ? "Revisando tus últimas decisiones…" : "Proponer reglas"}
    </Button>
  );
}
