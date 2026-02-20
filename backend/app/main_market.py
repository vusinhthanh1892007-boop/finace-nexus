"""Market microservice entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.bootstrap import init_cache, init_market_engine, init_store
from app.config import settings
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import market

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cache = await init_cache()
    store = init_store()
    engine = await init_market_engine(cache)

    app.state.cache = cache
    app.state.settings_store = store
    app.state.market_engine = engine

    yield

    await cache.disconnect()
    await engine.shutdown()


app = FastAPI(
    title="Nexus Market Service",
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

app.include_router(market.router)


@app.get("/")
async def root():
    return {"service": "market", "status": "ok"}
