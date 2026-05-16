"""
Authentication middleware for FastAPI.
Validates session tokens from request headers.
"""

from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import SessionRepo, UserRepo

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Dependency to get the current authenticated user.
    Extracts Bearer token from Authorization header and validates session.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    session = SessionRepo.get_by_token(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "id": session["user_id"],
        "username": session["username"],
        "role": session["role"],
    }


def require_role(required_role: str):
    """
    Dependency factory to require a specific role.
    Usage: `Depends(require_role("admin"))`
    """
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] != required_role and required_role != "user":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Optional[dict]:
    """
    Dependency to get user if authenticated, None otherwise.
    For endpoints that work both logged in and anonymous.
    """
    if not credentials:
        return None

    token = credentials.credentials
    session = SessionRepo.get_by_token(token)
    if not session:
        return None

    return {
        "id": session["user_id"],
        "username": session["username"],
        "role": session["role"],
    }
