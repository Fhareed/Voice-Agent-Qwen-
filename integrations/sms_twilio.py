"""Twilio SMS for booking confirmations.

Env:
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_SMS_FROM     the Twilio number (or messaging-service SID) texts are sent from

If not configured, send() is a safe no-op that returns {"sent": False, "reason":
"not_configured"} so the booking flow still works before you wire Twilio.
The Twilio SDK is imported lazily so the app boots without it installed.
"""
import os


def is_configured() -> bool:
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID")
        and os.getenv("TWILIO_AUTH_TOKEN")
        and os.getenv("TWILIO_SMS_FROM")
    )


def send(to: str, body: str) -> dict:
    """Send one SMS. Returns {"sent": bool, ...}. Never raises to the caller."""
    if not is_configured():
        return {"sent": False, "reason": "not_configured"}
    try:
        from twilio.rest import Client  # lazy import
        client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
        msg = client.messages.create(to=to, from_=os.environ["TWILIO_SMS_FROM"], body=body)
        return {"sent": True, "sid": msg.sid}
    except Exception as e:  # never let SMS failure break a booking
        return {"sent": False, "reason": str(e)}
