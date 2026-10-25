"""Call log storage -- a lean mini-CRM, one row per call (text only, no audio).

The backend connects with a privileged role, so tenant scoping is enforced HERE:
every function takes org_id (already derived from a verified membership) and only
ever touches that org's rows.
"""
from sqlalchemy import text

from db import get_engine


def log_turn(org_id: str, call_id: str, caller_said: str, assistant_said: str) -> None:
    """Append one exchange to a call's transcript, creating the call row if new.

    Deliberately cheap (no LLM) so it can run right after a voice reply without
    slowing it down.
    """
    line = ""
    if caller_said:
        line += f"Caller: {caller_said}\n"
    if assistant_said:
        line += f"Assistant: {assistant_said}\n"
    if not line:
        return
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "insert into call_logs (org_id, call_id, transcript) "
                "values (:org, :cid, :line) "
                "on conflict (org_id, call_id) do update set "
                "transcript = call_logs.transcript || :line, updated_at = now()"
            ),
            {"org": org_id, "cid": call_id, "line": line},
        )


def upsert_full_call(
    org_id: str,
    call_id: str,
    *,
    transcript: str = "",
    summary: str = "",
    caller_phone: str = "",
    caller_name: str | None = None,
    intent: str | None = None,
    from_number: str = "",
    to_number: str = "",
    direction: str = "inbound",
    duration_sec=None,
    language: str = "",
    started_at=None,
    ended_at=None,
    is_booking: bool = False,
) -> None:
    """Insert (or update) ONE complete call from a phone-call webhook.

    Unlike log_turn (which appends a line at a time during the browser pipeline),
    this stores a whole finished call at once. Called by the Retell webhook.

    On conflict we refresh the transcript/summary/metadata but deliberately LEAVE
    `status` untouched, so if the owner already marked the call resolved an updated
    webhook (call_analyzed after call_ended) won't flip it back to unresolved.
    A summary is coalesced so a later event can't blank out one we already had.
    """
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "insert into call_logs "
                "(org_id, call_id, transcript, summary, caller_name, caller_phone, intent, "
                " is_booking, from_number, to_number, direction, duration_sec, language, "
                " started_at, ended_at) "
                "values "
                "(:org, :cid, :transcript, :summary, :name, :phone, :intent, "
                " :isb, :from_number, :to_number, :direction, :duration, :language, "
                " :started_at, :ended_at) "
                "on conflict (org_id, call_id) do update set "
                "  transcript   = excluded.transcript, "
                "  summary      = coalesce(nullif(excluded.summary, ''), call_logs.summary), "
                "  caller_phone = coalesce(nullif(excluded.caller_phone, ''), call_logs.caller_phone), "
                "  from_number  = coalesce(nullif(excluded.from_number, ''), call_logs.from_number), "
                "  to_number    = coalesce(nullif(excluded.to_number, ''), call_logs.to_number), "
                "  direction    = excluded.direction, "
                "  duration_sec = coalesce(excluded.duration_sec, call_logs.duration_sec), "
                "  language     = coalesce(nullif(excluded.language, ''), call_logs.language), "
                "  started_at   = coalesce(excluded.started_at, call_logs.started_at), "
                "  ended_at     = coalesce(excluded.ended_at, call_logs.ended_at), "
                "  is_booking   = call_logs.is_booking or excluded.is_booking, "
                "  updated_at   = now()"
            ),
            {
                "org": org_id,
                "cid": call_id,
                "transcript": transcript or "",
                "summary": summary or "",
                "name": caller_name,
                "phone": caller_phone or "",
                "intent": intent,
                "isb": bool(is_booking),
                "from_number": from_number or "",
                "to_number": to_number or "",
                "direction": direction or "inbound",
                "duration": duration_sec,
                "language": language or "",
                "started_at": started_at,
                "ended_at": ended_at,
            },
        )


def list_calls(org_id: str, limit: int = 200) -> list[dict]:
    """Return an org's calls, newest first."""
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select id, call_id, created_at, updated_at, transcript, summary, "
                    "caller_name, caller_phone, intent, is_booking, booking_details, status, "
                    "from_number, to_number, direction, duration_sec, language, "
                    "started_at, ended_at "
                    "from call_logs where org_id = :org "
                    "order by created_at desc limit :lim"
                ),
                {"org": org_id, "lim": limit},
            )
            .mappings()
            .all()
        )
    return [_to_dict(r) for r in rows]


def get_transcript(org_id: str, call_row_id: str):
    """The accumulated transcript for one call (scoped to the org)."""
    with get_engine().connect() as conn:
        return conn.execute(
            text("select transcript from call_logs where org_id = :org and id = :id"),
            {"org": org_id, "id": call_row_id},
        ).scalar()


def set_status(org_id: str, call_row_id: str, status: str) -> None:
    """Flip a call between 'resolved' and 'unresolved'."""
    if status not in ("resolved", "unresolved"):
        raise ValueError("status must be 'resolved' or 'unresolved'")
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "update call_logs set status = :s, updated_at = now() "
                "where org_id = :org and id = :id"
            ),
            {"s": status, "org": org_id, "id": call_row_id},
        )


def delete_call(org_id: str, call_row_id: str) -> bool:
    """Remove a call from the dashboard. Returns True if a row was deleted.

    Scoped to the org, so one business can never delete another's call.
    """
    with get_engine().begin() as conn:
        res = conn.execute(
            text("delete from call_logs where org_id = :org and id = :id"),
            {"org": org_id, "id": call_row_id},
        )
        return res.rowcount > 0


def save_extract(org_id: str, call_row_id: str, fields: dict) -> None:
    """Store the lead details pulled out of the transcript when the call ended."""
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "update call_logs set summary = :summary, caller_name = :name, "
                "caller_phone = :phone, intent = :intent, is_booking = :isb, "
                "booking_details = :bd, updated_at = now() "
                "where org_id = :org and id = :id"
            ),
            {
                "summary": fields.get("summary"),
                "name": fields.get("caller_name"),
                "phone": fields.get("caller_phone"),
                "intent": fields.get("intent"),
                "isb": bool(fields.get("is_booking")),
                "bd": fields.get("booking_details"),
                "org": org_id,
                "id": call_row_id,
            },
        )


def _to_dict(r) -> dict:
    def _iso(key):
        v = r.get(key) if hasattr(r, "get") else r[key]
        return v.isoformat() if v else None

    return {
        "id": str(r["id"]),
        "call_id": r["call_id"],
        "created_at": _iso("created_at"),
        "updated_at": _iso("updated_at"),
        "transcript": r["transcript"],
        "summary": r["summary"],
        "caller_name": r["caller_name"],
        "caller_phone": r["caller_phone"],
        "intent": r["intent"],
        "is_booking": r["is_booking"],
        "booking_details": r["booking_details"],
        "status": r["status"],
        "from_number": r.get("from_number") if hasattr(r, "get") else r["from_number"],
        "to_number": r.get("to_number") if hasattr(r, "get") else r["to_number"],
        "direction": r.get("direction") if hasattr(r, "get") else r["direction"],
        "duration_sec": r.get("duration_sec") if hasattr(r, "get") else r["duration_sec"],
        "language": r.get("language") if hasattr(r, "get") else r["language"],
        "started_at": _iso("started_at"),
        "ended_at": _iso("ended_at"),
    }
