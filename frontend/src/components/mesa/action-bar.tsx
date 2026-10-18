"use client";

import { Loader2, MessageCircleQuestionMark, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const QUESTIONS = ["¿Qué tengo pendiente?", "¿Cuánto llevamos pagado este mes?", "Busca facturas de Northwind"];

const BASE =
  "inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-[colors,transform] hover:bg-secondary hover:text-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";
const ON = "border-brand/40 bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand";

interface Props {
  dictating: boolean;
  dictateLabel: string;
  asking: boolean;
  learning: boolean;
  disabled: boolean;
  onDictate: () => void;
  onLearn: () => void;
  onAsk: () => void;
  onPick: (question: string) => void;
}

export function ActionBar({ dictating, dictateLabel, asking, learning, disabled, onDictate, onLearn, onAsk, onPick }: Props) {
  return (
    <div className="space-y-2.5">
      {asking && (
        <div className="flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
          {QUESTIONS.map((q) => (
            <button key={q} onClick={() => onPick(q)} disabled={disabled} className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-[colors,transform] hover:bg-secondary hover:text-foreground active:scale-[0.98] disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={onDictate}
          aria-pressed={dictating}
          className={cn(BASE, dictating && "border-brand bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground")}
        >
          {dictating ? (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-foreground/70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-foreground" />
            </span>
          ) : (
            <Mic className="size-4" />
          )}
          {dictateLabel}
        </button>
        <button onClick={onLearn} disabled={disabled || learning} className={cn(BASE, learning && ON)}>
          {learning ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="size-4" />}
          Aprender de mis decisiones
        </button>
        <button onClick={onAsk} aria-pressed={asking} className={cn(BASE, asking && ON)}>
          <MessageCircleQuestionMark className="size-4" />
          Preguntar
        </button>
      </div>
    </div>
  );
}
