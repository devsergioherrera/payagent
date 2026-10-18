"""Feedback loop (V12): human resolutions -> rule proposals. Never creates active rules by itself."""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol

from google.genai import types

from payagent.adapters.gemini._call import call_with_retry, record_usage
from payagent.api.schemas import ConditionView, InvoiceSummary, ProposalRun, ProposalView, RuleDraft, RuleView, TraceStep
from payagent.app.rule_text import condition_text, rule_summary
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator, Rule
from payagent.ports.repositories import ColumnInfo, FeedbackLog, Operations, ResolvedCase, RuleCatalog
from payagent.ports.usage import UsageMeter

log = logging.getLogger(__name__)

MIN_PATTERN = 3
MAX_PROPOSALS = 3
REVIEW_BATCH = 20
# The verdict a pattern has decides the only effect that makes sense for it.
EFFECT_FOR_VERDICT = {"APPROVED": Effect.ALLOW, "REJECTED": Effect.HOLD}

SYSTEM = (
    "You help a finance team turn the human decisions on escalated invoices into payment rules. "
    "You get patterns: groups of at least 3 resolved invoices with the same vendor, the same rules "
    "fired and the same verdict. For an APPROVED pattern propose an ALLOW rule scoped as narrowly as "
    "possible: the vendor (vendor.tax_id) plus the condition of the rule that fired, or a higher "
    "threshold for that vendor. For a REJECTED pattern propose a HOLD rule. Propose at most 3 rules "
    "and only for patterns that are given; call proponer_regla once per rule. Use only the sources "
    "and columns listed. Write name, natural_language and rationale in Spanish. Cite the pattern's "
    "invoice ids in evidence_invoice_ids. If nothing deserves a rule, call proponer_regla zero times."
)

TOOL = types.FunctionDeclaration(
    name="proponer_regla",
    description="Propose one rule for a human to review.",
    parameters_json_schema={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "natural_language": {"type": "string", "description": "The rule as a sentence, in Spanish."},
            "effect": {"type": "string", "enum": ["ALLOW", "HOLD"]},
            "overridable": {"type": "boolean"},
            "conditions": {
                "type": "array",
                "description": "Combined with AND.",
                "items": {
                    "type": "object",
                    "properties": {
                        "source": {"type": "string"},
                        "column": {"type": "string"},
                        "operator": {"type": "string", "enum": [o.value for o in Operator]},
                        "value": {
                            "type": "string",
                            "description": "JSON literal: false, 5000, \"841234567\", [0, 90]. Omit for IS_NULL/IS_NOT_NULL.",
                        },
                        "value_source": {"type": "string"},
                        "value_column": {"type": "string"},
                    },
                    "required": ["source", "column", "operator"],
                },
            },
            "rationale": {"type": "string", "description": "Why, in Spanish, citing the evidence."},
            "evidence_invoice_ids": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["name", "natural_language", "effect", "overridable", "conditions", "rationale",
                     "evidence_invoice_ids"],
    },
)


class ProposalRunInProgress(Exception):
    """Another PROPOSE_RULES operation is RUNNING (unique index). The API answers 409."""


class ProposalNotFound(KeyError):
    pass


class ProposalNotPending(ValueError):
    """The proposal was already accepted or rejected. The API answers 409."""


@dataclass(frozen=True)
class NewProposal:
    name: str
    natural_language: str
    effect: Effect
    overridable: bool
    conditions: tuple[Condition, ...]
    rationale: str
    evidence_invoice_ids: tuple[str, ...]


@dataclass(frozen=True)
class StoredProposal:
    id: str
    name: str
    natural_language: str
    effect: Effect
    overridable: bool
    conditions: tuple[Condition, ...]
    rationale: str
    evidence: list[InvoiceSummary]
    status: str
    created_at: datetime
    trace: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class RuleInfo:
    id: str
    name: str
    natural_language: str
    effect: Effect
    overridable: bool
    conditions: tuple[Condition, ...]
    origin: str
    proposed_by: str
    proposed_at: datetime
    approved_by: str
    approved_at: datetime
    active: bool
    times_fired: int


