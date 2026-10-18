import type { CostByType } from "@/lib/api-types";
import { usd4 } from "./stat-tiles";

export const TYPE_LABEL: Record<string, string> = {
  PROCESS_INVOICE: "Procesar factura",
  PROPOSE_RULES: "Proponer reglas",
  CHAT: "Chat",
  RULE_DRAFT: "Redactar regla",
};

export function ByTypeTable({ rows }: { rows: CostByType[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">Por tipo de operación</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full min-w-0 text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2.5 sm:px-4 text-left font-normal">Operación</th>
              <th className="px-3 py-2.5 sm:px-4 text-right font-normal">Cantidad</th>
              <th className="px-3 py-2.5 sm:px-4 text-right font-normal">Total</th>
              <th className="px-3 py-2.5 sm:px-4 text-right font-normal">Promedio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.type}>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{r.operations}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{usd4(r.total_usd)}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{usd4(r.avg_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
