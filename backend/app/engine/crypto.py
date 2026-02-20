"""AES-256-GCM Encryption module for financial data at rest.

Uses PBKDF2 key derivation from the application's secret_key and encryption_salt.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

logger = logging.getLogger(__name__)

_KEY_LENGTH = 32
_NONCE_LENGTH = 12  # GCM standard nonce


class FinancialCrypto:
    """AES-256-GCM encryption for income/expense data at rest."""

    def __init__(self, secret_key: str, salt: str = "nexus-finance-salt"):
        self._key = self._derive_key(secret_key, salt)

    @staticmethod
    def _derive_key(secret: str, salt: str) -> bytes:
        """Derive a 256-bit key from secret_key using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=_KEY_LENGTH,
            salt=salt.encode("utf-8"),
            iterations=480_000,  # OWASP 2024 recommendation
        )
        return kdf.derive(secret.encode("utf-8"))

    def encrypt(self, data: dict[str, Any]) -> str:
        """Encrypt a dict → base64 string (nonce || ciphertext)."""
        plaintext = json.dumps(data, ensure_ascii=False).encode("utf-8")
        nonce = os.urandom(_NONCE_LENGTH)
        aesgcm = AESGCM(self._key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        token = base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")
        return token

    def decrypt(self, token: str) -> dict[str, Any]:
        """Decrypt a base64 token → dict."""
        raw = base64.urlsafe_b64decode(token)
        nonce = raw[:_NONCE_LENGTH]
        ciphertext = raw[_NONCE_LENGTH:]
        aesgcm = AESGCM(self._key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return json.loads(plaintext.decode("utf-8"))



_instance: FinancialCrypto | None = None


def init_crypto(secret_key: str, salt: str = "nexus-finance-salt") -> FinancialCrypto:
    """Initialize the global crypto instance."""
    global _instance
    _instance = FinancialCrypto(secret_key, salt)
    logger.info("🔐 AES-256-GCM encryption initialized (PBKDF2, 480k iterations)")
    return _instance


def encrypt_financial_data(data: dict[str, Any]) -> str:
    """Encrypt financial data using the global instance."""
    if not _instance:
        raise RuntimeError("Crypto not initialized. Call init_crypto() first.")
    return _instance.encrypt(data)


def decrypt_financial_data(token: str) -> dict[str, Any]:
    """Decrypt financial data using the global instance."""
    if not _instance:
        raise RuntimeError("Crypto not initialized. Call init_crypto() first.")
    return _instance.decrypt(token)
