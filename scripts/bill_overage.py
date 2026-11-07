"""Bill Pro customers for call-minutes over their monthly fair-use cap.

Pro includes PRO_INCLUDED_MINUTES (default 1000) call-minutes per calendar month.
Minutes beyond that are charged at OVERAGE_CENTS_PER_MIN (default 15 = €0.15/min)
via a Stripe invoice item, then invoiced immediately so it bills on the customer's
card the same way whether they pay monthly or yearly.

Run once a month. It bills the PREVIOUS calendar month and is idempotent — it
records which months it has billed per org (settings.overage_billed), so
re-running is safe. The .env's STRIPE_SECRET_KEY decides TEST vs LIVE.

    cd ~/Voice_Agent && .venv/bin/python scripts/bill_overage.py
    # or bill a specific month:  python scripts/bill_overage.py 2026-10

Crontab (00:05 on the 1st of each month):
    5 0 1 * * cd /home/ubuntu/Voice_Agent && /home/ubuntu/Voice_Agent/.venv/bin/python scripts/bill_overage.py >> /home/ubuntu/overage.log 2>&1
"""
import math
import os
import sys
from calendar import monthrange
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(".env")

import stripe  # noqa: E402
from sqlalchemy import text  # noqa: E402

import settings_store  # noqa: E402
from db import get_engine  # noqa: E402

INCLUDED = int(os.getenv("PRO_INCLUDED_MINUTES", "1000"))
CENTS_PER_MIN = int(os.getenv("OVERAGE_CENTS_PER_MIN", "15"))


def _prev_month(today: datetime):
    return (12, today.year - 1) if today.month == 1 else (today.month - 1, today.year)


def _month_bounds(year: int, month: int):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    last = monthrange(year, month)[1]
    end = datetime(year, month, last, 23, 59, 59, tzinfo=timezone.utc)
    return start, end


def _minutes(org_id: str, start, end) -> int:
    with get_engine().connect() as conn:
        secs = conn.execute(
            text("select coalesce(sum(duration_sec),0) from call_logs "
                 "where org_id = :o and created_at between :s and :e"),
            {"o": org_id, "s": start, "e": end},
        ).scalar() or 0
    return math.ceil(float(secs) / 60.0)


def _pro_orgs():
    with get_engine().connect() as conn:
        rows = conn.execute(
            text("select org_id, data from org_settings "
                 "where lower(data->>'plan') = 'pro' "
                 "and coalesce(data->>'stripe_customer_id','') <> ''")
        ).all()
    return [(str(r[0]), r[1] or {}) for r in rows]


def main():
    if not os.getenv("STRIPE_SECRET_KEY"):
        print("STRIPE_SECRET_KEY not set — aborting.")
        return
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    mode = "LIVE" if stripe.api_key.startswith("sk_live") else "TEST"

    if len(sys.argv) > 1:  # explicit YYYY-MM
        year, month = (int(x) for x in sys.argv[1].split("-"))
    else:
        month, year = _prev_month(datetime.now(timezone.utc))
    key = f"{year:04d}-{month:02d}"
    start, end = _month_bounds(year, month)
    print(f"Overage billing [{mode}] for {key}  "
          f"(included {INCLUDED} min, EUR {CENTS_PER_MIN / 100:.2f}/min over)\n")

    for org_id, data in _pro_orgs():
        billed = data.get("overage_billed") or {}
        if key in billed:
            print(f"  = {org_id}  already billed {key}")
            continue
        minutes = _minutes(org_id, start, end)
        overage = max(0, minutes - INCLUDED)
        if overage <= 0:
            print(f"  . {org_id}  {minutes} min — within cap")
            continue
        amount = overage * CENTS_PER_MIN
        cust = data.get("stripe_customer_id")
        # Create the charge item first, then mark billed (so a failure after this
        # never double-charges on a re-run), then issue the invoice.
        try:
            stripe.InvoiceItem.create(
                customer=cust, amount=amount, currency="eur",
                description=f"Call minutes over plan — {key}: {overage} min x EUR {CENTS_PER_MIN / 100:.2f}",
            )
        except Exception as e:
            print(f"  ! {org_id}  invoice item failed: {e}")
            continue
        billed[key] = {"minutes": minutes, "overage": overage, "amount_cents": amount}
        settings_store.save_settings(org_id, {"overage_billed": billed})
        try:
            stripe.Invoice.create(
                customer=cust, auto_advance=True,
                collection_method="charge_automatically",
                description=f"LumiDesk usage overage {key}",
            )
        except Exception as e:
            print(f"  ~ {org_id}  item added but immediate invoice failed "
                  f"(it will bill on their next invoice): {e}")
        print(f"  + {org_id}  {minutes} min -> {overage} over -> charged EUR {amount / 100:.2f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
