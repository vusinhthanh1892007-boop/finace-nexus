"""Market data provider (OpenBB optional, Stooq primary fallback)."""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timedelta, timezone
import io
import logging
import math
import time
from urllib.parse import quote_plus
from typing import Any, Dict, List

import httpx

from app.engine.market_data import MarketDataProvider

logger = logging.getLogger(__name__)

STOOQ_LIVE_FIELDS = "sd2t2ohlcvpn"
STOOQ_LIVE_URL = "https://stooq.com/q/l/"
STOOQ_HISTORY_URL = "https://stooq.com/q/d/l/"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
BINANCE_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"
OPEN_ER_LATEST_URL = "https://open.er-api.com/v6/latest"

SYMBOL_ALIASES: dict[str, str] = {
    "AAPL": "AAPL",
    "VNM": "VNM.VN",
    "SPX": "^GSPC",
    "DOW": "^DJI",
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "GOLD": "GC=F",
    "EURUSD": "EURUSD=X",
    "USDVND": "USDVND=X",
    "VN30": "VNM.US",
}

STOOQ_SOURCE_ALIASES: dict[str, str] = {
    "AAPL": "AAPL.US",
    "VNM.US": "VNM.US",
    "^GSPC": "^SPX",
    "^DJI": "^DJI",
    "BTC-USD": "BTCUSD",
    "ETH-USD": "ETH.V",
    "GC=F": "XAUUSD",
    "EURUSD=X": "EURUSD",
    "USDVND=X": "USDVND",
}

BINANCE_SYMBOL_ALIASES: dict[str, str] = {
    "BTC": "BTCUSDT",
    "BTC-USD": "BTCUSDT",
    "ETH": "ETHUSDT",
    "ETH-USD": "ETHUSDT",
}

BINANCE_SUPPORTED_INTERVALS = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w"}

YAHOO_INTERVAL_MAP: dict[str, str] = {
    "1m": "1m",
    "2m": "2m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "60m",
    "60m": "60m",
    "1d": "1d",
    "1w": "1wk",
}

YAHOO_RANGE_BY_INTERVAL: dict[str, str] = {
    "1m": "5d",
    "2m": "1mo",
    "5m": "1mo",
    "15m": "3mo",
    "30m": "3mo",
    "1h": "6mo",
    "60m": "6mo",
    "1d": "2y",
    "1w": "5y",
}

INDEX_SPECS = [
    {"symbol": "VN30", "name": "VN30 Proxy", "source": "VNM.US", "stooq_source": "VNM.US"},
    {"symbol": "SPX", "name": "S&P 500", "source": "^GSPC", "stooq_source": "^SPX"},
    {"symbol": "DOW", "name": "Dow Jones", "source": "^DJI", "stooq_source": "^DJI"},
    {"symbol": "BTC", "name": "Bitcoin", "source": "BTC-USD", "stooq_source": "BTCUSD"},
    {"symbol": "ETH", "name": "Ethereum", "source": "ETH-USD", "stooq_source": "ETH.V"},
    {"symbol": "GOLD", "name": "Gold Futures", "source": "GC=F", "stooq_source": "XAUUSD"},
    {"symbol": "EURUSD", "name": "EUR/USD", "source": "EURUSD=X", "stooq_source": "EURUSD"},
    {"symbol": "USDVND", "name": "USD/VND", "source": "USDVND=X", "stooq_source": "USDVND"},
]

try:
    from openbb import obb

    HAS_OPENBB = True
except ImportError:
    HAS_OPENBB = False
    obb = None
    logger.warning("⚠️ OpenBB SDK not found. Using Yahoo/Stooq/Mock fallback.")