class Proposals(Protocol):
    def vendor_tax_ids(self, invoice_ids: list[str]) -> dict[str, str | None]: ...
    def active_rules(self) -> list[Rule]: ...
    def recently_rejected(self, days: int = 30) -> list[tuple[Condition, ...]]: ...
    def save(self, operation_id: str, proposals: list[NewProposal], reviewed_invoice_ids: list[str]) -> list[str]: ...
    def list(self, status: str) -> list[StoredProposal]: ...
    def get(self, proposal_id: str) -> StoredProposal | None: ...
    def resolve(self, proposal_id: str, status: str, by: str, created_rule_id: str | None = None) -> bool: ...
    def rule_info(self, rule_id: str) -> RuleInfo: ...


class RuleCreator(Protocol):
    def create_rule(self, **kwargs: Any) -> str: ...


@dataclass
class ProposalService:
    """Constructed in app/wiring.py."""

    client: Any
    feedback: FeedbackLog
    operations: Operations
    meter: UsageMeter
    catalog: RuleCatalog
    rules: RuleCreator
    proposals: Proposals
    model: str = "gemini-3.8-flash"

    def run(self) -> ProposalRun:
        """Start a PROPOSE_RULES operation over the 20 oldest unreviewed resolutions; mark them reviewed
        only if the run succeeds. Raises ProposalRunInProgress."""
        try:
            operation_id = self.operations.start("PROPOSE_RULES")
        except Exception as exc:
            if "operation_one_running_proposal" in str(exc):
                raise ProposalRunInProgress from exc
            raise
        try:
            cases = list(self.feedback.unreviewed(REVIEW_BATCH))
            created: list[str] = []
            patterns: list[list[ResolvedCase]] = []
            accepted: list[NewProposal] = []
            discarded = 0
            if cases:
                patterns = find_patterns(cases)
                if patterns:
                    accepted, discarded = self._ask(operation_id, cases, patterns)
                created = self.proposals.save(operation_id, accepted, [c.invoice_id for c in cases])
            trace = build_trace(cases, patterns, accepted, discarded)
            self.operations.finish(operation_id, detail=[{"label": t.label, "detail": t.detail} for t in trace])
        except Exception as exc:
            self.operations.finish(operation_id, error=str(exc)[:500] or type(exc).__name__)
            raise
        by_id = {p.id: p for p in self.proposals.list("PENDING")}
        return ProposalRun(
            operation_id=operation_id,
            reviewed=len(cases),
            created=[self._view(by_id[i]) for i in created if i in by_id],
            trace=trace,
        )

    def learn_from(self, invoice_id: str) -> ProposalRun | None:
        """Called after a human resolves an invoice: review only if that resolution could complete a pattern."""
        cases = list(self.feedback.unreviewed(REVIEW_BATCH))
        if not could_complete_pattern(cases, invoice_id):
            return None
        try:
            return self.run()
        except ProposalRunInProgress:
            return None

    def list(self, status: str = "PENDING") -> list[ProposalView]:
        return [self._view(p) for p in self.proposals.list(status)]

    def accept(self, proposal_id: str, approver: str) -> RuleView:
        """Create the rule with origin AGENT, proposed_by 'Agente', approved_by `approver`."""
        p = self._pending(proposal_id)
        rule_id = self.rules.create_rule(
            name=p.name, natural_language=p.natural_language, effect=p.effect, overridable=p.overridable,
            conditions=p.conditions, origin="AGENT", proposed_by="Agente", approved_by=approver,
        )
        if not self.proposals.resolve(proposal_id, "ACCEPTED", approver, rule_id):
            # Lost a race with another click: do not leave a duplicate active rule behind.
            self.rules.deactivate(rule_id)  # type: ignore[attr-defined]
            raise ProposalNotPending(proposal_id)
        return self._rule_view(self.proposals.rule_info(rule_id))

    def reject(self, proposal_id: str, approver: str) -> ProposalView:
        self._pending(proposal_id)
        if not self.proposals.resolve(proposal_id, "REJECTED", approver):
            raise ProposalNotPending(proposal_id)
        return self._view(self.proposals.get(proposal_id))  # type: ignore[arg-type]

    # -- internals ---------------------------------------------------------------------

    def _pending(self, proposal_id: str) -> StoredProposal:
        p = self.proposals.get(proposal_id)
        if p is None:
            raise ProposalNotFound(proposal_id)
        if p.status != "PENDING":
            raise ProposalNotPending(proposal_id)
        return p

    def _labels(self) -> dict[str, str]:
        return {s.name: s.label for s in self.catalog.list_sources()}

    def _conditions_view(self, conditions: tuple[Condition, ...]) -> list[ConditionView]:
        labels = self._labels()
        return [
            ConditionView(
                source=c.left.source, column=c.left.column, operator=c.operator, value=_plain(c.value),
                value_source=c.value_ref.source if c.value_ref else None,
                value_column=c.value_ref.column if c.value_ref else None,
                text=condition_text(c, labels),
            )
            for c in conditions
        ]

    def _view(self, p: StoredProposal) -> ProposalView:
        return ProposalView(
            id=p.id,
            draft=RuleDraft(
                name=p.name, natural_language=p.natural_language, effect=p.effect.value, overridable=p.overridable,
                conditions=self._conditions_view(p.conditions),
                summary=rule_summary(p.effect, p.conditions),
            ),
            rationale=p.rationale, evidence=p.evidence, status=p.status, created_at=p.created_at,  # type: ignore[arg-type]
            trace=[TraceStep(label=t["label"], detail=t.get("detail")) for t in p.trace],
        )

    def _rule_view(self, r: RuleInfo) -> RuleView:
        return RuleView(
            name=r.name, natural_language=r.natural_language, effect=r.effect.value, overridable=r.overridable,
            conditions=self._conditions_view(r.conditions), id=r.id, origin=r.origin,  # type: ignore[arg-type]
            proposed_by=r.proposed_by, proposed_at=r.proposed_at, approved_by=r.approved_by,
            approved_at=r.approved_at, active=r.active, times_fired=r.times_fired,
            summary=rule_summary(r.effect, r.conditions),
        )

    def _ask(self, operation_id: str, cases: list[ResolvedCase], patterns: list[list[ResolvedCase]]) -> tuple[list[NewProposal], int]:
        sources = {s.name: self.catalog.describe_source(s.name) for s in self.catalog.list_sources()}
        active = self.proposals.active_rules()
        prompt = self._prompt(cases, patterns, sources, active)
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM,
            tools=[types.Tool(function_declarations=[TOOL])],
            tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="ANY")),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            temperature=0,
        )
        started = time.monotonic()
        response = call_with_retry(
            lambda: self.client.models.generate_content(model=self.model, contents=prompt, config=config)
        )
        record_usage(self.meter, operation_id, "PROPOSE_RULES", self.model, response, started)

        seen = {_key(r.conditions, r.effect) for r in active}
        rejected = {_key(c) for c in self.proposals.recently_rejected(30)}
        verdicts = {c.invoice_id: c.verdict for c in cases}
        out: list[NewProposal] = []
        discarded = 0
        for call in response.function_calls or []:
            if call.name != "proponer_regla" or len(out) >= MAX_PROPOSALS:
                continue
            try:
                proposal = validate(dict(call.args or {}), sources, verdicts)
            except ValueError as exc:
                log.warning("Discarding invalid proposal: %s", exc)
                discarded += 1
                continue
            if _key(proposal.conditions, proposal.effect) in seen or _key(proposal.conditions) in rejected:
                discarded += 1
                continue
            seen.add(_key(proposal.conditions, proposal.effect))
            out.append(proposal)
        return out, discarded

    def _prompt(self, cases, patterns, sources, active) -> str:
        labels = self._labels()
        by_name = {r.name: r for r in active}
        tax_ids = self.proposals.vendor_tax_ids([c.invoice_id for c in cases])
        pattern_rows = [
            {
                "verdict": group[0].verdict,
                "vendor_name": group[0].vendor_name,
                "vendor_tax_id": tax_ids.get(group[0].invoice_id),
                "fired_rules": [
                    {
                        "name": n,
                        "conditions": [condition_text(c, labels) for c in by_name[n].conditions] if n in by_name else [],
                    }
                    for n in shared_rules(group)
                ],
                "invoice_ids": [c.invoice_id for c in group],
                "notes": [c.note for c in group if c.note],
            }
            for group in patterns
        ]
        case_rows = [
            {"invoice_id": c.invoice_id, "vendor": c.vendor_name, "amount_usd": _plain(c.amount_usd),
             "outcome": c.outcome, "fired_rules": c.fired_rules, "verdict": c.verdict, "note": c.note}
            for c in cases
        ]
        source_rows = {
            name: [{"column": c.name, "type": c.data_type, "description": c.description} for c in cols]
            for name, cols in sources.items()
        }
        return json.dumps(
            {"patterns": pattern_rows, "all_cases": case_rows, "rule_sources": source_rows,
             "active_rules": [{"name": r.name, "effect": r.effect.value} for r in active]},
            ensure_ascii=False,
        )


