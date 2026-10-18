"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// The agent's face. Mesa and Reglas render it. The 3D body lives in mascot-canvas.tsx (client-only, lazy);
// until it is ready, or when WebGL is missing, a CSS version of the same face is shown.
export type MascotState = "idle" | "thinking" | "paid" | "escalated" | "held";

export interface MascotProps {
  state?: MascotState;
  size?: number; // px, square
  className?: string;
}

const MascotCanvas = dynamic(() => import("./mascot-canvas"), { ssr: false });

const noSubscribe = () => () => {};
let webglCache: boolean | undefined;
function hasWebGL() {
  if (webglCache !== undefined) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

function Fallback({ size }: { size: number }) {
  const eye = Math.max(4, size * 0.09);
  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className="flex items-center justify-center gap-[18%] rounded-[32%] bg-brand"
    >
      {[0, 1].map((i) => (
        <span key={i} style={{ width: eye, height: eye * 1.5 }} className="rounded-full bg-brand-foreground" />
      ))}
    </div>
  );
}

export function Mascot({ state = "idle", size = 96, className }: MascotProps) {
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => false);
  const [ready, setReady] = useState(false);

  return (
    <div
      role="img"
      aria-label="Agente de FacturaYa"
      data-state={state}
      style={{ width: size, height: size }}
      className={cn("relative shrink-0", className)}
    >
      {!ready && <div className="absolute inset-0"><Fallback size={size} /></div>}
      {webgl && (
        <div className={cn("absolute inset-0", !ready && "invisible")}>
          <MascotCanvas state={state} size={size} onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  );
}
