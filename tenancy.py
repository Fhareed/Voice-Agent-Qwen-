"""Tenant (organization) operations, always scoped to the current user.

The backend connects to Postgres with a privileged role (which bypasses Row-Level
Security), so it enforces tenant scoping HERE in code: every function takes the
user_id from the verified login token and only ever touches that user's data.
RLS remains the safety net against any access that doesn't go through the backend.
"""
from sqlalchemy import text

from db import get_engine


def create_org(name: str, user_id: str) -> str:
    """Create an organization and make the given user its owner. Returns the org id."""
    with get_engine().begin() as conn:
        org_id = conn.execute(
            text("insert into organizations (name) values (:name) returning id"),
            {"name": name},
        ).scalar_one()
        conn.execute(
            text(
                "insert into memberships (org_id, user_id, role) "
                "values (:org_id, :user_id, 'owner')"
            ),
            {"org_id": org_id, "user_id": user_id},
        )
    return str(org_id)


def list_orgs(user_id: str) -> list[dict]:
    """Return the organizations the user belongs to, with their role in each."""
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select o.id, o.name, m.role "
                    "from memberships m join organizations o on o.id = m.org_id "
                    "where m.user_id = :user_id order by o.created_at"
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )
    return [{"org_id": str(r["id"]), "name": r["name"], "role": r["role"]} for r in rows]


def get_role(user_id: str, org_id: str):
    """Return the user's role in an org, or None if they are not a member.

    Use this to enforce permissions (e.g. only an 'owner' may do X).
    """
    with get_engine().connect() as conn:
        return conn.execute(
            text("select role from memberships where user_id = :u and org_id = :o"),
            {"u": user_id, "o": org_id},
        ).scalar()


def resolve_org_by_number(to_number: str):
    """Map a dialed phone number (E.164) to the org that owns it, or None.

    Used by the Retell post-call webhook to decide which business a real call was
    for. Returns None when the number isn't mapped (the caller then falls back to
    RETELL_DEFAULT_ORG_ID). Never raises — a lookup failure must not drop a call.
    """
    if not to_number:
        return None
    try:
        with get_engine().connect() as conn:
            org_id = conn.execute(
                text("select org_id from org_phone_numbers where phone_e164 = :n"),
                {"n": to_number.strip()},
            ).scalar()
        return str(org_id) if org_id else None
    except Exception:
        return None
