"""Tune a live Retell agent so it stops mishearing days/times.

Boosts day-name + common keywords (so "Thursday" isn't heard as "Because") and
nudges interruption sensitivity. Does NOT touch the agent's prompt — paste the
improved booking rules into the prompt yourself (see the chat).

Run on the server:
    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    PYTHONPATH=. python scripts/tune_agent.py agent_4f6ee683dc04fa746637784e0e
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import httpx  # noqa: E402

KEY = os.environ["RETELL_API_KEY"]
H = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
BOOST = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "morning", "afternoon", "evening", "noon", "appointment", "leak", "boiler", "drain",
]


def main():
    if len(sys.argv) < 2:
        print("Usage: PYTHONPATH=. python scripts/tune_agent.py <agent_id>")
        sys.exit(1)
    aid = sys.argv[1]
    body = {"boosted_keywords": BOOST, "interruption_sensitivity": 0.9}
    r = httpx.patch(f"https://api.retellai.com/update-agent/{aid}", headers=H, json=body, timeout=30)
    print("update-agent:", r.status_code)
    print(r.text[:400])
    if r.status_code < 300:
        print("\n✅ Keywords boosted. Now paste the improved booking rules into this agent's prompt.")


if __name__ == "__main__":
    main()
