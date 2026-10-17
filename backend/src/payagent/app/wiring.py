from google import genai

from payagent.adapters.gemini.explainer import GeminiExplainer
from payagent.adapters.gemini.extractor import GeminiExtractor
from payagent.adapters.postgres import (
    PostgresDecisions,
    PostgresInvoices,
    PostgresOperations,
    PostgresRuleCatalog,
    PostgresUsageMeter,
)
from payagent.app.draft_rule import RuleDrafter
from payagent.app.pipeline import AgentPipeline
from payagent.adapters.postgres.vendors import search_vendors
from payagent.config import settings


def build_pipeline() -> AgentPipeline:
    client = genai.Client(api_key=settings.gemini_api_key)
    meter = PostgresUsageMeter()
    return AgentPipeline(
        invoices=PostgresInvoices(),
        operations=PostgresOperations(),
        decisions=PostgresDecisions(),
        extractor=GeminiExtractor(client, meter),
        explainer=GeminiExplainer(client, meter),
    )


def build_drafter() -> RuleDrafter:
    return RuleDrafter(
        client=genai.Client(api_key=settings.gemini_api_key),
        catalog=PostgresRuleCatalog(),
        meter=PostgresUsageMeter(),
        operations=PostgresOperations(),
        find_vendors=search_vendors,
    )
