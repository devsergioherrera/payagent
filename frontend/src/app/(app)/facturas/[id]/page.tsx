"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, FileText, ScanText } from "lucide-react";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Skeleton } from "@/components/ui/skeleton";
import { costUsd, dayTime, duration, isProcessing as isProcessingStatus, money, shortDate } from "@/lib/format";
import { Section } from "@/components/facturas/section";
import { Verdict } from "@/components/facturas/verdict";
import { CreateRuleButton, HoldCallout } from "@/components/facturas/rule-callout";
import { DocumentView, OpenLink } from "@/components/facturas/document";
import { Rules } from "@/components/facturas/rules";
import { Decision } from "@/components/facturas/decision";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
        <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
      </div>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, error, refresh } = usePolling(() => api.invoice(id), 3000);

  if (error) return <p className="rounded-2xl border bg-card p-5 text-sm text-destructive">No se pudo cargar la factura.</p>;
  if (!invoice) return <LoadingState />;

  const { summary, extracted, hits, cost, file_url, approval } = invoice;
  const pendingHuman = summary.outcome === "ESCALATE" && summary.decision_status === "PENDING_HUMAN";
  const processing = isProcessingStatus(summary.status);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/facturas" aria-label="Volver a facturas" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 text-lg leading-tight sm:truncate font-semibold tracking-tight sm:text-2xl">
          {summary.invoice_number ?? "Factura"} · {extracted.vendor_name_raw ?? summary.vendor_name ?? "Proveedor sin leer"}
        </h1>
        <span className="shrink-0 text-xl font-semibold tabular-nums">{money(summary.amount, summary.currency ?? "USD")}</span>
        {summary.outcome === "PAY" && <span className="hidden sm:block"><CreateRuleButton id={id} /></span>}
      </div>

      <Verdict invoice={invoice} processing={processing} />
      {summary.outcome === "HOLD" && <HoldCallout id={id} />}

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-5">
          <Section title="Documento original" icon={FileText} aside={file_url ? <OpenLink url={file_url} /> : undefined} bodyClassName="p-3">
            <div className="h-[190px]">{file_url && <DocumentView url={file_url} />}</div>
          </Section>

          <Section title="Datos extraídos" icon={ScanText} >
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
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
          </Section>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {pendingHuman && <Decision id={id} onDone={refresh} />}
          {!pendingHuman && approval && (
            <p className="rounded-2xl border bg-card px-4 py-3 text-[13px] text-muted-foreground">
              {approval.verdict === "APPROVED" ? "Aprobada" : "Rechazada"} por {approval.approver} · {dayTime(approval.created_at)}
              {approval.note && ` · «${approval.note}»`}
            </p>
          )}
          {!processing && hits.length > 0 && <Rules hits={hits} />}
        </div>
      </div>

      {summary.outcome === "PAY" && <div className="sm:hidden"><CreateRuleButton id={id} /></div>}

      {cost && (
        <p className="px-1 pb-2 pt-1 text-xs tabular-nums text-muted-foreground">
          Operación: {costUsd(cost.cost_usd)} · {duration(cost.duration_ms)} · {new Intl.NumberFormat("es-CO").format(cost.input_tokens + cost.output_tokens)} tokens
        </p>
      )}
    </div>
  );
}
