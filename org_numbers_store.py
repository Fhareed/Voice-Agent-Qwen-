"""org_phone_numbers — map a Retell number (E.164) to the org that owns it.

The Retell post-call webhook calls tenancy.resolve_org_by_number() to route an
inbound call to the right business. WRITING a row here is what makes multi-tenant
inbound actually work; without it every call falls back to RETELL_DEFAULT_ORG_ID.
Tenant scoping is enforced in code (the backend uses a privileged DB role).
"""
from sqlalchemy import text

from db import get_engine


def register_number(org_id: str, phone_e164: str, label: str = "") -> str:
    """Map a number to an org (idempotent — re-registering re-points it)."""
    num = (phone_e164 or "").strip()
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "insert into org_phone_numbers (phone_e164, org_id, label) "
                "values (:p, :o, :l) "
                "on conflict (phone_e164) do update set "
                "org_id = excluded.org_id, label = excluded.label"
            ),
            {"p": num, "o": org_id, "l": label or ""},
        )
    return num


def list_for_org(org_id: str) -> list[dict]:
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select phone_e164, label, created_at from org_phone_numbers "
                    "where org_id = :o order by created_at"
                ),
                {"o": org_id},
            )
            .mappings()
            .all()
        )
    return [
        {
            "phone_e164": r["phone_e164"],
            "label": r["label"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


def primary_number(org_id: str):
    nums = list_for_org(org_id)
    return nums[0]["phone_e164"] if nums else None


def unregister_number(org_id: str, phone_e164: str) -> bool:
    with get_engine().begin() as conn:
        res = conn.execute(
            text("delete from org_phone_numbers where org_id = :o and phone_e164 = :p"),
            {"o": org_id, "p": (phone_e164 or "").strip()},
        )
        return res.rowcount > 0


def delete_by_phone(phone_e164: str) -> bool:
    """Admin/cleanup: remove a mapping by number regardless of org (e.g. test teardown)."""
    with get_engine().begin() as conn:
        res = conn.execute(
            text("delete from org_phone_numbers where phone_e164 = :p"),
            {"p": (phone_e164 or "").strip()},
        )
        return res.rowcount > 0


def count_for_org(org_id: str) -> int:
    """How many numbers this org currently has mapped. Backs the per-org quota so a
    customer can't run up our Retell bill by buying many numbers."""
    with get_engine().connect() as conn:
        n = conn.execute(
            text("select count(*) from org_phone_numbers where org_id = :o"),
            {"o": org_id},
        ).scalar()
    return int(n or 0)


def count_all() -> int:
    """Total numbers mapped across EVERY org — the global account ceiling is checked
    against this so a bug anywhere can never run our Retell card past a hard max."""
    with get_engine().connect() as conn:
        n = conn.execute(text("select count(*) from org_phone_numbers")).scalar()
    return int(n or 0)
