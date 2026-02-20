"""Async caching layer with Redis backend and in-memory fallback.

Provides transparent caching for market data (OpenBB API calls) to ensure
sub-500ms latency. Falls back to an in-memory dict if Redis is unavailable.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class CacheLayer:
    """Async cache with Redis primary and in-memory fallback."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self._redis_url = redis_url
        self._redis = None
        self._memory: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)
        self._connected = False

    async def connect(self) -> None:
        """Attempt to connect to Redis. Fallback silently to memory."""
        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await self._redis.ping()
            self._connected = True
            logger.info("⚡ Redis cache connected: %s", self._redis_url)
        except ImportError:
            logger.warning(
                "redis package not installed. Using in-memory cache. "
                "Install with: pip install redis"
            )
        except Exception as e:
            logger.warning(
                "Redis unavailable (%s). Using in-memory cache fallback.", e
            )
            self._redis = None
            self._connected = False

    async def disconnect(self) -> None:
        """Close Redis connection if active."""
        if self._redis and self._connected:
            await self._redis.aclose()
            logger.info("Redis connection closed")

    async def get(self, key: str) -> Any | None:
        """Get a cached value by key. Returns None on miss."""
        if self._redis and self._connected:
            try:
                raw = await self._redis.get(f"nexus:{key}")
                if raw:
                    logger.debug("Cache HIT (Redis): %s", key)
                    return json.loads(raw)
            except Exception as e:
                logger.warning("Redis GET error: %s", e)

        if key in self._memory:
            value, expires_at = self._memory[key]
            if time.time() < expires_at:
                logger.debug("Cache HIT (memory): %s", key)
                return value
            else:
                del self._memory[key]

        logger.debug("Cache MISS: %s", key)
        return None

    async def get_many(self, keys: list[str]) -> dict[str, Any]:
        """Batch get values. Missing keys are omitted in result."""
        if not keys:
            return {}
        result: dict[str, Any] = {}

        if self._redis and self._connected:
            try:
                prefixed = [f"nexus:{k}" for k in keys]
                raw_values = await self._redis.mget(prefixed)
                for key, raw in zip(keys, raw_values):
                    if raw:
                        result[key] = json.loads(raw)
            except Exception as e:
                logger.warning("Redis MGET error: %s", e)

        now = time.time()
        for key in keys:
            if key in result:
                continue
            if key in self._memory:
                value, expires_at = self._memory[key]
                if now < expires_at:
                    result[key] = value
                else:
                    self._memory.pop(key, None)
        return result

    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Set a cached value with TTL in seconds."""
        serialized = json.dumps(value, default=str)

        if self._redis and self._connected:
            try:
                await self._redis.setex(f"nexus:{key}", ttl, serialized)
                logger.debug("Cache SET (Redis): %s, TTL=%ds", key, ttl)
                return
            except Exception as e:
                logger.warning("Redis SET error: %s", e)

        self._memory[key] = (value, time.time() + ttl)
        logger.debug("Cache SET (memory): %s, TTL=%ds", key, ttl)

    async def set_many(self, values: dict[str, Any], ttl: int = 60) -> None:
        """Batch set values with the same TTL."""
        if not values:
            return
        if self._redis and self._connected:
            try:
                async with self._redis.pipeline(transaction=False) as pipe:
                    for key, value in values.items():
                        pipe.setex(f"nexus:{key}", ttl, json.dumps(value, default=str))
                    await pipe.execute()
                return
            except Exception as e:
                logger.warning("Redis pipeline SET error: %s", e)
        expires = time.time() + ttl
        for key, value in values.items():
            self._memory[key] = (value, expires)

    async def invalidate(self, key: str) -> None:
        """Remove a key from cache."""
        if self._redis and self._connected:
            try:
                await self._redis.delete(f"nexus:{key}")
            except Exception:
                pass
        self._memory.pop(key, None)

    @property
    def is_redis_connected(self) -> bool:
        return self._connected

    @property
    def stats(self) -> dict[str, Any]:
        return {
            "backend": "redis" if self._connected else "memory",
            "memory_keys": len(self._memory),
        }
