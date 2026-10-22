"""Connection to the Supabase Postgres database.

The backend talks to Supabase's Postgres directly (via SQLAlchemy). The full
connection string — which includes the database password — lives in .env as
DATABASE_URL and is never committed to code.
"""
import os

from sqlalchemy import create_engine, text

_engine = None


def _normalized_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy your Supabase connection string into .env "
            "(see .env.example)."
        )
    # Use the modern psycopg (v3) driver under SQLAlchemy.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def get_engine():
    """A lazily-created SQLAlchemy engine for the Supabase Postgres database."""
    global _engine
    if _engine is None:
        _engine = create_engine(_normalized_url(), pool_pre_ping=True)
    return _engine


def db_health():
    """Prove we can reach the database and see our multi-tenant tables."""
    with get_engine().connect() as conn:
        conn.execute(text("select 1"))
        orgs = conn.execute(text("select count(*) from organizations")).scalar()
        members = conn.execute(text("select count(*) from memberships")).scalar()
    return {"organizations": orgs, "memberships": members}
