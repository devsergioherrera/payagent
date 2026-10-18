"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProposeButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy} className="border-brand/40 text-brand hover:bg-brand-soft hover:text-brand active:scale-[0.98]">
      {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
      {busy ? "Revisando…" : "Proponer reglas"}
    </Button>
  );
}
