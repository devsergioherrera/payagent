"""Background text handed to the rule drafter: an invoice with its decision, or a rule to revise."""
from payagent.api.schemas import InvoiceDetail, RuleView


def invoice_context(detail: InvoiceDetail) -> str:
    s = detail.summary
    amount = f"USD {s.amount_usd:,.2f}" if s.amount_usd is not None else "unknown amount"
    fired = [h.rule_name for h in detail.hits if h.result == "FIRED"]
    vendor_id = f" (vendor tax id {detail.extracted.vendor_tax_id})" if detail.extracted.vendor_tax_id else ""
    return (
        "Context: the user is looking at this invoice and wants a rule about cases like it.\n"
        f"- Vendor: {s.vendor_name or 'unknown'}{vendor_id}\n"
        f"- Invoice: {s.invoice_number or s.id}, {amount}\n"
        f"- Decision: {s.outcome or 'none yet'}; rules fired: {', '.join(fired) if fired else 'none'}"
    )


def revision_context(rule: RuleView) -> str:
    conds = "\n".join(
        f"  - {c.source}.{c.column} {c.operator}"
        + (f" {c.value_source}.{c.value_column}" if c.value_source else (f" {c.value!r}" if c.value is not None else ""))
        for c in rule.conditions
    )
    return (
        "Context: the user wants to CHANGE this existing rule. Return the full new version of it.\n"
        f"- Name: {rule.name}\n- Effect: {rule.effect}, overridable: {rule.overridable}\n"
        f"- Original wording: {rule.natural_language}\n- Conditions (all must hold):\n{conds}"
    )
