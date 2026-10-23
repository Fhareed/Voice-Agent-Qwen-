#!/usr/bin/env python3
"""Seed realistic demo calls + bookings into the database for the /ui pages.

The /ui/dashboard and /ui/bookings pages render LIVE data from the database.
Until real phone calls have flowed in, the database is empty and those pages
show their empty state. This script fills an org with a believable week of
calls and bookings so you can demo the product — then clear them again with
one flag when you're done.

Usage (run from the repo root, with your .env in place):

    python scripts/seed_demo.py            # insert the demo data
    python scripts/seed_demo.py --clear    # remove ONLY the seeded rows
    python scripts/seed_demo.py --org <id> # target a specific organization

Which org? By default the same one the UI pages use:
LUMIDESK_UI_ORG_ID or RETELL_DEFAULT_ORG_ID, else the first organization in
the database. Every row this script writes is tagged with a 'seed-' call_id,
so --clear removes exactly what it added and never touches real calls.

Times are written in THIS machine's local timezone, so they line up with the
clock on the calendar when you view the pages on the same machine.
"""
import argparse
import os
import sys
from datetime import datetime, timedelta

# Make the repo root importable (db.py, call_logs.py live there), whichever
# directory you launch this from.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from dotenv import load_dotenv  # noqa: E402
from sqlalchemy import text  # noqa: E402

load_dotenv(os.path.join(_REPO_ROOT, ".env"))

from db import get_engine  # noqa: E402

SEED_CALL_PREFIX = "seed-call-"
SEED_BOOK_PREFIX = "seed-bk-"


def resolve_org(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    oid = os.getenv("LUMIDESK_UI_ORG_ID") or os.getenv("RETELL_DEFAULT_ORG_ID")
    if oid:
        return oid
    with get_engine().connect() as conn:
        row = (
            conn.execute(text("select id, name from organizations order by created_at limit 1"))
            .mappings()
            .first()
        )
    return str(row["id"]) if row else None


def clear(org_id: str) -> None:
    with get_engine().begin() as conn:
        b = conn.execute(
            text("delete from bookings where org_id = :o and call_id like :p"),
            {"o": org_id, "p": SEED_BOOK_PREFIX + "%"},
        )
        c = conn.execute(
            text("delete from call_logs where org_id = :o and call_id like :p"),
            {"o": org_id, "p": SEED_CALL_PREFIX + "%"},
        )
    print(f"🧹 Removed {c.rowcount} seeded calls and {b.rowcount} seeded bookings.")


def seed(org_id: str) -> None:
    now = datetime.now().astimezone()                 # local, timezone-aware
    monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    def ago(minutes=0, hours=0, days=0):
        return now - timedelta(minutes=minutes, hours=hours, days=days)

    def slot(day, h, m, dur_min):
        s = (monday + timedelta(days=day)).replace(hour=h, minute=m)
        return s, s + timedelta(minutes=dur_min)

    # ── Calls (the "Recent calls" feed + dashboard metrics) ──────────────
    # (name, phone, summary, intent, is_booking, status, dur_sec, lang, created_at)
    calls = [
        ("Mika Virtanen", "+358 40 555 1180",
         "Burst pipe under the kitchen sink, water on the floor. Booked the first slot tomorrow morning.",
         "Emergency booking", True, "unresolved", 108, "finnish", ago(minutes=2)),
        ("Laura Mäkelä", "+358 40 555 7788",
         "No hot water since this morning, elderly tenant in the flat. Needs a same-day callout.",
         "Urgent — no hot water", False, "unresolved", 130, "finnish", ago(minutes=40)),
        (None, "+358 44 712 9908",
         "Wants a quote for a new electric water heater and a callback with pricing this afternoon.",
         "Water heater quote", False, "unresolved", 62, "finnish", ago(minutes=18)),
        ("Sofia Koivu", "+358 44 119 2200",
         "Radiator not heating in one room. Booked a diagnostic visit for later this week.",
         "Radiator diagnostic", True, "unresolved", 155, "english", ago(hours=1)),
        ("Antti Nieminen", "+358 44 712 0099",
         "Bathroom renovation question — wants a site visit to quote. No slot taken yet.",
         "Bathroom quote visit", False, "unresolved", 80, "finnish", ago(hours=2)),
        ("Tomi Heikkilä", "+358 40 221 3311",
         "Just checking the opening hours for Saturday. Answered — no visit needed.",
         "Opening hours", False, "resolved", 44, "finnish", ago(hours=3)),
        ("Eero Salmi", "+358 40 221 7788",
         "Three radiators cold upstairs. Booked a bleed-and-balance visit.",
         "Radiator bleed", True, "resolved", 95, "finnish", ago(hours=5)),
        ("Omar Rahim", "+358 44 330 7781",
         "Supplying and fitting a new WC. Booked the fitting.",
         "Toilet replacement", True, "resolved", 140, "english", ago(days=1, hours=2)),
        ("Liisa Aho", "+358 44 980 1122",
         "Dripping mixer tap in the kitchen — asked for advice, happy to wait for a routine slot.",
         "Leaking tap", False, "resolved", 70, "finnish", ago(days=1, hours=4)),
        ("Zara Holappa", "+358 50 442 1180",
         "Re-routing pipework for a new kitchen. Booked a first visit.",
         "Pipe re-route", True, "unresolved", 120, "english", ago(days=2, hours=1)),
    ]

    # ── Bookings (the week calendar) ─────────────────────────────────────
    # (name, phone, email, service, (day,h,m,dur), notes, status)
    bookings = [
        ("Eero Salmi", "+358 40 221 7788", None, "Radiator bleed & balance",
         slot(0, 8, 30, 90), "Three radiators cold upstairs since the weekend.", "completed"),
        ("Liisa Aho", "+358 44 980 1122", None, "Leaking tap",
         slot(0, 10, 30, 60), "Dripping mixer tap in the kitchen.", "completed"),
        ("Hakala", "+358 50 118 4420", None, "Drain unblock",
         slot(0, 13, 0, 60), "Slow-draining shower.", "booked"),
        ("Jasper Niemi", "+358 40 552 9011", None, "Boiler inspection",
         slot(1, 9, 0, 45), "Annual service.", "completed"),
        ("Mika Virtanen", "+358 40 555 1180", None, "Emergency leak",
         slot(1, 10, 0, 90), "Burst pipe under the kitchen sink, water on the floor.", "booked"),
        ("Omar Rahim", "+358 44 330 7781", "omar.rahim@example.fi", "Toilet replacement",
         slot(1, 13, 15, 75), "Supplying and fitting a new WC.", "booked"),
        ("Ethan Koski", "+358 50 771 2235", None, "Shower mixer fit",
         slot(2, 9, 30, 60), "Customer supplies the mixer.", "booked"),
        ("Sophie Laine", "+358 40 664 9008", "sophie.laine@example.fi", "Bathroom — quote visit",
         slot(2, 12, 0, 90), "Full bathroom refit, on-site quote.", "booked"),
        ("Clara Mäki", "+358 44 210 5567", None, "Water heater check",
         slot(2, 14, 45, 60), "No hot water in the mornings.", "cancelled"),
        ("Laura Mäkelä", "+358 40 555 7788", None, "No hot water — urgent",
         slot(3, 8, 0, 90), "Elderly tenant, no hot water since morning. Same-day callout.", "booked"),
        ("Sofia Koivu", "+358 44 119 2200", None, "Radiator diagnostic",
         slot(3, 9, 45, 75), "One room not heating.", "booked"),
        ("Antti Laine", "+358 44 712 9908", None, "Water heater — quote",
         slot(3, 13, 0, 60), "Replace an old electric water heater, wants pricing.", "booked"),
        ("Zara Holappa", "+358 50 442 1180", None, "Pipe re-route",
         slot(4, 9, 0, 90), "Re-routing pipework for a new kitchen.", "booked"),
    ]

    with get_engine().begin() as conn:
        # Clear any previous seed so re-running stays idempotent.
        conn.execute(
            text("delete from bookings where org_id = :o and call_id like :p"),
            {"o": org_id, "p": SEED_BOOK_PREFIX + "%"},
        )
        conn.execute(
            text("delete from call_logs where org_id = :o and call_id like :p"),
            {"o": org_id, "p": SEED_CALL_PREFIX + "%"},
        )

        for i, (name, phone, summary, intent, is_booking, status, dsec, langg, created) in enumerate(calls):
            ended = created + timedelta(seconds=dsec)
            conn.execute(
                text(
                    "insert into call_logs "
                    "(org_id, call_id, created_at, updated_at, transcript, summary, "
                    " caller_name, caller_phone, intent, is_booking, status, "
                    " duration_sec, language, started_at, ended_at) values "
                    "(:org, :cid, :created, :created, :tr, :summary, :name, :phone, "
                    " :intent, :isb, :status, :dur, :lang, :started, :ended)"
                ),
                {
                    "org": org_id, "cid": f"{SEED_CALL_PREFIX}{i}",
                    "created": created, "tr": f"Caller: {summary}\n",
                    "summary": summary, "name": name, "phone": phone,
                    "intent": intent, "isb": is_booking, "status": status,
                    "dur": dsec, "lang": langg, "started": created, "ended": ended,
                },
            )

        for i, (name, phone, email, service, (start, end), notes, status) in enumerate(bookings):
            conn.execute(
                text(
                    "insert into bookings "
                    "(org_id, call_id, customer_name, customer_phone, customer_email, "
                    " service, start_ts, end_ts, notes, status, created_at) values "
                    "(:org, :cid, :name, :phone, :email, :svc, :start, :end, :notes, :status, :created)"
                ),
                {
                    "org": org_id, "cid": f"{SEED_BOOK_PREFIX}{i}",
                    "name": name, "phone": phone, "email": email, "svc": service,
                    "start": start, "end": end, "notes": notes, "status": status,
                    "created": now - timedelta(days=1),
                },
            )

    print(f"✅ Seeded {len(calls)} calls and {len(bookings)} bookings for org {org_id}.")
    print("   Open http://localhost:8000/ui/dashboard and /ui/bookings to see them.")
    print("   Run  python scripts/seed_demo.py --clear  to remove them again.")


def main():
    ap = argparse.ArgumentParser(description="Seed or clear demo data for the /ui pages.")
    ap.add_argument("--clear", action="store_true", help="Remove previously seeded rows and exit.")
    ap.add_argument("--org", default=None, help="Target organization id (defaults to the UI org).")
    args = ap.parse_args()

    org_id = resolve_org(args.org)
    if not org_id:
        print("❌ No organization found. Create one first (sign up + create an org), "
              "or pass --org <id>.")
        sys.exit(1)

    if args.clear:
        clear(org_id)
    else:
        seed(org_id)


if __name__ == "__main__":
    main()
