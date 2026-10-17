import logging

from payagent.app.explain import decision_prompt, template_explanation
from payagent.app.process_invoice import ProcessedInvoice, StoredDocument
from payagent.domain.engine import evaluate
from payagent.domain.invoice import ExtractedInvoice
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

    def run(self, stored: StoredDocument) -> ProcessedInvoice:
        invoice_id = self.invoices.create(stored.doc, stored.sha256, str(stored.path))
        if invoice_id is None:
            raise ValueError(f"invoice {stored.sha256[:12]} already exists")
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
        try:
            extracted = self.extractor.extract(stored.doc.content, stored.doc.content_type, operation_id)
        except Exception:
            # An unreadable document still goes through the rules: every field is NULL, so it escalates.
            log.exception("extraction failed for invoice %s", invoice_id)
            extracted = UNREADABLE
        self.invoices.save_extraction(invoice_id, extracted)

        self.invoices.set_status(invoice_id, "EVALUATING")
        with self.decisions.session() as session:
            rules = session.active_rules()
            sources = set().union(*(r.sources() for r in rules)) if rules else set()
            decision = evaluate(rules, session.load_facts(invoice_id, sources))
            explanation = template_explanation(decision)
            decision_id = session.save_decision(invoice_id, operation_id, decision, explanation)

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
        )


def _summary(x: ExtractedInvoice) -> str:
    return (
        f"{x.vendor_name_raw or 'proveedor sin nombre'}, factura {x.invoice_number or 'sin número'}, "
        f"{x.amount if x.amount is not None else 'monto ilegible'} {x.currency or ''}"
    ).strip()
