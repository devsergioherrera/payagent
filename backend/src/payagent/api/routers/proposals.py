from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException

from payagent.api.deps import get_proposals
from payagent.api.schemas import ProposalRun, ProposalView, RuleView
from payagent.app.propose_rules import ProposalRunInProgress, ProposalService
from payagent.config import settings

router = APIRouter(prefix="/proposals")
T = TypeVar("T")


def _call(fn: Callable[[], T]) -> T:
    try:
        return fn()
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Las propuestas de reglas aún no están disponibles")
    except ProposalRunInProgress:
        raise HTTPException(status_code=409, detail="Ya hay una revisión en curso")
    except KeyError:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")


@router.get("")
def list_proposals(status: str = "PENDING", service: ProposalService = Depends(get_proposals)) -> list[ProposalView]:
    return _call(lambda: service.list(status))


@router.post("/run")
def run_proposals(service: ProposalService = Depends(get_proposals)) -> ProposalRun:
    return _call(service.run)


@router.post("/{proposal_id}/accept")
def accept(proposal_id: str, service: ProposalService = Depends(get_proposals)) -> RuleView:
    return _call(lambda: service.accept(proposal_id, settings.admin_name))


@router.post("/{proposal_id}/reject")
def reject(proposal_id: str, service: ProposalService = Depends(get_proposals)) -> ProposalView:
    return _call(lambda: service.reject(proposal_id, settings.admin_name))
