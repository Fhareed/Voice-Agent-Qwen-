"""Storage for outbound campaigns + their call targets.

Tenant scoping is enforced HERE (every function takes an org_id already derived
from a verified membership), exactly like call_logs.py / bookings_store.py.
"""
from sqlalchemy import text

from db import get_engine


def create_campaign(org_id, name, goal, script, from_number, targets) -> str:
    """Insert a campaign and its targets. targets = [{"name","phone"}]. Returns id."""
    with get_engine().begin() as conn:
        cid = conn.execute(
            text(
                "insert into outbound_campaigns (org_id, name, goal, script, from_number) "
                "values (:o, :n, :g, :s, :f) returning id"
            ),
            {"o": org_id, "n": name, "g": goal or "", "s": script or "", "f": from_number or ""},
        ).scalar()
        for t in targets:
            phone = (t.get("phone") or "").strip()
            if not phone:
                continue
            conn.execute(
                text(
                    "insert into outbound_targets (campaign_id, org_id, name, phone) "
                    "values (:c, :o, :n, :p)"
                ),
                {"c": cid, "o": org_id, "n": (t.get("name") or "").strip(), "p": phone},
            )
    return str(cid)


def list_campaigns(org_id, limit: int = 100) -> list[dict]:
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select c.id, c.name, c.goal, c.status, c.created_at, "
                    "  count(t.id) as total, "
                    "  count(*) filter (where t.status = 'completed') as completed, "
                    "  count(*) filter (where t.status in ('failed','no_answer')) as failed "
                    "from outbound_campaigns c "
                    "left join outbound_targets t on t.campaign_id = c.id "
                    "where c.org_id = :o "
                    "group by c.id order by c.created_at desc limit :l"
                ),
                {"o": org_id, "l": limit},
            )
            .mappings()
            .all()
        )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "goal": r["goal"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "total": int(r["total"]),
            "completed": int(r["completed"]),
            "failed": int(r["failed"]),
        }
        for r in rows
    ]


def get_campaign(org_id, campaign_id) -> dict | None:
    with get_engine().connect() as conn:
        c = (
            conn.execute(
                text(
                    "select id, name, goal, script, status, from_number, created_at "
                    "from outbound_campaigns where org_id = :o and id = :id"
                ),
                {"o": org_id, "id": campaign_id},
            )
            .mappings()
            .first()
        )
        if not c:
            return None
        ts = (
            conn.execute(
                text(
                    "select id, name, phone, status, call_id, outcome, transcript, "
                    "duration_sec, created_at from outbound_targets "
                    "where campaign_id = :id order by created_at"
                ),
                {"id": campaign_id},
            )
            .mappings()
            .all()
        )
    return {
        "id": str(c["id"]),
        "name": c["name"],
        "goal": c["goal"],
        "script": c["script"],
        "status": c["status"],
        "from_number": c["from_number"],
        "created_at": c["created_at"].isoformat() if c["created_at"] else None,
        "targets": [
            {
                "id": str(t["id"]),
                "name": t["name"],
                "phone": t["phone"],
                "status": t["status"],
                "call_id": t["call_id"],
                "outcome": t["outcome"],
                "transcript": t["transcript"],
                "duration_sec": t["duration_sec"],
                "created_at": t["created_at"].isoformat() if t["created_at"] else None,
            }
            for t in ts
        ],
    }


def list_pending_targets(org_id, campaign_id) -> list[dict]:
    with get_engine().connect() as conn:
        rows = (
            conn.execute(
                text(
                    "select id, name, phone from outbound_targets "
                    "where org_id = :o and campaign_id = :c and status = 'pending'"
                ),
                {"o": org_id, "c": campaign_id},
            )
            .mappings()
            .all()
        )
    return [{"id": str(r["id"]), "name": r["name"], "phone": r["phone"]} for r in rows]


def set_campaign_status(org_id, campaign_id, status) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "update outbound_campaigns set status = :s, updated_at = now() "
                "where org_id = :o and id = :id"
            ),
            {"s": status, "o": org_id, "id": campaign_id},
        )


def set_target_dialing(target_id, call_id) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "update outbound_targets set status = 'calling', call_id = :cid, "
                "updated_at = now() where id = :id"
            ),
            {"cid": call_id, "id": target_id},
        )


def set_target_failed(target_id, reason) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                "update outbound_targets set status = 'failed', outcome = :o, "
                "updated_at = now() where id = :id"
            ),
            {"o": (reason or "")[:500], "id": target_id},
        )


def update_target_from_call(call_id, *, status=None, outcome=None, transcript=None, duration_sec=None) -> None:
    """Called by the Retell webhook when an outbound call ends (matched by call_id)."""
    sets = ["updated_at = now()"]
    params = {"cid": call_id}
    if status:
        sets.append("status = :st")
        params["st"] = status
    if outcome is not None:
        sets.append("outcome = :oc")
        params["oc"] = outcome
    if transcript is not None:
        sets.append("transcript = :tr")
        params["tr"] = transcript
    if duration_sec is not None:
        sets.append("duration_sec = :du")
        params["du"] = duration_sec
    with get_engine().begin() as conn:
        conn.execute(
            text("update outbound_targets set " + ", ".join(sets) + " where call_id = :cid"),
            params,
        )


def delete_campaign(org_id, campaign_id) -> bool:
    with get_engine().begin() as conn:
        res = conn.execute(
            text("delete from outbound_campaigns where org_id = :o and id = :id"),
            {"o": org_id, "id": campaign_id},
        )
        return res.rowcount > 0
