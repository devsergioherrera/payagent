"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "./section";

type Doc = { kind: "image" | "pdf" | "text" | "other"; text?: string };

const byExtension = (url: string): Doc["kind"] | null => {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(path)) return "image";
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(txt|md|csv)$/.test(path)) return "text";
  return null;
};

function useDoc(url: string) {
  const [state, setState] = useState<{ url: string; doc: Doc } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return { kind: "other" } as Doc;
        const type = res.headers.get("content-type") ?? "";
        const kind = type.startsWith("image/") ? "image" : type.includes("pdf") ? "pdf" : type.startsWith("text/") ? "text" : (byExtension(url) ?? "other");
        return kind === "text" ? ({ kind, text: await res.text() } as Doc) : ({ kind } as Doc);
      })
      .catch(() => ({ kind: byExtension(url) ?? "other" }) as Doc)
      .then((doc) => alive && setState({ url, doc }));
    return () => { alive = false; };
  }, [url]);
  return state?.url === url ? state.doc : null;
}

export function OpenLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <span className="hidden sm:inline">Abrir en otra pestaña</span><span className="sm:hidden">Abrir</span> <ExternalLink className="size-3" />
    </a>
  );
}

// The card exists only when there is a file to show: no file, no card.
export function DocumentCard({ url }: { url: string }) {
  const doc = useDoc(url);
  if (doc?.kind === "other") return null;
  return (
    <Section title="Documento original" icon={FileText} aside={<OpenLink url={url} />} bodyClassName="p-3">
      <div className="h-[190px]">{doc ? <DocumentView doc={doc} url={url} /> : <Skeleton className="h-full w-full rounded-xl" />}</div>
    </Section>
  );
}

function DocumentView({ doc, url }: { doc: Doc; url: string }) {
  if (doc.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Factura original" className="h-full w-full rounded-xl border bg-white object-contain" />;
  }
  if (doc.kind === "pdf") {
    return (
      <object data={url} type="application/pdf" className="h-full w-full rounded-xl border">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline">Descargar el PDF</a>
      </object>
    );
  }
  if (doc.kind === "text") {
    return <pre className="h-full overflow-auto whitespace-pre-wrap rounded-xl border bg-background p-4 font-mono text-xs leading-relaxed">{doc.text}</pre>;
  }
  return null;
}
