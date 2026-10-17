"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { RuleView, ProposalView, RuleDraft, ConditionView, Effect } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { OutcomeBadge } from "@/components/outcome-badge";
import { format } from "@/lib/format";
import { Sparkles, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReglasPage() {
  const [rules, setRules] = useState<RuleView[]>([]);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [rulesData, proposalsData] = await Promise.all([
        api.rules(),
        api.proposals(),
      ]);
      setRules(rulesData);
      setProposals(proposalsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  // Fetch rules and proposals on mount
  useEffect(() => {
    fetchData();
  }, []);
    try {
      const [rulesData, proposalsData] = await Promise.all([
        api.rules(),
        api.proposals(),
      ]);
      setRules(rulesData);
      setProposals(proposalsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const handleDraftRule = async () => {
    if (!composerText.trim()) return;
    setDraftError(null);
    try {
      const response = await api.draftRule(composerText);
      if (response.error) {
        setDraftError(response.error);
        setDraft(null);
      } else if (response.draft) {
        setDraft(response.draft);
        setDraftError(null);
      }
    } catch (error) {
      setDraftError("Error al borrador de regla");
      setDraft(null);
    }
  };

  const handleCreateRule = async () => {
    if (!draft) return;
    try {
      await api.createRule(draft);
      setDraft(null);
      setComposerText("");
      // Refresh rules
      const updatedRules = await api.rules();
      setRules(updatedRules);
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const handleDiscardDraft = () => {
    setDraft(null);
    setDraftError(null);
    setComposerText("");
  };

  const handleRunProposals = async () => {
    setIsGeneratingProposals(true);
    try {
      await api.runProposals();
      // Refresh proposals and rules
      const [proposalsData, rulesData] = await Promise.all([
        api.proposals(),
        api.rules(),
      ]);
      setProposals(proposalsData);
      setRules(rulesData);
    } catch (error) {
      console.error("Failed to run proposals:", error);
    } finally {
      setIsGeneratingProposals(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await api.acceptProposal(proposalId);
      // Refresh data
      const [proposalsData, rulesData] = await Promise.all([
        api.proposals(),
        api.rules(),
      ]);
      setProposals(proposalsData);
      setRules(rulesData);
    } catch (error) {
      console.error("Failed to accept proposal:", error);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await api.rejectProposal(proposalId);
      // Refresh proposals
      const proposalsData = await api.proposals();
      setProposals(proposalsData);
    } catch (error) {
      console.error("Failed to reject proposal:", error);
    }
  };

  const handleDeactivateRule = async (ruleId: string) => {
    setDeactivateConfirmation(false);
    setActiveRuleId(ruleId);
    setIsDeactivating(true);
    try {
      await api.deactivateRule(ruleId);
      // Refresh rules
      const updatedRules = await api.rules();
      setRules(updatedRules);
    } catch (error) {
      setDeactivateError("Error al desactivar regla");
      console.error("Failed to deactivate rule:", error);
    } finally {
      setIsDeactivating(false);
    }
  };

  // Group rules by first condition's source label
  const groupedRules = rules.reduce((acc, rule) => {
    const firstCondition = rule.conditions[0];
    let groupLabel = firstCondition.source;
    
    // Map source to display label as per specs
    switch (firstCondition.source) {
      case "vendor":
        groupLabel = "Proveedor";
        break;
      case "invoice":
        groupLabel = "Montos (invoice)";
        break;
      case "validation":
        groupLabel = "Validaciones";
        break;
      case "po_check":
        groupLabel = "Cruce con la orden";
        break;
      case "budget":
        groupLabel = "Presupuesto";
        break;
      default:
        groupLabel = firstCondition.source;
    }
    
    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(rule);
    return acc;
  }, {} as Record<string, RuleView[]>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Reglas</h1>
        <p className="text-sm text-muted-foreground">
          El agente decide con estas reglas. Escríbelas como se las dirías a una persona.
        </p>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={handleRunProposals}
          disabled={isGeneratingProposals}
        >
          {isGeneratingProposals ? "Revisando..." : "Proponer reglas"}
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>

      {/* Composer Card */}
      <Card>
        <CardHeader>
          <CardTitle>Composer</CardTitle>
          <CardDescription>
            Ej.: no paguen más de 5 mil dólares sin que yo apruebe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!draft ? (
            <>
              <Textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Escribe tu regla en lenguaje natural..."
                className="h-20"
              />
              {draftError && (
                <p className="mt-2 text-sm text-destructive">{draftError}</p>
              )}
              <Button
                onClick={handleDraftRule}
                className="mt-2"
                disabled={!composerText.trim()}
              >
                Traducir
              </Button>
            </>
          ) : (
            <>
              {draft && (
                <>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{draft.name}</span>
                      {draft.overridable && (
                        <span className="text-xs text-muted-foreground">
                          (se puede anular con una excepción)
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draft.conditions.map((condition, index) => (
                        <span key={index} className="bg-muted rounded px-2 py-0.5 text-xs">
                          {condition.text}
                        </span>
                  ))
                    <div className="mt-2">
                      <span className="text-xs font-medium">
                        Effect:
                      </span>{" "}
                      <OutcomeBadge
                        outcome={draft.effect === "ALLOW" ? "PAY" : draft.effect === "ESCALATE" ? "ESCALATE" : "HOLD"}
                        className="ml-1"
                      />
                    </div>
                  </div>
                </div>
            </>
          )
        </>
      </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleDiscardDraft}
                      className="text-sm"
                    >
                      Descartar
                    </Button>
                    <Button
                      onClick={handleCreateRule}
                      className="mt-0"
                    >
                      Confirmar regla
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )
        </>
      )
                    <Button
                      variant="outline"
                      onClick={handleDiscardDraft}
                      className="text-sm"
                    >
                      Descartar
                    </Button>
                    <Button
                      onClick={handleCreateRule}
                      className="mt-0"
                    >
                      Confirmar regla
                    </Button>
                  </div>
                </>
              )}
            </>
          )
          </CardContent>
        </Card>
      )
      {/* Propuestas del agente */}
      {proposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Propuestas del agente</CardTitle>
          </CardHeader>
          <CardContent>
            {proposals.map((proposal) => (
              <div key={proposal.id} className="mb-4 pb-4 border-b">
                <div className="mb-2">
                  <div className="font-medium">{proposal.draft.name}</div>
                  <div className="text-sm text-muted-foreground">{proposal.rationale}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {proposal.draft.conditions.map((condition, index) => (
                    <span key={index} className="bg-muted rounded px-2 py-0.5 text-xs">
                      {condition.text}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <span className="text-xs font-medium">Effect: </span>
                  <OutcomeBadge
                    outcome={
                      proposal.draft.effect === "ALLOW"
                        ? "PAY"
                        : proposal.draft.effect === "ESCALATE"
                        ? "ESCALATE"
                        : "HOLD"
                    }
                    className="ml-1"
                  />
                </div>
                <div className="mt-2">
                  Evidencia:&nbsp;
                  {proposal.evidence.map((invoice, idx) => (
                    <span
                      key={idx}
                      className="text-sm font-medium underline underline-offset-2 hover:text-primary"
                    >
                      Factura {invoice.id}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleRejectProposal(proposal.id)}
                    className="text-sm"
                  >
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => handleAcceptProposal(proposal.id)}
                  >
                    Aceptar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )
      {/* Rule List */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4">Lista de reglas</h2>
        {Object.keys(groupedRules).length === 0 ? (
          <p className="text-muted-foreground">No hay reglas aún.</p>
        ) : (
          <>
            {Object.keys(groupedRules).map((groupLabel) => (
              <div key={groupLabel} className="mb-6">
                <h3 className="text-lg font-medium mb-3">{groupLabel}</h3>
                <div className="space-y-3">
                  {groupedRules[groupLabel].map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onDeactivate={handleDeactivateRule}
                      isDeactivating={isDeactivating && activeRuleId === rule.id}
                      deactivateError={deactivateError}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onDeactivate,
  isDeactivating,
  deactivateError,
}: {
  rule: RuleView;
  onDeactivate: (ruleId: string) => Promise<void>;
  isDeactivating: boolean;
  deactivateError: string | null;
}) {
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);

  const handleDeactivateClick = () => {
    setIsConfirmingDeactivate(true);
  };

  const handleConfirmDeactivate = async () => {
    setIsConfirmingDeactivate(false);
    await onDeactivate(rule.id);
  };

  const handleCancelDeactivate = () => {
    setIsConfirmingDeactivate(false);
  };

  // Determine origin and approval text
  const originText =
    rule.origin === "HUMAN"
      ? `Escrita por ${rule.proposed_by} · aprobada por ${rule.approved_by}, ${new Date(
          rule.approved_at
        ).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : `Propuesta por el agente · aprobada por ${rule.approved_by}, ${new Date(
          rule.approved_at
        ).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`
          minute: "2-digit",
        })}`

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium">{rule.name}</h3>
            <p className="text-sm text-muted-foreground">
              "{rule.natural_language}"
            </p>
          </div>
          {rule.active ? (
            <Switch
              checked={rule.active}
              onCheckedChange={handleDeactivateClick}
              disabled={isDeactivating}
              className="ml-4"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Inactiva</span>
          )}
        </div>
        
        {/* Condition chips */}
        <div className="mb-3 flex flex-wrap gap-2">
          {rule.conditions.map((condition, index) => (
            <span key={index} className="bg-muted rounded px-2 py-0.5 text-xs">
              {condition.text}
            </span>
          ))}
        </div>
        
        {/* Effect badge */}
        <div className="mb-3 flex items-start gap-2">
          <span className="text-xs font-medium">Effect: </span>
          <OutcomeBadge
            outcome={
              rule.effect === "ALLOW"
                ? "PAY"
                : rule.effect === "ESCALATE"
                ? "ESCALATE"
                : "HOLD"
            }
            className="ml-1"
          />
        </div>
        
        {/* Origin and approval */}
        <div className="mb-3 text-xs text-muted-foreground">
          {originText}
        </div>
        
        {/* Times fired */}
        <div className="mb-3 text-xs text-muted-foreground">
          Se disparó {rule.times_fired} veces
        </div>
        
        {/* Deactivation confirmation dialog */}
        {isConfirmingDeactivate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Dialog>
              <DialogTrigger asChild>
                <div />
              </DialogTrigger>
              <DialogContent className="bg-background rounded-lg p-6 w-96">
                <DialogHeader>
                  <DialogTitle>Desactivar regla</DialogTitle>
                  <DialogDescription>
                    La regla queda en el historial y deja de aplicarse
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <p className="mb-4">
                    ¿Estás seguro de que deseas desactivar la regla '<strong>{rule.name}</strong>'?
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancelDeactivate}
                      className="text-sm"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConfirmDeactivate}
                      className="text-sm"
                      disabled={isDeactivating}
                    >
                      {isDeactivating ? "Desactivando..." : "Desactivar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        
        {/* Deactivation error */}
        {deactivateError && (
          <p className="mt-2 text-sm text-destructive">{deactivateError}</p>
        )}
            )}
          </CardContent>
        </Card>
      }