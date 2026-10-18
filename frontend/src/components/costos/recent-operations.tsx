"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import type { OperationRow } from "@/lib/api-types";
import { dayTime, duration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL } from "./by-type-table";
import { usd4 } from "./stat-tiles";

const PAGE = 8;

export function RecentOperations({ rows }: { rows: OperationRow[] }) {
  const [page, setPage] = useState(1);
  const last = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, last);
  const shown = rows.slice((current - 1) * PAGE, current * PAGE);
  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-muted-foreground"><History className="size-3.5" /> Operaciones recientes</h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Aún no hay operaciones.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card">
          <ul className="h-[448px] divide-y overflow-y-auto">
            {shown.map((o) => (
              <li key={o.id} className="grid h-14 grid-cols-[1fr_auto] content-center gap-x-4 gap-y-0.5 px-4 text-sm">
                <span className="min-w-0 truncate">
                  {TYPE_LABEL[o.type] ?? o.type}
                  {o.invoice_id && <Link href={`/facturas/${o.invoice_id}`} className="ml-2 text-xs text-brand hover:underline">Ver factura</Link>}
                </span>
                <span className="text-right font-medium tabular-nums">{usd4(o.cost.cost_usd)}</span>
                <span className="text-xs text-muted-foreground">{dayTime(o.started_at)}</span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">{duration(o.cost.duration_ms)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{rows.length} {rows.length === 1 ? "operación" : "operaciones"}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">Página {current} de {last}</span>
              <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" aria-label="Página siguiente" disabled={current >= last} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
