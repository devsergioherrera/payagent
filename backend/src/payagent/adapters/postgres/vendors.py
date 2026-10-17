from payagent.adapters.postgres.db import get_pool
from payagent.domain.invoice import normalize_id


def search_vendors(text: str, limit: int = 5) -> list[dict[str, str]]:
    """Registered vendors whose name contains `text` (case/accent-insensitive) or whose tax id matches."""
    text = text.strip()
    if not text:
        return []
    with get_pool().connection() as conn:
        rows = conn.execute(
            """
            select id, name, tax_id, country, status from vendor
            where lower(name) like lower(%s) or tax_id = %s
            order by name limit %s
            """,
            (f"%{text}%", normalize_id(text) or "", limit),
        ).fetchall()
    return [dict(id=str(r[0]), name=r[1], tax_id=r[2], country=r[3], status=r[4]) for r in rows]
