"""Natural language -> structured rule (V10). The LLM only drafts; a human confirms with POST /rules."""
import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Any

from google.genai import types

from payagent.adapters.gemini._call import call_with_retry, record_usage
from payagent.api.schemas import ConditionView, DraftResponse, RuleDraft
from payagent.app.rule_text import condition_text
from payagent.domain.invoice import normalize_id
from payagent.domain.rule import ColumnRef, Condition, Effect, Operator
from payagent.ports.repositories import ColumnInfo, Operations, RuleCatalog
from payagent.ports.usage import UsageMeter

log = logging.getLogger(__name__)

MAX_TURNS = 6
MAX_FAILED_VALIDATIONS = 2  # retries the model gets after its first rejected draft
NO_DRAFT = "No pude redactar la regla. Prueba a describirla con más detalle."

SYSTEM = """\
You turn a finance rule written in natural language (usually Spanish) into a structured rule for FacturaYa, \
a company that pays supplier invoices in USD. You never decide payments and never write SQL.

Tools: listar_fuentes (data sources), describir_fuente (columns of one source), redactar_regla (submit the rule). \
Always look at the sources and the columns you need before calling redactar_regla. Never invent a source or a column.

How a rule works: conditions are combined with AND; when all hold, the effect applies.
- ESCALATE: a human must approve the payment. "sin que yo apruebe", "pídeme aprobación", "escala" mean ESCALATE.
- HOLD: block the payment. "nunca", "frena", "bloquea", "no pagues" mean HOLD.
- ALLOW: cancel an overridable escalation. "déjalo pasar", "permite", "no exijas" mean ALLOW. \
An ALLOW rule must have overridable = true. ALLOW never cancels a HOLD.
- overridable: always false for HOLD; for ESCALATE true unless the user says nobody may override it.

Rules of thumb:
- Money is in USD: limits on money use the column invoice.amount_usd.
- "más de" is GT, "al menos" is GTE, "menos de" is LT, "no más de" is LTE.
- A condition compares a column with a literal value, or with another column (value_source + value_column).
- Tax ids and bank accounts are stored normalized: letters and digits only, no dots, dashes or spaces.
- To name a vendor, filter by its tax id when you know it (use the vendor source), otherwise by name.
- Dates are YYYY-MM-DD. Percentages are plain numbers (5 means 5%).
- name: a short Spanish title. natural_language: the user's request, cleaned up, in Spanish.
- If the request cannot be expressed with the registered sources and columns, do NOT call redactar_regla: \
answer with one short sentence in Spanish saying what data is missing.
- If redactar_regla returns an error, fix it and call it again."""

_VALUE_SCHEMA = {
    "anyOf": [
        {"type": "string"},
        {"type": "number"},
        {"type": "boolean"},
        {"type": "array", "items": {"anyOf": [{"type": "string"}, {"type": "number"}, {"type": "boolean"}]}},
    ],
    "description": "Literal to compare with. IN/NOT_IN take a list, BETWEEN/NOT_BETWEEN take [low, high], "
    "IS_NULL/IS_NOT_NULL take nothing. Omit it when value_source/value_column are used.",
}

TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="listar_fuentes",
            description="List the data sources a rule can use, with name, label and description.",
        ),
        types.FunctionDeclaration(
            name="describir_fuente",
            description="List the columns of one source with type (number, text, boolean, date) and description.",
            parameters_json_schema={
                "type": "object",
                "properties": {"nombre": {"type": "string", "description": "Source name from listar_fuentes."}},
                "required": ["nombre"],
            },
        ),
        types.FunctionDeclaration(
            name="redactar_regla",
            description="Submit the structured rule. It is validated against the catalog; on error fix it and retry.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "natural_language": {"type": "string"},
                    "effect": {"type": "string", "enum": [e.value for e in Effect]},
                    "overridable": {"type": "boolean"},
                    "conditions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "source": {"type": "string"},
                                "column": {"type": "string"},
                                "operator": {"type": "string", "enum": [o.value for o in Operator]},
                                "value": _VALUE_SCHEMA,
                                "value_source": {"type": "string"},
                                "value_column": {"type": "string"},
                            },
                            "required": ["source", "column", "operator"],
                        },
                    },
                },
                "required": ["name", "natural_language", "effect", "overridable", "conditions"],
            },
        ),
    ]
)

