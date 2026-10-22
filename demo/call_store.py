"""Call store for the LumiDesk demo.

Turns Retell's post-call webhook into the line-by-line conversation + the booking
that show on the LumiDesk dashboard. Pure standard library (no database, no heavy
deps) so the demo boots in seconds and can't fail mid-presentation.

Files (next to this module):
  - demo_calls.jsonl     one row per finished call (written here)
  - demo_bookings.jsonl  one row per booking (written by the booking tool)
"""
from __future__ import annotations

import datetime
import json
from pathlib import Path

_DIR = Path(__file__).resolve().parent
CALLS_FILE = _DIR / "demo_calls.jsonl"
BOOKINGS_FILE = _DIR / "demo_bookings.jsonl"

# Retell transcript roles that represent the assistant (everything else = caller).
_BOT_ROLES = {"agent", "assistant", "ai", "bot"}


# ── Retell event ingest ───────────────────────────────────────────────────
def _ms_to_iso(ms) -> str | None:
    try:
        return datetime.datetime.fromtimestamp(int(ms) / 1000).isoformat(timespec="seconds")
    except Exception:
        return None


def _normalize_turns(call: dict) -> list[dict]:
    """Return [{'speaker': 'AI'|'Caller', 'text': str}, ...] from a Retell call."""
    turns: list[dict] = []
    obj = call.get("transcript_object")
    if isinstance(obj, list) and obj:
        for item in obj:
            if not isinstance(item, dict):
                continue
            text = (item.get("content") or "").strip()
            if not text:
                continue
            role = (item.get("role") or "").lower()
            speaker = "AI" if role in _BOT_ROLES else "Caller"
            turns.append({"speaker": speaker, "text": text})
        if turns:
            return turns
    # Fallback: parse the plain transcript string ("Agent: .. / User: ..").
    for line in (call.get("transcript") or "").splitlines():
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith(("agent:", "assistant:", "ai:", "bot:")):
            turns.append({"speaker": "AI", "text": line.split(":", 1)[1].strip()})
        elif low.startswith(("user:", "caller:", "customer:", "human:")):
            turns.append({"speaker": "Caller", "text": line.split(":", 1)[1].strip()})
        elif turns:
            turns[-1]["text"] += " " + line
        else:
            turns.append({"speaker": "Caller", "text": line})
    return turns


def _guess_language(turns: list[dict]) -> str:
    text = " ".join(t["text"] for t in turns).lower()
    if not text:
        return "—"
    fi = sum(w in text for w in (
        "kiitos", "hei", "moi", "joo", "soitit", "putki", "varata", "aika",
        "huomenta", "päivää", "auttaa", "tarvit", "vuoto",
    )) + sum(c in text for c in "äö")
    return "Finnish" if fi >= 2 else "English"


def ingest_retell_event(payload: dict) -> dict | None:
    """Store a finished call from a Retell webhook. Returns the stored record,
    or None for events we don't persist (call_started, transcript_updated, ...)."""
    event = (payload.get("event") or "").lower()
    if event not in ("call_ended", "call_analyzed"):
        return None
    call = payload.get("call") or {}
    call_id = call.get("call_id") or call.get("callId")
    if not call_id:
        return None

    turns = _normalize_turns(call)
    analysis = call.get("call_analysis") or {}
    duration = None
    try:
        if call.get("start_timestamp") and call.get("end_timestamp"):
            duration = round((int(call["end_timestamp"]) - int(call["start_timestamp"])) / 1000)
    except Exception:
        duration = None

    rec = {
        "call_id": call_id,
        "event": event,
        "from_number": call.get("from_number") or "",
        "to_number": call.get("to_number") or "",
        "direction": call.get("direction") or "",
        "started_at": _ms_to_iso(call.get("start_timestamp")),
        "ended_at": _ms_to_iso(call.get("end_timestamp")),
        "duration_sec": duration,
        "turns": turns,
        "summary": analysis.get("call_summary") or "",
        "sentiment": analysis.get("user_sentiment") or "",
        "successful": analysis.get("call_successful"),
        "language": _guess_language(turns),
        "status": "open",  # "open" (unresolved) | "resolved"
        "stored_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    _upsert(rec)
    return rec


def set_status(call_id: str, status: str) -> bool:
    """Mark a call 'resolved' or 'open'. Returns True if a row changed."""
    status = "resolved" if status == "resolved" else "open"
    rows = _read(CALLS_FILE)
    changed = False
    for r in rows:
        if r.get("call_id") == call_id:
            r["status"] = status
            changed = True
    if changed:
        _write(CALLS_FILE, rows)
    return changed


def delete_call(call_id: str) -> bool:
    """Remove a call from the store. Returns True if a row was removed."""
    rows = _read(CALLS_FILE)
    kept = [r for r in rows if r.get("call_id") != call_id]
    if len(kept) != len(rows):
        _write(CALLS_FILE, kept)
        return True
    return False


def _upsert(rec: dict) -> None:
    """Replace any existing row for this call_id. call_analyzed (has the summary)
    should supersede the earlier call_ended for the same call."""
    rows = _read(CALLS_FILE)
    merged: list[dict] = []
    for r in rows:
        if r.get("call_id") == rec["call_id"]:
            if not rec.get("summary") and r.get("summary"):
                rec["summary"] = r["summary"]          # don't lose a summary we already had
            continue
        merged.append(r)
    merged.append(rec)
    _write(CALLS_FILE, merged)


# ── read side (for the dashboard) ─────────────────────────────────────────
def _read(path: Path) -> list[dict]:
    out: list[dict] = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return out


def _write(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _bookings_by_call() -> dict:
    by_call = {}
    for b in _read(BOOKINGS_FILE):
        cid = b.get("call_id")
        if cid:
            by_call[cid] = b
    return by_call


def feed() -> list[dict]:
    """Calls newest-first, each with its linked booking (if any) attached."""
    by_call = _bookings_by_call()
    calls = _read(CALLS_FILE)
    for c in calls:
        c["booking"] = by_call.get(c.get("call_id"))
        c.setdefault("status", "open")
    calls.sort(key=lambda c: c.get("ended_at") or c.get("stored_at") or "", reverse=True)
    return calls
