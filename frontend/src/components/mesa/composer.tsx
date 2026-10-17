"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["¿Qué tengo pendiente?", "Crear una regla"];

export function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string, file: File | null) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  const canSend = !disabled && (text.trim().length > 0 || file !== null);
  const send = (value = text, attached = file) => {
    if (disabled || (!value.trim() && !attached)) return;
    onSend(value.trim(), attached);
    setText("");
    setFile(null);
  };
  const suggest = (s: string) => {
    if (s === "Crear una regla") {
      setText("Quiero crear una regla: ");
      area.current?.focus();
    } else send(s, null);
  };

  return (
    <div className="space-y-3 bg-background pb-4 pt-2">
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => suggest(s)} disabled={disabled} className="rounded-full border bg-card px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
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
            className={cn("ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground transition-opacity", !canSend && "opacity-40")}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
