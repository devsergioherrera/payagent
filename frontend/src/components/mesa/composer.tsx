"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import { useDictation } from "@/hooks/use-dictation";
import { cn } from "@/lib/utils";
import { ActionBar } from "./action-bar";

const BARS = 24;
const TYPE_MS = 16;
const MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

// Mock builds only: lets screenshots show states that need a microphone (?demo=listening|ask).
const noSubscribe = () => () => {};
const previewParam = () => (MOCKS ? new URLSearchParams(window.location.search).get("demo") : null);

const join = (base: string, add: string) => (!base || /\s$/.test(base) ? base : base + " ") + add.trimStart();
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface Props {
  disabled: boolean;
  learning: boolean;
  onSend: (text: string, file: File | null) => void;
  onLearn: () => void;
  onTranscribing: (busy: boolean) => void;
}

function Meter({ level, seconds }: { level: number; seconds: number }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1" role="status" aria-label="Grabando">
      <span className="flex h-6 flex-1 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => {
          const wave = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seconds));
          return <span key={i} className="w-1 rounded-full bg-brand transition-[height] duration-100 motion-reduce:transition-none" style={{ height: `${Math.max(12, level * wave * 100)}%`, opacity: 0.35 + level * 0.65 }} />;
        })}
      </span>
      <span className="text-[13px] tabular-nums text-muted-foreground">{clock(seconds)}</span>
    </div>
  );
}

export function Composer({ disabled, learning, onSend, onLearn, onTranscribing }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [askOpen, setAskOpen] = useState<boolean | null>(null);
  const [demoOff, setDemoOff] = useState(false);
  const preview = useSyncExternalStore(noSubscribe, previewParam, () => null);
  const demo = demoOff ? null : preview;
  const asking = askOpen ?? preview === "ask";
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  const typer = useRef<ReturnType<typeof setInterval>>(undefined);

  // The fallback result lands as a quick typewriter so it feels live.
  const typeInto = useCallback((full: string) => {
    clearInterval(typer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText((t) => join(t, full));
      return;
    }
    let i = 0;
    const word = join(textRef.current, full);
    const start = word.length - full.trimStart().length;
    typer.current = setInterval(() => {
      i += 2;
      setText(word.slice(0, Math.min(word.length, start + i)));
      if (start + i >= word.length) clearInterval(typer.current);
    }, TYPE_MS);
  }, []);
  useEffect(() => () => clearInterval(typer.current), []);

  const dict = useDictation({ onFinal: (t) => setText((cur) => join(cur, t)), onTranscript: typeInto });
  const state = demo === "listening" ? "listening" : dict.state;
  const interim = demo === "listening" ? "las tres facturas de Northwind" : dict.interim;
  const dictating = state === "listening" || state === "recording";

  useEffect(() => {
    onTranscribing(state === "transcribing");
  }, [state, onTranscribing]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text, state]);

  const learnOnce = useRef(false);
  useEffect(() => {
    if (preview === "learn" && !learnOnce.current) {
      learnOnce.current = true;
      onLearn();
    }
  }, [preview, onLearn]);

  const canSend = !disabled && state !== "transcribing" && (text.trim().length > 0 || interim.length > 0 || file !== null);
  const send = (value = text, attached = file) => {
    const spoken = value === text && interim ? join(value, interim) : value;
    dict.cancel();
    if (disabled || (!spoken.trim() && !attached)) return;
    clearInterval(typer.current);
    onSend(spoken.trim(), attached);
    setText("");
    setFile(null);
    setAskOpen(false);
  };

  const toggleDictation = () => {
    if (demo === "listening") return setDemoOff(true);
    if (dictating) dict.stop();
    else if (state === "idle") dict.start();
  };

  const label = state === "listening" ? "Escuchando…" : state === "recording" ? "Grabando…" : state === "transcribing" ? "Transcribiendo…" : "Dictar";

  return (
    <div className="space-y-3 bg-background pb-4 pt-2">
      <ActionBar
        dictating={dictating}
        dictateLabel={label}
        asking={asking}
        learning={learning}
        disabled={disabled}
        onDictate={toggleDictation}
        onLearn={onLearn}
        onAsk={() => setAskOpen(!asking)}
        onPick={(q) => send(q, null)}
      />
      <div className={cn("rounded-2xl border bg-card p-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30", dictating && "border-brand/50")}>
        {state === "recording" ? (
          <Meter level={dict.level} seconds={dict.seconds} />
        ) : state === "transcribing" ? (
          <div className="flex items-center gap-3 px-1 py-0.5" role="status">
            <Mascot state="thinking" size={32} />
            <span className="text-sm text-muted-foreground">Transcribiendo…</span>
          </div>
        ) : state === "listening" ? (
          <div className="min-h-6 max-h-36 overflow-y-auto whitespace-pre-wrap px-1 py-1 text-sm leading-6" aria-live="polite">
            {text || (demo ? "Busca las facturas de" : "")}
            {interim && <span className="text-muted-foreground">{(text || demo) && " "}{interim}</span>}
            {!text && !interim && !demo && <span className="text-muted-foreground">Habla ahora</span>}
          </div>
        ) : (
          <textarea
            ref={area}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Sube una factura, crea una regla o busca una factura"
            className="block max-h-36 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
          />
        )}
        {dict.error && (
          <p role="alert" className="mt-1.5 flex items-start gap-2 px-1 text-xs text-destructive">
            <span className="min-w-0 flex-1">{dict.error}</span>
            <button onClick={dict.dismissError} aria-label="Cerrar aviso" className="grid size-4 place-items-center rounded-full hover:bg-secondary"><X className="size-3" /></button>
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <input ref={picker} type="file" accept=".pdf,image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button onClick={() => picker.current?.click()} aria-label="Adjuntar factura" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Paperclip className="size-4" />
          </button>
          {file && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1.5 text-xs">
              <span className="truncate">{file.name}</span>
              <button onClick={() => setFile(null)} aria-label="Quitar archivo" className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-background"><X className="size-3" /></button>
            </span>
          )}
          <button
            onClick={() => send()}
            disabled={!canSend}
            aria-label="Enviar"
            className={cn("ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground transition-[opacity,transform] active:scale-[0.98]", !canSend && "opacity-40")}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
