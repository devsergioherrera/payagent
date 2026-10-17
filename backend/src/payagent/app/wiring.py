from google import genai

from payagent.adapters.email.smtp_notifier import SmtpNotifier
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
from payagent.adapters.postgres.vendors import search_vendors
from payagent.adapters.upload.storage import FileStorage
from payagent.app.draft_rule import RuleDrafter
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


def build_storage() -> FileStorage:
    return FileStorage(settings.storage_dir)


def build_notifier() -> SmtpNotifier:
    return SmtpNotifier(settings.gmail_address, settings.gmail_app_password, settings.approver_email)


def build_drafter() -> RuleDrafter:
    return RuleDrafter(
        client=genai.Client(api_key=settings.gemini_api_key),
        catalog=PostgresRuleCatalog(),
        meter=PostgresUsageMeter(),
        operations=PostgresOperations(),
        find_vendors=search_vendors,
    )


def build_proposals() -> ProposalService:
    return ProposalService(
        client=genai.Client(api_key=settings.gemini_api_key),
        feedback=PostgresFeedbackLog(),
        operations=PostgresOperations(),
        meter=PostgresUsageMeter(),
        catalog=PostgresRuleCatalog(),
        rules=PostgresRules(),
        proposals=PostgresProposals(),
    )
