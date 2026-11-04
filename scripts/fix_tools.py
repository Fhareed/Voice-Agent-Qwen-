"""Repoint the live agent's booking tools at the CURRENT backend + per-org token,
WITHOUT touching its prompt or voice.

Fixes "the schedule isn't loading" when the agent's tools point at a stale/dead
URL (e.g. an old ngrok tunnel from early dev) — which makes every check_availability
/ book_appointment call fail and the agent stall. It resolves the agent's REAL
llm id from Retell (the stored one can be stale), prints the agent's current tool
URLs so you can see the problem, then updates ONLY general_tools — the prompt and
voice are left exactly as they are.

Run on the SERVER:
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    PYTHONPATH=. python scripts/fix_tools.py --dry-run   # just show current tools
    PYTHONPATH=. python scripts/fix_tools.py             # show, then fix
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import httpx  # noqa: E402

import settings_store  # noqa: E402
from retell_provision import API, _base_url, _key, _tools  # noqa: E402


def _get(path: str) -> dict:
    r = httpx.get(f"{API}{path}", headers={"Authorization": f"Bearer {_key()}"}, timeout=30)
    if r.status_code >= 300:
        raise SystemExit(f"❌ GET {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def _patch(path: str, body: dict) -> dict:
    r = httpx.patch(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"},
        json=body, timeout=30,
    )
    if r.status_code >= 300:
        raise SystemExit(f"❌ PATCH {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def _show_tools(tools):
    for t in tools or []:
        h = t.get("headers") or {}
        print(f"   {t.get('name'):<18} -> {t.get('url')}")
        print(f"       org-token hdr: {'X-LumiDesk-Org-Token' in h} | call-id hdr: {'X-Call-Id' in h}")


def main():
    dry = "--dry-run" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    org_id = args[0] if args else os.getenv("RETELL_DEFAULT_ORG_ID")
    if not org_id:
        raise SystemExit("No org id (pass one or set RETELL_DEFAULT_ORG_ID).")

    s = settings_store.get_settings(org_id)
    agent_id = s.get("retell_agent_id")
    token = s.get("tools_token")
    if not agent_id:
        raise SystemExit("No retell_agent_id in settings.")
    if not token:
        raise SystemExit("No tools_token in settings — run migrate_agent.py first to create one.")

    # The live agent is the source of truth for its LLM id.
    agent = _get(f"/get-agent/{agent_id}")
    eng = agent.get("response_engine") or {}
    print(f"agent          : {agent_id}")
    print(f"response_engine: type={eng.get('type')}  llm_id={eng.get('llm_id')}")
    llm_id = eng.get("llm_id")
    if not llm_id:
        raise SystemExit("This agent isn't backed by a retell-llm (no llm_id). Paste this output to me.")

    base = _base_url()
    secret = os.getenv("TOOLS_SHARED_SECRET", "")
    print(f"backend base   : {base}   (this is where tools SHOULD point)")

    llm = _get(f"/get-retell-llm/{llm_id}")
    print("\nCURRENT tools (what the agent calls today):")
    _show_tools(llm.get("general_tools"))

    if dry:
        print("\n--dry-run: nothing changed.")
        return

    new_tools = _tools(base, secret, token)
    _patch(f"/update-retell-llm/{llm_id}", {"general_tools": new_tools})
    if s.get("retell_llm_id") != llm_id:
        settings_store.save_settings(org_id, {"retell_llm_id": llm_id})
        print(f"\n(fixed stale retell_llm_id in settings -> {llm_id})")

    after = _get(f"/get-retell-llm/{llm_id}")
    print("\nNEW tools (after fix):")
    _show_tools(after.get("general_tools"))
    print("\n✅ Tools repointed to the live backend with the per-org token. "
          "Prompt and voice were NOT touched. Place a test call — availability should load now.")


if __name__ == "__main__":
    main()
