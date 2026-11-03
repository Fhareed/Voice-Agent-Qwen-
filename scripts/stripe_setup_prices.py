"""Create (idempotently) the LumiDesk Stripe prices with stable lookup_keys.

Run on the server — its .env's STRIPE_SECRET_KEY decides TEST vs LIVE mode:
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    python scripts/stripe_setup_prices.py

Creates, if missing (matched by lookup_key):
  plan_starter_eur    €79 / month    (Starter)
  plan_pro_eur        €149 / month   (Pro)
  setup_fee_eur       €249 one-time   (Setup fee)
  addon_outbound_eur  €99 / month    (Outbound add-on)

All EUR, tax_behavior=exclusive, product tax_code txcd_10000000 (Electronically
Supplied Services). The backend resolves these by lookup_key, so there are no
Price ids to copy into .env. Safe to re-run — it won't duplicate.
"""
import os

from dotenv import load_dotenv

load_dotenv(".env")

import stripe  # noqa: E402

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

ESS = "txcd_10000000"
WANT = [
    {"lookup": "plan_starter_eur",   "name": "LumiDesk Starter",  "amount": 7900,  "recurring": True},
    {"lookup": "plan_pro_eur",       "name": "LumiDesk Pro",      "amount": 14900, "recurring": True},
    {"lookup": "setup_fee_eur",      "name": "LumiDesk Setup",    "amount": 24900, "recurring": False},
    {"lookup": "addon_outbound_eur", "name": "LumiDesk Outbound", "amount": 9900,  "recurring": True},
]


def main():
    mode = "LIVE" if stripe.api_key.startswith("sk_live") else "TEST"
    print(f"Stripe mode: {mode}\n")
    for w in WANT:
        suffix = "/mo" if w["recurring"] else " once"
        existing = stripe.Price.list(lookup_keys=[w["lookup"]], active=True, limit=1).data
        if existing:
            print(f"  = {w['lookup']:20s} exists  : {existing[0].id}  (€{w['amount'] / 100:.0f}{suffix})")
            continue
        kwargs = {
            "currency": "eur",
            "unit_amount": w["amount"],
            "lookup_key": w["lookup"],
            "tax_behavior": "exclusive",
            "product_data": {"name": w["name"], "tax_code": ESS},
        }
        if w["recurring"]:
            kwargs["recurring"] = {"interval": "month"}
        p = stripe.Price.create(**kwargs)
        print(f"  + {w['lookup']:20s} created : {p.id}  (€{w['amount'] / 100:.0f}{suffix})")
    print("\nDone. The backend finds these by lookup_key — nothing to put in .env.")


if __name__ == "__main__":
    main()
