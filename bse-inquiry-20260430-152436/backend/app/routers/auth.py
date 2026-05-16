"""
Authentication router: register, login, logout, me.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.user import UserRepo, SessionRepo
from app.utils.auth import get_full_hash, verify_full_hash, generate_session_token
from app.schemas.common import RegisterRequest, LoginRequest, AuthResponse
from app.middleware.auth import get_current_user

router = APIRouter()


@router.post("/register", response_model=dict)
def register(req: RegisterRequest):
    """Register a new user."""
    existing = UserRepo.get_by_username(req.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    pw_hash = get_full_hash(req.password)
    user_id = UserRepo.create(
        username=req.username,
        password_hash=pw_hash,
        email=req.email,
        display_name=req.display_name,
    )
    return {"user_id": user_id, "message": "Registration successful"}


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """Login and get session token."""
    user = UserRepo.get_by_username(req.username)
    if not user or not verify_full_hash(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = generate_session_token()
    SessionRepo.create(user_id=user["id"], token=token, expires_hours=24)

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "display_name": user.get("display_name"),
            "role": user["role"],
        },
    }


@router.post("/logout")
def logout(authorization: str = None):
    """Logout by invalidating current session token."""
    # Token will be passed via Bearer header, handled by middleware
    # For simple logout, we accept token in header
    raise HTTPException(status_code=501, detail="Use Authorization header with Bearer token")


@router.get("/me", response_model=dict)
def me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    full_user = UserRepo.get_by_id(user["id"])
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": full_user["id"],
        "username": full_user["username"],
        "email": full_user.get("email"),
        "display_name": full_user.get("display_name"),
        "role": full_user["role"],
    }
