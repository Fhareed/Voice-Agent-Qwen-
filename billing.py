"""Stripe billing: plan + one-time setup fee, then provision.

Onboarding collects the business details and the chosen plan, then sends the
customer to Stripe Checkout (subscription mode) with the plan's recurring price
PLUS a one-time €249 setup fee on the first invoice (skipped if they've already
paid it), plus an optional outbound add-on. On success we mark the org paid,
record the plan, and provision the Retell agent (+ a phone number when
RETELL_AUTO_BUY_NUMBER is on). The browser return hits confirm_and_provision
(synchronous); the webhook is the backup.

Prices are resolved by stable lookup_key — create them with
scripts/stripe_setup_prices.py — so there are no Price ids to copy into .env.

Env:
  STRIPE_SECRET_KEY      required. sk_test_… (test) or sk_live_… (live).
  STRIPE_WEBHOOK_SECRET  required for the webhook (whsec_…).
  PUBLIC_APP_URL         frontend base for redirects (default http://localhost:3000).
  STRIPE_AUTOMATIC_TAX   optional "1" to enable Stripe Tax (EU VAT) at checkout —
                         only turn on once Stripe Tax is activated with your address.
  STRIPE_PRICE_ID        optional legacy fallback for the plan price.
"""
import os

import retell_provision
import settings_store

PLAN_LOOKUP = {"starter": "plan_starter_eur", "pro": "plan_pro_eur"}
SETUP_LOOKUP = "setup_fee_eur"
OUTBOUND_LOOKUP = "addon_outbound_eur"

_price_cache: dict = {}


class BillingError(RuntimeError):
    """Raised when billing can't proceed (missing config or a Stripe error)."""


def _stripe():
    try:
        import stripe  # lazy — the app boots without the package installed
    except ImportError as e:
        raise BillingError("The 'stripe' package isn't installed (pip install stripe).") from e
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise BillingError("STRIPE_SECRET_KEY is not set.")
    stripe.api_key = key
    return stripe


def _app_url() -> str:
    return (os.getenv("PUBLIC_APP_URL") or "http://localhost:3000").rstrip("/")


def _sv(obj, key, default=None):
    """Read a field from a Stripe object (a StripeObject doesn't support .get())."""
    try:
        val = getattr(obj, key)
    except Exception:
        return default
    return default if val is None else val


def _price_by_lookup(lookup_key: str):
    """Resolve a Price id from its lookup_key (cached). None if not found."""
    if lookup_key in _price_cache:
        return _price_cache[lookup_key]
    stripe = _stripe()
    try:
        found = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
    except Exception:
        found = []
    pid = found[0].id if found else None
    if pid:
        _price_cache[lookup_key] = pid
    return pid


def _plan_price_id(plan: str) -> str:
    lookup = PLAN_LOOKUP.get((plan or "pro").lower())
    pid = _price_by_lookup(lookup) if lookup else None
    if not pid:
        pid = os.getenv("STRIPE_PRICE_ID")  # legacy fallback
    if not pid:
        raise BillingError(
            f"No Stripe price for plan '{plan}'. Run scripts/stripe_setup_prices.py to create the "
            "plan prices (or set STRIPE_PRICE_ID)."
        )
    return pid


def create_checkout(org_id: str, business_name: str, email, plan: str = "pro", outbound: bool = False) -> str:
    """Create a subscription Checkout Session (plan + one-time setup fee). Returns the URL."""
    stripe = _stripe()
    app_url = _app_url()
    settings = settings_store.get_settings(org_id)
    plan = (plan or "pro").lower()

    line_items = [{"price": _plan_price_id(plan), "quantity": 1}]

    # One-time setup fee on the first invoice, unless this org already paid it.
    if not settings.get("setup_fee_paid"):
        setup = _price_by_lookup(SETUP_LOOKUP)
        if setup:
            line_items.append({"price": setup, "quantity": 1})

    if outbound:
        ob = _price_by_lookup(OUTBOUND_LOOKUP)
        if ob:
            line_items.append({"price": ob, "quantity": 1})

    kwargs = {
        "mode": "subscription",
        "line_items": line_items,
        "success_url": f"{app_url}/app/welcome?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{app_url}/app/onboarding?canceled=1",
        "client_reference_id": org_id,
        "metadata": {"org_id": org_id, "plan": plan, "outbound": str(bool(outbound)).lower()},
        "subscription_data": {"metadata": {"org_id": org_id, "plan": plan}},
    }
    if email:
        kwargs["customer_email"] = email
    if (os.getenv("STRIPE_AUTOMATIC_TAX") or "").strip().lower() in ("1", "true", "yes"):
        kwargs["automatic_tax"] = {"enabled": True}
        kwargs["tax_id_collection"] = {"enabled": True}

    session = stripe.checkout.Session.create(**kwargs)
    return session.url


def _mark_paid_and_provision(org_id: str, customer, subscription, plan=None) -> str | None:
    """Mark the org paid, record the plan + setup-fee-paid, provision agent (+ number)."""
    settings = settings_store.get_settings(org_id)
    patch = {
        "onboarded": True,
        "paid": True,
        "setup_fee_paid": True,
        "stripe_customer_id": customer,
        "stripe_subscription_id": subscription,
    }
    if plan:
        patch["plan"] = plan
    settings_store.save_settings(org_id, patch)

    agent_id = settings.get("retell_agent_id")
    if not agent_id:
        name = settings.get("business_name") or ""
        try:
            result = retell_provision.provision_org(org_id, settings, name)
            agent_id = result.get("agent_id")
        except retell_provision.ProvisionError:
            agent_id = None  # payment succeeded; provisioning can be retried

    # Give the business a real phone line + bind the agent. Opt-in via env so it
    # never fires unexpectedly in dev/test; US/CA numbers only (EU customers
    # forward their existing number to this one, or import via SIP).
    _auto = (os.getenv("RETELL_AUTO_BUY_NUMBER") or "").strip().lower()
    if agent_id and _auto not in ("", "0", "false", "no"):
        try:
            import numbers_api
            numbers_api.ensure_number_for_org(org_id)  # reuse existing number, else buy; maps it
        except Exception as e:
            print(f"[billing] auto number provisioning skipped: {e}")
    return agent_id


def confirm_and_provision(org_id: str, session_id: str) -> dict:
    """Verify a returned Checkout session is paid (and ours), then provision."""
    stripe = _stripe()
    session = stripe.checkout.Session.retrieve(session_id)
    meta = _sv(session, "metadata") or {}
    meta_org = _sv(meta, "org_id")
    plan = _sv(meta, "plan")
    if meta_org and meta_org != org_id:
        raise BillingError("This payment doesn't belong to your account.")
    if _sv(session, "payment_status") != "paid" and _sv(session, "status") != "complete":
        raise BillingError("Payment hasn't completed yet.")
    agent_id = _mark_paid_and_provision(
        org_id, _sv(session, "customer"), _sv(session, "subscription"), plan=plan
    )
    return {"paid": True, "agent_id": agent_id, "plan": plan}


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify and handle a Stripe webhook (the backup path for provisioning)."""
    stripe = _stripe()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise BillingError("STRIPE_WEBHOOK_SECRET is not set.")
    event = stripe.Webhook.construct_event(payload, sig_header, secret)
    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        session = event["data"]["object"]
        meta = _sv(session, "metadata") or {}
        org_id = _sv(meta, "org_id")
        plan = _sv(meta, "plan")
        if org_id:
            _mark_paid_and_provision(
                org_id, _sv(session, "customer"), _sv(session, "subscription"), plan=plan
            )
    return {"received": True}
