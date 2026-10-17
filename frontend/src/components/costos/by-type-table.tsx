import type { CostByType } from "@/lib/api-types";

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
              <th className="px-3 py-2.5 sm:px-4 text-right font-normal">Total USD</th>
              <th className="px-3 py-2.5 sm:px-4 text-right font-normal">Prom. USD</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.type}>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{r.operations}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{r.total_usd.toFixed(4)}</td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4 text-right tabular-nums">{r.avg_usd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
