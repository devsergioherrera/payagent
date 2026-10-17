import Link from "next/link";
import type { OperationRow } from "@/lib/api-types";
import { dayTime } from "@/lib/format";
import { TYPE_LABEL } from "./by-type-table";
import { usd4 } from "./stat-tiles";

export function RecentOperations({ rows }: { rows: OperationRow[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">Operaciones recientes</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay operaciones.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((o) => (
            <li key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">
                {TYPE_LABEL[o.type] ?? o.type}
                {o.invoice_id && (
                  <Link href={`/facturas/${o.invoice_id}`} className="ml-2 text-xs text-brand hover:underline">Ver factura</Link>
                )}
              </span>
              <span className="text-right font-medium tabular-nums">{usd4(o.cost.cost_usd)}</span>
              <span className="text-xs text-muted-foreground">{dayTime(o.started_at)}</span>
              <span className="text-right text-xs tabular-nums text-muted-foreground">{(o.cost.duration_ms / 1000).toFixed(1)} s</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
