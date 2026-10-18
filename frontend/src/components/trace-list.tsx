"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { TraceStep } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const STEP_MS = 350;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The agent's reasoning as a checklist. With `animate` each step appears, spins for a beat and ticks.
export function TraceList({ steps, animate = false, onDone, className }: { steps: TraceStep[]; animate?: boolean; onDone?: () => void; className?: string }) {
  const n = steps.length;
  const [step, setStep] = useState(() => (animate && !prefersReducedMotion() ? 0 : n));
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (step >= n) {
      done.current?.();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, n]);

  return (
    <ol className={cn("space-y-2.5", className)} aria-label="Cómo lo pensó el agente">
      {steps.map((s, i) => {
        const visible = i <= step;
        const ticked = i < step;
        return (
          <li
            key={i}
            className={cn(
              "flex gap-3 transition-[opacity,transform] duration-300 motion-reduce:transition-none",
              visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                ticked ? "bg-brand text-brand-foreground" : "bg-brand-soft text-brand",
              )}
            >
              {ticked ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />}
            </span>
            <span className="min-w-0 text-[13px] leading-snug">
              <span className="font-medium">{s.label}</span>
              {s.detail && <span className="mt-0.5 block text-muted-foreground">{s.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
