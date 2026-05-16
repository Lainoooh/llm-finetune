"""
Authentication utilities: password hashing, token generation/validation.
"""

import hashlib
import hmac
import secrets
from typing import Optional


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hash password with salt using PBKDF2-like approach."""
    if salt is None:
        salt = secrets.token_hex(16)
    # Simple but effective: SHA-256 with salt (for production, use bcrypt)
    pw_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return pw_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify password against stored hash."""
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, stored_hash)


def get_full_hash(password: str, salt: str = None) -> str:
    """Get combined hash:salt string for storage."""
    pw_hash, salt = hash_password(password, salt)
    return f"{pw_hash}:{salt}"


def verify_full_hash(password: str, stored: str) -> bool:
    """Verify password against combined hash:salt string."""
    try:
        pw_hash, salt = stored.split(":", 1)
        return verify_password(password, pw_hash, salt)
    except (ValueError, TypeError):
        return False


# Simple token-based session (replacing JWT for simplicity)
def generate_session_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_urlsafe(48)