def could_complete_pattern(cases: list[ResolvedCase], invoice_id: str) -> bool:
    """True when this resolution plus at least MIN_PATTERN - 1 earlier unreviewed ones share vendor and verdict."""
    mine = next((c for c in cases if c.invoice_id == invoice_id), None)
    if mine is None or not mine.vendor_name or not mine.fired_rules:
        return False
    same = [c for c in cases if c.vendor_name == mine.vendor_name and c.verdict == mine.verdict and c.fired_rules]
    return len(same) >= MIN_PATTERN


def _count(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def build_trace(
    cases: list[ResolvedCase], patterns: list[list[ResolvedCase]], accepted: list[NewProposal], discarded: int
) -> list[TraceStep]:
    """The run told as steps, from what it actually saw and did (nothing here is invented)."""
    if not cases:
        return [TraceStep(label="No hay decisiones nuevas tuyas por revisar")]
    approved = sum(c.verdict == "APPROVED" for c in cases)
    steps = [TraceStep(
        label=f"Revisé {_count(len(cases), 'decisión tuya', 'decisiones tuyas')}",
        detail=f"{_count(approved, 'aprobada', 'aprobadas')}, {_count(len(cases) - approved, 'rechazada', 'rechazadas')}",
    )]
    if not patterns:
        steps.append(TraceStep(
            label="No encontré un patrón todavía",
            detail=f"Hacen falta {MIN_PATTERN} decisiones iguales del mismo proveedor",
        ))
        return steps
    for group in patterns:
        verdict = "aprobadas" if group[0].verdict == "APPROVED" else "rechazadas"
        total = sum(c.vendor_name == group[0].vendor_name for c in cases)
        shared = shared_rules(group)
        tail = f", todas con «{shared[0]}»" if len(shared) == 1 else ", todas con las mismas reglas"
        steps.append(TraceStep(
            label="Encontré un patrón",
            detail=f"{group[0].vendor_name}, {verdict} {len(group)} de {total}{tail}",
        ))
    if discarded:
        steps.append(TraceStep(
            label=f"Descarté {_count(discarded, 'propuesta', 'propuestas')}",
            detail="Repetía una regla activa o una que rechazaste, o no cuadraba con la evidencia",
        ))
    for p in accepted:
        if p.effect is Effect.ALLOW:
            steps.append(TraceStep(
                label="Límites que respeta",
                detail="Una excepción solo levanta escalaciones anulables: nunca anula un Frenar ni el umbral de aprobación.",
            ))
        steps.append(TraceStep(label="Propuesta lista", detail=p.name))
    if not accepted:
        steps.append(TraceStep(label="Ninguna propuesta merecía una regla nueva"))
    return steps


def shared_rules(group: list[ResolvedCase]) -> list[str]:
    """Rules that fired in every case of the group: the reason the human kept deciding the same way."""
    common = set(group[0].fired_rules)
    for c in group[1:]:
        common &= set(c.fired_rules)
    return sorted(common)


def find_patterns(cases: list[ResolvedCase]) -> list[list[ResolvedCase]]:
    """For each vendor and verdict, the cases where one same rule fired at least MIN_PATTERN times.

    Grouping by the exact set of fired rules missed real patterns: a monthly subscription also trips
    "same amount in 30 days" on some months, so identical decisions looked different.
    """
    by_vendor: dict[tuple, list[ResolvedCase]] = defaultdict(list)
    for c in cases:
        if c.fired_rules and c.vendor_name:
            by_vendor[(c.vendor_name, c.verdict)].append(c)
    groups: list[list[ResolvedCase]] = []
    for members in by_vendor.values():
        seen: set[tuple[str, ...]] = set()
        for rule in sorted({r for c in members for r in c.fired_rules}):
            group = [c for c in members if rule in c.fired_rules]
            ids = tuple(c.invoice_id for c in group)
            if len(group) >= MIN_PATTERN and ids not in seen:
                seen.add(ids)
                groups.append(group)
    return groups


def _plain(v: Any) -> Any:
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def _key(conditions: tuple[Condition, ...], effect: Effect | None = None) -> tuple:
    def lit(v: Any) -> Any:
        v = _plain(v)
        return [lit(x) for x in v] if isinstance(v, list) else (float(v) if isinstance(v, int) and not isinstance(v, bool) else v)

    parts = frozenset(
        (str(c.left), c.operator.value, json.dumps(lit(c.value)), str(c.value_ref) if c.value_ref else None)
        for c in conditions
    )
    return (effect, parts)


def _coerce(raw: Any, column: ColumnInfo) -> Any:
    """The tool sends the literal as JSON text; make it match the column type."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            pass
    if isinstance(raw, list):
        return [_coerce(x, column) for x in raw]
    kind = column.data_type
    if kind == "boolean":
        if isinstance(raw, bool):
            return raw
        if str(raw).lower() in ("true", "false"):
            return str(raw).lower() == "true"
        raise ValueError(f"{column.name} needs true or false")
    if kind == "number":
        if isinstance(raw, bool):
            raise ValueError(f"{column.name} needs a number")
        try:
            return Decimal(str(raw))
        except InvalidOperation as exc:
            raise ValueError(f"{column.name} needs a number") from exc
    if raw is None or isinstance(raw, bool):
        raise ValueError(f"{column.name} needs text")
    return str(raw)


def validate(args: dict[str, Any], sources: dict[str, list[ColumnInfo]], verdicts: dict[str, str]) -> NewProposal:
    """Check a tool call against the catalog and the evidence. Raises ValueError."""
    name = str(args.get("name") or "").strip()
    text = str(args.get("natural_language") or "").strip()
    rationale = str(args.get("rationale") or "").strip()
    if not (name and text and rationale):
        raise ValueError("name, natural_language and rationale are required")
    try:
        effect = Effect(args.get("effect"))
    except ValueError as exc:
        raise ValueError(f"bad effect {args.get('effect')!r}") from exc
    evidence = tuple(dict.fromkeys(str(i) for i in args.get("evidence_invoice_ids") or []))
    if len(evidence) < MIN_PATTERN or any(i not in verdicts for i in evidence):
        raise ValueError("evidence must cite at least 3 reviewed invoices")
    verdict = {verdicts[i] for i in evidence}
    if len(verdict) != 1 or EFFECT_FOR_VERDICT[next(iter(verdict))] is not effect:
        raise ValueError("effect does not match the verdict of the evidence")
    raw_conditions = args.get("conditions") or []
    if not raw_conditions:
        raise ValueError("a rule needs at least one condition")

    def ref(source: Any, column: Any) -> ColumnRef:
        if source not in sources or column not in {c.name for c in sources[source]}:
            raise ValueError(f"unknown column {source}.{column}")
        return ColumnRef(source, column)

    conditions = []
    for c in raw_conditions:
        c = dict(c)
        left = ref(c.get("source"), c.get("column"))
        try:
            operator = Operator(c.get("operator"))
        except ValueError as exc:
            raise ValueError(f"unknown operator {c.get('operator')!r}") from exc
        column = next(x for x in sources[left.source] if x.name == left.column)
        value_ref = ref(c["value_source"], c.get("value_column")) if c.get("value_source") else None
        raw_value = c.get("value")
        if operator in (Operator.IS_NULL, Operator.IS_NOT_NULL):
            if raw_value not in (None, "") or value_ref:
                raise ValueError(f"{operator} takes no value")
            value = None
        elif (raw_value in (None, "")) == (value_ref is None):
            raise ValueError("give either a literal value or a column to compare with")
        else:
            value = None if value_ref else _coerce(raw_value, column)
        if operator in (Operator.IN, Operator.NOT_IN, Operator.BETWEEN, Operator.NOT_BETWEEN) and not isinstance(value, list):
            raise ValueError(f"{operator} needs a list")
        if operator in (Operator.BETWEEN, Operator.NOT_BETWEEN) and len(value) != 2:
            raise ValueError(f"{operator} needs exactly two values")
        if operator in (Operator.GT, Operator.GTE, Operator.LT, Operator.LTE, Operator.EQ, Operator.NEQ) and isinstance(value, list):
            raise ValueError(f"{operator} takes a single value")
        conditions.append(Condition(left, operator, value, value_ref))

    # An ALLOW can never be overridden itself (DB check); HOLD is what the human asked for, so keep the model's choice.
    overridable = True if effect is Effect.ALLOW else bool(args.get("overridable", True))
    return NewProposal(name, text, effect, overridable, tuple(conditions), rationale, evidence)
