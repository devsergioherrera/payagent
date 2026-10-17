from typing import Protocol

from payagent.domain.invoice import ExtractedInvoice


class Extractor(Protocol):
    def extract(self, content: bytes, content_type: str, operation_id: str) -> ExtractedInvoice:
        """Read a PDF, image or plain text invoice. Raises on failure; the caller escalates."""
        ...


class Explainer(Protocol):
    def explain(self, facts_for_prompt: str, operation_id: str) -> str:
        """At most 3 sentences in Spanish, written only from the decision's hits. Raises on failure."""
        ...
