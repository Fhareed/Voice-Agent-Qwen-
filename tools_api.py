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


def _org_by_token(token: str) -> str | None:
    """Return the org whose settings hold this per-org tools token, or None."""
    try:
        with get_engine().connect() as conn:
            row = conn.execute(
                text("select org_id from org_settings where data->>'tools_token' = :t limit 1"),
                {"t": token},
            ).scalar()
        return str(row) if row else None
    except Exception:
        return None


def _require_real_org(org_id) -> str:
    """Validate org_id is a real, existing organization. No silent fallback."""
    try:
        uuid.UUID(str(org_id))
        with get_engine().connect() as conn:
            exists = conn.execute(
                text("select 1 from organizations where id = cast(:id as uuid)"),
                {"id": str(org_id)},
            ).scalar()
    except (ValueError, TypeError, AttributeError):
        exists = None
    if exists:
        return str(org_id)
    raise HTTPException(status_code=400, detail="Unknown or invalid org_id.")


def tool_auth(
    x_lumidesk_secret: str = Header(default=""),
    x_lumidesk_org_token: str = Header(default=""),
) -> dict:
    """Authenticate a tool call, returning {"org_id": <str|None>}.

    New agents send a per-org token (X-LumiDesk-Org-Token) that binds the call to
    one org server-side; the body org_id is ignored on that path. Legacy agents
    send only the global X-LumiDesk-Secret, and the caller must then strictly
    validate the body org_id (no silent default) via _require_real_org.
    """
    if x_lumidesk_org_token:
        org = _org_by_token(x_lumidesk_org_token)
        if org is None:
            raise HTTPException(status_code=401, detail="Bad org token.")
        return {"org_id": org}
    expected = os.getenv("TOOLS_SHARED_SECRET")
    if not expected:
        raise HTTPException(status_code=503, detail="Booking tools are not configured (set TOOLS_SHARED_SECRET).")
    if not hmac.compare_digest(x_lumidesk_secret, expected):
        raise HTTPException(status_code=401, detail="Bad or missing tool secret.")
    return {"org_id": None}


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
def check_availability(body: CheckAvailabilityIn, auth: dict = Depends(tool_auth)):
    org = auth["org_id"] or _require_real_org(body.org_id)
    slots = calendar_google.suggest_slots(org_id=org, days=body.days)
    return {
        "org_id": body.org_id,
        "slots": [{"iso": s.isoformat(), "spoken": _speak(s)} for s in slots],
        "calendar_connected": calendar_google.is_configured(org),
    }


@router.post("/book_appointment")
def book_appointment(
    body: BookIn,
    auth: dict = Depends(tool_auth),
    x_caller_number: str = Header(default=""),
):
    start_dt = _parse_start(body.start)
    service = body.service or "appointment"
    # The caller's number comes straight from the phone network: Retell injects it
    # into the X-Caller-Number header as {{user_number}}, so the agent never has to
    # ask for it. Fall back to anything the agent passed.
    phone = (x_caller_number or "").strip() or (body.customer_phone or "").strip()

    # A clear, human-readable description so the business knows what the booking is
    # for at a glance — only the fields we actually have.
    desc_lines = ["Booked by LumiDesk (AI receptionist)."]
    if service:
        desc_lines.append(f"Service: {service}")
    if body.customer_name:
        desc_lines.append(f"Customer: {body.customer_name}")
    if phone:
        desc_lines.append(f"Phone: {phone}")
    if body.customer_email:
        desc_lines.append(f"Email: {body.customer_email}")
    if body.notes:
        desc_lines.append(f"Details: {body.notes}")
    description = "\n".join(desc_lines)

    # 1) real calendar event on the business's own calendar (skipped if not connected)
    org = auth["org_id"] or _require_real_org(body.org_id)
    event_id = None
    if calendar_google.is_configured(org):
        try:
            event_id = calendar_google.create_event(
                summary=f"{service} — {body.customer_name or phone or 'caller'}",
                start_dt=start_dt,
                description=description,
                attendee_email=None,  # service account can't invite guests; email is in the description
                org_id=org,
            )
        except Exception as e:
            # A calendar hiccup must never lose the booking — save it anyway and
            # the dashboard still shows it; the event just isn't mirrored to Google.
            print(f"[calendar] create_event failed, saving booking without it: {e}")
            event_id = None

    # 2) source-of-truth row for the dashboard
    booking_id = _save_booking(
        org, body.customer_name, phone, body.customer_email,
        service, start_dt, body.notes, event_id, body.call_id,
    )

    # 3) confirmation text to the caller
    spoken = _speak(start_dt)
    sms_result = {"sent": False, "reason": "no_phone"}
    if phone:
        sms_result = sms_twilio.send(
            phone,
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
def send_sms(body: SmsIn, auth: dict = Depends(tool_auth)):
    # Strictly validate the tenant (no silent default), consistent with the other
    # tools, even though sending the SMS itself isn't org-scoped yet.
    _ = auth["org_id"] or _require_real_org(body.org_id)
    return sms_twilio.send(body.to, body.message)


class SearchKnowledgeIn(BaseModel):
    org_id: str
    query: str = ""


@router.post("/search_knowledge")
def search_knowledge(body: SearchKnowledgeIn, auth: dict = Depends(tool_auth)):
    """Search the business's knowledge base to answer a caller's question.

    Retrieval only — returns the most relevant passages for the agent's own LLM to
    phrase. Tenant-scoped: only ever searches this org's own documents.
    """
    import kb

    org_id = auth["org_id"] or _require_real_org(body.org_id)
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
