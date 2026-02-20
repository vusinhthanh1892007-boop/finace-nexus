"""Settings + Ledger microservice entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.bootstrap import (
    build_advisor_engine,
    init_cache,
    init_crypto_layer,
    init_market_engine,
    init_store,
    read_decrypted_ai_settings,
)
from app.config import settings
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import ledger, settings as app_settings

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cache = await init_cache()
    crypto = init_crypto_layer()
    store = init_store()
    engine = await init_market_engine(cache)
    ai = read_decrypted_ai_settings(store, crypto)

    app.state.cache = cache
    app.state.crypto = crypto
    app.state.settings_store = store
    app.state.market_engine = engine
    app.state.advisor_engine = build_advisor_engine(ai["gemini_key"])
    app.state.openai_api_key = ai["openai_key"]
    app.state.ai_provider = ai["ai_provider"]
    app.state.ai_model = ai["ai_model"]
    app.state.gemini_scopes = ai.get("gemini_scopes", ["chat", "advisor_analysis"])
    app.state.openai_scopes = ai.get("openai_scopes", ["chat"])
    app.state.api_key_version = ai.get("api_key_version", 1)
    app.state.last_secret_rotation_at = ai.get("last_secret_rotation_at", "")

    yield

    await cache.disconnect()
    await engine.shutdown()


app = FastAPI(
    title="Nexus Settings Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
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
app.include_router(app_settings.router)


@app.get("/")
async def root():
    return {"service": "settings", "status": "ok"}
