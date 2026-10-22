"""End-to-end auth check: sign up a throwaway user, log in, verify the token.

Run:  .venv/bin/python check_auth.py

For this to work during development, turn OFF email confirmation in Supabase:
  Authentication -> Sign In / Providers -> Email -> disable "Confirm email".
Otherwise a brand-new user can't log in until they click a confirmation link.
"""
import time

from dotenv import load_dotenv

from auth import sign_in, sign_up, verify_token

if __name__ == "__main__":
    load_dotenv()

    # Supabase rejects reserved domains like example.com; use a normal one.
    # (No email is actually sent while "Confirm email" is off.)
    email = f"vatest{int(time.time())}@gmail.com"
    password = "TestPassword123!"

    print(f"1) Signing up  {email}")
    sign_up(email, password)

    print("2) Logging in...")
    session = sign_in(email, password).session
    if session is None:
        raise SystemExit("No session returned — email confirmation is probably still ON.")
    token = session.access_token
    print(f"   got an access token ({len(token)} chars)")

    print("3) Verifying the token against Supabase's public keys...")
    claims = verify_token(token)
    print(f"✅ Verified! user id = {claims.get('sub')}  email = {claims.get('email')}")
