"""Shared FastAPI dependencies for locking down endpoints.

Two questions every protected request must answer:
  1. WHO are you?            -> get_current_user (auth.py) verifies the login token.
  2. WHICH org may you act as? -> require_org_member checks you actually belong to
                                  the org named in the X-Org-Id header.

Deriving the org from the caller's own membership (not from something they simply
claim) is what stops one company from touching another company's data.
"""
from fastapi import Depends, Header, HTTPException, status

from auth import get_current_user
from tenancy import get_role


def require_org_member(
    x_org_id: str = Header(..., alias="X-Org-Id"),
    user: dict = Depends(get_current_user),
) -> dict:
    """Require a valid login AND membership in the org given by the X-Org-Id header.

    Returns {"user": {...}, "org_id": ..., "role": ...} so the endpoint knows who
    is calling, which org they're acting as, and what they're allowed to do.
    """
    role = get_role(user["id"], x_org_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization.",
        )
    return {"user": user, "org_id": x_org_id, "role": role}
