"""Pull a short lead summary out of a call transcript, using the LLM.

Runs once, when a call ends (off the voice hot-path), so it never slows a reply.
Returns a plain dict; on any hiccup it degrades to a bare summary so the call
still shows up in the dashboard.
"""
import json
import re

_INSTRUCTIONS = (
    "You are reading the transcript of a phone call between a customer and a local "
    "service business's receptionist. Pull out the key details as JSON with exactly "
    "these keys:\n"
    '  "summary": one short sentence on what the caller wanted,\n'
    '  "caller_name": their name if they gave one, else null,\n'
    '  "caller_phone": their phone number if they gave one, else null,\n'
    '  "intent": a 1-3 word label like "quote", "booking", "question", "complaint",\n'
    '  "is_booking": true if they want to book or schedule a job, else false,\n'
    '  "booking_details": what they want done and when, if it is a booking, else null.\n'
    "Only use what is actually in the transcript; use null when unsure. "
    "Reply with ONLY the JSON object, nothing else.\n\n"
    "Transcript:\n"
)

_EMPTY = {
    "summary": None, "caller_name": None, "caller_phone": None,
    "intent": None, "is_booking": False, "booking_details": None,
}


def extract_lead(llm, transcript: str) -> dict:
    """Return {summary, caller_name, caller_phone, intent, is_booking, booking_details}."""
    if not transcript or not transcript.strip():
        return dict(_EMPTY)
    try:
        raw = llm.invoke(_INSTRUCTIONS + transcript)
        content = raw if isinstance(raw, str) else getattr(raw, "content", str(raw))
        data = _parse_json(content)
    except Exception as e:
        print(f"⚠️  lead extract failed: {e}")
        data = {}
    return {
        "summary": data.get("summary") or _fallback_summary(transcript),
        "caller_name": data.get("caller_name"),
        "caller_phone": data.get("caller_phone"),
        "intent": data.get("intent"),
        "is_booking": bool(data.get("is_booking")),
        "booking_details": data.get("booking_details"),
    }


def _parse_json(s: str) -> dict:
    # Models sometimes wrap JSON in prose or ```json fences; grab the first {...}.
    m = re.search(r"\{.*\}", s, re.S)
    return json.loads(m.group(0)) if m else {}


def _fallback_summary(transcript: str) -> str:
    first = next(
        (ln for ln in transcript.splitlines() if ln.startswith("Caller:")), ""
    )
    return (first.replace("Caller:", "").strip() or "Call")[:140]
