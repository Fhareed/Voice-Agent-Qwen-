"""Diagnose why the agent's tools fail on a live call (check_availability etc).

Runs the exact backend paths a tool call hits and prints where it breaks.
Run on the SERVER:
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    PYTHONPATH=. python scripts/diag_call.py        # uses RETELL_DEFAULT_ORG_ID
    PYTHONPATH=. python scripts/diag_call.py <org_id>
"""
import os
import sys
import traceback

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))


def line(t):
    print("\n" + "=" * 8 + " " + t + " " + "=" * 8)


def main():
    import settings_store
    from integrations import calendar_google

    org_id = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("RETELL_DEFAULT_ORG_ID"))
    if not org_id:
        raise SystemExit("No org id (pass one or set RETELL_DEFAULT_ORG_ID).")
    print(f"org_id = {org_id}")
    s = settings_store.get_settings(org_id)

    line("1) settings")
    tok = s.get("tools_token")
    print(f"tools_token present: {bool(tok)}  (len {len(tok) if tok else 0})")
    print(f"timezone setting   : {s.get('timezone')!r}")
    print(f"retell_agent_id    : {s.get('retell_agent_id')}")
    print(f"retell_llm_id      : {s.get('retell_llm_id')}")

    line("2) H2 token round-trip (if this fails, EVERY tool call 401s)")
    try:
        from tools_api import _org_by_token, _require_real_org
        resolved = _org_by_token(tok) if tok else None
        print(f"_org_by_token(stored token) -> {resolved}")
        print(f"   {'MATCH ✅' if resolved == org_id else 'MISMATCH ❌ — tool_auth would reject the agent'}")
        print(f"_require_real_org(org_id)   -> {_require_real_org(org_id)}  (should echo the org id)")
    except Exception:
        print("   EXCEPTION:")
        traceback.print_exc()

    line("3) calendar config (H12 — SA file path on THIS host)")
    sa = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")
    print(f"GOOGLE_SERVICE_ACCOUNT_FILE = {sa!r}")
    print(f"   file exists on this host : {bool(sa) and os.path.exists(sa)}")
    try:
        print(f"has_service_account()       : {calendar_google.has_service_account()}")
        print(f"is_configured(org)          : {calendar_google.is_configured(org_id)}")
        print(f"tz_for_org(org)             : {calendar_google.tz_for_org(org_id)}")
    except Exception:
        traceback.print_exc()

    line("4) suggest_slots (the actual availability lookup)")
    try:
        slots = calendar_google.suggest_slots(org_id=org_id, days=5)
        print(f"returned {len(slots)} slots:")
        for sl in slots:
            print(f"   {sl.isoformat()}")
    except Exception:
        print("   EXCEPTION (this is the 'scheduling tool error'):")
        traceback.print_exc()

    line("5) full check_availability return shape")
    try:
        from tools_api import _speak
        slots = calendar_google.suggest_slots(org_id=org_id, days=5)
        out = {
            "slots": [{"iso": sl.isoformat(), "spoken": _speak(sl)} for sl in slots],
            "calendar_connected": calendar_google.is_configured(org_id),
        }
        print(f"OK — {len(out['slots'])} spoken slots, calendar_connected={out['calendar_connected']}")
        for sl in out["slots"][:4]:
            print(f"   {sl['spoken']}")
    except Exception:
        print("   EXCEPTION:")
        traceback.print_exc()

    print("\nDone. If step 2 says MISMATCH, the agent's token doesn't match settings. "
          "If step 4/5 throws, that exception is the tool error. If calendar is not "
          "configured (step 3), slots still come back as standard business hours.")


if __name__ == "__main__":
    main()
