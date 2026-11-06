"""Support / contact messages: the in-app channel between a customer and the
LumiDesk founder.

A signed-in customer posts a message from the app; the founder reads every
message in the admin dashboard and writes one reply back onto the same row. Like
the other stores, the backend connects with a privileged DB role, so tenant
scoping is enforced HERE: the customer-facing reads/writes always take org_id
(already derived from a verified membership), and only the admin-facing readers
(guarded by require_admin in app.py) ever cross orgs.
"""
from sqlalchemy import text

from db import get_engine


def _row(r) -> dict:
    return {
        "id": str(r["id"]),
        "org_id": str(r["org_id"]) if r["org_id"] else None,
        "email": r["email"],
        "subject": r["subject"],
        "message": r["message"],
        "admin_reply": r["admin_reply"],
        "status": r["status"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "replied_at": r["replied_at"].isoformat() if r["replied_at"] else None,
    }


def create_message(
    org_id: str,
    user_id: str | None,
    email: str,
    subject: str,
    message: str,
) -> dict:
    """Customer posts a new message. Returns the created row."""
    msg = (message or "").strip()
    if not msg:
        raise ValueError("message is required")
    with get_engine().begin() as conn:
        r = (
            conn.execute(
                text(
                    "insert into support_messages "
                    "(org_id, user_id, email, subject, message) "
                    "values (:o, :u, :e, :s, :m) "
                    "returning id, org_id, email, subject, message, "
                    "admin_reply, status, created_at, replied_at"
                ),
                {
                    "o": org_id,
                    "u": user_id,
                    "e": (email or "").strip(),
                    "s": (subject or "").strip()[:200],
                    "m": msg[:5000],
                },
            )
            .mappings()
            .one()
        )
    return _row(r)


def list_for_org(org_id: str) -> list[dict]:
    """Customer view: this org's own messages, newest first."""
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select id, org_id, email, subject, message, admin_reply, "
                    "status, created_at, replied_at from support_messages "
                    "where org_id = :o order by created_at desc"
                ),
                {"o": org_id},
            )
            .mappings()
            .all()
        )
    return [_row(r) for r in rows]


def list_all(status: str | None = None, limit: int = 500) -> list[dict]:
    """Admin view: every message across all orgs, newest first. Guarded by
    require_admin in app.py — never call this on a customer-facing path."""
    q = (
        "select id, org_id, email, subject, message, admin_reply, "
        "status, created_at, replied_at from support_messages "
    )
    params: dict = {"lim": max(1, min(int(limit or 500), 2000))}
    if status:
        q += "where status = :st "
        params["st"] = status
    q += "order by created_at desc limit :lim"
    with get_engine().connect() as conn:
        rows = conn.execute(text(q), params).mappings().all()
    return [_row(r) for r in rows]


def reply_to_message(message_id: str, reply: str) -> dict | None:
    """Admin writes a reply onto a message and marks it replied. Returns the
    updated row, or None if the id doesn't exist. Admin-only (app.py)."""
    body = (reply or "").strip()
    if not body:
        raise ValueError("reply is required")
    with get_engine().begin() as conn:
        r = (
            conn.execute(
                text(
                    "update support_messages set "
                    "admin_reply = :r, status = 'replied', replied_at = now() "
                    "where id = :id "
                    "returning id, org_id, email, subject, message, "
                    "admin_reply, status, created_at, replied_at"
                ),
                {"r": body[:5000], "id": message_id},
            )
            .mappings()
            .first()
        )
    return _row(r) if r else None


def open_count() -> int:
    """How many messages still await a reply — drives the admin inbox badge."""
    with get_engine().connect() as conn:
        n = conn.execute(
            text("select count(*) from support_messages where status = 'open'")
        ).scalar()
    return int(n or 0)
