"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Paperclip, Search, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { useKeyedPolling } from "@/components/directorio/use-directory";
import { DateFilter } from "@/components/facturas/date-filter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import Outlet from "@/components/facturas/outlet";

const FILTERS = [
  { key: "TODAS", label: "Todas" },
  { key: "PAY", label: "Pagadas" },
  { key: "ESCALATE", label: "Escaladas" },
  { key: "HOLD", label: "Frenadas" },
  { key: "PENDING", label: "Pendientes" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];
const PAGE_SIZE = 25;

// Filters live in the URL so a view can be shared and the back button restores it.
function filterFromUrl(sp: URLSearchParams): FilterKey {
  if (sp.get("status") === "PENDING") return "PENDING";
  const o = sp.get("outcome");
  return o === "PAY" || o === "ESCALATE" || o === "HOLD" ? o : "TODAS";
}

export default function Page() {
  return (
    <Suspense>
      <Facturas />
    </Suspense>
  );
}

function Facturas() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filter = filterFromUrl(sp);
  const q = sp.get("q") ?? "";
  const range = { from: sp.get("from") ?? "", to: sp.get("to") ?? "" };
  const pageNo = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [query, setQuery] = useState(q);
  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => setParams({ q: query.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ uploading: boolean; success: boolean; message: string }>({ uploading: false, success: false, message: "" });
  const picker = useRef<HTMLInputElement>(null);

  const key = sp.toString();
  const { data: page, error, refresh } = useKeyedPolling(
    () =>
      api.invoicesPage({
        outcome: filter === "PAY" || filter === "ESCALATE" || filter === "HOLD" ? filter : undefined,
        status: filter === "PENDING" ? "PENDING" : undefined,
        q: q || undefined, from: range.from || undefined, to: range.to || undefined,
        limit: PAGE_SIZE, offset: (pageNo - 1) * PAGE_SIZE,
      }),
    key,
  );
  const lastPage = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;

  const handleUpload = async () => {
    if (!file && !text.trim()) {
      setStatus({ uploading: false, success: false, message: "Adjunta un archivo o pega el texto." });
      return;
    }
    setStatus({ uploading: true, success: false, message: "" });
    try {
      const result = await api.upload(file, text);
      if (result.invoice_id || result.duplicate_of) {
        setOpen(false);
        setFile(null);
        setText("");
        setStatus({ uploading: false, success: true, message: "" });
        refresh();
      }
    } catch {
      setStatus({ uploading: false, success: false, message: "No se pudo subir la factura." });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proveedor, número o monto"
              className="h-9 w-full rounded-xl border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72"
            />
          </label>
          <Button className="h-9 bg-brand text-brand-foreground hover:bg-brand/90 active:scale-[0.98]" onClick={() => setOpen(true)}>
            <Upload /> Subir factura
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 xl:mx-0 xl:px-0">
          <div className="inline-flex gap-0.5 rounded-full bg-secondary p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setParams({ outcome: f.key === "PAY" || f.key === "ESCALATE" || f.key === "HOLD" ? f.key : null, status: f.key === "PENDING" ? "PENDING" : null })}
                className={cn("h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] text-muted-foreground transition-colors active:scale-[0.98]", filter === f.key && "bg-card font-medium text-foreground shadow-xs")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <DateFilter value={range} onChange={(r) => setParams({ from: r.from || null, to: r.to || null })} />
      </div>

      {error ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-destructive">No se pudieron cargar las facturas.</p>
      ) : !page ? (
        <div className="space-y-px overflow-hidden rounded-2xl border bg-card">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
        </div>
      ) : (
        <>
          <Outlet invoices={page.items} listClassName="lg:max-h-[calc(100dvh-330px)]" />
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{page.total} {page.total === 1 ? "factura" : "facturas"}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">Página {Math.min(pageNo, lastPage)} de {lastPage}</span>
              <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={pageNo <= 1} onClick={() => setParams({ page: pageNo > 2 ? String(pageNo - 1) : null })}><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" aria-label="Página siguiente" disabled={pageNo >= lastPage} onClick={() => setParams({ page: String(pageNo + 1) })}><ChevronRight /></Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir factura</DialogTitle>
            <DialogDescription>Adjunta un PDF o una imagen, o pega el texto de la factura.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={picker} type="file" accept=".pdf,image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button
              onClick={() => picker.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Paperclip className="size-4" />
              {file ? file.name : "Seleccionar PDF o imagen"}
              {file && (
                <span role="button" aria-label="Quitar archivo" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="grid size-5 place-items-center rounded-full hover:bg-background"><X className="size-3" /></span>
              )}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="O pega aquí el texto de la factura"
              rows={4}
              className="block w-full resize-none rounded-xl border bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {status.message && <p className="text-sm text-destructive">{status.message}</p>}
            <Button onClick={handleUpload} disabled={status.uploading} className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              {status.uploading ? "Subiendo" : "Subir factura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
