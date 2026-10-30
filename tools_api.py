"""Booking tools — the webhooks the voice agent (Retell/Vapi) calls mid-call.

These three endpoints are what turn the assistant from a chatbot into an agent:
it can look at a real calendar, put a real appointment on it, and text a real
confirmation. The voice platform calls them as "custom tools / functions" and
feeds the JSON result back into the conversation.

Security: every call must send the header  X-LumiDesk-Secret: <TOOLS_SHARED_SECRET>.
You set that same secret on the platform's tool config. Without the env var set,
the endpoints refuse to run (fail closed).

Multi-tenancy: each call carries org_id (which business). For the MVP we use a
single Google Calendar from env; per-org calendars are a later change isolated to
integrations/calendar_google.py.
"""
import hmac
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from db import get_engine
from integrations import calendar_google, sms_twilio

router = APIRouter(prefix="/tools", tags=["tools"])


# ── auth ──────────────────────────────────────────────────────────────
def verify_secret(x_lumidesk_secret: str = Header(default="")):
    expected = os.getenv("TOOLS_SHARED_SECRET")
    if not expected:
        raise HTTPException(status_code=503, detail="Booking tools are not configured (set TOOLS_SHARED_SECRET).")
    if not hmac.compare_digest(x_lumidesk_secret, expected):
        raise HTTPException(status_code=401, detail="Bad or missing tool secret.")


# ── helpers ───────────────────────────────────────────────────────────
def _speak(dt: datetime) -> str:
    """A human, speakable time like 'Tuesday at 8:00 AM'."""
    hour = dt.strftime("%I").lstrip("0") or "12"
    return f"{dt.strftime('%A')} at {hour}:{dt.strftime('%M %p')}"


def _parse_start(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=calendar_google.default_tz())
    return dt


def _resolve_org(org_id):
    """Return a real organization UUID.

    Agents sometimes pass a placeholder (e.g. "demo-oulu") instead of a UUID,
    which the bookings table rejects. If org_id isn't a valid UUID, fall back to
    RETELL_DEFAULT_ORG_ID, then to the first organization in the database.
    """
    try:
        uuid.UUID(str(org_id))
        return str(org_id)
    except (ValueError, TypeError, AttributeError):
        pass
    fallback = os.getenv("RETELL_DEFAULT_ORG_ID")
    if fallback:
        return fallback
    try:
        with get_engine().connect() as conn:
            row = conn.execute(
                text("select id from organizations order by created_at limit 1")
            ).scalar()
        if row:
            return str(row)
    except Exception:
        pass
    return org_id  # give up — the insert will surface the original error


def _save_booking(org_id, name, phone, email, service, start_dt, notes, calendar_event_id, call_id):
    """Insert the booking (source of truth for the dashboard). Returns its id."""
    org_id = _resolve_org(org_id)
    row = {
        "org_id": org_id, "name": name or "", "phone": phone or "", "email": email,
        "service": service, "start": start_dt, "notes": notes,
        "event_id": calendar_event_id, "call_id": call_id,
    }
    sql = text(
        "insert into bookings "
        "(org_id, customer_name, customer_phone, customer_email, service, start_ts, notes, calendar_event_id, call_id) "
        "values (:org_id, :name, :phone, :email, :service, :start, :notes, :event_id, :call_id) "
        "returning id"
    )
    with get_engine().begin() as conn:
        return str(conn.execute(sql, row).scalar())


# ── models ────────────────────────────────────────────────────────────
class CheckAvailabilityIn(BaseModel):
    org_id: str
    service: str = ""
    days: int = 5


class BookIn(BaseModel):
    org_id: str
    start: str                 # ISO 8601 — one of the slots we offered
    customer_name: str = ""
    customer_phone: str = ""
    customer_email: str | None = None
    service: str = ""
    notes: str = ""
    call_id: str | None = None


class SmsIn(BaseModel):
    org_id: str
    to: str
    message: str


# ── endpoints ─────────────────────────────────────────────────────────
@router.post("/check_availability")
def check_availability(body: CheckAvailabilityIn, _: None = Depends(verify_secret)):
    slots = calendar_google.suggest_slots(days=body.days)
    return {
        "org_id": body.org_id,
        "slots": [{"iso": s.isoformat(), "spoken": _speak(s)} for s in slots],
        "calendar_connected": calendar_google.is_configured(),
    }


@router.post("/book_appointment")
def book_appointment(body: BookIn, _: None = Depends(verify_secret)):
    start_dt = _parse_start(body.start)
    service = body.service or "appointment"

    # 1) real calendar event (skipped gracefully if Calendar isn't wired yet)
    event_id = None
    if calendar_google.is_configured():
        event_id = calendar_google.create_event(
            summary=f"{service} — {body.customer_name or body.customer_phone}",
            start_dt=start_dt,
            description=f"Booked by LumiDesk.\nPhone: {body.customer_phone}\nNotes: {body.notes}",
            attendee_email=body.customer_email,
        )

    # 2) source-of-truth row for the dashboard
    booking_id = _save_booking(
        body.org_id, body.customer_name, body.customer_phone, body.customer_email,
        service, start_dt, body.notes, event_id, body.call_id,
    )

    # 3) confirmation text to the caller
    spoken = _speak(start_dt)
    sms_result = {"sent": False, "reason": "no_phone"}
    if body.customer_phone:
        sms_result = sms_twilio.send(
            body.customer_phone,
            f"You're booked for {service} on {spoken}. Reply here if you need to change it.",
        )

    return {
        "ok": True,
        "booking_id": booking_id,
        "calendar_event_id": event_id,
        "sms": sms_result,
        "spoken": f"You're all set for {spoken}. I've sent a text to confirm.",
    }


@router.post("/send_sms")
def send_sms(body: SmsIn, _: None = Depends(verify_secret)):
    return sms_twilio.send(body.to, body.message)


class SearchKnowledgeIn(BaseModel):
    org_id: str
    query: str = ""


@router.post("/search_knowledge")
def search_knowledge(body: SearchKnowledgeIn, _: None = Depends(verify_secret)):
    """Search the business's knowledge base to answer a caller's question.

    Retrieval only — returns the most relevant passages for the agent's own LLM to
    phrase. Tenant-scoped: only ever searches this org's own documents.
    """
    import kb

    org_id = _resolve_org(body.org_id)
    query = (body.query or "").strip()
    if not query or not kb.has_index(org_id):
        return {"found": False, "context": ""}
    try:
        retriever = kb.get_retriever_for_org(org_id)
        try:
            docs = retriever.invoke(query)
        except AttributeError:
            docs = retriever.get_relevant_documents(query)
    except Exception:
        return {"found": False, "context": ""}
    passages = []
    for d in (docs or [])[:4]:
        t = (getattr(d, "page_content", "") or "").strip()
        if t:
            passages.append(t)
    context = "\n\n".join(passages)
    return {"found": bool(context), "context": context}
