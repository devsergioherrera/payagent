"use client";

import { useState } from "react";
import { ArrowLeft, Building2, ClipboardList, Landmark, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VendorView } from "@/lib/api-types";
import { Chip, EmptyRows, ListPane, RowsSkeleton } from "./list-pane";
import { DetailSkeleton, InvoiceLinks, Kpi, RAIL_LABEL, Section, StatusPill, TAX_LABEL } from "./shared";
import { count, PAGE_SIZE, useDebounced, useKeyedPolling } from "./use-directory";

const COUNTRIES = ["CO", "MX", "BR", "US"] as const;

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenPo: (po: string) => void;
  onAllPos: (vendorName: string) => void;
}

export function VendorsTab({ selectedId, onSelect, onOpenPo, onAllPos }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const filters = { q: dq, status, country, limit: PAGE_SIZE, offset };
  const { data, error } = useKeyedPolling(() => api.vendors(filters), JSON.stringify(filters));
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOffset(0); };
  const toggle = (cur: string, set: (v: string) => void, v: string) => reset(set)(cur === v ? "" : v);

  const activeId = selectedId ?? data?.items[0]?.id ?? null;

  return (
    <>
      <ListPane
        placeholder="Buscar por nombre o identificación fiscal" query={q} onQuery={reset(setQ)} total={data?.total ?? null}
        offset={offset} onOffset={setOffset} hidden={selectedId !== null}
        filters={
          <>
            <Chip active={status === "ALLOWED"} onClick={() => toggle(status, setStatus, "ALLOWED")}>Permitido</Chip>
            <Chip active={status === "BLOCKED"} onClick={() => toggle(status, setStatus, "BLOCKED")}>Bloqueado</Chip>
            <span className="mx-1 h-4 w-px bg-border" />
            {COUNTRIES.map((c) => <Chip key={c} active={country === c} onClick={() => toggle(country, setCountry, c)}>{c}</Chip>)}
          </>
        }
      >
        {error && !data ? <EmptyRows text="No se pudieron cargar los proveedores." />
          : !data ? <RowsSkeleton />
          : data.items.length === 0 ? <EmptyRows text="Ningún proveedor coincide con la búsqueda." />
          : (
            <ul className="divide-y">
              {data.items.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(v.id)}
                    aria-current={v.id === activeId}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary", v.id === activeId && "bg-secondary")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="min-w-0 truncate">{v.name}</span>
                        {v.status === "BLOCKED" && <StatusPill blocked labels={["Permitido", "Bloqueado"]} />}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.country} · {TAX_LABEL[v.country]} <span className="font-mono">{v.tax_id}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">{money(v.paid_usd)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{count(v.invoices)} {v.invoices === 1 ? "factura" : "facturas"}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </ListPane>
      <section className={cn("min-h-0 flex-col overflow-hidden rounded-2xl border bg-card", selectedId === null ? "hidden lg:flex" : "flex")}>
        {activeId ? <VendorDetail id={activeId} onBack={() => onSelect(null)} onOpenPo={onOpenPo} onAllPos={onAllPos} />
          : <p className="m-auto p-6 text-sm text-muted-foreground">Elige un proveedor para ver su detalle.</p>}
      </section>
    </>
  );
}

function VendorDetail({ id, onBack, onOpenPo, onAllPos }: { id: string; onBack: () => void; onOpenPo: (po: string) => void; onAllPos: (n: string) => void }) {
  const { data: v, error } = useKeyedPolling(() => api.vendor(id), id);
  const { data: pos } = useKeyedPolling(() => api.purchaseOrders({ vendor_id: id, limit: 5 }), id);
  const { data: invoices } = useKeyedPolling(() => api.invoices({ vendor_id: id, limit: 5 }), id);

  if (error && !v) return <p className="m-auto p-6 text-sm text-muted-foreground">No se encontró el proveedor.</p>;
  if (!v || v.id !== id) return <DetailSkeleton />;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="size-4" /> Volver a la lista
      </button>
      <Header v={v} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border px-4 py-3 max-sm:col-span-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Landmark className="size-3.5" />Datos de pago</p>
          <p className="mt-1 text-sm">{RAIL_LABEL[v.bank_rail]} · {v.currency}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{v.bank_account}</p>
        </div>
        <Kpi label="Facturas" value={count(v.invoices)} />
        <Kpi label="Pagado en USD" value={money(v.paid_usd)} />
      </div>
      <Section
        icon={ClipboardList} title="Órdenes de compra"
        aside={pos && pos.total > pos.items.length ? (
          <button type="button" onClick={() => onAllPos(v.name)} className="text-brand hover:underline">Ver las {count(pos.total)}</button>
        ) : pos ? count(pos.total) : null}
      >
        {!pos ? <div className="m-4 h-20 animate-pulse rounded bg-muted" />
          : pos.items.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">Sin órdenes de compra.</p>
          : (
            <ul className="divide-y">
              {pos.items.map((p) => (
                <li key={p.po_number}>
                  <button type="button" onClick={() => onOpenPo(p.po_number)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary">
                    <span className="font-mono text-[13px]">{p.po_number}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.description ?? "Sin descripción"}</span>
                    <span className="text-right text-sm font-medium tabular-nums">{money(p.amount, p.currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Section>
      <Section icon={Receipt} title="Facturas recientes">
        {invoices ? <InvoiceLinks invoices={invoices} /> : <div className="m-4 h-20 animate-pulse rounded bg-muted" />}
      </Section>
    </div>
  );
}

function Header({ v }: { v: VendorView }) {
  return (
    <header className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><Building2 className="size-5 text-muted-foreground" /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{v.name}</h2>
          <StatusPill blocked={v.status === "BLOCKED"} labels={["Permitido", "Bloqueado"]} />
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{v.country} · {TAX_LABEL[v.country]} <span className="font-mono">{v.tax_id}</span></p>
      </div>
    </header>
  );
}
