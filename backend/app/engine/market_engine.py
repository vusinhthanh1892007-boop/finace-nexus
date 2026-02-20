"""
Market Engine — Orchestrates data providers (Strategy Pattern).
"""

from __future__ import annotations

import logging
import asyncio
from typing import Any, Dict

from app.engine.cache import CacheLayer
from app.engine.market_data import MarketDataProvider
from app.engine.providers.openbb import OpenBBProvider
from app.models.schemas import (
    BudgetStatus,
    LedgerInput,
    LedgerResult,
    MarketIndex,
    MarketOverview,
    StockQuote,
)

logger = logging.getLogger(__name__)

class MarketEngine:
    """
    High-level facade for market operations.
    Supports dependency injection for the data provider.
    """

    def __init__(
        self,
        provider: MarketDataProvider = None,
        cache: CacheLayer = None,
        openbb_token: str = "",
        provider_keys: Dict[str, str] = None,
    ):
        self.cache = cache
        self._initialized = False
        self._quote_locks: dict[str, asyncio.Lock] = {}
        self._candles_locks: dict[str, asyncio.Lock] = {}
        if provider:
            self.provider = provider
        else:
            self.provider = OpenBBProvider(token=openbb_token, provider_keys=provider_keys)

    async def initialize(self):
        """Initialize resources."""
        await self.provider.initialize()
        self._initialized = True
        logger.info("✅ MarketEngine: Initialized")

    async def shutdown(self):
        """Cleanup resources."""
        await self.provider.shutdown()
        self._initialized = False
        logger.info("✅ MarketEngine: Shutdown")

    def calculate_safe_to_spend(self, ledger: LedgerInput) -> LedgerResult:
        """Core Safe-to-Spend math used by `/api/ledger/calculate`."""
        remaining_budget = ledger.planned_budget - ledger.actual_expenses
        safe_to_spend = max(remaining_budget, 0.0)
        savings_potential = ledger.income - ledger.planned_budget
        budget_utilization = (
            round((ledger.actual_expenses / ledger.planned_budget) * 100, 2)
            if ledger.planned_budget > 0
            else 0.0
        )

        if budget_utilization > 100:
            status = BudgetStatus.OVER_BUDGET
        elif budget_utilization >= 90:
            status = BudgetStatus.CRITICAL
        elif budget_utilization >= 70:
            status = BudgetStatus.WARNING
        else:
            status = BudgetStatus.HEALTHY

        status_messages = {
            BudgetStatus.HEALTHY: "Budget on track.",
            BudgetStatus.WARNING: "Spending is getting close to your budget limit.",
            BudgetStatus.CRITICAL: "High spending risk. Adjust your expenses now.",
            BudgetStatus.OVER_BUDGET: "Over budget. Reduce discretionary spending immediately.",
        }

        return LedgerResult(
            safe_to_spend=safe_to_spend,
            budget_utilization=budget_utilization,
            remaining_budget=remaining_budget,
            savings_potential=savings_potential,
            status=status,
            status_message=status_messages[status],
        )

    async def get_price(self, ticker: str) -> float:
        """Get real-time price with caching."""
        cache_key = f"price:{ticker}"
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached is not None:
                return float(cached)

        price = await self.provider.get_stock_price(ticker)

        if self.cache and price > 0:
            await self.cache.set(cache_key, price, ttl=60)

        return price

    async def get_stock_quote(self, ticker: str) -> StockQuote:
        """Get full quote snapshot with change/high/low/volume."""
        symbol = ticker.upper().strip()
        cache_key = f"quote:{symbol}"

        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                try:
                    return StockQuote.model_validate(cached)
                except Exception:
                    logger.debug("Invalid cached quote payload for %s", symbol)

        lock = self._quote_locks.get(symbol)
        if lock is None:
            lock = asyncio.Lock()
            self._quote_locks[symbol] = lock
        async with lock:
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    try:
                        return StockQuote.model_validate(cached)
                    except Exception:
                        logger.debug("Invalid cached quote payload for %s", symbol)

            payload: dict[str, Any] | None = None
            if hasattr(self.provider, "get_stock_quote"):
                payload = await self.provider.get_stock_quote(symbol)

            if payload is None:
                price = await self.get_price(symbol)
                payload = {
                    "symbol": symbol,
                    "name": symbol,
                    "price": price,
                    "change": 0.0,
                    "change_percent": 0.0,
                    "volume": 0,
                    "day_high": price,
                    "day_low": price,
                }

            quote = StockQuote(
                symbol=payload.get("symbol", symbol),
                name=payload.get("name", symbol),
                price=float(payload.get("price", 0.0)),
                change=float(payload.get("change", 0.0)),
                change_percent=float(payload.get("change_percent", 0.0)),
                volume=int(float(payload.get("volume", 0) or 0)),
                day_high=(
                    float(payload["day_high"])
                    if payload.get("day_high") is not None
                    else None
                ),
                day_low=(
                    float(payload["day_low"])
                    if payload.get("day_low") is not None
                    else None
                ),
            )

            if self.cache and quote.price > 0:
                await self.cache.set(cache_key, quote.model_dump(mode="json"), ttl=25)

        return quote

    async def get_market_indices(self) -> MarketOverview:
        """Get ticker-strip market overview with short-lived cache."""
        cache_key = "indices:overview"

        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                try:
                    return MarketOverview.model_validate(cached)
                except Exception:
                    logger.debug("Invalid cached indices payload")

        items: list[dict[str, Any]] = []
        if hasattr(self.provider, "get_market_indices"):
            items = await self.provider.get_market_indices()

        if not items:
            for sym in ("SPX", "DOW", "BTC", "ETH", "GOLD"):
                q = await self.get_stock_quote(sym)
                if "(Mock)" in q.name:
                    continue
                items.append({
                    "symbol": sym,
                    "name": q.name or sym,
                    "value": q.price,
                    "change": q.change,
                    "change_percent": q.change_percent,
                })

        indices = [
            MarketIndex(
                symbol=str(item.get("symbol", "")).upper(),
                name=str(item.get("name", item.get("symbol", ""))),
                value=float(item.get("value", 0.0)),
                change=float(item.get("change", 0.0)),
                change_percent=float(item.get("change_percent", 0.0)),
            )
            for item in items
        ]
        overview = MarketOverview(indices=indices)

        if self.cache and indices:
            await self.cache.set(cache_key, overview.model_dump(mode="json"), ttl=30)

        return overview

    async def get_stock_quotes(self, tickers: list[str]) -> list[StockQuote]:
        """Batch quote fetch for watchlist/taskbar requests."""
        symbols = [s.upper().strip() for s in tickers if s and s.strip()]
        if not symbols:
            return []

        by_symbol: dict[str, StockQuote] = {}
        missed: list[str] = symbols
        if self.cache:
            keys = [f"quote:{s}" for s in symbols]
            cached_map = await self.cache.get_many(keys)
            missed = []
            for symbol in symbols:
                cache_key = f"quote:{symbol}"
                raw = cached_map.get(cache_key)
                if raw is None:
                    missed.append(symbol)
                    continue
                try:
                    by_symbol[symbol] = StockQuote.model_validate(raw)
                except Exception:
                    missed.append(symbol)

        if missed:
            semaphore = asyncio.Semaphore(6)

            async def fetch_one(sym: str):
                async with semaphore:
                    return await self.get_stock_quote(sym)

            tasks = [fetch_one(sym) for sym in missed]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for idx, result in enumerate(results):
                sym = missed[idx]
                if isinstance(result, Exception):
                    logger.warning("Batch quote fetch failed for %s: %s", sym, result)
                    continue
                by_symbol[sym] = result

        return [by_symbol[s] for s in symbols if s in by_symbol]

    async def get_history(self, ticker: str, days: int = 30) -> list[dict]:
        """Get historical data (caching handled by provider or here)."""
        return await self.provider.get_historical_data(ticker, days)

    async def get_candles(
        self,
        ticker: str,
        interval: str = "5m",
        limit: int = 200,
    ) -> dict[str, Any]:
        """Get OHLCV candles with short-lived cache for charting."""
        symbol = ticker.upper().strip()
        cache_key = f"candles:{symbol}:{interval}:{limit}"

        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return cached

        lock = self._candles_locks.get(cache_key)
        if lock is None:
            lock = asyncio.Lock()
            self._candles_locks[cache_key] = lock
        async with lock:
            if self.cache:
                cached = await self.cache.get(cache_key)
                if cached:
                    return cached

            candles_payload: dict[str, Any]
            if hasattr(self.provider, "get_candles"):
                candles_payload = await self.provider.get_candles(symbol, interval=interval, limit=limit)
            else:
                history = await self.provider.get_historical_data(symbol, days=max(limit, 30))
                candles = [
                    {
                        "time": row.get("date"),
                        "open": row.get("close"),
                        "high": row.get("close"),
                        "low": row.get("close"),
                        "close": row.get("close"),
                        "volume": row.get("volume", 0),
                    }
                    for row in history[-limit:]
                ]
                candles_payload = {
                    "symbol": symbol,
                    "interval": interval,
                    "source": "history_fallback",
                    "candles": candles,
                }

            if self.cache and candles_payload.get("candles"):
                ttl = 8 if interval in {"1m", "5m"} else 25
                await self.cache.set(cache_key, candles_payload, ttl=ttl)

            return candles_payload