_ORDERED = {Operator.GT, Operator.GTE, Operator.LT, Operator.LTE}
_SET = {Operator.IN, Operator.NOT_IN}
_RANGE = {Operator.BETWEEN, Operator.NOT_BETWEEN}
_NULLS = {Operator.IS_NULL, Operator.IS_NOT_NULL}
_EQUALITY = {Operator.EQ, Operator.NEQ}
_ALLOWED: dict[str, set[Operator]] = {
    "number": _EQUALITY | _ORDERED | _SET | _RANGE | _NULLS,
    "date": _EQUALITY | _ORDERED | _RANGE | _NULLS,
    "text": _EQUALITY | _SET | _NULLS,
    "boolean": _EQUALITY | _NULLS,
}
_NORMALIZED_COLUMNS = ("tax_id", "bank_account")


class RuleError(ValueError):
    """A validation problem written for the model, so it can fix its call."""


def _scalar(raw: Any, col: ColumnInfo) -> str | float | bool:
    if col.data_type == "boolean":
        if isinstance(raw, bool):
            return raw
    elif col.data_type == "number":
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            return float(raw)
        if isinstance(raw, str):
            try:
                return float(raw.replace(",", ""))
            except ValueError:
                pass
    elif col.data_type == "date":
        if isinstance(raw, str):
            try:
                date.fromisoformat(raw)
                return raw
            except ValueError:
                pass
    elif isinstance(raw, str):
        if any(k in col.name for k in _NORMALIZED_COLUMNS):
            return normalize_id(raw) or raw
        return raw
    raise RuleError(f"value {raw!r} is not a valid {col.data_type} for column {col.name}")


