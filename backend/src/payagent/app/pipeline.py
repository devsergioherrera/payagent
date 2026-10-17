import logging

from payagent.app.explain import decision_prompt, template_explanation
from payagent.app.process_invoice import AlreadyProcessed, ProcessedInvoice, StoredDocument
from payagent.domain.decision import Decision, HitResult, Outcome
from payagent.domain.engine import evaluate
from payagent.domain.invoice import ExtractedInvoice
from payagent.domain.rule import ColumnRef, Effect
from payagent.ports.extractor import Explainer, Extractor
from payagent.ports.repositories import Decisions, Invoices, Operations

log = logging.getLogger(__name__)

UNREADABLE = ExtractedInvoice(None, None, None, None, None, None, None, None, None, confidence=0.0)


class AgentPipeline:
    """Extract -> decide under the global lock -> explain. The LLM never touches the decision."""

    def __init__(
        self,
        invoices: Invoices,
        operations: Operations,
        decisions: Decisions,
        extractor: Extractor,
        explainer: Explainer,
    ) -> None:
        self.invoices = invoices
        self.operations = operations
        self.decisions = decisions
        self.extractor = extractor
        self.explainer = explainer

    def run(self, stored: StoredDocument, invoice_id: str | None = None) -> ProcessedInvoice:
        """`invoice_id`: the caller already created the row (the API answers before the pipeline ends)."""
        if invoice_id is None:
            invoice_id = self.invoices.create(stored.doc, stored.sha256, str(stored.path))
        if invoice_id is None:
            # Same file again: only a document we could not read gets a new attempt (a new operation).
            invoice_id = self.invoices.retryable(stored.sha256)
            if invoice_id is None:
                raise AlreadyProcessed(stored.sha256)
        operation_id = self.operations.start("PROCESS_INVOICE", invoice_id)
        try:
            result = self._decide(invoice_id, operation_id, stored)
        except Exception as exc:
            self.invoices.set_status(invoice_id, "FAILED", str(exc))
            self.operations.finish(operation_id, str(exc))
            raise
        self.operations.finish(operation_id)
        return result

    def _decide(self, invoice_id: str, operation_id: str, stored: StoredDocument) -> ProcessedInvoice:
        self.invoices.set_status(invoice_id, "EXTRACTING")
        read_error = None
        try:
            extracted = self.extractor.extract(stored.doc.content, stored.doc.content_type, operation_id)
        except Exception as exc:
            # An unreadable document still goes through the rules: every field is NULL, so it escalates.
            log.exception("extraction failed for invoice %s", invoice_id)
            extracted, read_error = UNREADABLE, f"No se pudo leer el documento: {exc}"[:500]
        self.invoices.save_extraction(invoice_id, extracted)

        self.invoices.set_status(invoice_id, "EVALUATING")
        with self.decisions.session() as session:
            rules = session.active_rules()
            sources = {"invoice"}.union(*(r.sources() for r in rules))
            facts = session.load_facts(invoice_id, sources)
            decision = evaluate(rules, facts)
            explanation = template_explanation(decision)
            decision_id = session.save_decision(invoice_id, operation_id, decision, explanation)
        self.invoices.set_status(invoice_id, "DECIDED", read_error)

        try:
            explanation = self.explainer.explain(decision_prompt(decision, _summary(extracted)), operation_id)
            self.invoices.set_explanation(decision_id, explanation, "LLM")
        except Exception:
            log.exception("explainer failed; keeping the template explanation")

        return ProcessedInvoice(
            invoice_id=invoice_id,
            outcome=decision.outcome,
            explanation=explanation,
            vendor=extracted.vendor_name_raw,
            amount=str(extracted.amount) if extracted.amount is not None else None,
            currency=extracted.currency,
            amount_usd=_text(facts.value(ColumnRef("invoice", "amount_usd"))),
            rule=_deciding_rule(decision),
        )


def _text(value: object) -> str | None:
    return None if value is None else str(value)


def _deciding_rule(decision: Decision) -> str | None:
    effect = {Outcome.HOLD: Effect.HOLD, Outcome.ESCALATE: Effect.ESCALATE}.get(decision.outcome)
    return next(
        (h.rule_name for h in decision.hits if h.effect is effect and h.result in (HitResult.FIRED, HitResult.MISSING_DATA)),
        None,
    )


def _summary(x: ExtractedInvoice) -> str:
    return (
        f"{x.vendor_name_raw or 'proveedor sin nombre'}, factura {x.invoice_number or 'sin número'}, "
        f"{x.amount if x.amount is not None else 'monto ilegible'} {x.currency or ''}"
    ).strip()
