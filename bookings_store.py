"""Bookings read/update for the owner-facing dashboard.

Bookings are WRITTEN by the voice agent mid-call (see tools_api.book_appointment,
which inserts into the `bookings` table and, when configured, also creates a real
Google Calendar event). This module is the read + manage side the dashboard uses:
list the org's bookings, mark one done/cancelled, or delete one.

Like call_logs.py, the backend connects with a privileged role, so tenant scoping
is enforced HERE: every function takes org_id (already derived from a verified
membership) and only ever touches that org's rows.
"""
from sqlalchemy import text

from db import get_engine

# The booking.status values the schema allows (db/002_bookings.sql).
VALID_STATUSES = ("booked", "cancelled", "completed", "no_show")


def list_bookings(org_id: str, limit: int = 200) -> list[dict]:
    """Return an org's bookings, soonest-upcoming first."""
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select id, call_id, customer_name, customer_phone, customer_email, "
                    "service, start_ts, end_ts, notes, calendar_event_id, status, created_at "
                    "from bookings where org_id = :org "
                    "order by start_ts desc limit :lim"
                ),
                {"org": org_id, "lim": limit},
            )
            .mappings()
            .all()
        )
    return [_to_dict(r) for r in rows]


def set_booking_status(org_id: str, booking_id: str, status: str) -> bool:
    """Set a booking's status (booked / cancelled / completed / no_show).

    The dashboard's done/undone toggle maps to 'completed' / 'booked'.
    Returns True if a row changed. Scoped to the org so one business can never
    touch another's bookings.
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"status must be one of {VALID_STATUSES}")
    with get_engine().begin() as conn:
        res = conn.execute(
            text(
                "update bookings set status = :s "
                "where org_id = :org and id = :id"
            ),
            {"s": status, "org": org_id, "id": booking_id},
        )
    return res.rowcount > 0


def delete_booking(org_id: str, booking_id: str) -> bool:
    """Remove a booking (owner action from the dashboard). Returns True if removed.

    Note: this deletes the dashboard row only. It does NOT delete the Google
    Calendar event (that is intentional — the appointment on the real calendar is
    managed in the calendar). Scoped to the org.
    """
    with get_engine().begin() as conn:
        res = conn.execute(
            text("delete from bookings where org_id = :org and id = :id"),
            {"org": org_id, "id": booking_id},
        )
    return res.rowcount > 0


def _to_dict(r) -> dict:
    return {
        "id": str(r["id"]),
        "call_id": r["call_id"],
        "customer_name": r["customer_name"],
        "customer_phone": r["customer_phone"],
        "customer_email": r["customer_email"],
        "service": r["service"],
        "start_ts": r["start_ts"].isoformat() if r["start_ts"] else None,
        "end_ts": r["end_ts"].isoformat() if r["end_ts"] else None,
        "notes": r["notes"],
        "calendar_event_id": r["calendar_event_id"],
        "status": r["status"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }
