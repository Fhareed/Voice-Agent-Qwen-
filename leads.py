"""Store marketing-site leads (the "Book a demo" / "Hear it live" forms).

This is written to by a PUBLIC endpoint, so keep it simple and defensive:
- only keep a known set of fields (ignore anything else a caller sends)
- cap every field's length so a bad actor can't write huge records
- append one JSON object per line to a file (LEADS_FILE) - easy to tail/import later

When you outgrow a flat file, swap save_lead() to insert into Supabase instead;
nothing else has to change.
"""
import json
import os
import time

LEADS_FILE = os.getenv("LEADS_FILE", "leads.jsonl")
_ALLOWED = ("kind", "name", "phone", "business", "website", "email", "note", "page", "ts")
_MAXLEN = 500


def _clean(v) -> str:
    return str(v).replace("\n", " ").strip()[:_MAXLEN]


def save_lead(data: dict) -> dict:
    """Append one lead to LEADS_FILE and return the stored record."""
    rec = {k: _clean(data.get(k, "")) for k in _ALLOWED if data.get(k)}
    rec["received_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with open(LEADS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec
