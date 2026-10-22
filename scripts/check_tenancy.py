"""Check the full multi-tenant flow: sign up -> log in -> create an org -> list it.

Run:  .venv/bin/python check_tenancy.py

Needs Step 3 (DATABASE_URL) and Step 4 (auth, email confirmation off) working.
"""
import time

from dotenv import load_dotenv

from auth import sign_in, sign_up, verify_token
from tenancy import create_org, get_role, list_orgs

if __name__ == "__main__":
    load_dotenv()

    email = f"vatest{int(time.time())}@gmail.com"
    password = "TestPassword123!"

    print("1) Creating a user and logging in...")
    sign_up(email, password)
    token = sign_in(email, password).session.access_token
    user_id = verify_token(token)["sub"]
    print(f"   user id = {user_id}")

    print("2) Creating an organization (user becomes owner)...")
    org_id = create_org("Acme Test Co", user_id)
    print(f"   org id = {org_id}")

    print("3) Reading it back, scoped to this user...")
    orgs = list_orgs(user_id)
    role = get_role(user_id, org_id)
    print(f"✅ my orgs = {orgs}")
    print(f"✅ my role in the new org = {role}")
