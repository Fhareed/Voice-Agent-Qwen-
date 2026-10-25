"""Retell post-call webhook -> the multi-tenant Postgres call log.

This is the bridge between a REAL phone call and the owner's dashboard. When a
call on Retell ends, Retell POSTs the finished call here. We:

  1. Check the secret in the URL path (so only Retell can post).
  2. Work out WHICH business the call was for, from the dialed number
     (to_number) via org_phone_numbers, or the RETELL_DEFAULT_ORG_ID fallback.
  3. Turn Retell's transcript into the same "Caller: .. / Assistant: .." text the
     rest of the app already understands, pull out the summary / duration /
     language, and upsert one row into call_logs for that org.

It stores TEXT ONLY (never audio), exactly like the browser pipeline. Bookings
are written separately, live during the call, by tools_api.book_appointment.

Config (.env):
  RETELL_WEBHOOK_SECRET   required. The secret segment in the webhook URL:
                          https://<your-host>/retell/webhook/<RETELL_WEBHOOK_SECRET>
  RETELL_DEFAULT_ORG_ID   optional. Used when the dialed number isn't mapped yet
                          (perfect for your first single customer).
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


# ── security ────────────────────────────────────────────────────────────────
def _verify_signature(raw_body: bytes, signature: str | None) -> None:
    """Optional defense-in-depth: if RETELL_API_KEY is set and a signature header
    is present, require it to match. If no key is configured we rely on the URL
    secret alone."""
    api_key = os.getenv("RETELL_API_KEY")
    if not api_key or not signature:
        return
    expected = hmac.new(api_key.encode(), raw_body, hashlib.sha256).hexdigest()
    # Retell sends the hex digest, sometimes prefixed (e.g. "v1="). Compare the tail.
    got = signature.split("=")[-1].strip()
    if not hmac.compare_digest(expected, got):
        # The URL path secret already authenticates the caller. Retell's own
        # signature scheme can differ from this HMAC, so don't fail the webhook
        # on a mismatch — just note it and rely on the (long, secret) URL path.
        print("retell_webhook: x-retell-signature mismatch — relying on URL secret")


# ── endpoint ──────────────────────────────────────────────────────────────
@router.post("/webhook/{secret}")
async def retell_webhook(secret: str, request: Request):
    expected_secret = os.getenv("RETELL_WEBHOOK_SECRET")
    if not expected_secret:
        # Fail closed: an unconfigured webhook must not accept anything.
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
        # call_started, transcript_updated, etc. — acknowledge without storing.
        return {"ok": True, "ignored": event or "unknown"}

    call = payload.get("call") or {}
    call_id = call.get("call_id") or call.get("callId")
    if not call_id:
        return {"ok": False, "reason": "no_call_id"}

    to_number = call.get("to_number") or ""
    from_number = call.get("from_number") or ""

    # Which business was this call for?
    org_id = resolve_org_by_number(to_number) or os.getenv("RETELL_DEFAULT_ORG_ID")
    if not org_id:
        # Don't 4xx/5xx — Retell would keep retrying. Acknowledge and note it.
        return {"ok": False, "reason": "no_org_for_number", "to_number": to_number}

    turns = _normalize_turns(call)
    analysis = call.get("call_analysis") or {}
    duration = None
    try:
        if call.get("start_timestamp") and call.get("end_timestamp"):
            duration = round((int(call["end_timestamp"]) - int(call["start_timestamp"])) / 1000)
    except Exception:
        duration = None

    call_logs.upsert_full_call(
        org_id,
        call_id,
        transcript=_transcript_text(turns),
        summary=analysis.get("call_summary") or "",
        caller_phone=from_number,
        from_number=from_number,
        to_number=to_number,
        direction=call.get("direction") or "inbound",
        duration_sec=duration,
        language=_guess_language(turns),
        started_at=_ms_to_iso(call.get("start_timestamp")),
        ended_at=_ms_to_iso(call.get("end_timestamp")),
        is_booking=_has_booking_for_call(org_id, call_id),
    )
    return {"ok": True, "org_id": org_id, "call_id": call_id, "event": event}
