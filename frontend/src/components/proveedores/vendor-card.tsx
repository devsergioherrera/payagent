"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VendorView } from "@/lib/api-types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAX_LABEL: Record<VendorView["country"], string> = { CO: "NIT", MX: "RFC", BR: "CNPJ", US: "EIN" };
const RAIL_LABEL: Record<VendorView["bank_rail"], string> = { ACH: "ACH", WIRE: "Wire", BRE_B: "Bre-B", SPEI: "SPEI", PIX: "PIX" };

export function VendorCard({ vendor: v }: { vendor: VendorView }) {
  const [open, setOpen] = useState(false);
  const blocked = v.status === "BLOCKED";

  return (
    <li className="rounded-2xl border bg-card">
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{v.name}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", blocked ? "bg-hold-soft text-hold" : "bg-muted text-muted-foreground")}>
              {blocked ? "Bloqueado" : "Permitido"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {v.country} · {TAX_LABEL[v.country]} <span className="font-mono">{v.tax_id}</span> · {v.currency}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {RAIL_LABEL[v.bank_rail]} <span className="break-all font-mono">{v.bank_account}</span>
          </p>
        </div>
        <div className="flex gap-6 text-xs text-muted-foreground sm:text-right">
          <div>
            <p>Facturas</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{v.invoices}</p>
          </div>
          <div>
            <p>Pagado</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{money(v.paid_usd)}</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:px-5"
      >
        Órdenes de compra ({v.purchase_orders.length})
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {v.purchase_orders.length === 0 && <li className="px-4 py-3 text-xs text-muted-foreground sm:px-5">Sin órdenes de compra.</li>}
          {v.purchase_orders.map((po) => (
            <li key={po.po_number} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 text-sm sm:px-5">
              <span className="font-mono text-[13px]">{po.po_number}</span>
              <span className="text-right font-medium tabular-nums">{money(po.amount, po.currency)}</span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">{po.description ?? "Sin descripción"}</span>
              <span className="text-right text-xs text-muted-foreground">{po.status === "OPEN" ? "Abierta" : "Cerrada"}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
