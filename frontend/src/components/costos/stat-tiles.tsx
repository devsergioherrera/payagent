import type { Costs } from "@/lib/api-types";
import { money } from "@/lib/format";

export const usd4 = (n: number) => money(n, "USD", 4);

export function StatTiles({ costs }: { costs: Costs }) {
  const tiles = [
    { label: "Gasto de hoy", value: usd4(costs.today_usd) },
    { label: "Gasto del mes", value: usd4(costs.month_usd) },
    { label: "Operaciones", value: costs.operations.toLocaleString("es-CO") },
    { label: "Tokens", value: (costs.input_tokens + costs.output_tokens).toLocaleString("es-CO"), meta: `${costs.input_tokens.toLocaleString("es-CO")} entrada · ${costs.output_tokens.toLocaleString("es-CO")} salida` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{t.value}</p>
          {t.meta && <p className="mt-0.5 text-xs text-muted-foreground">{t.meta}</p>}
        </div>
      ))}
    </div>
  );
}
