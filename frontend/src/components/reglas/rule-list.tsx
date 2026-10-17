import type { RuleView } from "@/lib/api-types";
import { RuleRow } from "./rule-row";

const GROUP_LABEL: Record<string, string> = {
  vendor: "Proveedor",
  invoice: "Montos (invoice)",
  invoice_checks: "Validaciones",
  po_check: "Cruce con la orden",
  purchase_order: "Orden de compra",
  budget_status: "Presupuesto",
};
const GROUP_ORDER = Object.keys(GROUP_LABEL);

function groupRules(rules: RuleView[]) {
  const groups = new Map<string, RuleView[]>();
  for (const r of rules) {
    const key = r.conditions[0]?.source ?? "invoice";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups].sort(([a], [b]) => (GROUP_ORDER.indexOf(a) + 99) % 99 - (GROUP_ORDER.indexOf(b) + 99) % 99);
}

export function RuleList({ rules, onChange }: { rules: RuleView[]; onChange: () => void }) {
  if (rules.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay reglas.</p>;
  return (
    <div className="flex flex-col gap-6">
      {groupRules(rules).map(([source, items]) => (
        <section key={source}>
          <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">{GROUP_LABEL[source] ?? source}</h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {items.map((r) => <RuleRow key={r.id} rule={r} onChange={onChange} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
