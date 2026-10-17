"""Natural language -> structured rule (V10). The LLM only drafts; a human confirms with POST /rules."""
from dataclasses import dataclass

from payagent.api.schemas import DraftResponse


@dataclass
class RuleDrafter:
    """Gemini with tools listar_fuentes / describir_fuente / redactar_regla over the RuleCatalog.

    Constructed in app/wiring.py. `draft` opens a RULE_DRAFT operation, meters every LLM call,
    validates the result against the catalog (max 2 retries) and never saves anything.
    """

    def draft(self, text: str) -> DraftResponse:
        raise NotImplementedError
