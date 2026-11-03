"""Buy / import / attach / release phone numbers via Retell.

After an org's agent is provisioned (retell_provision), this gives the org a real
phone line and binds the agent to it — the piece that makes inbound calls actually
reach the business. Two provisioning paths:

  • buy_number()    — purchase a Retell-managed US/CA number (~$2/mo). US customers
                      advertise it directly; EU customers forward their existing
                      national number to it (inbound answering still works, and the
                      customer-facing number stays theirs).
  • import_number() — bring an existing number via SIP/BYOC (native EU numbers, or
                      EU outbound). Needs the customer's SIP termination URI + creds.

Agents are bound with Retell's CURRENT weighted-array fields
(inbound_agents / outbound_agents = [{"agent_id": .., "weight": 1}]). The old
single-string *_agent_id fields were removed by Retell after 2026-03-31.

Env: RETELL_API_KEY (shared with retell_provision).
"""
import os

import httpx

API = "https://api.retellai.com"


class NumberError(RuntimeError):
    """Raised when a Retell phone-number operation can't proceed."""


def _key() -> str:
    k = os.getenv("RETELL_API_KEY")
    if not k:
        raise NumberError("RETELL_API_KEY is not set — add your Retell secret key to .env.")
    return k


def _req(method: str, path: str, body: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=30) as client:
            r = client.request(method, f"{API}{path}", headers=headers, json=body)
    except httpx.HTTPError as e:
        raise NumberError(f"Couldn't reach Retell ({method} {path}): {e}") from e
    if r.status_code >= 300:
        raise NumberError(f"Retell {method} {path} failed ({r.status_code}): {r.text[:300]}")
    if r.status_code == 204 or not r.content:
        return {}
    return r.json()


def _agents(agent_id: str | None):
    """Retell's weighted-agent array for a single agent (or None)."""
    return [{"agent_id": agent_id, "weight": 1}] if agent_id else None


def buy_number(
    inbound_agent_id: str,
    outbound_agent_id: str | None = None,
    *,
    country_code: str = "US",
    area_code=None,
    toll_free: bool = False,
    nickname: str = "",
) -> str:
    """Purchase a Retell-managed US/CA number and bind the agent(s). Returns the E.164."""
    body: dict = {"country_code": country_code, "toll_free": toll_free}
    if area_code:
        try:
            body["area_code"] = int(area_code)
        except (TypeError, ValueError):
            pass
    if inbound_agent_id:
        body["inbound_agents"] = _agents(inbound_agent_id)
    if outbound_agent_id or inbound_agent_id:
        body["outbound_agents"] = _agents(outbound_agent_id or inbound_agent_id)
    if nickname:
        body["nickname"] = nickname[:40]
    res = _req("POST", "/create-phone-number", body)
    number = res.get("phone_number")
    if not number:
        raise NumberError(f"Retell did not return a phone_number: {res}")
    return number


def import_number(
    phone_number: str,
    termination_uri: str,
    inbound_agent_id: str,
    *,
    outbound_agent_id: str | None = None,
    sip_user: str | None = None,
    sip_pass: str | None = None,
    nickname: str = "",
) -> str:
    """Import an existing number over SIP/BYOC and bind the agent(s). Returns the E.164."""
    body: dict = {"phone_number": phone_number, "termination_uri": termination_uri}
    if sip_user:
        body["sip_trunk_auth_username"] = sip_user
    if sip_pass:
        body["sip_trunk_auth_password"] = sip_pass
    if inbound_agent_id:
        body["inbound_agents"] = _agents(inbound_agent_id)
    if outbound_agent_id or inbound_agent_id:
        body["outbound_agents"] = _agents(outbound_agent_id or inbound_agent_id)
    if nickname:
        body["nickname"] = nickname[:40]
    res = _req("POST", "/import-phone-number", body)
    return res.get("phone_number") or phone_number


def attach_agents(phone_number: str, inbound_agent_id: str, outbound_agent_id: str | None = None) -> dict:
    """Attach / change the agent(s) bound to an existing Retell number."""
    body: dict = {}
    if inbound_agent_id:
        body["inbound_agents"] = _agents(inbound_agent_id)
    if outbound_agent_id or inbound_agent_id:
        body["outbound_agents"] = _agents(outbound_agent_id or inbound_agent_id)
    return _req("PATCH", f"/update-phone-number/{phone_number}", body)


def list_numbers() -> list:
    """All phone numbers in the Retell account."""
    res = _req("GET", "/v2/list-phone-numbers")
    if isinstance(res, list):
        return res
    return res.get("items", [])


def release_number(phone_number: str) -> bool:
    """Release (delete) a Retell-managed number — stops the recurring monthly fee."""
    _req("DELETE", f"/delete-phone-number/{phone_number}")
    return True
