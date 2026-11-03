"""Authentication via Supabase Auth.

Signup and login go through Supabase's Auth service (it stores users, hashes
passwords, and issues signed JWT access tokens). The backend then VERIFIES those
tokens on protected requests using Supabase's public JWKS keys — so we can trust
who is calling without ever holding their password.

Config (SUPABASE_URL etc.) is read lazily inside the functions, so this module
is safe to import before .env has been loaded.
"""
import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from supabase import create_client

_supabase = None
_jwks_client = None
# auto_error=False so a MISSING token gives our own 401 below, instead of
# FastAPI's default 403 — 401 ("who are you?") is the right code for no login.
_bearer = HTTPBearer(auto_error=False)


def _client():
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
        if not (url and key):
            raise RuntimeError("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set (see .env).")
        _supabase = create_client(url, key)
    return _supabase


def sign_up(email: str, password: str):
    """Create a new user account via Supabase Auth."""
    return _client().auth.sign_up({"email": email, "password": password})


def sign_in(email: str, password: str):
    """Log a user in; the returned session carries the access token."""
    return _client().auth.sign_in_with_password({"email": email, "password": password})


def _jwks():
    global _jwks_client
    if _jwks_client is None:
        jwks_url = os.getenv("SUPABASE_JWKS_URL")
        if not jwks_url:
            raise RuntimeError("SUPABASE_JWKS_URL not set (see .env).")
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def verify_token(token: str) -> dict:
    """Verify a Supabase access token against the public keys; return its claims."""
    signing_key = _jwks().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256"],
        audience="authenticated",
        issuer=f"{os.getenv('SUPABASE_URL')}/auth/v1",
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """FastAPI dependency: require a valid login token, return {id, email}."""
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — provide a Bearer token.",
        )
    try:
        claims = verify_token(creds.credentials)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        ) from e
    return {"id": claims.get("sub"), "email": claims.get("email")}


class AuthResetError(RuntimeError):
    """Raised when a password-reset step fails (bad or expired link, etc.)."""


def send_password_reset(email: str, redirect_to: str | None = None) -> None:
    """Email a password-reset link. Uses GoTrue's /recover with NO PKCE challenge, so
    the emailed link returns the session in the URL fragment (#access_token=...) that the
    /reset page reads client-side. This works on Supabase's free plan with the default
    email template (no template editing needed). Never reveals whether the email exists.
    """
    import httpx

    email = (email or "").strip()
    if not email:
        return
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not (url and key):
        return
    params = {"redirect_to": redirect_to} if redirect_to else {}
    try:
        httpx.post(
            f"{url}/auth/v1/recover",
            params=params,
            headers={"apikey": key, "Content-Type": "application/json"},
            json={"email": email},
            timeout=20,
        )
    except Exception:
        # Swallow errors so we never leak whether the email exists.
        pass


def complete_password_reset(access_token: str, new_password: str) -> None:
    """Set a new password using the recovery session access_token (from the reset link's
    URL fragment)."""
    import httpx

    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not (url and key):
        raise AuthResetError("Auth is not configured.")
    if not (access_token or "").strip():
        raise AuthResetError("That reset link is invalid or has expired - request a new one.")
    try:
        u = httpx.put(
            f"{url}/auth/v1/user",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {access_token.strip()}",
                "Content-Type": "application/json",
            },
            json={"password": new_password},
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise AuthResetError(f"Couldn't set the new password: {e}") from e
    if u.status_code >= 300:
        raise AuthResetError("That reset link is invalid or has expired - request a new one.")


def refresh_session(refresh_token: str) -> dict:
    """Exchange a refresh token for a fresh session via Supabase GoTrue, so a
    logged-in dashboard doesn't silently die ~1h in when the access token expires."""
    import httpx

    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not (url and key):
        raise RuntimeError("Auth is not configured.")
    token = (refresh_token or "").strip()
    if not token:
        raise RuntimeError("Missing refresh token.")
    try:
        r = httpx.post(
            f"{url}/auth/v1/token",
            params={"grant_type": "refresh_token"},
            headers={"apikey": key, "Content-Type": "application/json"},
            json={"refresh_token": token},
            timeout=10,
        )
    except httpx.HTTPError as e:
        raise RuntimeError(f"Couldn't refresh the session: {e}") from e
    if r.status_code >= 300:
        raise RuntimeError("That session has expired - please sign in again.")
    data = r.json()
    if not data.get("access_token"):
        raise RuntimeError("That session has expired - please sign in again.")
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }
