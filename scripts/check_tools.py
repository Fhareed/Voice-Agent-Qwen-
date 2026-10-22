"""Hermetic test for the booking tools (no DB, no Google, no Twilio, no network).

Run:  .venv/bin/python check_tools.py    (or: python check_tools.py)

It mounts ONLY the tools router (so it doesn't drag in the whole app / LLM stack),
monkeypatches the calendar, SMS, and DB-save functions, and checks the contract:
auth, availability, booking, and SMS.
"""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

os.environ["TOOLS_SHARED_SECRET"] = "test-secret-123"

from fastapi import FastAPI
from fastapi.testclient import TestClient

import tools_api

# ---- fakes ----
TZ = ZoneInfo("Europe/Helsinki")
_slot = (datetime.now(TZ) + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)
saved = []

tools_api.calendar_google.suggest_slots = lambda days=5: [_slot, _slot + timedelta(hours=5)]
tools_api.calendar_google.is_configured = lambda: False           # skip real event creation
tools_api.sms_twilio.send = lambda to, body: {"sent": True, "sid": "SMtest", "to": to}
def _fake_save(*a, **k):
    saved.append((a, k)); return "booking-abc-123"
tools_api._save_booking = _fake_save

app = FastAPI()
app.include_router(tools_api.router)
c = TestClient(app)
H = {"X-LumiDesk-Secret": "test-secret-123"}

def ok(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    assert cond, name

# 1) auth: no secret -> 401
r = c.post("/tools/check_availability", json={"org_id": "org1"})
ok("missing secret rejected (401)", r.status_code == 401)

# 2) auth: wrong secret -> 401
r = c.post("/tools/check_availability", json={"org_id": "org1"}, headers={"X-LumiDesk-Secret": "nope"})
ok("wrong secret rejected (401)", r.status_code == 401)

# 3) check_availability -> slots
r = c.post("/tools/check_availability", json={"org_id": "org1", "service": "burst pipe"}, headers=H)
ok("check_availability 200", r.status_code == 200)
body = r.json()
ok("returns 2 slots", len(body["slots"]) == 2)
ok("slot has iso + spoken", "iso" in body["slots"][0] and "spoken" in body["slots"][0])
print("   sample spoken:", body["slots"][0]["spoken"])

# 4) book_appointment -> booking id + spoken confirmation + sms sent
r = c.post("/tools/book_appointment", json={
    "org_id": "org1", "start": _slot.isoformat(),
    "customer_name": "Sarah Miller", "customer_phone": "+15550142",
    "service": "burst pipe", "call_id": "call_9"
}, headers=H)
ok("book_appointment 200", r.status_code == 200)
b = r.json()
ok("booking id returned", b["booking_id"] == "booking-abc-123")
ok("booking persisted (save called)", len(saved) == 1)
ok("sms sent on booking", b["sms"]["sent"] is True)
ok("spoken confirmation present", "You're all set" in b["spoken"])
print("   confirmation:", b["spoken"])

# 5) send_sms
r = c.post("/tools/send_sms", json={"org_id": "org1", "to": "+15550142", "message": "Our address is 12 High St."}, headers=H)
ok("send_sms 200", r.status_code == 200 and r.json()["sent"] is True)

print("\nALL TOOL TESTS PASSED")
