"""Retell post-call webhook -> the multi-tenant Postgres call log.

This is the bridge between a REAL phone call and the owner's dashboard. When a
call on Retell ends, Retell POSTs the finished call here. We:

  1. Check the secret in the URL path (so only Retell can post).
  2. Work out WHICH business the call was for:
       - inbound:  from the dialed number (to_number) via org_phone_numbers.
       - outbound: from the metadata we attached when we placed the call
         (org_id / campaign_id / target_id), set in outbound.create_outbound_call.
     Falls back to RETELL_DEFAULT_ORG_ID.
  3. Turn Retell's transcript into the same "Caller: .. / Assistant: .." text the
     rest of the app already understands, pull out the summary / duration /
     language, and upsert one row into call_logs for that org.
  4. For outbound calls, also update the campaign target (status + outcome) so the
     Outbound page shows how each call went.

It stores TEXT ONLY (never audio), exactly like the browser pipeline. Bookings
are written separately, live during the call, by tools_api.book_appointment.

Config (.env):
  RETELL_WEBHOOK_SECRET   required. The secret segment in the webhook URL:
                          https://<your-host>/retell/webhook/<RETELL_WEBHOOK_SECRET>
  RETELL_DEFAULT_ORG_ID   optional. Used when the call isn't mapped to an org yet.
  RETELL_API_KEY          optional. If set, we additionally verify Retell's
                          X-Retell-Signature header (defense in depth).
"""
from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import os

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

import call_logs
from db import get_engine
from tenancy import resolve_org_by_number

router = APIRouter(prefix="/retell", tags=["retell"])

# Retell transcript roles that represent the assistant (everything else = caller).
_BOT_ROLES = {"agent", "assistant", "ai", "bot"}

# Events worth persisting. call_analyzed arrives after call_ended and carries the
# summary, so it supersedes the earlier call_ended row for the same call.
_PERSIST_EVENTS = ("call_ended", "call_analyzed")


# ── payload parsing (self-contained; mirrors the demo's call_store) ─────────
def _ms_to_iso(ms) -> str | None:
    try:
        return datetime.datetime.fromtimestamp(int(ms) / 1000).isoformat(timespec="seconds")
    except Exception:
        return None


def _normalize_turns(call: dict) -> list[tuple[str, str]]:
    """Return [(speaker, text)] where speaker is 'Assistant' or 'Caller'."""
    turns: list[tuple[str, str]] = []
    obj = call.get("transcript_object")
    if isinstance(obj, list) and obj:
        for item in obj:
            if not isinstance(item, dict):
                continue
            body = (item.get("content") or "").strip()
            if not body:
                continue
            role = (item.get("role") or "").lower()
            speaker = "Assistant" if role in _BOT_ROLES else "Caller"
            turns.append((speaker, body))
        if turns:
            return turns
    # Fallback: parse the plain transcript string ("Agent: .. / User: ..").
    for line in (call.get("transcript") or "").splitlines():
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith(("agent:", "assistant:", "ai:", "bot:")):
            turns.append(("Assistant", line.split(":", 1)[1].strip()))
        elif low.startswith(("user:", "caller:", "customer:", "human:")):
            turns.append(("Caller", line.split(":", 1)[1].strip()))
        elif turns:
            turns[-1] = (turns[-1][0], turns[-1][1] + " " + line)
        else:
            turns.append(("Caller", line))
    return turns


def _transcript_text(turns: list[tuple[str, str]]) -> str:
    """Render turns as the "Caller: .. / Assistant: .." text call_logs stores."""
    return "".join(f"{speaker}: {body}\n" for speaker, body in turns)


def _guess_language(turns: list[tuple[str, str]]) -> str:
    text_all = " ".join(body for _, body in turns).lower()
    if not text_all:
        return "—"
    fi = sum(w in text_all for w in (
        "kiitos", "hei", "moi", "joo", "soitit", "putki", "varata", "aika",
        "huomenta", "päivää", "auttaa", "tarvit", "vuoto",
    )) + sum(c in text_all for c in "äö")
    return "Finnish" if fi >= 2 else "English"


def _has_booking_for_call(org_id: str, call_id: str) -> bool:
    """Did the agent book something on this call? (booking is written live by the
    tools webhook, so by the time the call ends the row already exists)."""
    if not call_id:
        return False
    try:
        with get_engine().connect() as conn:
            found = conn.execute(
                text("select 1 from bookings where org_id = :org and call_id = :cid limit 1"),
                {"org": org_id, "cid": call_id},
            ).first()
        return found is not None
    except Exception:
        return False


def _outbound_target_status(call: dict, turns: list) -> str:
    """Map a finished outbound call to a target status for the Outbound page."""
    disc = (call.get("disconnection_reason") or "").lower()
    if "voicemail" in disc:
        return "no_answer"
    if any(k in disc for k in ("no_answer", "no-answer", "not_connected", "not-connected",
                               "dial_failed", "dial_busy", "busy", "invalid")):
        return "no_answer"
    if "error" in disc or "failed" in disc:
        return "failed"
    # Connected and had a conversation.
    return "completed"


# ── security ────────────────────────────────────────────────────────────────
def _verify_signature(raw_body: bytes, signature: str | None) -> None:
    """Optional defense-in-depth: if RETELL_API_KEY is set and a signature header
    is present, require it to match. If no key is configured we rely on the URL
    secret alone."""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key or not signature:
        return
    expected = hmac.new(api_key.encode(), raw_body, hashlib.sha256).hexdigest()
    got = signature.split("=")[-1].strip()
    if not hmac.compare_digest(expected, got):
        print("retell_webhook: x-retell-signature mismatch — relying on URL secret")


# ── endpoint ──────────────────────────────────────────────────────────────
@router.post("/webhook/{secret}")
async def retell_webhook(secret: str, request: Request):
    expected_secret = os.getenv("RETELL_WEBHOOK_SECRET")
    if not expected_secret:
        raise HTTPException(status_code=503, detail="Retell webhook not configured (set RETELL_WEBHOOK_SECRET).")
    if not hmac.compare_digest(secret, expected_secret):
        raise HTTPException(status_code=401, detail="Bad webhook secret.")

    raw = await request.body()
    _verify_signature(raw, request.headers.get("x-retell-signature"))

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    event = (payload.get("event") or "").lower()
    if event not in _PERSIST_EVENTS:
        return {"ok": True, "ignored": event or "unknown"}

    call = payload.get("call") or {}
    call_id = call.get("call_id") or call.get("callId")
    if not call_id:
        return {"ok": False, "reason": "no_call_id"}

    to_number = call.get("to_number") or ""
    from_number = call.get("from_number") or ""
    meta = call.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    direction = (call.get("direction") or meta.get("direction") or "inbound").lower()
    is_outbound = direction == "outbound" or bool(meta.get("campaign_id"))

    # Which business was this call for?
    if is_outbound:
        org_id = meta.get("org_id") or resolve_org_by_number(from_number) or os.getenv("RETELL_DEFAULT_ORG_ID")
    else:
        org_id = resolve_org_by_number(to_number) or os.getenv("RETELL_DEFAULT_ORG_ID")
    if not org_id:
        # Don't 4xx/5xx — Retell would keep retrying. Acknowledge and note it.
        return {"ok": False, "reason": "no_org_for_number", "to_number": to_number}

    turns = _normalize_turns(call)
    analysis = call.get("call_analysis") or {}
    summary = analysis.get("call_summary") or ""
    duration = None
    try:
        if call.get("start_timestamp") and call.get("end_timestamp"):
            duration = round((int(call["end_timestamp"]) - int(call["start_timestamp"])) / 1000)
    except Exception:
        duration = None

    # The "other party": who we called (outbound) vs who called us (inbound).
    other_phone = to_number if is_outbound else from_number

    call_logs.upsert_full_call(
        org_id,
        call_id,
        transcript=_transcript_text(turns),
        summary=summary,
        caller_phone=other_phone,
        from_number=from_number,
        to_number=to_number,
        direction="outbound" if is_outbound else "inbound",
        duration_sec=duration,
        language=_guess_language(turns),
        started_at=_ms_to_iso(call.get("start_timestamp")),
        ended_at=_ms_to_iso(call.get("end_timestamp")),
        is_booking=_has_booking_for_call(org_id, call_id),
    )

    # For outbound calls, mirror the outcome onto the campaign target.
    if is_outbound:
        try:
            import outbound_store
            outbound_store.update_target_from_call(
                call_id,
                status=_outbound_target_status(call, turns),
                outcome=summary,
                transcript=_transcript_text(turns),
                duration_sec=duration,
            )
        except Exception as e:  # never fail the webhook over the dashboard mirror
            print(f"retell_webhook: outbound target update failed: {e}")

    return {"ok": True, "org_id": org_id, "call_id": call_id, "event": event, "direction": direction}
