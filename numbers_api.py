"""Phone-number setup for an org (owner-facing): give the business a real line and
bind its agent to it — automating what used to be manual Retell-console work.

  GET    /numbers           — list this org's mapped numbers.
  POST   /numbers/buy       — buy a Retell US/CA number, attach the org's agent, map it.
  POST   /numbers/import    — import an existing number via SIP (EU/BYO), attach + map.
  POST   /numbers/assign    — register a Retell number you already have to this org.
  DELETE /numbers/{e164}    — unmap it from this org (optionally ?release=true to delete it).

Secured by require_org_member, like the rest of the dashboard API.
"""
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import org_numbers_store
import retell_numbers
import settings_store
from deps import require_org_member

router = APIRouter(prefix="/numbers", tags=["numbers"])


def _agents_for(org_id: str):
    """(inbound_agent_id, outbound_agent_id, settings) for this org."""
    s = settings_store.get_settings(org_id)
    return s.get("retell_agent_id"), s.get("retell_outbound_agent_id"), s


def ensure_number_for_org(org_id: str) -> dict:
    """Reuse the agent's existing Retell number if it has one, else buy a US/CA one;
    then map it to the org. Idempotent — safe to call on every provision."""
    s = settings_store.get_settings(org_id)
    inbound = s.get("retell_agent_id")
    outbound = s.get("retell_outbound_agent_id")
    name = s.get("business_name") or ""
    if not inbound:
        return {"ok": False, "reason": "no_agent"}
    num = s.get("retell_phone_number") or retell_numbers.find_number_for_agent(inbound)
    reused = bool(num)
    if not num:
        num = retell_numbers.buy_number(
            inbound, outbound,
            country_code=os.getenv("RETELL_NUMBER_COUNTRY", "US"),
            nickname=name,
        )
    org_numbers_store.register_number(org_id, num, label=name or "Primary line")
    settings_store.save_settings(org_id, {"retell_phone_number": num})
    return {"ok": True, "phone_number": num, "reused": reused}


class BuyIn(BaseModel):
    country_code: str = "US"
    area_code: int | None = None
    toll_free: bool = False


class ImportIn(BaseModel):
    phone_number: str
    termination_uri: str
    sip_user: str = ""
    sip_pass: str = ""


class AssignIn(BaseModel):
    phone_number: str
    attach_agent: bool = True


@router.get("")
def list_numbers(ctx: dict = Depends(require_org_member)):
    return {"numbers": org_numbers_store.list_for_org(ctx["org_id"])}


@router.post("/provision")
def provision(ctx: dict = Depends(require_org_member)):
    """Smart one-click: reuse the org agent's existing number, or buy one; then map it."""
    inbound, _out, _s = _agents_for(ctx["org_id"])
    if not inbound:
        raise HTTPException(status_code=400, detail="Provision your receptionist agent first.")
    try:
        res = ensure_number_for_org(ctx["org_id"])
    except retell_numbers.NumberError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail="Couldn't set up a number (no agent found).")
    return res


@router.post("/buy")
def buy(body: BuyIn, ctx: dict = Depends(require_org_member)):
    org_id = ctx["org_id"]
    inbound, outbound, s = _agents_for(org_id)
    if not inbound:
        raise HTTPException(
            status_code=400,
            detail="Provision your receptionist agent first — no agent found for this business.",
        )
    name = s.get("business_name") or ""
    try:
        number = retell_numbers.buy_number(
            inbound, outbound,
            country_code=(body.country_code or "US").upper(),
            area_code=body.area_code,
            toll_free=body.toll_free,
            nickname=name,
        )
    except retell_numbers.NumberError as e:
        raise HTTPException(status_code=400, detail=str(e))
    org_numbers_store.register_number(org_id, number, label=name or "Primary line")
    settings_store.save_settings(org_id, {"retell_phone_number": number})
    return {"ok": True, "phone_number": number}


@router.post("/import")
def import_num(body: ImportIn, ctx: dict = Depends(require_org_member)):
    org_id = ctx["org_id"]
    inbound, outbound, s = _agents_for(org_id)
    if not inbound:
        raise HTTPException(status_code=400, detail="Provision your receptionist agent first.")
    if not body.phone_number.strip() or not body.termination_uri.strip():
        raise HTTPException(status_code=400, detail="Both a phone number and a SIP termination URI are required.")
    try:
        number = retell_numbers.import_number(
            body.phone_number.strip(),
            body.termination_uri.strip(),
            inbound,
            outbound_agent_id=outbound,
            sip_user=body.sip_user or None,
            sip_pass=body.sip_pass or None,
            nickname=s.get("business_name") or "",
        )
    except retell_numbers.NumberError as e:
        raise HTTPException(status_code=400, detail=str(e))
    org_numbers_store.register_number(org_id, number, label=s.get("business_name") or "Imported line")
    settings_store.save_settings(org_id, {"retell_phone_number": number})
    return {"ok": True, "phone_number": number}


@router.post("/assign")
def assign(body: AssignIn, ctx: dict = Depends(require_org_member)):
    """Map a Retell number you already own to this org (and optionally (re)attach the agent)."""
    org_id = ctx["org_id"]
    inbound, outbound, s = _agents_for(org_id)
    num = body.phone_number.strip()
    if not num:
        raise HTTPException(status_code=400, detail="A phone number is required.")
    if body.attach_agent and inbound:
        try:
            retell_numbers.attach_agents(num, inbound, outbound)
        except retell_numbers.NumberError as e:
            raise HTTPException(status_code=400, detail=str(e))
    org_numbers_store.register_number(org_id, num, label=s.get("business_name") or "")
    settings_store.save_settings(org_id, {"retell_phone_number": num})
    return {"ok": True, "phone_number": num}


@router.delete("/{phone_number}")
def remove(phone_number: str, release: bool = False, ctx: dict = Depends(require_org_member)):
    org_numbers_store.unregister_number(ctx["org_id"], phone_number)
    if release:
        try:
            retell_numbers.release_number(phone_number)
        except retell_numbers.NumberError as e:
            raise HTTPException(status_code=400, detail=f"Unmapped from your org, but Retell release failed: {e}")
    return {"ok": True}
