from fastapi import APIRouter, Depends, HTTPException

from payagent.adapters.postgres import PostgresRules
from payagent.adapters.postgres.queries import ApiQueries
from payagent.api.deps import get_drafter, get_queries, get_rules
from payagent.api.schemas import DraftRequest, DraftResponse, RuleDraft, RuleSourceView, RuleView
from payagent.config import settings
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator

router = APIRouter()


@router.get("/rules")
def list_rules(queries: ApiQueries = Depends(get_queries)) -> list[RuleView]:
    return queries.rule_views()


@router.post("/rules/draft")
def draft_rule(body: DraftRequest, drafter=Depends(get_drafter)) -> DraftResponse:
    try:
        return drafter.draft(body.text)
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Redactar reglas aún no está disponible")


@router.post("/rules")
def create_rule(
    body: RuleDraft, rules: PostgresRules = Depends(get_rules), queries: ApiQueries = Depends(get_queries)
) -> RuleView:
    conditions = [
        Condition(
            left=ColumnRef(c.source, c.column),
            operator=Operator(c.operator),
            value=c.value,
            value_ref=ColumnRef(c.value_source, c.value_column) if c.value_source and c.value_column else None,
        )
        for c in body.conditions
    ]
    try:
        rule_id = rules.create_rule(
            name=body.name, natural_language=body.natural_language, effect=Effect(body.effect),
            overridable=body.overridable, conditions=conditions, origin="HUMAN",
            proposed_by=settings.admin_name, approved_by=settings.admin_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return queries.rule_views(rule_id)[0]


@router.post("/rules/{rule_id}/deactivate")
def deactivate_rule(
    rule_id: str, rules: PostgresRules = Depends(get_rules), queries: ApiQueries = Depends(get_queries)
) -> RuleView:
    if not queries.rule_views(rule_id):
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    rules.deactivate(rule_id)
    return queries.rule_views(rule_id)[0]


@router.get("/rule-sources")
def rule_sources(queries: ApiQueries = Depends(get_queries)) -> list[RuleSourceView]:
    return queries.rule_sources()
