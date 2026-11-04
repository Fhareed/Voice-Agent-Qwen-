"""Migrate an EXISTING Retell agent in place — same agent_id, same phone number.

Re-applies the latest prompt + tools to an org's already-provisioned Retell LLM
and agent, so changes that otherwise only reach NEWLY provisioned agents also
land on your live demo agent without re-provisioning (which would mint a new
agent_id and drop the number binding). It applies:

  - C5  : the corrected booking prompt (reads back the exact day/time, waits for
          a clear yes) — via build_prompt()
  - H8  : the X-Call-Id header on book_appointment, so bookings link to their
          call and show as "Booked"
  - H2  : a per-org tools token (X-LumiDesk-Org-Token) binding this agent to its
          own org server-side (stored in settings first, then sent by the tools)
  - #88 : day-name / keyword ASR boosting + interruption sensitivity on the agent
  - H9  : ensures the post-call webhook_url is set, so caller name/intent get
          captured after each call

It never creates a new agent or LLM — it PATCHes the existing ones.

Run on the SERVER (where .env, the database, and network to Retell exist):
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    PYTHONPATH=. python scripts/migrate_agent.py <org_id>
    PYTHONPATH=. python scripts/migrate_agent.py <org_id> --dry-run

With no <org_id> it falls back to RETELL_DEFAULT_ORG_ID (your demo org).
"""
import os
import secrets
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import httpx  # noqa: E402

import settings_store  # noqa: E402
from retell_provision import API, _base_url, _key, _tools, build_prompt  # noqa: E402

# Same ASR boost list provision_org sets on new agents (keeps days from being
# misheard, e.g. "Thursday" -> "because").
BOOST = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "morning", "afternoon", "evening", "noon", "appointment", "leak", "boiler", "drain",
]


def _patch(path: str, body: dict) -> dict:
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    r = httpx.patch(f"{API}{path}", headers=headers, json=body, timeout=30)
    if r.status_code >= 300:
        raise SystemExit(f"❌ Retell {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def _get(path: str) -> dict:
    headers = {"Authorization": f"Bearer {_key()}"}
    r = httpx.get(f"{API}{path}", headers=headers, timeout=30)
    if r.status_code >= 300:
        raise SystemExit(f"❌ Retell {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def _llm_id_from_agent(agent_id: str) -> str | None:
    """The real LLM id backing a live agent — authoritative over any stale setting."""
    agent = _get(f"/get-agent/{agent_id}")
    eng = agent.get("response_engine") or {}
    return eng.get("llm_id") or None


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    org_id = args[0] if args else os.getenv("RETELL_DEFAULT_ORG_ID")
    if not org_id:
        raise SystemExit("Usage: PYTHONPATH=. python scripts/migrate_agent.py <org_id> "
                         "(or set RETELL_DEFAULT_ORG_ID)")

    s = settings_store.get_settings(org_id)
    agent_id = s.get("retell_agent_id")
    if not agent_id:
        raise SystemExit(f"Org {org_id} has no retell_agent_id in settings — "
                         "nothing to migrate (provision it first).")

    secret = os.getenv("TOOLS_SHARED_SECRET", "")
    if not secret:
        raise SystemExit("TOOLS_SHARED_SECRET is not set — the tools would reject the agent's calls.")
    base = _base_url()
    org_name = s.get("business_name") or org_id
    token = s.get("tools_token") or secrets.token_urlsafe(24)
    new_token = not s.get("tools_token")

    # The live agent is the source of truth for its LLM id — a stored retell_llm_id
    # can be stale if the agent was re-pointed, which makes /update-retell-llm 404.
    stored_llm = s.get("retell_llm_id")
    llm_id = _llm_id_from_agent(agent_id) or stored_llm
    if not llm_id:
        raise SystemExit(f"Couldn't find the LLM backing agent {agent_id} (its response_engine "
                         "has no llm_id). Re-provision the agent.")
    llm_corrected = bool(stored_llm) and llm_id != stored_llm

    prompt = build_prompt(s, org_name, org_id)
    tools = _tools(base, secret, token)

    print(f"Org:        {org_id}  ({org_name})")
    print(f"Agent:      {agent_id}")
    print(f"LLM:        {llm_id}" + (f"  (stored was {stored_llm} — STALE, will fix)" if llm_corrected else ""))
    print(f"Base URL:   {base}")
    print(f"Tools token:{' (new, will be stored)' if new_token else ' (existing)'}")
    print(f"Tools:      {[t['name'] for t in tools]}")
    print(f"Prompt:     {len(prompt)} chars")
    if dry:
        print("\n--dry-run: no changes made.")
        return

    # 1) Persist the token (and corrected llm id) FIRST so tools_api can resolve the
    #    token the instant the agent starts sending the X-LumiDesk-Org-Token header.
    patch = {}
    if new_token:
        patch["tools_token"] = token
    if llm_corrected:
        patch["retell_llm_id"] = llm_id
    if patch:
        settings_store.save_settings(org_id, patch)
        print(f"✅ stored {', '.join(patch)}")

    # 2) Update the LLM in place: new prompt (C5) + new tools (H8 X-Call-Id, H2 token).
    _patch(f"/update-retell-llm/{llm_id}", {
        "general_prompt": prompt,
        "general_tools": tools,
    })
    print("✅ updated LLM prompt + tools")

    # 3) Update the agent: keyword boost + interruption sensitivity (#88) and make
    #    sure the post-call webhook is wired (H9).
    agent_body = {"boosted_keywords": BOOST, "interruption_sensitivity": 0.9}
    wh = os.getenv("RETELL_WEBHOOK_SECRET")
    if wh:
        agent_body["webhook_url"] = f"{base}/retell/webhook/{wh}"
    _patch(f"/update-agent/{agent_id}", agent_body)
    print("✅ updated agent keywords + webhook")

    print("\n🎉 Migration done — same agent_id, same number. Place a test call to confirm "
          "the agent confirms the slot, the booking shows as 'Booked', and the caller name is captured.")


if __name__ == "__main__":
    main()
