"use client";

import { useRef, useState } from "react";
import { Paperclip, Search, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import type { InvoiceSummary } from "@/lib/api-types";
import { usePolling } from "@/hooks/use-polling";
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

function passes(i: InvoiceSummary, filter: FilterKey, q: string) {
  if (filter === "PENDING" ? i.decision_status !== "PENDING_HUMAN" : filter !== "TODAS" && i.outcome !== filter) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [i.vendor_name, i.invoice_number, i.amount != null ? String(i.amount) : null].some((v) => v?.toLowerCase().includes(needle));
}

export default function Page() {
  const [filter, setFilter] = useState<FilterKey>("TODAS");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ uploading: boolean; success: boolean; message: string }>({ uploading: false, success: false, message: "" });
  const picker = useRef<HTMLInputElement>(null);

  const { data: invoices, error, refresh } = usePolling(() => api.invoices(), 3000);

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

  const rows = (invoices ?? []).filter((i) => passes(i, filter, query));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proveedor, número o monto"
              className="h-9 w-full rounded-lg border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72"
            />
          </label>
          <Button className="h-9 bg-brand text-brand-foreground hover:bg-brand/90" onClick={() => setOpen(true)}>
            <Upload /> Subir factura
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="inline-flex gap-0.5 rounded-lg bg-secondary p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn("h-8 whitespace-nowrap rounded-md px-3 text-[13px] text-muted-foreground transition-colors", filter === f.key && "bg-card font-medium text-foreground shadow-xs")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-destructive">No se pudieron cargar las facturas.</p>
      ) : !invoices ? (
        <div className="space-y-px overflow-hidden rounded-2xl border bg-card">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
        </div>
      ) : (
        <Outlet invoices={rows} />
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
