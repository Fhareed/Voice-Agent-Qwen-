"""Stripe billing: pay-upfront subscription, then provision the agent.

Flow: onboarding collects the business details, then the customer is sent to a
Stripe Checkout session. On successful payment we mark the org paid and
provision its Retell agent (via retell_provision). The browser return hits
confirm_and_provision (synchronous, so the agent is ready when they land on the
dashboard); the webhook is the backup for when they don't return.

stripe is imported lazily so the app still boots when the package or keys aren't
set up yet.

Env it needs:
  STRIPE_SECRET_KEY       required. Secret key (sk_test_… in test mode).
  STRIPE_PRICE_ID         required. The recurring Price id (price_…) for the plan.
  STRIPE_WEBHOOK_SECRET   required for the webhook. Signing secret (whsec_…).
  PUBLIC_APP_URL          the frontend base for success/cancel redirects.
                          Defaults to http://localhost:3000.
"""
import os

import retell_provision
import settings_store


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


def create_checkout(org_id: str, business_name: str, email: str | None) -> str:
    """Create a subscription Checkout Session for this org; return its URL."""
    stripe = _stripe()
    price = os.getenv("STRIPE_PRICE_ID")
    if not price:
        raise BillingError("STRIPE_PRICE_ID is not set (create a recurring price in Stripe).")
    app_url = _app_url()
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price, "quantity": 1}],
        success_url=f"{app_url}/app/welcome?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{app_url}/app/onboarding?canceled=1",
        client_reference_id=org_id,
        metadata={"org_id": org_id},
        subscription_data={"metadata": {"org_id": org_id}},
        **({"customer_email": email} if email else {}),
    )
    return session.url


def _mark_paid_and_provision(org_id: str, customer, subscription) -> str | None:
    """Mark the org paid and provision its agent if it doesn't have one yet."""
    settings = settings_store.get_settings(org_id)
    settings_store.save_settings(org_id, {
        "onboarded": True,
        "paid": True,
        "stripe_customer_id": customer,
        "stripe_subscription_id": subscription,
    })
    agent_id = settings.get("retell_agent_id")
    if not agent_id:
        name = settings.get("business_name") or ""
        try:
            result = retell_provision.provision_org(org_id, settings, name)
            agent_id = result.get("agent_id")
        except retell_provision.ProvisionError:
            agent_id = None  # payment succeeded; provisioning can be retried
    return agent_id


def confirm_and_provision(org_id: str, session_id: str) -> dict:
    """Verify a returned Checkout session is paid (and ours), then provision."""
    stripe = _stripe()
    session = stripe.checkout.Session.retrieve(session_id)
    meta_org = (session.get("metadata") or {}).get("org_id")
    if meta_org and meta_org != org_id:
        raise BillingError("This payment doesn't belong to your account.")
    if session.get("payment_status") != "paid" and session.get("status") != "complete":
        raise BillingError("Payment hasn't completed yet.")
    agent_id = _mark_paid_and_provision(org_id, session.get("customer"), session.get("subscription"))
    return {"paid": True, "agent_id": agent_id}


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify and handle a Stripe webhook (the backup path for provisioning)."""
    stripe = _stripe()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise BillingError("STRIPE_WEBHOOK_SECRET is not set.")
    event = stripe.Webhook.construct_event(payload, sig_header, secret)
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        org_id = (session.get("metadata") or {}).get("org_id")
        if org_id:
            _mark_paid_and_provision(org_id, session.get("customer"), session.get("subscription"))
    return {"received": True}
