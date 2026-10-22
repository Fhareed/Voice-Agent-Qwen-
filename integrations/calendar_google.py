"""Google Calendar integration for the booking tools.

Design for the MVP / first customer: ONE calendar, configured via env. The
business shares their Google Calendar with a Google service account, and we read
free/busy and create events on it. This is the simplest thing that reaches a
REAL calendar with no per-user OAuth dance.

Later (multi-customer): store a per-org Google refresh token in the database and
pick the calendar per org_id. The rest of the tools layer already passes org_id,
so only this file changes.

Nothing here imports the Google libraries at module load, so the app still boots
if they aren't installed yet or the calendar isn't configured. Call is_configured()
to check; the tools endpoints fall back to generated slots when it returns False,
so the whole flow works end-to-end before you wire real credentials.
"""
import os
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

# Env:
#   GOOGLE_CALENDAR_ID           the calendar to read/write (e.g. the business's gmail address)
#   GOOGLE_SERVICE_ACCOUNT_FILE  path to the service-account JSON key file
#   DEFAULT_TZ                   IANA tz, e.g. "Europe/Helsinki" (default) or "America/New_York"
#   BOOKING_SLOT_MINUTES         appointment length in minutes (default 60)
#   BOOKING_DAY_START / _END     business hours, 24h ints (default 8..18)

_SCOPES = ["https://www.googleapis.com/auth/calendar"]
_service = None


def default_tz() -> ZoneInfo:
    return ZoneInfo(os.getenv("DEFAULT_TZ", "Europe/Helsinki"))


def is_configured() -> bool:
    return bool(os.getenv("GOOGLE_CALENDAR_ID") and os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE"))


def _get_service():
    """Build (once) an authenticated Google Calendar client. Imports lazily."""
    global _service
    if _service is not None:
        return _service
    from google.oauth2 import service_account          # lazy import
    from googleapiclient.discovery import build          # lazy import

    creds = service_account.Credentials.from_service_account_file(
        os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"], scopes=_SCOPES
    )
    _service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    return _service


def _candidate_slots(from_dt, to_dt, tz, slot_min, day_start, day_end):
    """Every business-hour start time between from_dt and to_dt (before removing busy)."""
    slots = []
    day = from_dt.date()
    while day <= to_dt.date():
        # Mon-Fri only for the MVP; trades/clinics tweak this later.
        if day.weekday() < 5:
            t = datetime.combine(day, time(day_start), tzinfo=tz)
            end_of_day = datetime.combine(day, time(day_end), tzinfo=tz)
            while t + timedelta(minutes=slot_min) <= end_of_day:
                if t >= from_dt:
                    slots.append(t)
                t += timedelta(minutes=slot_min)
        day += timedelta(days=1)
    return slots


def suggest_slots(from_dt=None, days=5, max_slots=4):
    """Return up to max_slots free appointment start times (timezone-aware).

    If Google Calendar is configured, real busy periods are removed. If not, the
    same business-hour candidates are returned so the agent can still offer times
    during development.
    """
    tz = default_tz()
    slot_min = int(os.getenv("BOOKING_SLOT_MINUTES", "60"))
    day_start = int(os.getenv("BOOKING_DAY_START", "8"))
    day_end = int(os.getenv("BOOKING_DAY_END", "18"))
    from_dt = from_dt or datetime.now(tz) + timedelta(hours=1)
    to_dt = from_dt + timedelta(days=days)

    candidates = _candidate_slots(from_dt, to_dt, tz, slot_min, day_start, day_end)

    if not is_configured():
        return candidates[:max_slots]

    # Remove times that overlap a busy period on the real calendar.
    svc = _get_service()
    body = {
        "timeMin": from_dt.isoformat(),
        "timeMax": to_dt.isoformat(),
        "items": [{"id": os.environ["GOOGLE_CALENDAR_ID"]}],
    }
    busy = svc.freebusy().query(body=body).execute()
    periods = busy["calendars"][os.environ["GOOGLE_CALENDAR_ID"]].get("busy", [])
    busy_ranges = [
        (datetime.fromisoformat(p["start"]), datetime.fromisoformat(p["end"])) for p in periods
    ]

    free = []
    for s in candidates:
        e = s + timedelta(minutes=slot_min)
        if not any(s < b_end and e > b_start for b_start, b_end in busy_ranges):
            free.append(s)
        if len(free) >= max_slots:
            break
    return free


def create_event(summary, start_dt, description="", attendee_email=None):
    """Create a calendar event and return its id. Raises if not configured."""
    if not is_configured():
        raise RuntimeError("Google Calendar is not configured (set GOOGLE_CALENDAR_ID and GOOGLE_SERVICE_ACCOUNT_FILE).")
    slot_min = int(os.getenv("BOOKING_SLOT_MINUTES", "60"))
    end_dt = start_dt + timedelta(minutes=slot_min)
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat()},
        "end": {"dateTime": end_dt.isoformat()},
    }
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]
    created = _get_service().events().insert(
        calendarId=os.environ["GOOGLE_CALENDAR_ID"], body=event
    ).execute()
    return created.get("id")
