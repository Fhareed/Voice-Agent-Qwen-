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
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import settings_store

# Env:
#   GOOGLE_CALENDAR_ID           the calendar to read/write (e.g. the business's gmail address)
#   GOOGLE_SERVICE_ACCOUNT_FILE  path to the service-account JSON key file
#   DEFAULT_TZ                   IANA tz, e.g. "Europe/Helsinki" (default) or "America/New_York"
#   BOOKING_SLOT_MINUTES         appointment length in minutes (default 60)
#   BOOKING_DAY_START / _END     business hours, 24h ints (default 8..18)

_SCOPES = ["https://www.googleapis.com/auth/calendar"]
_service = None
_warned_missing_sa_file = False


def tz_for_org(org_id=None) -> ZoneInfo:
    """The org's timezone: its saved `timezone` setting if valid, else DEFAULT_TZ
    env, else Europe/Helsinki. Never raises — bad values fall back."""
    name = None
    if org_id:
        try:
            name = (settings_store.get_settings(org_id) or {}).get("timezone")
        except Exception:
            name = None
    name = (name or os.getenv("DEFAULT_TZ") or "Europe/Helsinki").strip()
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("Europe/Helsinki")


def default_tz() -> ZoneInfo:
    return tz_for_org(None)


def _parse_google_dt(s: str) -> datetime:
    """Parse a Google RFC3339 timestamp into a timezone-aware datetime.

    Google returns UTC times ending in 'Z' (e.g. '2026-10-31T10:00:00Z').
    Python 3.10's datetime.fromisoformat() can't read that trailing 'Z', so we
    normalise it to '+00:00' first. (3.11+ handles 'Z' natively; this keeps us
    working on 3.10 too.)
    """
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def has_service_account() -> bool:
    """True if the Google service-account key file is configured on the server."""
    global _warned_missing_sa_file
    path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")
    if path and not os.path.isfile(path) and not _warned_missing_sa_file:
        _warned_missing_sa_file = True
        print(
            f"⚠️  GOOGLE_SERVICE_ACCOUNT_FILE is set to '{path}' but no file exists "
            "there — Google Calendar is DISABLED (bookings save, but no calendar "
            "events / real availability). Point it at the key file on THIS host."
        )
    return bool(path and os.path.isfile(path))


def service_account_email() -> str | None:
    """The service account's email — the address a business shares their calendar with."""
    path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")
    if not path or not os.path.isfile(path):
        return None
    try:
        import json
        with open(path, "r", encoding="utf-8") as f:
            return (json.load(f) or {}).get("client_email")
    except Exception:
        return None


def _calendar_id_for(org_id=None):
    """The calendar id to use: this org's own connected calendar, else the env default."""
    if org_id:
        try:
            import settings_store
            cid = (settings_store.get_settings(org_id) or {}).get("google_calendar_id")
            if isinstance(cid, str) and cid.strip():
                return cid.strip()
        except Exception:
            pass
    env = os.getenv("GOOGLE_CALENDAR_ID")
    return env.strip() if env and env.strip() else None


def is_configured(org_id=None) -> bool:
    """True if we can read/write a real calendar for this org (service account + a calendar id)."""
    return has_service_account() and bool(_calendar_id_for(org_id))


def test_access(org_id=None):
    """Check the app can actually see the org's calendar. Returns (ok: bool, message: str)."""
    if not has_service_account():
        return (False, "Calendar sync isn't set up on the server yet.")
    cal_id = _calendar_id_for(org_id)
    if not cal_id:
        return (False, "No calendar connected yet.")
    try:
        _get_service().calendars().get(calendarId=cal_id).execute()
        return (True, "Connected — your calendar is reachable.")
    except Exception as e:
        msg = str(e).lower()
        if "404" in msg or "notfound" in msg:
            return (False, "Can't find that calendar — double-check the Calendar ID.")
        if "403" in msg or "forbidden" in msg:
            return (False, "Found it, but it isn't shared with the service account yet.")
        return (False, "Couldn't reach that calendar — check the ID and that it's shared.")


