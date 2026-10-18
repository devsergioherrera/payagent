"""Apply db/migrations/*.sql in order, once each: uv run python scripts/migrate.py

Works on an empty Postgres (local Docker or a new Supabase project) and on the existing demo database:
if the schema already exists but no migration log does, every migration present is recorded as applied.
"""
import os
from pathlib import Path

import psycopg

MIGRATIONS = Path(os.environ.get("MIGRATIONS_DIR") or Path(__file__).resolve().parents[2] / "db" / "migrations")

# Supabase ships these roles; plain Postgres does not, and 003 revokes from them.
SUPABASE_ROLES = """
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
"""


def main() -> None:
    files = sorted(MIGRATIONS.glob("*.sql"))
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
        conn.execute(SUPABASE_ROLES)
        conn.execute("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())")
        applied = {r[0] for r in conn.execute("select name from schema_migrations")}
        schema_exists = conn.execute("select to_regclass('public.vendor')").fetchone()[0] is not None
        if not applied and schema_exists:
            for f in files:
                conn.execute("insert into schema_migrations (name) values (%s)", (f.name,))
            print(f"Existing schema: recorded {len(files)} migrations as applied.")
            return
        for f in files:
            if f.name in applied:
                continue
            conn.execute(f.read_text())
            conn.execute("insert into schema_migrations (name) values (%s)", (f.name,))
            print(f"applied {f.name}")
    print("Database is up to date.")


if __name__ == "__main__":
    main()
