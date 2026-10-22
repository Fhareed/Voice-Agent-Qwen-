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
