"""Outbound campaigns API (owner-facing, tenant-scoped).

Create a campaign (a list of people + a goal/script), launch it (we ring each
number with the org's outbound Retell agent), and read back each call's outcome.
Secured by require_org_member, like the rest of the dashboard API.
"""
import os
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

import outbound
import outbound_store
import settings_store
from deps import require_org_member

router = APIRouter(prefix="/outbound", tags=["outbound"])


def _require_outbound(org_id: str) -> None:
    """Gate the feature on the +€99/mo add-on entitlement (settings.outbound)."""
    if settings_store.get_settings(org_id).get("outbound") is not True:
        raise HTTPException(
            status_code=403,
            detail="Outbound calling isn't enabled for your plan — add it from Billing.",
        )


class TargetIn(BaseModel):
    name: str = ""
    phone: str


class CampaignIn(BaseModel):
    name: str
    goal: str = ""
    script: str = ""
    from_number: str = ""
    targets: list[TargetIn] = []


@router.get("/campaigns")
def list_campaigns(ctx: dict = Depends(require_org_member)):
    _require_outbound(ctx["org_id"])
    return {"campaigns": outbound_store.list_campaigns(ctx["org_id"])}


@router.post("/campaigns")
def create_campaign(body: CampaignIn, ctx: dict = Depends(require_org_member)):
    _require_outbound(ctx["org_id"])
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Campaign needs a name.")
    targets = [{"name": t.name, "phone": t.phone} for t in body.targets if (t.phone or "").strip()]
    if not targets:
        raise HTTPException(status_code=400, detail="Add at least one phone number.")
    cid = outbound_store.create_campaign(
        ctx["org_id"], body.name.strip(), body.goal, body.script, body.from_number, targets
    )
    return {"ok": True, "id": cid}


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, ctx: dict = Depends(require_org_member)):
    _require_outbound(ctx["org_id"])
    c = outbound_store.get_campaign(ctx["org_id"], campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return c


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: str, ctx: dict = Depends(require_org_member)):
    _require_outbound(ctx["org_id"])
    if not outbound_store.delete_campaign(ctx["org_id"], campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return {"ok": True}


def _run_campaign(org_id: str, campaign_id: str, goal: str, script: str, from_number: str) -> None:
    """Background worker: ring each pending target, pacing gently under Retell limits."""
    for t in outbound_store.list_pending_targets(org_id, campaign_id):
        try:
            call_id = outbound.create_outbound_call(
                org_id=org_id,
                campaign_id=campaign_id,
                target_id=t["id"],
                to_number=t["phone"],
                customer_name=t["name"],
                goal=goal,
                script=script,
                from_number=from_number,
            )
            if call_id:
                outbound_store.set_target_dialing(t["id"], call_id)
            else:
                outbound_store.set_target_failed(t["id"], "No call id returned by Retell.")
        except Exception as e:  # one bad number must not stop the campaign
            outbound_store.set_target_failed(t["id"], str(e))
        time.sleep(1.0)
    outbound_store.set_campaign_status(org_id, campaign_id, "done")


@router.post("/campaigns/{campaign_id}/launch")
def launch_campaign(
    campaign_id: str,
    background: BackgroundTasks,
    ctx: dict = Depends(require_org_member),
):
    _require_outbound(ctx["org_id"])
    c = outbound_store.get_campaign(ctx["org_id"], campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    pending = [t for t in c["targets"] if t["status"] == "pending"]
    if not pending:
        raise HTTPException(status_code=400, detail="Nothing left to call in this campaign.")
    if not (c.get("from_number") or os.getenv("RETELL_OUTBOUND_FROM_NUMBER") or "").strip():
        raise HTTPException(
            status_code=400,
            detail="No outbound number configured. Set RETELL_OUTBOUND_FROM_NUMBER in the "
            "server .env (a number registered in Retell), or set the campaign's from_number.",
        )
    outbound_store.set_campaign_status(ctx["org_id"], campaign_id, "running")
    background.add_task(
        _run_campaign, ctx["org_id"], campaign_id, c["goal"], c["script"], c.get("from_number") or ""
    )
    return {"ok": True, "launching": len(pending)}
