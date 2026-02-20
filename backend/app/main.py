"""FastAPI application entry point — Fintech AI Platform backend."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.engine.market_engine import MarketEngine
from app.engine.advisor_engine import AdvisorEngine
from app.engine.cache import CacheLayer
from app.engine.crypto import init_crypto
from app.db import SettingsStore
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import ledger, advisor, market, settings as app_settings


logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
for noisy_logger in ("httpcore", "httpx", "urllib3"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — init engines, cache, crypto."""
    app_env = str(settings.app_env or "").strip().lower()
    if app_env in {"prod", "production"}:
        if settings.secret_key == "change-this-to-a-secure-random-string":
            raise RuntimeError("SECURITY: SECRET_KEY must be changed in production.")
        if settings.encryption_salt == "nexus-finance-aes256-salt-2024":
            raise RuntimeError("SECURITY: ENCRYPTION_SALT must be changed in production.")

    cache = CacheLayer(redis_url=settings.redis_url)
    await cache.connect()
    app.state.cache = cache

    crypto = init_crypto(
        secret_key=settings.secret_key,
        salt=settings.encryption_salt,
    )
    app.state.crypto = crypto

    store = SettingsStore(settings.database_path)
    store.initialize()
    app.state.settings_store = store
    persisted_settings = store.get_settings()

    from app.engine.providers.openbb import OpenBBProvider

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
    app.state.market_engine = engine

    gemini_api_key = getattr(settings, "gemini_api_key", "")
    openai_api_key = ""
    if persisted_settings.get("gemini_api_key_enc"):
        try:
            token = str(persisted_settings.get("gemini_api_key_enc") or "")
            decrypted = crypto.decrypt(token)
            gemini_api_key = str(decrypted.get("key", "")).strip() or gemini_api_key
        except Exception:
            logger.warning("Failed to decrypt persisted Gemini API key. Falling back to env key.")
    if persisted_settings.get("openai_api_key_enc"):
        try:
            token = str(persisted_settings.get("openai_api_key_enc") or "")
            decrypted = crypto.decrypt(token)
            openai_api_key = str(decrypted.get("key", "")).strip()
        except Exception:
            logger.warning("Failed to decrypt persisted OpenAI API key.")
    advisor_eng = AdvisorEngine(gemini_api_key=gemini_api_key)
    app.state.advisor_engine = advisor_eng
    app.state.openai_api_key = openai_api_key
    ai_provider = str(persisted_settings.get("ai_provider", "auto"))
    app.state.ai_provider = ai_provider if ai_provider in {"auto", "gemini", "openai"} else "auto"
    app.state.ai_model = str(persisted_settings.get("ai_model", "gemini-2.0-flash"))
    app.state.gemini_scopes = persisted_settings.get("gemini_scopes", ["chat", "advisor_analysis"])
    app.state.openai_scopes = persisted_settings.get("openai_scopes", ["chat"])
    app.state.api_key_version = int(persisted_settings.get("api_key_version", 1))
    app.state.last_secret_rotation_at = str(persisted_settings.get("last_secret_rotation_at", ""))

    logger.info(
        "🚀 Fintech AI Platform started [Cache=%s | Encryption=AES-256-GCM]",
        "Redis" if cache.is_redis_connected else "Memory",
    )

    yield

    await cache.disconnect()
    await engine.shutdown()
    logger.info("👋 Backend shutting down")



app = FastAPI(
    title="Fintech AI Platform",
    description=(
        "Professional financial analytics backend powered by OpenBB. "
        "Provides real-time market data, budget analysis, and portfolio insights."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)


app.include_router(ledger.router)
app.include_router(advisor.router)
app.include_router(market.router)
app.include_router(app_settings.router)




@app.get("/")
async def root():
    return {
        "name": "Fintech AI Platform",
        "version": "2.0.0",
        "security": "AES-256-GCM",
        "cache": app.state.cache.stats if hasattr(app.state, "cache") else "n/a",
        "docs": "/docs" if settings.debug else "disabled",
    }