@dataclass
class RuleDrafter:
    """Gemini with tools listar_fuentes / describir_fuente / redactar_regla over the RuleCatalog.

    Constructed in app/wiring.py. `draft` opens a RULE_DRAFT operation, meters every LLM call,
    validates the result against the catalog (max 2 retries) and never saves anything.
    """

    client: Any
    catalog: RuleCatalog
    meter: UsageMeter
    operations: Operations
    model: str = "gemini-3.8-flash"

    def draft(self, text: str) -> DraftResponse:
        op_id = self.operations.start("RULE_DRAFT")
        try:
            response = self._run(text, op_id)
        except Exception as exc:
            log.exception("Rule drafting failed")
            self.operations.finish(op_id, error=str(exc)[:500])
            return DraftResponse(draft=None, error=NO_DRAFT)
        self.operations.finish(op_id)
        return response

    def _run(self, text: str, op_id: str) -> DraftResponse:
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM,
            tools=[TOOLS],
            temperature=0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        contents: list[types.Content] = [types.Content(role="user", parts=[types.Part.from_text(text=text)])]
        failures = 0
        for _ in range(MAX_TURNS):
            started = time.monotonic()
            response = call_with_retry(
                lambda: self.client.models.generate_content(model=self.model, contents=contents, config=config)
            )
            record_usage(self.meter, op_id, "DRAFT_RULE", self.model, response, started)
            content = response.candidates[0].content
            calls = [p.function_call for p in (content.parts or []) if p.function_call]
            if not calls:
                answer = "".join(p.text or "" for p in (content.parts or []) if not p.thought).strip()
                return DraftResponse(draft=None, error=answer or NO_DRAFT)
            contents.append(content)
            replies: list[types.Part] = []
            for call in calls:
                args = dict(call.args or {})
                if call.name == "redactar_regla":
                    try:
                        return DraftResponse(draft=self._build(args), error=None)
                    except RuleError as err:
                        failures += 1
                        if failures > MAX_FAILED_VALIDATIONS:
                            return DraftResponse(draft=None, error=NO_DRAFT)
                        out = {"error": str(err)}
                else:
                    out = self._lookup(call.name, args)
                replies.append(types.Part.from_function_response(name=call.name, response=out))
            contents.append(types.Content(role="user", parts=replies))
        return DraftResponse(draft=None, error=NO_DRAFT)

    def _lookup(self, name: str | None, args: dict[str, Any]) -> dict[str, Any]:
        if name == "listar_fuentes":
            return {"fuentes": [{"name": s.name, "label": s.label, "description": s.description}
                                for s in self.catalog.list_sources()]}
        if name == "describir_fuente":
            try:
                cols = self.catalog.describe_source(str(args.get("nombre", "")))
            except KeyError:
                return {"error": f"unknown source {args.get('nombre')!r}; use listar_fuentes"}
            return {"columnas": [{"name": c.name, "type": c.data_type, "description": c.description} for c in cols]}
        return {"error": f"unknown tool {name!r}"}

    def _build(self, args: dict[str, Any]) -> RuleDraft:
        """Validate a redactar_regla call against the catalog; raises RuleError with a model-facing message."""
        try:
            effect = Effect(args.get("effect"))
        except ValueError:
            raise RuleError("effect must be one of ALLOW, ESCALATE, HOLD") from None
        overridable = args.get("overridable")
        if not isinstance(overridable, bool):
            raise RuleError("overridable must be true or false")
        if effect is Effect.ALLOW and not overridable:
            raise RuleError("an ALLOW rule must have overridable = true")
        raw_conditions = args.get("conditions") or []
        if not raw_conditions:
            raise RuleError("a rule needs at least one condition")
        name = str(args.get("name") or "").strip()
        natural = str(args.get("natural_language") or "").strip()
        if not name or not natural:
            raise RuleError("name and natural_language are required")

        labels = {s.name: s.label for s in self.catalog.list_sources()}
        columns: dict[str, dict[str, ColumnInfo]] = {}

        def column(source: str, col: str) -> ColumnInfo:
            if source not in labels:
                raise RuleError(f"unknown source {source!r}; known sources: {', '.join(sorted(labels))}")
            if source not in columns:
                columns[source] = {c.name: c for c in self.catalog.describe_source(source)}
            if col not in columns[source]:
                raise RuleError(f"source {source!r} has no column {col!r}; columns: {', '.join(columns[source])}")
            return columns[source][col]

        views: list[ConditionView] = []
        for raw in raw_conditions:
            cond = self._condition(raw, column)
            views.append(self._view(cond, labels))
        return RuleDraft(name=name, natural_language=natural, effect=effect.value, overridable=overridable,
                         conditions=views)

    @staticmethod
    def _condition(raw: dict[str, Any], column: Any) -> Condition:
        try:
            op = Operator(raw.get("operator"))
        except ValueError:
            raise RuleError(f"operator {raw.get('operator')!r} is not valid; use {', '.join(o.value for o in Operator)}") from None
        left = ColumnRef(str(raw.get("source")), str(raw.get("column")))
        info = column(left.source, left.column)
        where = f"{left}"
        if op not in _ALLOWED[info.data_type]:
            raise RuleError(f"operator {op.value} cannot be used on {where} ({info.data_type}); "
                            f"allowed: {', '.join(sorted(o.value for o in _ALLOWED[info.data_type]))}")
        value, vsrc, vcol = raw.get("value"), raw.get("value_source"), raw.get("value_column")
        if op in _NULLS:
            if value is not None or vsrc or vcol:
                raise RuleError(f"{op.value} on {where} takes no value")
            return Condition(left, op)
        if (vsrc or vcol) and value is not None:
            raise RuleError(f"{where}: give either value or value_source+value_column, not both")
        if vsrc or vcol:
            if not (vsrc and vcol):
                raise RuleError(f"{where}: value_source and value_column go together")
            if op in _SET | _RANGE:
                raise RuleError(f"{op.value} needs literal values, not a column")
            other = column(str(vsrc), str(vcol))
            if other.data_type != info.data_type:
                raise RuleError(f"cannot compare {where} ({info.data_type}) with {vsrc}.{vcol} ({other.data_type})")
            return Condition(left, op, value_ref=ColumnRef(str(vsrc), str(vcol)))
        if value is None:
            raise RuleError(f"{op.value} on {where} needs a value")
        if op in _RANGE:
            if not isinstance(value, list) or len(value) != 2:
                raise RuleError(f"{op.value} on {where} needs a list [low, high]")
            low, high = (_scalar(v, info) for v in value)
            if info.data_type == "number" and low > high:
                raise RuleError(f"{op.value} on {where}: low must be <= high")
            return Condition(left, op, [low, high])
        if op in _SET:
            if not isinstance(value, list) or not value:
                raise RuleError(f"{op.value} on {where} needs a non-empty list")
            return Condition(left, op, [_scalar(v, info) for v in value])
        if isinstance(value, list):
            raise RuleError(f"{op.value} on {where} takes a single value, not a list")
        return Condition(left, op, _scalar(value, info))

    @staticmethod
    def _view(cond: Condition, labels: dict[str, str]) -> ConditionView:
        ref = cond.value_ref
        return ConditionView(
            source=cond.left.source,
            column=cond.left.column,
            operator=cond.operator.value,
            value=cond.value,
            value_source=ref.source if ref else None,
            value_column=ref.column if ref else None,
            text=condition_text(cond, labels),
        )
