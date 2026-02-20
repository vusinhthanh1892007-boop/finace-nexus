"""Security middleware for the FastAPI application."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security-related HTTP headers into every response (CIA Triad)."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
        response.headers["Origin-Agent-Cluster"] = "?1"

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "object-src 'none'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "base-uri 'none'; "
                "frame-ancestors 'none'; "
                "form-action 'none'; "
                "script-src 'none'; "
                "style-src 'none'; "
                "img-src 'none'; "
                "connect-src 'self'; "
                "object-src 'none'"
            )

        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Distributed Redis rate limiter (with dev fallback)."""

    def __init__(self, app, max_requests: int | None = None):
        super().__init__(app)
        self.max_requests = max_requests or settings.rate_limit_per_minute
        self.window_seconds = max(10, int(settings.rate_limit_window_seconds))
        self.prefix = str(settings.rate_limit_prefix or "nexus:ratelimit")
        self.fail_open = bool(settings.rate_limit_fail_open)
        self.trust_proxy = bool(settings.rate_limit_trust_proxy)
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _extract_client_ip(self, request: Request) -> str:
        if self.trust_proxy:
            forwarded = request.headers.get("x-forwarded-for", "")
            if forwarded:
                first = forwarded.split(",")[0].strip()
                if first:
                    return first
            real_ip = request.headers.get("x-real-ip", "").strip()
            if real_ip:
                return real_ip
        return request.client.host if request.client else "unknown"

    @staticmethod
    def _service_scope(request: Request) -> str:
        title = getattr(request.app, "title", "api")
        value = str(title).lower().strip().replace(" ", "-")
        return "".join(ch for ch in value if ch.isalnum() or ch in {"-", "_", ":"}) or "api"

    @staticmethod
    def _redis_from_app(request: Request):
        cache = getattr(request.app.state, "cache", None)
        if cache is None:
            return None
        if not bool(getattr(cache, "is_redis_connected", False)):
            return None
        return getattr(cache, "_redis", None)

    async def _redis_count(self, redis_client, key: str) -> tuple[int, int]:
        script = (
            "local count = redis.call('INCR', KEYS[1]); "
            "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; "
            "local ttl = redis.call('TTL', KEYS[1]); "
            "return {count, ttl};"
        )
        raw = await redis_client.eval(script, 1, key, str(self.window_seconds + 1))
        if isinstance(raw, (list, tuple)) and len(raw) >= 2:
            count = int(raw[0])
            ttl = int(raw[1]) if int(raw[1]) > 0 else self.window_seconds
            return count, ttl
        return 1, self.window_seconds

    def _memory_count(self, key: str, now: float) -> tuple[int, int]:
        window_start = now - self.window_seconds
        entries = [t for t in self._requests[key] if t >= window_start]
        entries.append(now)
        self._requests[key] = entries
        ttl = self.window_seconds if len(entries) <= 1 else max(1, int(self.window_seconds - (now - entries[0])))
        return len(entries), ttl

    def _build_headers(self, remaining: int, reset_after: int, backend: str) -> dict[str, str]:
        reset_after_i = max(1, int(reset_after))
        reset_epoch = int(time.time()) + reset_after_i
        return {
            "X-RateLimit-Limit": str(self.max_requests),
            "X-RateLimit-Remaining": str(max(0, remaining)),
            "X-RateLimit-Reset": str(reset_epoch),
            "X-RateLimit-Backend": backend,
        }

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = self._extract_client_ip(request)
        now = time.time()
        bucket = int(now // self.window_seconds)
        scope = self._service_scope(request)
        redis_key = f"{self.prefix}:{scope}:{client_ip}:{bucket}"
        memory_key = f"{scope}:{client_ip}"

        backend = "redis"
        ttl = self.window_seconds
        try:
            redis_client = self._redis_from_app(request)
            if redis_client is None:
                raise RuntimeError("Redis rate-limit backend unavailable")
            count, ttl = await self._redis_count(redis_client, redis_key)
        except Exception as exc:
            if settings.debug:
                backend = "memory-fallback"
                count, ttl = self._memory_count(memory_key, now)
            elif self.fail_open:
                backend = "redis-fail-open"
                logger.warning("Rate limit fail-open: %s", exc)
                response = await call_next(request)
                headers = self._build_headers(self.max_requests, self.window_seconds, backend)
                for hk, hv in headers.items():
                    response.headers[hk] = hv
                return response
            else:
                return Response(
                    content='{"error":"Rate limit backend unavailable"}',
                    status_code=503,
                    media_type="application/json",
                    headers={"Retry-After": str(self.window_seconds)},
                )

        if count > self.max_requests:
            headers = self._build_headers(0, ttl, backend)
            headers["Retry-After"] = str(max(1, int(ttl)))
            return Response(
                content='{"error":"Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
                headers=headers,
            )

        response = await call_next(request)
        remaining = self.max_requests - count
        headers = self._build_headers(remaining, ttl, backend)
        for hk, hv in headers.items():
            response.headers[hk] = hv
        return response
