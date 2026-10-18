from fastapi import APIRouter, Depends, HTTPException

from payagent.adapters.postgres import PostgresRules
from payagent.adapters.postgres.queries import ApiQueries, NotFound
from payagent.api.deps import get_drafter, get_queries, get_rules
from payagent.api.schemas import DraftRequest, DraftResponse, ReviseRequest, RuleCreate, RuleSourceView, RuleView
from payagent.app.rule_context import invoice_context, revision_context
from payagent.config import settings
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator

router = APIRouter()


@router.get("/rules")
def list_rules(queries: ApiQueries = Depends(get_queries)) -> list[RuleView]:
    return queries.rule_views()


@router.post("/rules/draft")
def draft_rule(
    body: DraftRequest, drafter=Depends(get_drafter), queries: ApiQueries = Depends(get_queries)
) -> DraftResponse:
    context = None
    if body.invoice_id:
        try:
            context = invoice_context(queries.invoice_detail(body.invoice_id))
        except NotFound:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
    try:
        return drafter.draft(body.text, context=context)
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Redactar reglas aún no está disponible")


@router.post("/rules/{rule_id}/revise")
def revise_rule(
    rule_id: str, body: ReviseRequest, drafter=Depends(get_drafter), queries: ApiQueries = Depends(get_queries)
) -> DraftResponse:
    found = queries.rule_views(rule_id)
    if not found:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return drafter.draft(body.instruction, context=revision_context(found[0]))


@router.post("/rules")
def create_rule(
    body: RuleCreate, rules: PostgresRules = Depends(get_rules), queries: ApiQueries = Depends(get_queries)
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
    if body.replaces_rule_id and not queries.rule_views(body.replaces_rule_id):
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    try:
        rule_id = rules.create_rule(
            name=body.name, natural_language=body.natural_language, effect=Effect(body.effect),
            overridable=body.overridable, conditions=conditions, origin="HUMAN",
            proposed_by=settings.admin_name, approved_by=settings.admin_name,
            replaces_rule_id=body.replaces_rule_id,
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


@router.post("/rules/{rule_id}/activate")
def activate_rule(
    rule_id: str, rules: PostgresRules = Depends(get_rules), queries: ApiQueries = Depends(get_queries)
) -> RuleView:
    if not queries.rule_views(rule_id):
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    rules.activate(rule_id)
    return queries.rule_views(rule_id)[0]


@router.get("/rule-sources")
def rule_sources(queries: ApiQueries = Depends(get_queries)) -> list[RuleSourceView]:
    return queries.rule_sources()
