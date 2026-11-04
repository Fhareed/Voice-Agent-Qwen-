"""Confirm the AUTOMATED provisioning path — no money, no phone number.

Creates a throwaway organization, runs the SAME provision_org() that a paid signup
fires, then reads the created Retell agent back and checks its tools are wired
correctly (your live backend URL, per-org token, args-at-root, X-Call-Id, the real
org id baked into the prompt). You then web-test the agent in Retell's audio panel
(browser mic — no phone number). Afterwards, --cleanup removes everything.

Run on the SERVER:
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    PYTHONPATH=. python scripts/test_provision.py                 # create + provision + verify
    PYTHONPATH=. python scripts/test_provision.py --cleanup <org_id>
"""
import os
import sys
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

import retell_provision  # noqa: E402
import settings_store  # noqa: E402
from db import get_engine  # noqa: E402
from retell_provision import API, _key  # noqa: E402

SAMPLE = {
    "business_name": "Test Plumbing Co",
    "industry": "Plumbing & trades",
    "services": "leak repair, drain cleaning, boiler service",
    "pricing": "€60 call-out, €75 per hour",
    "service_area": "Helsinki and 30 km around",
    "default_language": "English",
    "timezone": "Europe/Helsinki",
    "always_open": True,
}


def _get(path):
    r = httpx.get(f"{API}{path}", headers={"Authorization": f"Bearer {_key()}"}, timeout=30)
    r.raise_for_status()
    return r.json()


def _delete(path):
    r = httpx.request("DELETE", f"{API}{path}", headers={"Authorization": f"Bearer {_key()}"}, timeout=30)
    return r.status_code


def create_and_provision():
    org_id = str(uuid.uuid4())
    name = SAMPLE["business_name"]

    # 1) What signup + onboarding would do: create the org + save its settings.
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into organizations (id, name) values (cast(:i as uuid), :n)"),
            {"i": org_id, "n": name},
        )
    settings_store.save_settings(org_id, SAMPLE)
    print(f"created throwaway org {org_id}  ({name})")

    # 2) The SAME call a paid signup fires. No phone number is bought (auto-buy off).
    result = retell_provision.provision_org(org_id, settings_store.get_settings(org_id), name)
    agent_id = result.get("agent_id")
    llm_id = result.get("llm_id")
    print(f"provisioned: agent={agent_id}  llm={llm_id}")

    # 3) Read the agent back and verify the automation wired it correctly.
    llm = _get(f"/get-retell-llm/{llm_id}")
    tools = llm.get("general_tools") or []
    s = settings_store.get_settings(org_id)
    base_ok = True
    print("\n── what the automation built ──")
    for t in tools:
        h = t.get("headers") or {}
        url = t.get("url") or ""
        extras = f"args_at_root={t.get('args_at_root')} | org-token={'X-LumiDesk-Org-Token' in h} | secret={'X-LumiDesk-Secret' in h}"
        if t.get("name") == "book_appointment":
            extras += f" | call-id={'X-Call-Id' in h}"
        print(f"  {t.get('name'):<18} {url}")
        print(f"      {extras}")
        if url and "duckdns" not in url and "localhost" not in url and "ngrok" in url:
            base_ok = False

    prompt_has_org = org_id in retell_provision.build_prompt(s, name, org_id)
    token_ok = bool(s.get("tools_token"))
    print("\n── checks ──")
    print(f"  tools point at the live backend : {base_ok}")
    print(f"  per-org token stored            : {token_ok}")
    print(f"  real org id baked into prompt   : {prompt_has_org}")
    good = base_ok and token_ok and prompt_has_org
    print("\n" + ("✅ The automation produced a correctly-wired agent." if good
                  else "⚠️  Something looks off above — paste this output to me."))
    print(f"\nNow web-test it (free): open agent {agent_id} in the Retell dashboard and use the\n"
          f"audio/test panel (browser mic). Say you have a clogged sink and want someone out —\n"
          f"it should check availability, offer a time, confirm it, and book.")
    print(f"\nWhen done, clean up everything with:\n"
          f"  PYTHONPATH=. python scripts/test_provision.py --cleanup {org_id}")


def cleanup(org_id):
    s = settings_store.get_settings(org_id)
    agent_id = s.get("retell_agent_id")
    llm_id = s.get("retell_llm_id")
    if agent_id:
        print(f"delete agent {agent_id}: HTTP {_delete(f'/delete-agent/{agent_id}')}")
    if llm_id:
        print(f"delete llm {llm_id}: HTTP {_delete(f'/delete-retell-llm/{llm_id}')}")
    with get_engine().begin() as conn:
        conn.execute(text("delete from org_settings where org_id = cast(:i as uuid)"), {"i": org_id})
        conn.execute(text("delete from organizations where id = cast(:i as uuid)"), {"i": org_id})
    print(f"removed test org {org_id}. (If a Retell delete returned 4xx, remove that agent/LLM by hand in the dashboard.)")


def main():
    if "--cleanup" in sys.argv:
        args = [a for a in sys.argv[1:] if not a.startswith("--")]
        if not args:
            raise SystemExit("Usage: PYTHONPATH=. python scripts/test_provision.py --cleanup <org_id>")
        cleanup(args[0])
        return
    create_and_provision()


if __name__ == "__main__":
    main()
