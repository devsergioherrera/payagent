from collections.abc import Mapping
from dataclasses import dataclass

from payagent.domain.rule import ColumnRef, Scalar

Row = Mapping[str, Scalar]


@dataclass(frozen=True)
class Facts:
    """What the rule sources say about one invoice.

    `rows[source]` is that source's row linked to the invoice, or None when the source has no row
    (e.g. `vendor` for an unregistered vendor). Loader contract: numbers as int or Decimal,
    dates as ISO strings, uuids as str.
    """

    rows: Mapping[str, Row | None]

    def has_row(self, source: str) -> bool:
        return self.rows.get(source) is not None

    def value(self, ref: ColumnRef) -> Scalar:
        row = self.rows.get(ref.source)
        return None if row is None else row.get(ref.column)
