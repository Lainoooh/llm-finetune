"""
Encryption utilities for sensitive data (API keys, etc.).
Uses simple XOR + base64 for development; should use proper encryption in production.
"""

import base64
import os
import hashlib


# In production, use environment variable for this key
_ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "default-dev-key-change-in-production").encode()


def _derive_key(key: bytes) -> bytes:
    """Derive a 32-byte key from the encryption key."""
    return hashlib.sha256(key).digest()


def encrypt_api_key(plain_text: str) -> str:
    """Encrypt an API key for storage."""
    key = _derive_key(_ENCRYPTION_KEY)
    plain_bytes = plain_text.encode()
    # Simple XOR encryption (for production, use Fernet or similar)
    encrypted = bytes([plain_bytes[i] ^ key[i % len(key)] for i in range(len(plain_bytes))])
    return base64.b64encode(encrypted).decode()


def decrypt_api_key(encrypted_text: str) -> str:
    """Decrypt a stored API key."""
    key = _derive_key(_ENCRYPTION_KEY)
    encrypted_bytes = base64.b64decode(encrypted_text)
    decrypted = bytes([encrypted_bytes[i] ^ key[i % len(key)] for i in range(len(encrypted_bytes))])
    return decrypted.decode()
