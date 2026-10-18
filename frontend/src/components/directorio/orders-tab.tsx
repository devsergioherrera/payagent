"use client";

import { useState } from "react";
import { ArrowLeft, Building2, ClipboardList, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PurchaseOrderRow } from "@/lib/api-types";
import { Chip, EmptyRows, ListPane, RowsSkeleton } from "./list-pane";
import { DetailSkeleton, InvoiceLinks, Kpi, Section, StatusPill } from "./shared";
import { count, PAGE_SIZE, useDebounced, useKeyedPolling } from "./use-directory";

const pct = (po: PurchaseOrderRow) => Math.min(100, Math.round((po.invoiced_usd / po.amount_usd) * 100));

function Consumption({ po, className }: { po: PurchaseOrderRow; className?: string }) {
  const over = po.invoiced_usd > po.amount_usd;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={pct(po)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", over ? "bg-hold" : "bg-foreground/60")} style={{ width: `${pct(po)}%` }} />
    </div>
  );
}

interface Props {
  selectedPo: string | null;
  initialQ: string;
  onSelect: (po: string | null) => void;
  onOpenVendor: (id: string) => void;
}

export function OrdersTab({ selectedPo, initialQ, onSelect, onOpenVendor }: Props) {
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [withBalance, setWithBalance] = useState(false);
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q);
  const filters = { q: dq, status, vendor_id: vendorId, with_balance: withBalance, limit: PAGE_SIZE, offset };
  const { data, error } = useKeyedPolling(() => api.purchaseOrders(filters), JSON.stringify(filters));
  const { data: vendors } = useKeyedPolling(() => api.vendors({ limit: 200 }), "vendors");
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOffset(0); };

  const activeId = selectedPo ?? data?.items[0]?.po_number ?? null;

  return (
    <>
      <ListPane
        placeholder="Buscar por orden, descripción o proveedor" query={q} onQuery={reset(setQ)} total={data?.total ?? null}
        offset={offset} onOffset={setOffset} hidden={selectedPo !== null}
        filters={
          <>
            <Chip active={status === "OPEN"} onClick={() => reset(setStatus)(status === "OPEN" ? "" : "OPEN")}>Abierta</Chip>
            <Chip active={status === "CLOSED"} onClick={() => reset(setStatus)(status === "CLOSED" ? "" : "CLOSED")}>Cerrada</Chip>
            <Chip active={withBalance} onClick={() => reset(setWithBalance)(!withBalance)}>Con saldo</Chip>
            <select
              value={vendorId}
              onChange={(e) => reset(setVendorId)(e.target.value)}
              aria-label="Proveedor"
              className={cn("h-7 max-w-44 truncate rounded-full border bg-transparent px-2.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50", vendorId ? "border-foreground/25 bg-secondary font-medium" : "text-muted-foreground")}
            >
              <option value="">Proveedor</option>
              {vendors?.items.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </>
        }
      >
        {error && !data ? <EmptyRows text="No se pudieron cargar las órdenes." />
          : !data ? <RowsSkeleton />
          : data.items.length === 0 ? <EmptyRows text="Ninguna orden coincide con la búsqueda." />
          : (
            <ul className="divide-y">
              {data.items.map((p) => (
                <li key={p.po_number}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.po_number)}
                    aria-current={p.po_number === activeId}
                    className={cn("block w-full px-4 py-3 text-left transition-colors hover:bg-secondary", p.po_number === activeId && "bg-secondary")}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[13px] font-medium">{p.po_number}</span>
                      <span className="text-sm font-medium tabular-nums">{money(p.amount, p.currency)}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">{p.vendor_name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {p.status === "CLOSED" ? "Cerrada" : `Saldo ${money(Math.max(0, p.remaining_usd))}`}
                      </span>
                    </div>
                    <Consumption po={p} className="mt-2" />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </ListPane>
      <section className={cn("min-h-0 flex-col overflow-hidden rounded-2xl border bg-card", selectedPo === null ? "hidden lg:flex" : "flex")}>
        {activeId ? <OrderDetail poNumber={activeId} onBack={() => onSelect(null)} onOpenVendor={onOpenVendor} />
          : <p className="m-auto p-6 text-sm text-muted-foreground">Elige una orden para ver su detalle.</p>}
      </section>
    </>
  );
}

function OrderDetail({ poNumber, onBack, onOpenVendor }: { poNumber: string; onBack: () => void; onOpenVendor: (id: string) => void }) {
  const { data, error } = useKeyedPolling(() => api.purchaseOrder(poNumber), poNumber);
  if (error && !data) return <p className="m-auto p-6 text-sm text-muted-foreground">No se encontró la orden de compra.</p>;
  if (!data || data.po.po_number !== poNumber) return <DetailSkeleton />;
  const { po, invoices } = data;
  const over = po.invoiced_usd > po.amount_usd;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="size-4" /> Volver a la lista
      </button>
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><ClipboardList className="size-5 text-muted-foreground" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-semibold tracking-tight">{po.po_number}</h2>
            <StatusPill blocked={po.status === "CLOSED"} labels={["Abierta", "Cerrada"]} neutral />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{po.description ?? "Sin descripción"}</p>
          <button type="button" onClick={() => onOpenVendor(po.vendor_id)} className="mt-1 flex max-w-full items-center gap-1.5 text-[13px] text-brand hover:underline">
            <Building2 className="size-3.5 shrink-0" /><span className="truncate">{po.vendor_name}</span>
          </button>
        </div>
      </header>
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xl font-semibold tabular-nums">{money(po.amount, po.currency)}</p>
          {po.currency !== "USD" && <p className="text-sm tabular-nums text-muted-foreground">{money(po.amount_usd)}</p>}
        </div>
        <Consumption po={po} className="mt-3 h-2" />
        <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>Facturado {money(po.invoiced_usd)} ({pct(po)} %)</span>
          <span className={cn(over && "text-hold")}>{over ? `Excedido ${money(-po.remaining_usd)}` : `Saldo ${money(po.remaining_usd)}`}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Facturas que la citan" value={count(po.invoices)} />
        <Kpi label="Facturado en USD" value={money(po.invoiced_usd)} />
      </div>
      <Section icon={Receipt} title="Facturas"><InvoiceLinks invoices={invoices} /></Section>
    </div>
  );
}
