"""Manual end-to-end test for #1 — automatic number provisioning + routing.

Run on the SERVER (its .env has RETELL_API_KEY + DATABASE_URL):

    cd ~/Voice-Agent-Qwen- && source .venv/bin/activate
    python scripts/test_number_provision.py [ORG_ID]

It buys a Retell US number, binds the org's agent to it, maps it to the org, and
checks that resolve_org_by_number() returns that org. Then call the number from a
phone — your agent should answer and the call should log to THIS org's dashboard.

Clean up afterwards (stops the ~$2/mo charge for the test number):

    python scripts/test_number_provision.py --release +1XXXXXXXXXX
"""
import os
import sys

# Allow running as `python scripts/test_number_provision.py` from the repo root:
# put the repo root (this file's parent's parent) on the import path.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import org_numbers_store  # noqa: E402
import retell_numbers  # noqa: E402
import settings_store  # noqa: E402
from tenancy import resolve_org_by_number  # noqa: E402


def _release(number: str) -> None:
    print(f"Releasing {number} …")
    org_numbers_store.delete_by_phone(number)
    retell_numbers.release_number(number)
    print("  released from Retell + unmapped. ✅")


def main() -> None:
    argv = sys.argv[1:]
    if "--release" in argv:
        nums = [a for a in argv if a.startswith("+")]
        if not nums:
            print("Usage: python scripts/test_number_provision.py --release +1XXXXXXXXXX")
            sys.exit(1)
        _release(nums[0])
        return

    pos = [a for a in argv if not a.startswith("--")]
    org_id = pos[0] if pos else os.getenv("RETELL_DEFAULT_ORG_ID")
    if not org_id:
        print("Pass an ORG_ID or set RETELL_DEFAULT_ORG_ID in .env")
        sys.exit(1)

    s = settings_store.get_settings(org_id)
    inbound = s.get("retell_agent_id")
    outbound = s.get("retell_outbound_agent_id")
    print(f"org_id          = {org_id}")
    print(f"business_name   = {s.get('business_name')!r}")
    print(f"inbound agent   = {inbound}")
    print(f"outbound agent  = {outbound}")
    if not inbound:
        print("\n❌ No retell_agent_id in this org's settings — provision the agent first.")
        sys.exit(1)

    print("\nBuying a US number and binding the agent …")
    number = retell_numbers.buy_number(
        inbound, outbound, country_code="US", nickname=s.get("business_name") or "test"
    )
    print(f"  bought: {number}")

    org_numbers_store.register_number(org_id, number, label="TEST number")
    settings_store.save_settings(org_id, {"retell_phone_number": number})

    resolved = resolve_org_by_number(number)
    ok = resolved == org_id
    print(f"  routing check: resolve_org_by_number({number}) = {resolved}  {'✅ MATCH' if ok else '❌ MISMATCH'}")
    print(f"  org numbers now: {org_numbers_store.list_for_org(org_id)}")

    print(f"\n➡️  Call {number} from your phone — the agent should answer and the call")
    print(f"    should appear on {s.get('business_name') or 'this org'}'s dashboard.")
    print(f"\nWhen done, release it so you stop paying ~$2/mo:")
    print(f"    python scripts/test_number_provision.py --release {number}")


if __name__ == "__main__":
    main()
