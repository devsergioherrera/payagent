from collections.abc import Iterator
from contextlib import AbstractContextManager
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Protocol

from payagent.domain.decision import Decision
from payagent.domain.facts import Facts
from payagent.domain.invoice import ExtractedInvoice
from payagent.domain.rule import Rule
from payagent.ports.invoice_source import IncomingDocument

OperationType = Literal["PROCESS_INVOICE", "PROPOSE_RULES", "CHAT", "RULE_DRAFT"]
InvoiceStatus = Literal["RECEIVED", "EXTRACTING", "EVALUATING", "DECIDED", "FAILED"]


class Operations(Protocol):
    def start(self, type: OperationType, invoice_id: str | None = None) -> str: ...

    def finish(self, operation_id: str, error: str | None = None) -> None:
        """DONE when error is None, FAILED otherwise."""
        ...


class Invoices(Protocol):
    def create(self, doc: IncomingDocument, sha256: str, file_path: str) -> str | None:
        """New invoice in RECEIVED. None when the sha256 already exists (idempotency)."""
        ...

    def retryable(self, sha256: str) -> str | None:
        """Id of the invoice for this file if its document could not be read and no human resolved it yet."""
        ...

    def set_status(self, invoice_id: str, status: InvoiceStatus, error: str | None = None) -> None: ...

    def save_extraction(self, invoice_id: str, extracted: ExtractedInvoice) -> None:
        """Store the fields, resolve the vendor (tax_id, then normalized name) and convert to USD."""
        ...

    def set_explanation(self, decision_id: str, text: str, by: Literal["LLM", "TEMPLATE"]) -> None: ...


class DecisionSession(Protocol):
    """One transaction holding the global decision lock: decisions never race for the same budget."""

    def active_rules(self) -> list[Rule]: ...

    def load_facts(self, invoice_id: str, sources: set[str]) -> Facts: ...

    def save_decision(self, invoice_id: str, operation_id: str, decision: Decision, explanation: str) -> str:
        """Persist decision + every hit, explained_by TEMPLATE; returns decision_id. Sets invoice DECIDED."""
        ...


class Decisions(Protocol):
    def session(self) -> AbstractContextManager[DecisionSession]: ...


@dataclass(frozen=True)
class SourceInfo:
    name: str
    label: str
    description: str


@dataclass(frozen=True)
class ColumnInfo:
    name: str
    data_type: Literal["number", "text", "boolean", "date"]
    description: str


class RuleCatalog(Protocol):
    """What the rule-drafting agent may reference: registered sources and their columns."""

    def list_sources(self) -> list[SourceInfo]: ...

    def describe_source(self, name: str) -> list[ColumnInfo]:
        """Columns from information_schema with their COMMENT. Raises KeyError for unknown sources."""
        ...


@dataclass(frozen=True)
class ResolvedCase:
    """A human resolution the feedback loop has not reviewed yet."""

    invoice_id: str
    vendor_name: str | None
    amount_usd: Decimal | None
    outcome: str
    fired_rules: list[str]
    verdict: Literal["APPROVED", "REJECTED"]
    note: str | None


class FeedbackLog(Protocol):
    def unreviewed(self, limit: int = 20) -> Iterator[ResolvedCase]: ...

    def mark_reviewed(self, invoice_ids: list[str], operation_id: str) -> None: ...
