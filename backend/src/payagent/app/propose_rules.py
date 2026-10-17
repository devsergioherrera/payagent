"""Feedback loop (V12): human resolutions -> rule proposals. Never creates active rules by itself."""
from dataclasses import dataclass

from payagent.api.schemas import ProposalRun, ProposalView, RuleView


class ProposalRunInProgress(Exception):
    """Another PROPOSE_RULES operation is RUNNING (unique index). The API answers 409."""


@dataclass
class ProposalService:
    """Constructed in app/wiring.py."""

    def run(self) -> ProposalRun:
        """Start a PROPOSE_RULES operation over the 20 oldest unreviewed resolutions; mark them reviewed
        only if the run succeeds. Raises ProposalRunInProgress."""
        raise NotImplementedError

    def list(self, status: str = "PENDING") -> list[ProposalView]:
        raise NotImplementedError

    def accept(self, proposal_id: str, approver: str) -> RuleView:
        """Create the rule with origin AGENT, proposed_by 'Agente', approved_by `approver`."""
        raise NotImplementedError

    def reject(self, proposal_id: str, approver: str) -> ProposalView:
        raise NotImplementedError
