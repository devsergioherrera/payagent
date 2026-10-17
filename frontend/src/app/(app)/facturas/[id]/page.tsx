"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { OutcomeBadge } from "@/components/outcome-badge";
import { money } from "@/lib/format";
import { shortDate } from "@/lib/format";
import { time } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InvoiceDetail } from "@/lib/api-types";
import { Effect } from "@/lib/api-types";
import { HitResult } from "@/lib/api-types";
import { Hit } from "@/lib/api-types";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, error, refresh } = usePolling(() => api.invoice(id), 3000);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveStatus, setResolveStatus] = useState<{
    resolving: boolean;
    success: boolean;
    message: string;
  }>({ resolving: false, success: false, message: "" });

  const handleResolve = async (verdict: "APPROVED" | "REJECTED") => {
    if (verdict === "REJECTED" && !resolveNote.trim()) {
      setResolveStatus({ resolving: false, success: false, message: "El motivo es obligatorio si rechazas" });
      return;
    }

    setResolveStatus({ resolving: true, success: false, message: "" });
    try {
      await api.resolve(id, { verdict, note: resolveNote || null });
      setResolveStatus({ resolving: false, success: true, message: verdict === "APPROVED" ? "Factura aprobada" : "Factura rechazada" });
      setResolveNote("");
      refresh();
    } catch (err) {
      setResolveStatus({ resolving: false, success: false, message: "Error al procesar la decisión" });
    }
  };

  if (error) {
    return (
      <div className="p-6 bg-error/20 rounded-xl text-error">
        Error al cargar la factura: {(error as Error)?.message}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-[24rem] w-full items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const { summary, extracted, hits, timeline, cost, file_url, approval } = invoice;
  const isPendingHuman = summary.decision_status === "PENDING_HUMAN";
  const isDecided = summary.decision_status === "FINAL" || summary.decision_status === "RESOLVED";
  const isProcessing = ![summary.status, "DECIDED", "FAILED"].includes(summary.status);

  // Find the first FIRED or MISSING_DATA hit for the decisive rule
  const decisiveHit = hits.find(
    (hit) => hit.result === "FIRED" || hit.result === "MISSING_DATA"
  );

  // Group hits by result
  const firedHits = hits.filter((hit) => hit.result === "FIRED");
  const missingDataHits = hits.filter((hit) => hit.result === "MISSING_DATA");
  const passedHits = hits.filter((hit) => hit.result === "PASSED");
  const overriddenHits = hits.filter((hit) => hit.result === "OVERRIDDEN");
  const notApplicableHits = hits.filter((hit) => hit.result === "NOT_APPLICABLE");

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Title */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link href="/facturas">
              Facturas
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium">{summary.invoice_number ?? "FV-XXXX"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {summary.invoice_number ?? "FV-XXXX"} · {extracted.vendor_name_raw ?? "Proveedor desconocido"}
          </h1>
        </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Original Document */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Documento original
              </CardTitle>
            </CardHeader>
            <CardContent>
              {file_url ? (
                <>
                  {file_url.toLowerCase().endsWith(".pdf") && (
                    <iframe
                      src={file_url}
                      title="Documento PDF"
                      className="w-full h-48 rounded-md"
                    />
                  )}
                   {file_url.match(/\.(png|jpe?g)$/i) && (
                     <Image
                       src={file_url}
                       alt="Documento"
                       className="w-full h-48 object-contained rounded-md"
                       width={800}
                       height={600}
                     />
                   )}
                  {!file_url.toLowerCase().endsWith(".pdf") && !file_url.match(/\.(png|jpe?g)$/i) && (
                    <div className="flex h-48 items-center justify-center rounded-md border bg-muted">
                      <a href={file_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:underline">
                        Ver documento
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-md border bg-muted">
                  <p className="text-muted-foreground">No hay documento disponible</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Datos extraídos por el agente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-medium">Proveedor</p>
                  <p className="text-muted-foreground">{extracted.vendor_name_raw ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">NIT</p>
                  <p className="text-muted-foreground">{extracted.vendor_tax_id ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">N.º factura</p>
                  <p className="text-muted-foreground tabular-nums">{extracted.invoice_number ?? "—"}</p>
                </div>
                <div>
                   <p className="font-medium">Monto</p>
                   <p className="text-muted-foreground tabular-nums">
                     {money(extracted.amount, extracted.currency || "USD")}
                   </p>
                </div>
                <div>
                  <p className="font-medium">Moneda original</p>
                  <p className="text-muted-foreground">{extracted.currency ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Tasa a USD</p>
                  <p className="text-muted-foreground">
                    {extracted.fx_rate ? `${extracted.fx_rate}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Monto en USD</p>
                  <p className="text-muted-foreground tabular-nums">
                    {money(extracted.amount_usd, "USD")}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Emisión / vence</p>
                  <p className="text-muted-foreground">
                    {shortDate(extracted.issue_date)} / {shortDate(extracted.due_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Orden de compra</p>
                  <p className="text-muted-foreground">{extracted.po_number ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Cuenta bancaria</p>
                  <p className="text-muted-foreground">{extracted.bank_account ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Confianza de lectura</p>
                  <p className="text-muted-foreground">
                    {extracted.confidence !== null ? `${(extracted.confidence * 100).toFixed(0)}%` : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Decisive Rule */}
          {decisiveHit ? (
            <Card className={decisiveHit.effect === "ESCALATE" ? "border-escalate" : decisiveHit.effect === "HOLD" ? "border-hold" : "border-pay"}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Regla decisiva
                   <span className="text-xs">{decisiveHit.result === "FIRED" ? "DISPARADA" : "FALTA UN DATO"}</span>
                </CardTitle>
              </CardHeader>
               <CardContent>
                 <p className="font-medium">{decisiveHit.rule_name}</p>
                 <p className="text-sm text-muted-foreground">{invoice.explanation}</p>
               </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Regla decisiva
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                No se encontró regla decisiva
              </CardContent>
            </Card>
          )}

          {/* Traceability */}
          {!isProcessing && timeline.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Trazabilidad ({timeline.length} pasos)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {timeline.map((step, index) => (
                    <div key={step.at} className="flex items-start space-x-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted flex-shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{step.label}</p>
                        {step.detail && (
                          <p className="text-muted-foreground">{step.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{time(step.at)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Reglas aplicadas
                    {passedHits.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        // Toggle expanded state for passed rules
                        // In a real implementation, we'd use useState
                      }}>
                        {passedHits.length} reglas cumplen
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Fired and Missing Data Hits First */}
                  {[...firedHits, ...missingDataHits].map((hit) => (
                    <div key={hit.rule_id} className="flex items-start space-x-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted flex-shrink-0">
                        <span className="text-xs">{hit.result === "FIRED" ? "!" : "?"}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{hit.rule_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {/* Build observed vs threshold message in plain Spanish */}
                          {buildHitMessage(hit)}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeClass(hit)}`}>
                          {getBadgeText(hit)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Overridden and Not Applicable Hits */}
                   {[...overriddenHits, ...notApplicableHits].map((hit) => (
                     <div key={hit.rule_id} className="flex items-start space-x-2 text-sm text-muted-foreground">
                       <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted flex-shrink-0">
                       </div>
                       <div>
                         <p className="font-medium">{hit.rule_name}</p>
                         <p className="text-muted-foreground">
                           {hit.result === "OVERRIDDEN" ? "Anulada por excepción" : "No aplicable"}
                         </p>
                       </div>
                     </div>
                   ))}
                  
                  {/* Passed Hits (collapsed by default) */}
                   {passedHits.length > 0 && (
                     <div className="border-t pt-2">
                       <p className="text-sm font-medium text-muted-foreground">
                         {passedHits.length} reglas cumplen
                       </p>
                       {/* In a real implementation, these would be expandable */}
                     </div>
                   )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Decision Column */}
          {isPendingHuman && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Tu decisión
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label htmlFor="resolve-note" className="text-sm font-medium mb-1 block">
                 Motivo (obligatorio si rechazas)
               </label>
                <Textarea
                  id="resolve-note"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Explica tu decisión..."
                  className="h-24"
                />
                {resolveStatus.message && (
                  <div className={`px-4 py-2 rounded-md text-sm ${resolveStatus.success ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                    {resolveStatus.message}
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => handleResolve("REJECTED")}
                    disabled={resolveStatus.resolving}
                    className="h-10"
                  >
                    {resolveStatus.resolving ? "Rechazando..." : "Rechazar"}
                  </Button>
                  <Button
                    onClick={() => handleResolve("APPROVED")}
                    disabled={resolveStatus.resolving}
                    className="h-10 bg-pay text-pay hover:bg-pay/90"
                  >
                    {resolveStatus.resolving ? "Aprobando..." : "Aprobar"}
                  </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {!isPendingHuman && approval && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Decisión registrada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="flex items-center space-x-2 text-sm">
                  {approval.verdict === "APPROVED" ? "Aprobada" : "Rechazada"} por {approval.approver} · {time(approval.created_at)}
                   {approval.note && (
                     <span className="mt-1 block text-xs text-muted-foreground">
                       Motivo: {approval.note}
                     </span>
                   )}
                 </p>
               </CardContent>
             </Card>
           )}

          {/* Cost Footer */}
          {cost && (
            <Card className="pt-0">
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Esta operación costó
                  <span className="font-medium">{money(cost.cost_usd, "USD")}</span>
                  y {Math.round(cost.duration_ms / 10) / 100} s
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <Card>
          <CardContent className="flex items-center space-x-4 py-4">
            <div className="flex-1 space-y-2">
              <p className="font-medium">Procesando factura...</p>
              <div className="flex items-center space-x-2">
                {/* In a real implementation, we'd show progress based on timeline steps completed */}
                <div className="h-2 w-32 bg-muted rounded-full">
                  <div className="h-2 w-1/2 bg-primary rounded-full" />
                </div>
                <span className="text-xs text-muted-foreground">50%</span>
              </div>
            </div>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}

// Helper function to build hit message in plain Spanish
function buildHitMessage(hit: Hit): string {
  // This is a simplified implementation
  // In reality, we'd need to compare observed vs threshold values based on the rule conditions
  if (hit.observed.amount && hit.threshold.amount) {
    const observedAmt = hit.observed.amount as number;
    const thresholdAmt = hit.threshold.amount as number;
    const currency = hit.observed.currency as string || "USD";
    
    if (observedAmt > thresholdAmt) {
      return `${money(observedAmt, currency)} supera el límite de ${money(thresholdAmt, currency)}`;
    } else if (observedAmt < thresholdAmt) {
      return `${money(observedAmt, currency)} está por debajo del mínimo de ${money(thresholdAmt, currency)}`;
    } else {
      return `${money(observedAmt, currency)} equals the threshold of ${money(thresholdAmt, currency)}`;
    }
  }
  
  return "Condición no evaluada";
}

// Helper functions for badge styling
function getBadgeClass(hit: Hit): string {
  if (hit.result === "FIRED") {
    switch (hit.effect) {
      case "ESCALATE":
        return "bg-escalate text-escalate";
      case "HOLD":
        return "bg-hold text-hold";
      case "ALLOW":
        return "bg-pay text-pay";
      default:
        return "bg-muted";
    }
  } else if (hit.result === "MISSING_DATA") {
    return "bg-muted";
  }
  return "bg-muted";
}

function getBadgeText(hit: Hit): string {
  if (hit.result === "FIRED") {
    switch (hit.effect) {
      case "ESCALATE":
        return "Escala";
      case "HOLD":
        return "Frena";
      case "ALLOW":
        return "Permite";
      default:
        return "";
    }
  } else if (hit.result === "MISSING_DATA") {
    return "Falta un dato";
  }
  return "";
}