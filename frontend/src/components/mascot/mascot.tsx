"use client";

import { cn } from "@/lib/utils";

// The agent's face. Mesa and Reglas render it; the Three.js version replaces this body, same props.
export type MascotState = "idle" | "thinking" | "paid" | "escalated" | "held";

export interface MascotProps {
  state?: MascotState;
  size?: number; // px, square
  className?: string;
}

export function Mascot({ state = "idle", size = 96, className }: MascotProps) {
  return (
    <div
      role="img"
      aria-label="Agente de FacturaYa"
      data-state={state}
      style={{ width: size, height: size }}
      className={cn("rounded-2xl bg-brand-soft", className)}
    />
  );
}