def _get_service():
    """Build (once) an authenticated Google Calendar client. Imports lazily."""
    global _service
    if _service is not None:
        return _service
    from google.oauth2 import service_account  # lazy import
    from googleapiclient.discovery import build  # lazy import

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


def _spread_across_days(slots, max_slots):
    """Pick free times across DIFFERENT days (the earliest open slot on each day),
    so the agent can offer a choice of days instead of four times on one morning."""
    out, seen = [], set()
    for s in slots:
        d = s.date()
        if d in seen:
            continue
        seen.add(d)
        out.append(s)
        if len(out) >= max_slots:
            break
    return out


def suggest_slots(org_id=None, from_dt=None, days=5, max_slots=4):
    """Return up to max_slots free appointment start times (timezone-aware).

    If Google Calendar is configured, real busy periods are removed. If not, the
    same business-hour candidates are returned so the agent can still offer times
    during development.
    """
    tz = tz_for_org(org_id)
    slot_min = int(os.getenv("BOOKING_SLOT_MINUTES", "60"))
    day_start = int(os.getenv("BOOKING_DAY_START", "8"))
    day_end = int(os.getenv("BOOKING_DAY_END", "18"))
    from_dt = from_dt or datetime.now(tz) + timedelta(hours=1)
    to_dt = from_dt + timedelta(days=days)

    candidates = _candidate_slots(from_dt, to_dt, tz, slot_min, day_start, day_end)

    cal_id = _calendar_id_for(org_id)
    if not (has_service_account() and cal_id):
        return _spread_across_days(candidates, max_slots)

    # Remove times that overlap a busy period on the real calendar. If anything in
    # this path fails (calendar not shared yet, Google API error, odd timestamp),
    # we must NOT break the call — fall back to offering the standard business-hour
    # slots so the receptionist can still book.
    try:
        svc = _get_service()
        body = {
            "timeMin": from_dt.isoformat(),
            "timeMax": to_dt.isoformat(),
            "items": [{"id": cal_id}],
        }
        busy = svc.freebusy().query(body=body).execute()
        periods = busy.get("calendars", {}).get(cal_id, {}).get("busy", [])
        busy_ranges = [
            (_parse_google_dt(p["start"]), _parse_google_dt(p["end"])) for p in periods
        ]
    except Exception as e:
        print(f"[calendar] free/busy lookup failed, offering standard slots instead: {e}")
        return _spread_across_days(candidates, max_slots)

    free = []
    for s in candidates:
        e = s + timedelta(minutes=slot_min)
        if not any(s < b_end and e > b_start for b_start, b_end in busy_ranges):
            free.append(s)
    return _spread_across_days(free, max_slots)


def create_event(summary, start_dt, description="", attendee_email=None, org_id=None):
    """Create a calendar event on this org's calendar and return its id. Raises if not connected."""
    cal_id = _calendar_id_for(org_id)
    if not (has_service_account() and cal_id):
        raise RuntimeError("Google Calendar is not connected for this business yet.")
    slot_min = int(os.getenv("BOOKING_SLOT_MINUTES", "60"))
    end_dt = start_dt + timedelta(minutes=slot_min)
    # We do NOT add the caller as a Google "attendee". A service account that
    # reaches the calendar through sharing can't invite guests without Google
    # Workspace domain-wide delegation (impossible on a personal Gmail), and
    # attempting it makes the whole event insert fail. Keep the caller's email in
    # the event details instead, so the info is preserved and the event always
    # lands on the calendar.
    if attendee_email:
        description = (f"{description}\nCaller email: {attendee_email}").strip()
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat()},
        "end": {"dateTime": end_dt.isoformat()},
    }
    created = _get_service().events().insert(
        calendarId=cal_id, body=event
    ).execute()
    return created.get("id")
