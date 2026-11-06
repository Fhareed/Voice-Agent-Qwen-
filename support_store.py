"""Support / contact threads: the in-app two-way channel between a customer and
the LumiDesk founder.

One row per message (`support_messages`); a thread is every row sharing a
`thread_id`, ordered by `created_at`. The first message of a thread is from the
customer and carries the subject. Either side can keep adding messages, so the
conversation is continuous. Thread status is DERIVED from the last message's
sender ('customer' last = awaiting us = "open"; 'admin' last = "replied").

Like the other stores, the backend connects with a privileged DB role, so tenant
scoping is enforced HERE: the customer-facing calls always take org_id (already
derived from a verified membership) and only touch threads that org owns; only
the admin-facing readers/writers (guarded by require_admin in app.py) cross orgs.
"""
import uuid

from sqlalchemy import text

from db import get_engine

_COLS = "id, thread_id, org_id, user_id, email, subject, sender, body, created_at"


def _msg(r) -> dict:
    return {
        "id": str(r["id"]),
        "sender": r["sender"],
        "body": r["body"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


def _thread_from_rows(rows: list) -> dict:
    """Build a thread object from its message rows (already ordered oldest→newest)."""
    first = rows[0]
    last = rows[-1]
    status = "replied" if last["sender"] == "admin" else "open"
    return {
        "thread_id": str(first["thread_id"]),
        "org_id": str(first["org_id"]) if first["org_id"] else None,
        "email": first["email"],
        "subject": first["subject"],
        "status": status,
        "created_at": first["created_at"].isoformat() if first["created_at"] else None,
        "updated_at": last["created_at"].isoformat() if last["created_at"] else None,
        "messages": [_msg(r) for r in rows],
    }


def _group_threads(rows: list) -> list[dict]:
    """Group a flat, time-ordered list of message rows into threads, ordered by
    most-recent activity first. `rows` must be ordered by created_at ASC."""
    buckets: dict[str, list] = {}
    order: list[str] = []
    for r in rows:
        tid = str(r["thread_id"])
        if tid not in buckets:
            buckets[tid] = []
            order.append(tid)
        buckets[tid].append(r)
    threads = [_thread_from_rows(buckets[tid]) for tid in order]
    # Most-recently-active thread first.
    threads.sort(key=lambda t: t["updated_at"] or "", reverse=True)
    return threads


def _get_thread_rows(conn, thread_id: str) -> list:
    return (
        conn.execute(
            text(
                f"select {_COLS} from support_messages "
                "where thread_id = :t order by created_at"
            ),
            {"t": thread_id},
        )
        .mappings()
        .all()
    )


def start_thread(
    org_id: str,
    user_id: str | None,
    email: str,
    subject: str,
    body: str,
) -> dict:
    """Customer opens a new thread with a first message. Returns the thread."""
    msg = (body or "").strip()
    if not msg:
        raise ValueError("message is required")
    thread_id = str(uuid.uuid4())
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "insert into support_messages "
                "(thread_id, org_id, user_id, email, subject, sender, body) "
                "values (:t, :o, :u, :e, :s, 'customer', :b)"
            ),
            {
                "t": thread_id,
                "o": org_id,
                "u": user_id,
                "e": (email or "").strip(),
                "s": (subject or "").strip()[:200],
                "b": msg[:5000],
            },
        )
        rows = _get_thread_rows(conn, thread_id)
    return _thread_from_rows(rows)


def add_customer_message(
    org_id: str,
    thread_id: str,
    user_id: str | None,
    email: str,
    body: str,
) -> dict | None:
    """Append a customer message to an EXISTING thread this org owns. Returns the
    updated thread, or None if the thread doesn't exist or isn't this org's."""
    msg = (body or "").strip()
    if not msg:
        raise ValueError("message is required")
    with get_engine().begin() as conn:
        owner = conn.execute(
            text("select org_id, subject from support_messages where thread_id = :t limit 1"),
            {"t": thread_id},
        ).mappings().first()
        if not owner or str(owner["org_id"]) != str(org_id):
            return None
        conn.execute(
            text(
                "insert into support_messages "
                "(thread_id, org_id, user_id, email, subject, sender, body) "
                "values (:t, :o, :u, :e, :s, 'customer', :b)"
            ),
            {
                "t": thread_id,
                "o": org_id,
                "u": user_id,
                "e": (email or "").strip(),
                "s": owner["subject"],
                "b": msg[:5000],
            },
        )
        rows = _get_thread_rows(conn, thread_id)
    return _thread_from_rows(rows)


def add_admin_message(thread_id: str, body: str) -> dict | None:
    """Append an admin reply to a thread. Admin-only (guarded in app.py). Returns
    the updated thread, or None if the thread doesn't exist."""
    msg = (body or "").strip()
    if not msg:
        raise ValueError("reply is required")
    with get_engine().begin() as conn:
        base = conn.execute(
            text("select org_id, email, subject from support_messages where thread_id = :t limit 1"),
            {"t": thread_id},
        ).mappings().first()
        if not base:
            return None
        conn.execute(
            text(
                "insert into support_messages "
                "(thread_id, org_id, user_id, email, subject, sender, body) "
                "values (:t, :o, null, :e, :s, 'admin', :b)"
            ),
            {
                "t": thread_id,
                "o": base["org_id"],
                "e": base["email"],
                "s": base["subject"],
                "b": msg[:5000],
            },
        )
        rows = _get_thread_rows(conn, thread_id)
    return _thread_from_rows(rows)


def list_threads_for_org(org_id: str) -> list[dict]:
    """Customer view: this org's threads, most-recently-active first."""
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    f"select {_COLS} from support_messages "
                    "where org_id = :o order by created_at"
                ),
                {"o": org_id},
            )
            .mappings()
            .all()
        )
    return _group_threads(rows)


def list_all_threads(status: str | None = None) -> list[dict]:
    """Admin view: every thread across all orgs, most-recently-active first.
    Guarded by require_admin in app.py — never call this on a customer path.
    `status` optionally filters the result to 'open' or 'replied'."""
    with get_engine().connect() as conn:
        rows = conn.execute(
            text(f"select {_COLS} from support_messages order by created_at")
        ).mappings().all()
    threads = _group_threads(rows)
    if status:
        threads = [t for t in threads if t["status"] == status]
    return threads


def open_count() -> int:
    """How many threads are awaiting us (last message is from the customer).
    Drives the admin inbox badge."""
    return sum(1 for t in list_all_threads() if t["status"] == "open")
