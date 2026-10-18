"use client";

import { useEffect } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useDictation } from "@/hooks/use-dictation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mic button for any rule text box: appends what you say, shows live text through `onInterim`.
export function DictateButton({ onText, onInterim, disabled }: { onText: (text: string) => void; onInterim?: (text: string) => void; disabled?: boolean }) {
  const dict = useDictation({ onFinal: onText, onTranscript: onText });
  const active = dict.state === "listening" || dict.state === "recording";
  const transcribing = dict.state === "transcribing";

  useEffect(() => onInterim?.(dict.interim), [dict.interim, onInterim]);
  useEffect(() => {
    if (dict.error) {
      toast.error(dict.error);
      dict.dismissError();
    }
  }, [dict]);

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled || transcribing}
      aria-pressed={active}
      aria-label={active ? "Detener el dictado" : transcribing ? "Transcribiendo" : "Dictar"}
      onClick={() => (active ? dict.stop() : dict.start())}
      className={cn("size-8 shrink-0 rounded-full text-muted-foreground active:scale-[0.98]", active && "bg-brand/10 text-brand")}
    >
      {transcribing ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : active ? <Square className="fill-current" /> : <Mic />}
    </Button>
  );
}
