"""Bootstrap helpers for monolith and microservices."""

from __future__ import annotations

import logging

from app.config import settings
from app.db import SettingsStore
from app.engine.advisor_engine import AdvisorEngine
from app.engine.cache import CacheLayer
from app.engine.crypto import FinancialCrypto, init_crypto
from app.engine.market_engine import MarketEngine
from app.engine.providers.openbb import OpenBBProvider

logger = logging.getLogger(__name__)


async def init_cache() -> CacheLayer:
    cache = CacheLayer(redis_url=settings.redis_url)
    await cache.connect()
    return cache


def init_store() -> SettingsStore:
    store = SettingsStore(settings.database_path)
    store.initialize()
    return store


def init_crypto_layer() -> FinancialCrypto:
    return init_crypto(secret_key=settings.secret_key, salt=settings.encryption_salt)


async def init_market_engine(cache: CacheLayer | None) -> MarketEngine:
    provider = OpenBBProvider(
        token=settings.openbb_token,
        provider_keys={
            "fmp_api_key": settings.fmp_api_key,
            "polygon_api_key": settings.polygon_api_key,
            "alpha_vantage_api_key": settings.alpha_vantage_api_key,
        },
    )
    engine = MarketEngine(provider=provider, cache=cache)
    await engine.initialize()
    return engine


def build_advisor_engine(gemini_api_key: str = "") -> AdvisorEngine:
    return AdvisorEngine(gemini_api_key=gemini_api_key)


def read_decrypted_ai_settings(store: SettingsStore, crypto: FinancialCrypto) -> dict[str, str]:
    row = store.get_settings()

    gemini_key = ""
    openai_key = ""

    if row.get("gemini_api_key_enc"):
        try:
            token = str(row.get("gemini_api_key_enc") or "")
            decrypted = crypto.decrypt(token)
            gemini_key = str(decrypted.get("key", "")).strip()
        except Exception:
            logger.warning("Failed to decrypt persisted Gemini API key")

    if row.get("openai_api_key_enc"):
        try:
            token = str(row.get("openai_api_key_enc") or "")
            decrypted = crypto.decrypt(token)
            openai_key = str(decrypted.get("key", "")).strip()
        except Exception:
            logger.warning("Failed to decrypt persisted OpenAI API key")

    ai_provider = str(row.get("ai_provider", "auto"))
    if ai_provider not in {"auto", "gemini", "openai"}:
        ai_provider = "auto"

    return {
        "gemini_key": gemini_key or settings.gemini_api_key,
        "openai_key": openai_key,
        "ai_provider": ai_provider,
        "ai_model": str(row.get("ai_model", "gemini-2.0-flash")),
        "gemini_scopes": row.get("gemini_scopes", ["chat", "advisor_analysis"]),
        "openai_scopes": row.get("openai_scopes", ["chat"]),
        "api_key_version": int(row.get("api_key_version", 1)),
        "last_secret_rotation_at": str(row.get("last_secret_rotation_at", "")),
    }
