"""Per-org settings (owner-facing): one JSON blob per organization.

Holds the business profile, phone number, hours, voice/language, notification
and plan preferences the Settings page edits. Like the other stores, the backend
connects with a privileged role, so tenant scoping is enforced HERE: every
function takes org_id (already derived from a verified membership).
"""
import json

from sqlalchemy import text

from db import get_engine


def get_settings(org_id: str) -> dict:
    """Return the org's settings blob (empty dict if none saved yet)."""
    with get_engine().connect() as conn:
        data = conn.execute(
            text("select data from org_settings where org_id = :o"),
            {"o": org_id},
        ).scalar()
    return dict(data) if data else {}


def save_settings(org_id: str, patch: dict) -> dict:
    """Shallow-merge `patch` into the org's settings and return the full blob.

    If the patch includes a non-empty 'business_name', the organization's name
    is updated too, so the dashboard greeting stays in sync.
    """
    if not isinstance(patch, dict):
        raise ValueError("settings patch must be an object")

    with get_engine().begin() as conn:
        conn.execute(
            text(
                "insert into org_settings (org_id, data) "
                "values (:o, cast(:d as jsonb)) "
                "on conflict (org_id) do update set "
                "data = org_settings.data || cast(:d as jsonb), updated_at = now()"
            ),
            {"o": org_id, "d": json.dumps(patch)},
        )
        name = (patch.get("business_name") or "").strip()
        if name:
            conn.execute(
                text("update organizations set name = :n where id = :o"),
                {"n": name, "o": org_id},
            )
        data = conn.execute(
            text("select data from org_settings where org_id = :o"),
            {"o": org_id},
        ).scalar()
    return dict(data) if data else {}