class OpenBBProvider(MarketDataProvider):
    """Concrete provider using Yahoo chart API first, then Stooq/OpenBB/mock."""

    def __init__(self, token: str = "", provider_keys: Dict[str, str] | None = None):
        self.token = token
        self.provider_keys = provider_keys or {}
        self._initialized = False
        self._http: httpx.AsyncClient | None = None
        self._last_price_by_symbol: dict[str, float] = {}

    async def initialize(self) -> None:
        if self._initialized:
            return

        self._http = httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                )
            },
        )

        if HAS_OPENBB and self.token:
            try:
                obb.account.login(token=self.token)
                logger.info("✅ OpenBB: Logged in via token")
            except Exception as e:
                logger.warning("OpenBB login failed, continuing with fallback providers: %s", e)

        self._initialized = True

    async def shutdown(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    async def get_stock_price(self, ticker: str) -> float:
        quote = await self.get_stock_quote(ticker)
        return float(quote.get("price", 0.0))

    async def get_stock_quote(self, ticker: str) -> Dict[str, Any]:
        """Fetch full quote snapshot: price + change + high/low + volume."""
        symbol = ticker.upper().strip()
        source_symbol = self._resolve_symbol(symbol)
        stooq_symbol = self._resolve_stooq_symbol(source_symbol)
        asset_class = self._detect_asset_class(symbol=symbol, source_symbol=source_symbol)

        if asset_class == "crypto":
            try:
                live = await self._fetch_binance_quote(symbol=symbol, source_symbol=source_symbol)
                live["symbol"] = symbol
                return live
            except Exception as e:
                logger.warning("Binance quote fetch failed for %s (%s): %s", symbol, source_symbol, e)

        if asset_class == "fx":
            try:
                live = await self._fetch_yahoo_quote(source_symbol)
                live["symbol"] = symbol
                return live
            except Exception as e:
                logger.warning("Yahoo quote fetch failed for %s (%s): %s", symbol, source_symbol, e)
            try:
                fx = await self._fetch_open_er_fx_quote(symbol=symbol, source_symbol=source_symbol)
                fx["symbol"] = symbol
                return fx
            except Exception as e:
                logger.warning("Open ER FX fetch failed for %s (%s): %s", symbol, source_symbol, e)
            try:
                live = await self._fetch_stooq_live(stooq_symbol)
                live["symbol"] = symbol
                return live
            except Exception as e:
                logger.warning(
                    "Stooq quote fetch failed for %s (%s -> %s): %s",
                    symbol,
                    source_symbol,
                    stooq_symbol,
                    e,
                )
        else:
            prefer_yahoo = source_symbol.upper().endswith(".VN")
            if prefer_yahoo:
                try:
                    live = await self._fetch_yahoo_quote(source_symbol)
                    live["symbol"] = symbol
                    return live
                except Exception as e:
                    logger.warning("Yahoo quote fetch failed for %s (%s): %s", symbol, source_symbol, e)
                try:
                    live = await self._fetch_stooq_live(stooq_symbol)
                    live["symbol"] = symbol
                    return live
                except Exception as e:
                    logger.warning(
                        "Stooq quote fetch failed for %s (%s -> %s): %s",
                        symbol,
                        source_symbol,
                        stooq_symbol,
                        e,
                    )
            else:
                try:
                    live = await self._fetch_stooq_live(stooq_symbol)
                    live["symbol"] = symbol
                    return live
                except Exception as e:
                    logger.warning(
                        "Stooq quote fetch failed for %s (%s -> %s): %s",
                        symbol,
                        source_symbol,
                        stooq_symbol,
                        e,
                    )
                try:
                    live = await self._fetch_yahoo_quote(source_symbol)
                    live["symbol"] = symbol
                    return live
                except Exception as e:
                    logger.warning("Yahoo quote fetch failed for %s (%s): %s", symbol, source_symbol, e)

        if HAS_OPENBB:
            try:
                res = obb.equity.price.quote(symbol=symbol, provider="yfinance")
                if res and hasattr(res, "results") and res.results:
                    item = res.results[0]
                    price = float(getattr(item, "last_price", 0.0) or 0.0)
                    prev = float(getattr(item, "previous_close", 0.0) or 0.0)
                    change = price - prev if prev else 0.0
                    return {
                        "symbol": symbol,
                        "name": getattr(item, "name", symbol) or symbol,
                        "price": price,
                        "change": change,
                        "change_percent": (change / prev) * 100 if prev else 0.0,
                        "volume": int(float(getattr(item, "volume", 0) or 0)),
                        "day_high": float(getattr(item, "day_high", price) or price),
                        "day_low": float(getattr(item, "day_low", price) or price),
                    }
            except Exception as e:
                logger.warning("OpenBB quote fallback failed for %s: %s", symbol, e)

        if source_symbol.upper().endswith(".VN"):
            return {
                "symbol": symbol,
                "name": f"{symbol} (Unavailable)",
                "price": 0.0,
                "change": 0.0,
                "change_percent": 0.0,
                "volume": 0,
                "day_high": 0.0,
                "day_low": 0.0,
            }

        return self._get_mock_quote(symbol)

    async def get_market_indices(self) -> List[Dict[str, Any]]:
        """Fetch major indices/assets used in bottom ticker."""
        results: List[Dict[str, Any]] = []
        tasks = [self.get_stock_quote(spec["symbol"]) for spec in INDEX_SPECS]
        payloads = await asyncio.gather(*tasks, return_exceptions=True)

        for spec, payload in zip(INDEX_SPECS, payloads):
            if isinstance(payload, Exception):
                logger.warning("Index fetch failed for %s: %s", spec["symbol"], payload)
                continue
            live = payload
            if "(Mock)" in str(live.get("name", "")):
                logger.warning("Skipping mock index payload for %s", spec["symbol"])
                continue
            results.append({
                "symbol": spec["symbol"],
                "name": spec["name"],
                "value": float(live["price"]),
                "change": float(live["change"]),
                "change_percent": float(live["change_percent"]),
            })
        return results

    async def get_historical_data(self, ticker: str, days: int = 30) -> List[Dict[str, Any]]:
        symbol = ticker.upper().strip()
        source_symbol = self._resolve_symbol(symbol)
        stooq_symbol = self._resolve_stooq_symbol(source_symbol)

        try:
            client = await self._client()
            encoded = quote_plus(stooq_symbol.lower())
            url = f"{STOOQ_HISTORY_URL}?s={encoded}&i=d"
            res = await client.get(url)
            res.raise_for_status()

            rows = list(csv.DictReader(io.StringIO(res.text)))
            if not rows:
                return self._get_mock_history(symbol, days)

            data: List[Dict[str, Any]] = []
            for row in rows[-days:]:
                close = self._to_float(row.get("Close"))
                if close is None:
                    continue
                volume = int(self._to_float(row.get("Volume")) or 0)
                data.append({
                    "date": row.get("Date"),
                    "close": round(close, 6),
                    "volume": volume,
                })
            if data:
                return data
        except Exception as e:
            logger.warning(
                "Failed to fetch history for %s (%s -> %s): %s",
                symbol,
                source_symbol,
                stooq_symbol,
                e,
            )

        try:
            history = await self._fetch_yahoo_history(source_symbol, days)
            if history:
                return history
        except Exception as e:
            logger.warning("Yahoo history fetch failed for %s (%s): %s", symbol, source_symbol, e)

        if HAS_OPENBB:
            try:
                res = obb.equity.price.historical(symbol=symbol, provider="yfinance")
                if hasattr(res, "to_df"):
                    df = res.to_df().tail(days)
                    return [
                        {"date": str(idx), "close": float(row["close"]), "volume": int(row.get("volume", 0) or 0)}
                        for idx, row in df.iterrows()
                    ]
            except Exception as e:
                logger.warning("OpenBB history fallback failed for %s: %s", symbol, e)

        return self._get_mock_history(symbol, days)

    async def get_candles(self, ticker: str, interval: str = "5m", limit: int = 200) -> Dict[str, Any]:
        """Fetch OHLCV candles for charting with exchange-aware fallback."""
        symbol = ticker.upper().strip()
        source_symbol = self._resolve_symbol(symbol)
        asset_class = self._detect_asset_class(symbol=symbol, source_symbol=source_symbol)
        safe_limit = max(20, min(limit, 500))

        if asset_class == "crypto":
            try:
                candles = await self._fetch_binance_candles(symbol=symbol, source_symbol=source_symbol, interval=interval, limit=safe_limit)
                return {
                    "symbol": symbol,
                    "interval": interval,
                    "source": "binance",
                    "candles": candles,
                }
            except Exception as e:
                logger.warning("Binance candle fetch failed for %s: %s", symbol, e)

        try:
            candles = await self._fetch_yahoo_candles(source_symbol=source_symbol, interval=interval, limit=safe_limit)
            if candles:
                return {
                    "symbol": symbol,
                    "interval": interval,
                    "source": "yahoo",
                    "candles": candles,
                }
        except Exception as e:
            logger.warning("Yahoo candle fetch failed for %s (%s): %s", symbol, source_symbol, e)

        try:
            if interval == "1d":
                candles = await self._fetch_stooq_daily_candles(source_symbol=self._resolve_stooq_symbol(source_symbol), limit=safe_limit)
                if candles:
                    return {
                        "symbol": symbol,
                        "interval": interval,
                        "source": "stooq",
                        "candles": candles,
                    }
        except Exception as e:
            logger.warning("Stooq candle fetch failed for %s: %s", symbol, e)

        return {
            "symbol": symbol,
            "interval": interval,
            "source": "mock",
            "candles": self._get_mock_candles(symbol, interval=interval, limit=safe_limit),
        }

    async def get_company_profile(self, ticker: str) -> Dict[str, Any]:
        quote = await self.get_stock_quote(ticker)
        return {
            "symbol": quote.get("symbol", ticker.upper()),
            "name": quote.get("name", ticker.upper()),
        }

    async def _fetch_yahoo_quote(self, source_symbol: str) -> Dict[str, Any]:
        client = await self._client()
        encoded = quote_plus(source_symbol)
        url = f"{YAHOO_CHART_URL}/{encoded}"
        res = await client.get(url, params={"range": "5d", "interval": "1d"})
        res.raise_for_status()

        payload = res.json()
        chart = payload.get("chart", {})
        if chart.get("error"):
            raise RuntimeError(str(chart["error"]))

        results = chart.get("result") or []
        if not results:
            raise RuntimeError(f"No Yahoo chart result for {source_symbol}")

        result = results[0]
        meta = result.get("meta", {})
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]

        closes = [v for v in (quote.get("close") or []) if isinstance(v, (int, float))]
        highs = [v for v in (quote.get("high") or []) if isinstance(v, (int, float))]
        lows = [v for v in (quote.get("low") or []) if isinstance(v, (int, float))]
        volumes = [v for v in (quote.get("volume") or []) if isinstance(v, (int, float))]

        price = self._to_float(meta.get("regularMarketPrice"))
        if price is None and closes:
            price = float(closes[-1])
        if price is None:
            raise RuntimeError(f"No market price for {source_symbol}")

        prev = self._to_float(meta.get("chartPreviousClose"))
        if prev in (None, 0.0) and len(closes) >= 2:
            prev = float(closes[-2])

        change = (price - prev) if prev not in (None, 0.0) else 0.0
        change_pct = ((change / prev) * 100) if prev not in (None, 0.0) else 0.0

        high = self._to_float(meta.get("regularMarketDayHigh"))
        if high is None:
            high = max(highs) if highs else price

        low = self._to_float(meta.get("regularMarketDayLow"))
        if low is None:
            low = min(lows) if lows else price

        volume = self._to_float(meta.get("regularMarketVolume"))
        if volume is None:
            volume = volumes[-1] if volumes else 0

        name = (
            meta.get("shortName")
            or meta.get("longName")
            or meta.get("symbol")
            or source_symbol
        )

        return {
            "symbol": str(meta.get("symbol", source_symbol)).upper(),
            "name": str(name),
            "price": round(float(price), 6),
            "change": round(float(change), 6),
            "change_percent": round(float(change_pct), 6),
            "volume": int(float(volume) if volume is not None else 0),
            "day_high": round(float(high), 6),
            "day_low": round(float(low), 6),
        }

    async def _fetch_binance_quote(self, symbol: str, source_symbol: str) -> Dict[str, Any]:
        client = await self._client()
        binance_symbol = self._resolve_binance_symbol(symbol=symbol, source_symbol=source_symbol)
        if not binance_symbol:
            raise RuntimeError(f"Symbol {symbol} is not mapped to Binance")

        res = await client.get(BINANCE_24H_URL, params={"symbol": binance_symbol})
        res.raise_for_status()
        payload = res.json()
        if not isinstance(payload, dict) or "lastPrice" not in payload:
            raise RuntimeError(f"No Binance payload for {symbol}")

        price = float(payload.get("lastPrice", 0.0) or 0.0)
        change = float(payload.get("priceChange", 0.0) or 0.0)
        change_pct = float(payload.get("priceChangePercent", 0.0) or 0.0)
        high = float(payload.get("highPrice", price) or price)
        low = float(payload.get("lowPrice", price) or price)
        volume = int(float(payload.get("volume", 0.0) or 0.0))
        if price <= 0:
            raise RuntimeError(f"Invalid Binance price for {symbol}")

        return {
            "symbol": symbol,
            "name": "Bitcoin" if symbol.startswith("BTC") else "Ethereum" if symbol.startswith("ETH") else symbol,
            "price": round(price, 6),
            "change": round(change, 6),
            "change_percent": round(change_pct, 6),
            "volume": volume,
            "day_high": round(high, 6),
            "day_low": round(low, 6),
        }

    async def _fetch_open_er_fx_quote(self, symbol: str, source_symbol: str) -> Dict[str, Any]:
        pair = source_symbol.replace("=X", "")
        if len(pair) != 6:
            raise RuntimeError(f"Unsupported FX symbol: {source_symbol}")
        base = pair[:3]
        quote = pair[3:]

        client = await self._client()
        res = await client.get(f"{OPEN_ER_LATEST_URL}/{base}")
        res.raise_for_status()
        payload = res.json()

        if payload.get("result") != "success":
            raise RuntimeError(f"Open ER API error for {base}/{quote}: {payload}")
        rates = payload.get("rates") or {}
        value = self._to_float(rates.get(quote))
        if value in (None, 0.0):
            raise RuntimeError(f"Missing FX rate for {base}/{quote}")

        previous = self._last_price_by_symbol.get(symbol)
        change = (value - previous) if previous not in (None, 0.0) else 0.0
        change_pct = ((change / previous) * 100) if previous not in (None, 0.0) else 0.0
        self._last_price_by_symbol[symbol] = float(value)

        return {
            "symbol": symbol,
            "name": f"{base}/{quote}",
            "price": round(float(value), 6),
            "change": round(float(change), 6),
            "change_percent": round(float(change_pct), 6),
            "volume": 0,
            "day_high": round(float(value), 6),
            "day_low": round(float(value), 6),
        }

    async def _fetch_yahoo_history(self, source_symbol: str, days: int) -> List[Dict[str, Any]]:
        client = await self._client()
        end = datetime.now(tz=timezone.utc)
        start = end - timedelta(days=max(days * 3, 21))

        encoded = quote_plus(source_symbol)
        url = f"{YAHOO_CHART_URL}/{encoded}"
        params = {
            "period1": int(start.timestamp()),
            "period2": int(end.timestamp()),
            "interval": "1d",
            "events": "history",
        }
        res = await client.get(url, params=params)
        res.raise_for_status()

        payload = res.json()
        chart = payload.get("chart", {})
        if chart.get("error"):
            raise RuntimeError(str(chart["error"]))
        results = chart.get("result") or []
        if not results:
            return []

        result = results[0]
        timestamps = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []

        data: List[Dict[str, Any]] = []
        for i, ts in enumerate(timestamps):
            close = closes[i] if i < len(closes) else None
            if close is None:
                continue
            volume = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
            date = datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat()
            data.append({
                "date": date,
                "close": round(float(close), 6),
                "volume": int(float(volume)),
            })

        return data[-days:]

    async def _fetch_stooq_live(self, source_symbol: str) -> Dict[str, Any]:
        client = await self._client()
        encoded = quote_plus(source_symbol.lower())
        url = f"{STOOQ_LIVE_URL}?s={encoded}&f={STOOQ_LIVE_FIELDS}&h&e=csv"
        res = await client.get(url)
        res.raise_for_status()

        rows = list(csv.DictReader(io.StringIO(res.text)))
        if not rows:
            raise RuntimeError(f"No data returned for {source_symbol}")

        row = rows[0]
        price = self._to_float(row.get("Close"))
        if price is None:
            raise RuntimeError(f"No market price for {source_symbol}")

        prev = self._to_float(row.get("Prev"))
        if prev in (None, 0.0):
            prev = self._to_float(row.get("Open"))

        change = (price - prev) if prev is not None else 0.0
        change_pct = ((change / prev) * 100) if prev not in (None, 0.0) else 0.0
        high = self._to_float(row.get("High")) or price
        low = self._to_float(row.get("Low")) or price
        volume = int(self._to_float(row.get("Volume")) or 0)

        return {
            "symbol": row.get("Symbol", source_symbol).upper(),
            "name": (row.get("Name") or source_symbol).strip(),
            "price": round(price, 6),
            "change": round(change, 6),
            "change_percent": round(change_pct, 6),
            "volume": volume,
            "day_high": round(high, 6),
            "day_low": round(low, 6),
        }

    async def _fetch_binance_candles(
        self,
        symbol: str,
        source_symbol: str,
        interval: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        client = await self._client()
        binance_symbol = self._resolve_binance_symbol(symbol=symbol, source_symbol=source_symbol)
        if not binance_symbol:
            raise RuntimeError(f"Symbol {symbol} is not mapped to Binance")

        normalized = self._normalize_interval(interval, target="binance")
        res = await client.get(
            BINANCE_KLINES_URL,
            params={"symbol": binance_symbol, "interval": normalized, "limit": max(20, min(limit, 500))},
        )
        res.raise_for_status()
        rows = res.json()
        if not isinstance(rows, list) or not rows:
            raise RuntimeError(f"No Binance kline data for {symbol}")

        candles: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, list) or len(row) < 6:
                continue
            candles.append({
                "time": int(int(row[0]) / 1000),
                "open": round(float(row[1]), 8),
                "high": round(float(row[2]), 8),
                "low": round(float(row[3]), 8),
                "close": round(float(row[4]), 8),
                "volume": round(float(row[5]), 8),
            })
        return candles

    async def _fetch_yahoo_candles(
        self,
        source_symbol: str,
        interval: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        client = await self._client()
        normalized = self._normalize_interval(interval, target="yahoo")
        request_interval = YAHOO_INTERVAL_MAP.get(normalized, normalized)
        request_range = YAHOO_RANGE_BY_INTERVAL.get(normalized, "3mo")

        encoded = quote_plus(source_symbol)
        url = f"{YAHOO_CHART_URL}/{encoded}"
        res = await client.get(
            url,
            params={
                "range": request_range,
                "interval": request_interval,
                "includePrePost": "false",
                "events": "div,splits",
            },
        )
        res.raise_for_status()

        payload = res.json()
        chart = payload.get("chart", {})
        if chart.get("error"):
            raise RuntimeError(str(chart["error"]))
        results = chart.get("result") or []
        if not results:
            raise RuntimeError(f"No Yahoo chart result for {source_symbol}")

        result = results[0]
        timestamps = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []

        candles: List[Dict[str, Any]] = []
        for i, ts in enumerate(timestamps):
            o = opens[i] if i < len(opens) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            c = closes[i] if i < len(closes) else None
            if o is None or h is None or l is None or c is None:
                continue
            v = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
            candles.append({
                "time": int(ts),
                "open": round(float(o), 8),
                "high": round(float(h), 8),
                "low": round(float(l), 8),
                "close": round(float(c), 8),
                "volume": round(float(v), 8),
            })

        return candles[-limit:]

    async def _fetch_stooq_daily_candles(self, source_symbol: str, limit: int) -> List[Dict[str, Any]]:
        client = await self._client()
        encoded = quote_plus(source_symbol.lower())
        url = f"{STOOQ_HISTORY_URL}?s={encoded}&i=d"
        res = await client.get(url)
        res.raise_for_status()

        rows = list(csv.DictReader(io.StringIO(res.text)))
        if not rows:
            return []

        candles: List[Dict[str, Any]] = []
        for row in rows[-limit:]:
            date_str = row.get("Date")
            o = self._to_float(row.get("Open"))
            h = self._to_float(row.get("High"))
            l = self._to_float(row.get("Low"))
            c = self._to_float(row.get("Close"))
            if not date_str or o is None or h is None or l is None or c is None:
                continue
            try:
                ts = int(datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc).timestamp())
            except Exception:
                continue
            candles.append({
                "time": ts,
                "open": round(o, 8),
                "high": round(h, 8),
                "low": round(l, 8),
                "close": round(c, 8),
                "volume": round(float(self._to_float(row.get("Volume")) or 0), 8),
            })
        return candles

    def _normalize_interval(self, interval: str, target: str) -> str:
        value = interval.strip().lower()
        if value == "60m":
            value = "1h"
        if target == "yahoo" and value == "4h":
            value = "1h"

        if target == "binance":
            return value if value in BINANCE_SUPPORTED_INTERVALS else "5m"
        if target == "yahoo":
            return value if value in YAHOO_INTERVAL_MAP else "5m"
        return value

    def _resolve_symbol(self, ticker: str) -> str:
        return SYMBOL_ALIASES.get(ticker.upper(), ticker.upper())

    def _resolve_stooq_symbol(self, source_symbol: str) -> str:
        return STOOQ_SOURCE_ALIASES.get(source_symbol.upper(), source_symbol.upper())

    def _detect_asset_class(self, symbol: str, source_symbol: str) -> str:
        symbol_u = symbol.upper()
        source_u = source_symbol.upper()
        if self._is_likely_crypto_symbol(symbol_u) or self._is_likely_crypto_symbol(source_u):
            return "crypto"
        if source_u.endswith("=X") or symbol_u in {"EURUSD", "USDVND"}:
            return "fx"
        return "equity"

    def _is_likely_crypto_symbol(self, value: str) -> bool:
        raw = value.upper().replace("/", "").replace("-", "")
        if raw in BINANCE_SYMBOL_ALIASES:
            return True
        if raw.endswith(("USDT", "BUSD", "USDC", "FDUSD")) and len(raw) >= 6:
            return True
        if raw in {"BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "LTC", "TRX", "AVAX", "DOT", "LINK"}:
            return True
        return False

    def _resolve_binance_symbol(self, symbol: str, source_symbol: str) -> str:
        for candidate in (symbol, source_symbol):
            raw = str(candidate or "").upper().replace("/", "").replace("-", "")
            if not raw:
                continue
            if raw in BINANCE_SYMBOL_ALIASES:
                return BINANCE_SYMBOL_ALIASES[raw]
            if raw.endswith("USD") and len(raw) >= 6:
                return f"{raw[:-3]}USDT"
            if raw.endswith(("USDT", "BUSD", "USDC", "FDUSD")) and len(raw) >= 6:
                return raw

        raw_symbol = str(symbol or "").upper().replace("/", "").replace("-", "")
        if raw_symbol and raw_symbol.isalnum() and len(raw_symbol) <= 10:
            return f"{raw_symbol}USDT"
        return ""

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(
                timeout=10.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0"},
            )
        return self._http

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value in (None, "", "N/D"):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


    def _get_mock_quote(self, ticker: str) -> Dict[str, Any]:
        price = self._get_mock_price(ticker)
        previous = max(price * 0.99, 0.01)
        change = price - previous
        return {
            "symbol": ticker.upper(),
            "name": f"{ticker.upper()} (Mock)",
            "price": price,
            "change": change,
            "change_percent": (change / previous) * 100 if previous else 0.0,
            "volume": int(100_000 + (abs(hash(ticker)) % 900_000)),
            "day_high": round(price * 1.01, 6),
            "day_low": round(price * 0.99, 6),
        }

    def _get_mock_price(self, ticker: str) -> float:
        base = 100.0 + (len(ticker) * 10.5)
        t = time.time()
        fluctuation = math.sin(t / 10) * 2.0 + (hash(ticker + str(int(t))) % 100) / 50.0
        return round(base + fluctuation, 6)

    def _get_mock_history(self, ticker: str, days: int) -> List[Dict[str, Any]]:
        import random

        base = 100.0 + (len(ticker) * 10.5)
        data = []
        for i in range(days):
            volatility = base * 0.05
            change = (random.random() - 0.5) * volatility
            price = max(base + change, 1.0)
            data.append({
                "date": f"2024-01-{i + 1:02d}",
                "close": round(price, 6),
                "volume": int(1000 * (i + 1) + random.random() * 500),
            })
        return data

    def _get_mock_candles(self, ticker: str, interval: str, limit: int) -> List[Dict[str, Any]]:
        import random

        now = int(time.time())
        step_seconds = {
            "1m": 60,
            "5m": 300,
            "15m": 900,
            "30m": 1800,
            "1h": 3600,
            "4h": 14400,
            "1d": 86400,
        }.get(interval, 300)

        base = max(self._get_mock_price(ticker), 1.0)
        candles: List[Dict[str, Any]] = []
        price = base
        for i in range(limit):
            ts = now - (limit - i) * step_seconds
            drift = (random.random() - 0.5) * (base * 0.01)
            open_price = max(price, 0.01)
            close_price = max(open_price + drift, 0.01)
            high_price = max(open_price, close_price) * (1 + random.random() * 0.003)
            low_price = min(open_price, close_price) * (1 - random.random() * 0.003)
            volume = abs(drift) * 10_000 + random.random() * 5_000
            candles.append({
                "time": ts,
                "open": round(open_price, 8),
                "high": round(high_price, 8),
                "low": round(low_price, 8),
                "close": round(close_price, 8),
                "volume": round(volume, 8),
            })
            price = close_price
        return candles
