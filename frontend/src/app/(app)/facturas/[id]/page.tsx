"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OutcomeBadge } from "@/components/outcome-badge";
import { isProcessing as isProcessingStatus, money, shortDate, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Hit, Value } from "@/lib/api-types";

const EFFECT_TEXT = { ESCALATE: "text-escalate", HOLD: "text-hold", ALLOW: "text-pay" } as const;
const EFFECT_SOFT = { ESCALATE: "bg-escalate-soft text-escalate", HOLD: "bg-hold-soft text-hold", ALLOW: "bg-pay-soft text-pay" } as const;
const EFFECT_LABEL = { ESCALATE: "Escala", HOLD: "Frena", ALLOW: "Permite" } as const;
const COLUMN: Record<string, string> = {
  amount_usd: "monto en USD", amount: "monto", status: "estado del proveedor", bank_account: "cuenta bancaria",
  tax_id: "NIT", duplicada: "duplicada", orden_encontrada: "orden encontrada",
};

function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function fmt(v: Value | undefined) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") return new Intl.NumberFormat("es-CO").format(v);
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function hitDetail(hit: Hit) {
  return Object.keys(hit.observed).map((k) => {
    const name = COLUMN[k.split(".").pop() ?? k] ?? (k.split(".").pop() ?? k).replaceAll("_", " ");
    return `${name[0].toUpperCase()}${name.slice(1)}: ${fmt(hit.observed[k])}, umbral ${fmt(hit.threshold[k])}`;
  }).join(" · ");
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm tabular-nums">{value}</dd>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, error, refresh } = usePolling(() => api.invoice(id), 3000);
  const [note, setNote] = useState("");
  const [showPassed, setShowPassed] = useState(false);
  const [resolve, setResolve] = useState<{ busy: boolean; ok: boolean; message: string }>({ busy: false, ok: false, message: "" });

  const handleResolve = async (verdict: "APPROVED" | "REJECTED") => {
    if (verdict === "REJECTED" && !note.trim()) {
      setResolve({ busy: false, ok: false, message: "El motivo es obligatorio si rechazas." });
      return;
    }
    setResolve({ busy: true, ok: false, message: "" });
    try {
      await api.resolve(id, { verdict, note: note || null });
      setResolve({ busy: false, ok: true, message: verdict === "APPROVED" ? "Factura aprobada." : "Factura rechazada." });
      setNote("");
      refresh();
    } catch {
      setResolve({ busy: false, ok: false, message: "No se pudo registrar la decisión." });
    }
  };

  if (error) return <p className="rounded-2xl border bg-card p-5 text-sm text-destructive">No se pudo cargar la factura.</p>;
  if (!invoice) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-80 max-w-full" />
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
          <div className="space-y-5"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>
        </div>
      </div>
    );
  }

  const { summary, extracted, hits, timeline, cost, file_url, approval } = invoice;
  const pendingHuman = summary.decision_status === "PENDING_HUMAN";
  const processing = isProcessingStatus(summary.status);
  const decisive = hits.find((h) => h.result === "FIRED" || h.result === "MISSING_DATA");
  const active = hits.filter((h) => h.result === "FIRED" || h.result === "MISSING_DATA");
  const passed = hits.filter((h) => h.result === "PASSED");
  const skipped = hits.filter((h) => h.result === "OVERRIDDEN" || h.result === "NOT_APPLICABLE");
  const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link href="/facturas" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" /> Facturas
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
            {summary.invoice_number ?? "Factura"} · {extracted.vendor_name_raw ?? summary.vendor_name ?? "Proveedor sin leer"}
          </h1>
          {summary.outcome && <OutcomeBadge outcome={summary.outcome} />}
          <span className="ml-auto text-xl font-semibold tabular-nums">{money(summary.amount, summary.currency ?? "USD")}</span>
        </div>
      </div>

      {processing && (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 text-sm">
          <span className="size-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          El agente está leyendo y evaluando esta factura.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Panel
            title="Documento original"
            aside={file_url && !useMocks && (
              <a href={file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Abrir <ExternalLink className="size-3" />
              </a>
            )}
          >
            {file_url && !useMocks ? (
              <iframe src={file_url} title="Documento original" className="h-96 w-full rounded-xl border bg-background" />
            ) : (
              <div className="grid h-48 place-items-center rounded-xl bg-secondary text-sm text-muted-foreground">Documento no disponible</div>
            )}
          </Panel>

          <Panel title="Datos extraídos por el agente">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Proveedor" value={extracted.vendor_name_raw ?? "—"} />
              <Field label="NIT" value={extracted.vendor_tax_id ?? "—"} />
              <Field label="N.º factura" value={extracted.invoice_number ?? "—"} />
              <Field label="Monto" value={money(extracted.amount, extracted.currency ?? "USD")} />
              <Field label="Monto en USD" value={money(extracted.amount_usd, "USD")} />
              <Field label="Tasa a USD" value={extracted.fx_rate ?? "—"} />
              <Field label="Emisión" value={shortDate(extracted.issue_date)} />
              <Field label="Vence" value={shortDate(extracted.due_date)} />
              <Field label="Orden de compra" value={extracted.po_number ?? "—"} />
              <Field label="Cuenta bancaria" value={extracted.bank_account ?? "—"} />
              <Field label="Moneda original" value={extracted.currency ?? "—"} />
              <Field label="Confianza de lectura" value={extracted.confidence != null ? `${Math.round(extracted.confidence * 100)} %` : "—"} />
            </dl>
          </Panel>
        </div>

        <div className="space-y-5">
          {pendingHuman && (
            <Panel title="Tu decisión" className="border-brand/40">
              <label htmlFor="resolve-note" className="mb-2 block text-xs text-muted-foreground">Motivo (obligatorio si rechazas)</label>
              <textarea
                id="resolve-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Explica tu decisión"
                className="block w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {resolve.message && <p className={cn("mt-3 text-sm", resolve.ok ? "text-pay" : "text-destructive")}>{resolve.message}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-9" disabled={resolve.busy} onClick={() => handleResolve("REJECTED")}>Rechazar</Button>
                <Button className="h-9 bg-brand text-brand-foreground hover:bg-brand/90" disabled={resolve.busy} onClick={() => handleResolve("APPROVED")}>Aprobar</Button>
              </div>
            </Panel>
          )}

          {!pendingHuman && approval && (
            <Panel title="Decisión registrada">
              <p className="text-sm">
                {approval.verdict === "APPROVED" ? "Aprobada" : "Rechazada"} por {approval.approver} · {time(approval.created_at)}
              </p>
              {approval.note && <p className="mt-1 text-[13px] text-muted-foreground">Motivo: {approval.note}</p>}
            </Panel>
          )}

          <Panel title="Regla decisiva" aside={decisive && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", EFFECT_SOFT[decisive.effect])}>{decisive.result === "FIRED" ? "Disparada" : "Falta un dato"}</span>}>
            {decisive ? (
              <>
                <p className={cn("text-sm font-medium", EFFECT_TEXT[decisive.effect])}>{decisive.rule_name}</p>
                {invoice.explanation && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{invoice.explanation}</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{processing ? "Aún sin evaluar." : "Ninguna regla se disparó."}</p>
            )}
          </Panel>

          {!processing && timeline.length > 0 && (
            <Panel title="Trazabilidad" aside={<span className="text-xs text-muted-foreground">{timeline.length} pasos</span>}>
              <ol className="space-y-4">
                {timeline.map((s, i) => (
                  <li key={`${s.at}-${i}`} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.label}</p>
                      {s.detail && <p className="text-[13px] text-muted-foreground">{s.detail}</p>}
                      <p className="text-xs tabular-nums text-muted-foreground">{time(s.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {!processing && hits.length > 0 && (
            <Panel title="Reglas aplicadas">
              <ul className="space-y-4">
                {active.map((h) => (
                  <li key={h.rule_id} className="flex items-start gap-3">
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", h.result === "FIRED" ? EFFECT_SOFT[h.effect] : "bg-secondary text-muted-foreground")}>
                      {h.result === "FIRED" ? EFFECT_LABEL[h.effect] : "Falta dato"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{h.rule_name}</p>
                      <p className="text-[13px] text-muted-foreground">{hitDetail(h) || "Sin datos para evaluar"}</p>
                    </div>
                  </li>
                ))}
                {skipped.map((h) => (
                  <li key={h.rule_id} className="text-[13px] text-muted-foreground">
                    {h.rule_name} · {h.result === "OVERRIDDEN" ? "anulada por excepción" : "no aplica"}
                  </li>
                ))}
              </ul>
              {passed.length > 0 && (
                <div className={cn(active.length + skipped.length > 0 && "mt-4 border-t pt-3")}>
                  <button onClick={() => setShowPassed((v) => !v)} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                    <ChevronDown className={cn("size-3.5 transition-transform", showPassed && "rotate-180")} />
                    {passed.length} {passed.length === 1 ? "regla cumple" : "reglas cumplen"}
                  </button>
                  {showPassed && (
                    <ul className="mt-3 space-y-3">
                      {passed.map((h) => (
                        <li key={h.rule_id}>
                          <p className="text-sm">{h.rule_name}</p>
                          <p className="text-xs text-muted-foreground">{hitDetail(h)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Panel>
          )}

          {cost && (
            <p className="px-1 text-xs text-muted-foreground">
              Esta operación costó <span className="font-medium tabular-nums text-foreground">{money(cost.cost_usd, "USD")}</span> y {(cost.duration_ms / 1000).toFixed(1)} s.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
