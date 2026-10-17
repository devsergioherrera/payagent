from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class ExtractedInvoice:
    """What the extractor read. A field not found is None, never invented.

    vendor_tax_id and bank_account come normalized: uppercase letters and digits only.
    """

    vendor_name_raw: str | None
    vendor_tax_id: str | None
    invoice_number: str | None
    amount: Decimal | None
    currency: str | None  # ISO 4217
    issue_date: date | None
    due_date: date | None
    po_number: str | None
    bank_account: str | None
    confidence: float  # 0..1


def normalize_id(raw: str | None) -> str | None:
    """'900.123.456-7' -> '9001234567'. Used for tax ids and bank accounts on both sides."""
    if raw is None:
        return None
    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    return cleaned or None
