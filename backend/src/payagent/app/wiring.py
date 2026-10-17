from google import genai

from payagent.adapters.gemini.explainer import GeminiExplainer
from payagent.adapters.gemini.extractor import GeminiExtractor
from payagent.adapters.postgres import (
    PostgresDecisions,
    PostgresFeedbackLog,
    PostgresInvoices,
    PostgresOperations,
    PostgresProposals,
    PostgresRuleCatalog,
    PostgresRules,
    PostgresUsageMeter,
)
from payagent.app.pipeline import AgentPipeline
from payagent.app.propose_rules import ProposalService
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


def build_proposals() -> ProposalService:
    client = genai.Client(api_key=settings.gemini_api_key)
    return ProposalService(
        client=client,
        feedback=PostgresFeedbackLog(),
        operations=PostgresOperations(),
        meter=PostgresUsageMeter(),
        catalog=PostgresRuleCatalog(),
        rules=PostgresRules(),
        proposals=PostgresProposals(),
    )
