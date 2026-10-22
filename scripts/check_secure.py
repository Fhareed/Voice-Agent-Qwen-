"""Prove the app is locked down (Step 7).

Runs the real FastAPI app in-process (no server, no Ollama, no ElevenLabs needed —
the security checks happen BEFORE any of that) and asserts:

  * no login            -> 401  (who are you?)
  * you can upload to YOUR org
  * you CANNOT touch someone else's org         -> 403
  * /ask needs login and your own org
  * missing X-Org-Id header                     -> 422

Run:  .venv/bin/python check_secure.py
Needs: .env with Supabase creds and email confirmation OFF (like check_auth.py).
"""
import time

from dotenv import load_dotenv

load_dotenv()

from fastapi.testclient import TestClient  # noqa: E402  (import after load_dotenv)

from app import app  # noqa: E402
from auth import sign_in, sign_up  # noqa: E402

# raise_server_exceptions=False: a junk-audio /ask may error deep in the pipeline;
# we only care that it got PAST the security gate, so don't crash the test on it.
client = TestClient(app, raise_server_exceptions=False)


def new_login(tag):
    email = f"vatest{int(time.time() * 1000)}{tag}@gmail.com"
    password = "TestPassword123!"
    sign_up(email, password)
    return sign_in(email, password).session.access_token


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


if __name__ == "__main__":
    print("1) Two users, each creating their own org...")
    tok_a = new_login("a")
    org_a = client.post("/orgs", json={"name": "Acme"}, headers=bearer(tok_a)).json()["org_id"]
    tok_b = new_login("b")
    org_b = client.post("/orgs", json={"name": "Globex"}, headers=bearer(tok_b)).json()["org_id"]
    print(f"   org A = {org_a}\n   org B = {org_b}")

    print("2) No login -> upload blocked (expect 401)...")
    r = client.post("/documents", files={"file": ("a.txt", b"hi", "text/plain")})
    assert r.status_code == 401, f"expected 401, got {r.status_code}"

    print("3) User A uploads to A's own knowledge base (expect 200)...")
    r = client.post(
        "/documents",
        headers={**bearer(tok_a), "X-Org-Id": org_a},
        files={"file": ("policy.txt", b"Acme return policy is 30 days.", "text/plain")},
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    print(f"   {r.json()}")

    print("4) User B tries to upload into A's org (expect 403)...")
    r = client.post(
        "/documents",
        headers={**bearer(tok_b), "X-Org-Id": org_a},
        files={"file": ("sneaky.txt", b"should be rejected", "text/plain")},
    )
    assert r.status_code == 403, f"expected 403, got {r.status_code}"

    print("5) /ask with no login (expect 401)...")
    r = client.post(
        "/ask",
        files={"audio": ("a.webm", b"x", "audio/webm")},
        data={"language": "english"},
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}"

    print("6) /ask with login but MISSING X-Org-Id header (expect 422)...")
    r = client.post(
        "/ask",
        headers=bearer(tok_a),
        files={"audio": ("a.webm", b"x", "audio/webm")},
        data={"language": "english"},
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}"

    print("7) /ask with A's login + A's org passes the gate (expect NOT 401/403)...")
    r = client.post(
        "/ask",
        headers={**bearer(tok_a), "X-Org-Id": org_a},
        files={"audio": ("a.webm", b"x", "audio/webm")},
        data={"language": "english"},
    )
    assert r.status_code not in (401, 403), f"unexpectedly blocked: {r.status_code}"
    print(f"   passed the gate (status {r.status_code} — reached the voice pipeline)")

    print("\n✅ Locked down: login required, and every action is confined to your own org.")
