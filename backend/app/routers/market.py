from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from math import asin, cos, log, radians, sin, sqrt
import re
from statistics import NormalDist, mean
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.requests import Request

from app.engine.market_engine import MarketEngine

router = APIRouter(prefix="/api/market", tags=["market"])

RESTCOUNTRIES_URL = "https://restcountries.com/v3.1/all"
WORLDBANK_INDICATOR_URL = "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/{base}"
BINANCE_TICKER_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_DEPTH_URL = "https://api.binance.com/api/v3/depth"
BINANCE_TRADES_URL = "https://api.binance.com/api/v3/trades"
RESTCOUNTRIES_BASE_FIELDS = "cca2,ccn3,name,latlng,area,population,region,subregion,capital,timezones"
RESTCOUNTRIES_EXTRA_FIELDS = "cca2,currencies,languages"

RESTCOUNTRIES_CACHE: dict[str, Any] = {"expires_at": 0.0, "data": []}
WB_CACHE: dict[str, tuple[dict[str, Any], float]] = {}

_BINANCE_SYMBOL_RE = re.compile(r"^[A-Z0-9]{4,20}$")
_BINANCE_QUOTE_SUFFIXES = ("USDT", "BUSD", "USDC", "FDUSD", "BTC", "ETH", "BNB", "TRY")
_BINANCE_BASE_ALIASES = {
    "BTC": "BTCUSDT",
    "ETH": "ETHUSDT",
    "BNB": "BNBUSDT",
    "SOL": "SOLUSDT",
    "XRP": "XRPUSDT",
    "ADA": "ADAUSDT",
    "DOGE": "DOGEUSDT",
    "LTC": "LTCUSDT",
    "TRX": "TRXUSDT",
    "AVAX": "AVAXUSDT",
    "DOT": "DOTUSDT",
    "LINK": "LINKUSDT",
}

RESTCOUNTRIES_FALLBACK: list[dict[str, Any]] = [
    {
        "code": "US",
        "numeric_code": "840",
        "name": "United States",
        "official_name": "United States of America",
        "lat": 38.0,
        "lng": -97.0,
        "area_km2": 9833517.0,
        "population": 331000000.0,
        "region": "Americas",
        "subregion": "North America",
        "capital": "Washington, D.C.",
        "timezones": ["UTC-05:00"],
        "currencies": ["USD"],
        "languages": ["English"],
    },
    {
        "code": "VN",
        "numeric_code": "704",
        "name": "Vietnam",
        "official_name": "Socialist Republic of Vietnam",
        "lat": 16.0,
        "lng": 108.0,
        "area_km2": 331212.0,
        "population": 100300000.0,
        "region": "Asia",
        "subregion": "South-Eastern Asia",
        "capital": "Hanoi",
        "timezones": ["UTC+07:00"],
        "currencies": ["VND"],
        "languages": ["Vietnamese"],
    },
    {
        "code": "JP",
        "numeric_code": "392",
        "name": "Japan",
        "official_name": "Japan",
        "lat": 36.0,
        "lng": 138.0,
        "area_km2": 377975.0,
        "population": 124500000.0,
        "region": "Asia",
        "subregion": "Eastern Asia",
        "capital": "Tokyo",
        "timezones": ["UTC+09:00"],
        "currencies": ["JPY"],
        "languages": ["Japanese"],
    },
    {
        "code": "GB",
        "numeric_code": "826",
        "name": "United Kingdom",
        "official_name": "United Kingdom of Great Britain and Northern Ireland",
        "lat": 55.0,
        "lng": -3.0,
        "area_km2": 242495.0,
        "population": 67700000.0,
        "region": "Europe",
        "subregion": "Northern Europe",
        "capital": "London",
        "timezones": ["UTC+00:00"],
        "currencies": ["GBP"],
        "languages": ["English"],
    },
    {
        "code": "DE",
        "numeric_code": "276",
        "name": "Germany",
        "official_name": "Federal Republic of Germany",
        "lat": 51.0,
        "lng": 9.0,
        "area_km2": 357114.0,
        "population": 84000000.0,
        "region": "Europe",
        "subregion": "Western Europe",
        "capital": "Berlin",
        "timezones": ["UTC+01:00"],
        "currencies": ["EUR"],
        "languages": ["German"],
    },
]

KNOWN_BTC_HOLDINGS = {
    "US": 213_000,
    "CN": 190_000,
    "GB": 61_000,
    "UA": 46_000,
    "BT": 13_000,
    "SV": 5_700,
    "FI": 1_981,
    "GE": 66,
}

SUPPORTED_FIAT_CURRENCIES = {
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "VND",
    "AUD",
    "CAD",
    "SGD",
    "CNY",
    "HKD",
    "KRW",
    "THB",
    "MYR",
    "PHP",
    "IDR",
    "INR",
    "CHF",
    "SEK",
    "NOK",
    "DKK",
    "NZD",
    "AED",
    "SAR",
    "TRY",
    "BRL",
    "MXN",
}

SUPPORTED_CRYPTO_CURRENCIES = {
    "BTC",
    "ETH",
    "BNB",
    "SOL",
    "XRP",
    "ADA",
    "DOGE",
    "LTC",
    "TRX",
    "AVAX",
    "DOT",
    "LINK",
    "USDT",
}


async def _http_get_json(url: str, *, params: dict[str, Any] | None = None) -> Any:
    async with httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        headers={"User-Agent": "NexusFinance/2.1 (+market-router)"},
    ) as client:
        res = await client.get(url, params=params)
        res.raise_for_status()
        return res.json()


def _stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:20]


def _normalize_binance_symbol(value: str) -> str:
    raw = str(value or "").upper().strip().replace("/", "").replace("-", "")
    if not raw:
        raise HTTPException(status_code=400, detail="Binance symbol is empty")

    if raw in _BINANCE_BASE_ALIASES:
        return _BINANCE_BASE_ALIASES[raw]

    if raw.endswith(_BINANCE_QUOTE_SUFFIXES):
        if not _BINANCE_SYMBOL_RE.match(raw):
            raise HTTPException(status_code=400, detail=f"Invalid Binance symbol: {raw}")
        return raw

    if not _BINANCE_SYMBOL_RE.match(raw):
        raise HTTPException(status_code=400, detail=f"Invalid Binance symbol: {raw}")

    if len(raw) <= 12:
        return f"{raw}USDT"
    return raw


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


async def _fiat_to_usd_rate(currency: str, engine: MarketEngine) -> tuple[float, str]:
    code = currency.upper().strip()
    if code == "USD":
        return 1.0, "fiat:identity"
    cache_key = f"fx:fiat-usd:{code}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict):
            rate = _to_float(cached.get("rate"), 0.0)
            if rate > 0:
                return rate, str(cached.get("source") or "open-er-api")

    payload = await _http_get_json(OPEN_ER_API_URL.format(base=code))
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail=f"Failed to fetch FX rate for {code}")
    rates = payload.get("rates") if isinstance(payload.get("rates"), dict) else {}
    usd_rate = _to_float(rates.get("USD"), 0.0)
    if usd_rate <= 0:
        raise HTTPException(status_code=502, detail=f"USD rate unavailable for {code}")
    source = "open-er-api"
    if engine.cache:
        await engine.cache.set(cache_key, {"rate": usd_rate, "source": source}, ttl=600)
    return usd_rate, source


async def _crypto_to_usd_rate(currency: str, engine: MarketEngine) -> tuple[float, str]:
    code = currency.upper().strip()
    if code in {"USD", "USDT"}:
        return 1.0, "crypto:identity"
    pair = _normalize_binance_symbol(f"{code}USDT")
    cache_key = f"fx:crypto-usd:{pair}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict):
            rate = _to_float(cached.get("rate"), 0.0)
            if rate > 0:
                return rate, str(cached.get("source") or "binance")

    try:
        payload = await _http_get_json(BINANCE_TICKER_24H_URL, params={"symbol": pair})
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch crypto rate for {pair}") from exc
    rate = _to_float((payload or {}).get("lastPrice"), 0.0) if isinstance(payload, dict) else 0.0
    if rate <= 0:
        raise HTTPException(status_code=502, detail=f"Crypto rate unavailable for {pair}")
    source = "binance"
    if engine.cache:
        await engine.cache.set(cache_key, {"rate": rate, "source": source}, ttl=5)
    return rate, source


async def _load_restcountries() -> list[dict[str, Any]]:
    now = time.time()
    if RESTCOUNTRIES_CACHE["expires_at"] > now and RESTCOUNTRIES_CACHE["data"]:
        return RESTCOUNTRIES_CACHE["data"]

    try:
        payload = await _http_get_json(
            RESTCOUNTRIES_URL,
            params={"fields": RESTCOUNTRIES_BASE_FIELDS},
        )
    except Exception:
        if RESTCOUNTRIES_CACHE["data"]:
            return RESTCOUNTRIES_CACHE["data"]
        return [dict(x) for x in RESTCOUNTRIES_FALLBACK]

    rows = payload if isinstance(payload, list) else []
    extra_by_code: dict[str, dict[str, Any]] = {}
    try:
        extra_payload = await _http_get_json(
            RESTCOUNTRIES_URL,
            params={"fields": RESTCOUNTRIES_EXTRA_FIELDS},
        )
        for row in (extra_payload if isinstance(extra_payload, list) else []):
            if not isinstance(row, dict):
                continue
            code = str(row.get("cca2") or "").upper()
            if len(code) != 2:
                continue
            extra_by_code[code] = {
                "currencies": row.get("currencies") if isinstance(row.get("currencies"), dict) else {},
                "languages": row.get("languages") if isinstance(row.get("languages"), dict) else {},
            }
    except Exception:
        extra_by_code = {}

    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get("cca2") or "").upper()
        if len(code) != 2:
            continue
        latlng = row.get("latlng") if isinstance(row.get("latlng"), list) else [0, 0]
        lat = _to_float(latlng[0], 0.0) if len(latlng) > 0 else 0.0
        lng = _to_float(latlng[1], 0.0) if len(latlng) > 1 else 0.0

        name_obj = row.get("name") if isinstance(row.get("name"), dict) else {}
        extra = extra_by_code.get(code, {})
        currencies = extra.get("currencies") if isinstance(extra.get("currencies"), dict) else {}
        currency_codes = list(currencies.keys())[:3]
        languages = extra.get("languages") if isinstance(extra.get("languages"), dict) else {}

        normalized.append(
            {
                "code": code,
                "numeric_code": str(row.get("ccn3") or ""),
                "name": str(name_obj.get("common") or code),
                "official_name": str(name_obj.get("official") or ""),
                "lat": lat,
                "lng": lng,
                "area_km2": _to_float(row.get("area"), 0),
                "population": _to_float(row.get("population"), 0),
                "region": str(row.get("region") or ""),
                "subregion": str(row.get("subregion") or ""),
                "capital": ", ".join(str(x) for x in (row.get("capital") or [])[:2]),
                "timezones": list(row.get("timezones") or []),
                "currencies": currency_codes,
                "languages": [str(v) for v in languages.values()][:4],
            }
        )

    if not normalized:
        if RESTCOUNTRIES_CACHE["data"]:
            return RESTCOUNTRIES_CACHE["data"]
        return [dict(x) for x in RESTCOUNTRIES_FALLBACK]

    normalized.sort(key=lambda x: x["name"])
    RESTCOUNTRIES_CACHE["data"] = normalized
    RESTCOUNTRIES_CACHE["expires_at"] = now + 24 * 3600
    return normalized


async def _latest_worldbank_indicator(country_code: str, indicator: str) -> dict[str, Any]:
    key = f"{country_code.upper()}:{indicator.upper()}"
    now = time.time()
    cached = WB_CACHE.get(key)
    if cached and cached[1] > now:
        return cached[0]

    try:
        data = await _http_get_json(
            WORLDBANK_INDICATOR_URL.format(country=country_code.lower(), indicator=indicator),
            params={"format": "json", "per_page": 70},
        )
    except Exception:
        WB_CACHE[key] = ({"value": None, "year": None}, now + 30 * 60)
        return {"value": None, "year": None}

    result = {"value": None, "year": None}
    if isinstance(data, list) and len(data) >= 2 and isinstance(data[1], list):
        for row in data[1]:
            if not isinstance(row, dict):
                continue
            value = row.get("value")
            if value is None:
                continue
            try:
                result = {"value": float(value), "year": str(row.get("date") or "")}
                break
            except Exception:
                continue

    WB_CACHE[key] = (result, now + 12 * 3600)
    return result


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return r * c


def _income_percentile_from_gdp_and_gini(annual_income_usd: float, gdp_per_capita: float, gini: float) -> float:
    if annual_income_usd <= 0 or gdp_per_capita <= 0:
        return 0.0

    gini_ratio = min(max(gini / 100.0, 0.2), 0.65)
    p = (gini_ratio + 1.0) / 2.0
    sigma = max(0.25, min(2.5, sqrt(2.0) * NormalDist().inv_cdf(p)))
    mu = max(-20.0, min(30.0, (log(gdp_per_capita) - 0.5 * sigma * sigma) if gdp_per_capita > 0 else 0.0))
    percentile = NormalDist(mu, sigma).cdf(log(max(annual_income_usd, 1e-9)))
    return max(0.0, min(100.0, percentile * 100.0))




def get_market_engine(request: Request) -> MarketEngine:
    return request.app.state.market_engine




@router.get("/quote/{ticker}")
async def get_price(ticker: str, engine: MarketEngine = Depends(get_market_engine)):
    quote = await engine.get_stock_quote(ticker)
    return quote.model_dump(mode="json")


@router.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. AAPL,BTC,VNM"),
    engine: MarketEngine = Depends(get_market_engine),
):
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    quotes = await engine.get_stock_quotes(tickers)
    return [q.model_dump(mode="json") for q in quotes]


@router.get("/indices")
async def get_indices(engine: MarketEngine = Depends(get_market_engine)):
    overview = await engine.get_market_indices()
    return overview.model_dump(mode="json")


@router.get("/convert")
async def convert_currency(
    amount: float = Query(..., gt=0, le=1_000_000_000),
    from_currency: str = Query(..., min_length=2, max_length=12),
    to_currency: str = Query(..., min_length=2, max_length=12),
    engine: MarketEngine = Depends(get_market_engine),
):
    """Convert fiat/crypto amount using live FX + Binance prices."""
    source = from_currency.upper().strip()
    target = to_currency.upper().strip()
    if source == target:
        return {
            "amount": amount,
            "from_currency": source,
            "to_currency": target,
            "rate": 1.0,
            "converted": amount,
            "source": "identity",
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }

    source_is_crypto = source in SUPPORTED_CRYPTO_CURRENCIES
    target_is_crypto = target in SUPPORTED_CRYPTO_CURRENCIES
    source_is_fiat = source in SUPPORTED_FIAT_CURRENCIES
    target_is_fiat = target in SUPPORTED_FIAT_CURRENCIES

    if not (source_is_crypto or source_is_fiat):
        raise HTTPException(status_code=400, detail=f"Unsupported source currency: {source}")
    if not (target_is_crypto or target_is_fiat):
        raise HTTPException(status_code=400, detail=f"Unsupported target currency: {target}")

    if source_is_crypto:
        source_to_usd, source_feed = await _crypto_to_usd_rate(source, engine)
    else:
        source_to_usd, source_feed = await _fiat_to_usd_rate(source, engine)

    if target_is_crypto:
        target_to_usd, target_feed = await _crypto_to_usd_rate(target, engine)
    else:
        target_to_usd, target_feed = await _fiat_to_usd_rate(target, engine)

    if source_to_usd <= 0 or target_to_usd <= 0:
        raise HTTPException(status_code=502, detail="Rate provider returned invalid conversion data")

    converted = (amount * source_to_usd) / target_to_usd
    rate = source_to_usd / target_to_usd
    return {
        "amount": amount,
        "from_currency": source,
        "to_currency": target,
        "rate": round(rate, 10),
        "converted": round(converted, 10),
        "source": f"{source_feed}+{target_feed}",
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get("/history/{ticker}")
async def get_history(
    ticker: str,
    days: int = Query(30, ge=7, le=365),
    engine: MarketEngine = Depends(get_market_engine),
):
    return await engine.get_history(ticker, days)


@router.get("/candles/{ticker}")
async def get_candles(
    ticker: str,
    interval: str = Query("5m", pattern=r"^(1m|2m|5m|15m|30m|1h|4h|1d|1w|60m)$"),
    limit: int = Query(180, ge=30, le=500),
    engine: MarketEngine = Depends(get_market_engine),
):
    payload = await engine.get_candles(ticker=ticker, interval=interval, limit=limit)
    payload["updated_at"] = datetime.now(tz=timezone.utc).isoformat()
    return payload


@router.get("/binance/ticker/{symbol}")
async def get_binance_ticker_24h(
    symbol: str,
    engine: MarketEngine = Depends(get_market_engine),
):
    pair = _normalize_binance_symbol(symbol)
    cache_key = f"binance:ticker24h:{pair}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and cached.get("symbol") == pair:
            return cached

    try:
        payload = await _http_get_json(BINANCE_TICKER_24H_URL, params={"symbol": pair})
        if not isinstance(payload, dict) or "lastPrice" not in payload:
            raise RuntimeError("unexpected payload")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Binance ticker: {pair}") from exc

    result = {
        "symbol": pair,
        "last_price": float(payload.get("lastPrice", 0.0) or 0.0),
        "open_price": float(payload.get("openPrice", 0.0) or 0.0),
        "high_price": float(payload.get("highPrice", 0.0) or 0.0),
        "low_price": float(payload.get("lowPrice", 0.0) or 0.0),
        "price_change": float(payload.get("priceChange", 0.0) or 0.0),
        "price_change_percent": float(payload.get("priceChangePercent", 0.0) or 0.0),
        "volume_base": float(payload.get("volume", 0.0) or 0.0),
        "volume_quote": float(payload.get("quoteVolume", 0.0) or 0.0),
        "count_24h": int(float(payload.get("count", 0) or 0)),
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, result, ttl=2)
    return result


@router.get("/binance/depth/{symbol}")
async def get_binance_orderbook_depth(
    symbol: str,
    limit: int = Query(20, ge=5, le=200),
    engine: MarketEngine = Depends(get_market_engine),
):
    pair = _normalize_binance_symbol(symbol)
    allowed_limits = [5, 10, 20, 50, 100, 200]
    normalized_limit = min(allowed_limits, key=lambda x: abs(x - limit))
    cache_key = f"binance:depth:{pair}:{normalized_limit}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and cached.get("symbol") == pair:
            return cached

    try:
        payload = await _http_get_json(BINANCE_DEPTH_URL, params={"symbol": pair, "limit": normalized_limit})
        if not isinstance(payload, dict):
            raise RuntimeError("unexpected payload")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Binance orderbook: {pair}") from exc

    bids_raw = payload.get("bids") if isinstance(payload.get("bids"), list) else []
    asks_raw = payload.get("asks") if isinstance(payload.get("asks"), list) else []
    bids = [
        {"price": float(level[0]), "quantity": float(level[1])}
        for level in bids_raw[:normalized_limit]
        if isinstance(level, list) and len(level) >= 2
    ]
    asks = [
        {"price": float(level[0]), "quantity": float(level[1])}
        for level in asks_raw[:normalized_limit]
        if isinstance(level, list) and len(level) >= 2
    ]
    result = {
        "symbol": pair,
        "last_update_id": int(float(payload.get("lastUpdateId", 0) or 0)),
        "bids": bids,
        "asks": asks,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, result, ttl=1)
    return result


@router.get("/binance/trades/{symbol}")
async def get_binance_recent_trades(
    symbol: str,
    limit: int = Query(50, ge=10, le=120),
    engine: MarketEngine = Depends(get_market_engine),
):
    pair = _normalize_binance_symbol(symbol)
    cache_key = f"binance:trades:{pair}:{limit}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and cached.get("symbol") == pair:
            return cached

    try:
        payload = await _http_get_json(BINANCE_TRADES_URL, params={"symbol": pair, "limit": limit})
        if not isinstance(payload, list):
            raise RuntimeError("unexpected payload")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Binance trades: {pair}") from exc

    trades = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        trades.append(
            {
                "id": int(float(row.get("id", 0) or 0)),
                "price": float(row.get("price", 0.0) or 0.0),
                "quantity": float(row.get("qty", 0.0) or 0.0),
                "quote_quantity": float(row.get("quoteQty", 0.0) or 0.0),
                "time": int(float(row.get("time", 0) or 0)),
                "is_buyer_maker": bool(row.get("isBuyerMaker", False)),
            }
        )
    result = {
        "symbol": pair,
        "trades": trades,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, result, ttl=1)
    return result


@router.get("/analytics")
async def get_analytics(
    symbols: str = Query("BTC,ETH,SPX,DOW,GOLD"),
    engine: MarketEngine = Depends(get_market_engine),
):
    watch = [s.strip().upper() for s in symbols.split(",") if s.strip()][:8]
    quotes = await engine.get_stock_quotes(watch)

    volatility = sorted(
        [
            {
                "symbol": q.symbol,
                "price": q.price,
                "change_percent": q.change_percent,
                "abs_move": abs(q.change_percent),
            }
            for q in quotes
        ],
        key=lambda x: x["abs_move"],
        reverse=True,
    )

    momentum_rows: list[dict[str, Any]] = []
    for q in quotes[:6]:
        history = await engine.get_history(q.symbol, 8)
        if len(history) < 2:
            continue
        first = float(history[0].get("close", 0) or 0)
        last = float(history[-1].get("close", 0) or 0)
        if first <= 0:
            continue
        momentum_rows.append(
            {
                "symbol": q.symbol,
                "start": first,
                "last": last,
                "momentum_7d": ((last - first) / first) * 100,
            }
        )

    correlation_score = 0.0
    if quotes:
        positives = sum(1 for q in quotes if q.change_percent >= 0)
        negatives = len(quotes) - positives
        consensus = max(positives, negatives) / len(quotes)
        avg_abs = mean(abs(q.change_percent) for q in quotes)
        correlation_score = min(100.0, consensus * 65 + avg_abs * 7)

    return {
        "volatility_24h": volatility,
        "momentum_7d": momentum_rows,
        "correlation_risk": {
            "score": round(correlation_score, 2),
            "level": "high" if correlation_score >= 70 else "medium" if correlation_score >= 45 else "low",
        },
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get("/portfolio-overview")
async def get_portfolio_overview(request: Request, engine: MarketEngine = Depends(get_market_engine)):
    settings_store = request.app.state.settings_store
    settings = settings_store.get_settings()
    watch_symbols = settings.get("watch_symbols") or ["AAPL", "BTC", "VNM"]

    quotes = await engine.get_stock_quotes([str(x).upper() for x in watch_symbols][:10])
    quotes = [q for q in quotes if q.price > 0]

    if not quotes:
        return {
            "watch_symbols": watch_symbols,
            "allocation": [],
            "total_market_value": 0,
            "risk_note": "No live quotes available.",
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }

    total_value = sum(q.price for q in quotes)
    allocation = [
        {
            "symbol": q.symbol,
            "name": q.name,
            "price": q.price,
            "change_percent": q.change_percent,
            "weight": (q.price / total_value) * 100 if total_value > 0 else 0,
        }
        for q in quotes
    ]

    top = max(allocation, key=lambda x: x["weight"])
    risk_note = (
        f"Concentration risk is high on {top['symbol']} ({top['weight']:.1f}%)."
        if top["weight"] >= 45
        else "Allocation is relatively balanced across selected assets."
    )

    return {
        "watch_symbols": watch_symbols,
        "allocation": allocation,
        "total_market_value": total_value,
        "risk_note": risk_note,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }




@router.get("/countries")
async def get_countries(engine: MarketEngine = Depends(get_market_engine)):
    """Return full-country list for map overlay (all countries)."""
    cache_key = "map:countries:v2"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and isinstance(cached.get("countries"), list):
            return cached

    countries = await _load_restcountries()

    rows = await engine.get_stock_quotes(["BTC", "SPX", "EURUSD"])
    by_symbol = {q.symbol: q for q in rows}
    btc_price = float(by_symbol.get("BTC").price if by_symbol.get("BTC") else 0)
    spx_change = float(by_symbol.get("SPX").change_percent if by_symbol.get("SPX") else 0)

    output = []
    for row in countries:
        fx_projection = 1 + (spx_change / 1000)
        property_potential = max(0.0, min(100.0, 42 + spx_change * 2.1 + (btc_price / 100_000) * 12))
        output.append(
            {
                **row,
                "btc_holding": KNOWN_BTC_HOLDINGS.get(row["code"], 0),
                "fx_forecast_factor": round(fx_projection, 6),
                "real_estate_potential_pct": round(property_potential, 2),
                "ai_signal": "bullish" if property_potential >= 60 else "neutral" if property_potential >= 45 else "cautious",
            }
        )

    payload = {
        "countries": output,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache and output:
        await engine.cache.set(cache_key, payload, ttl=180)
    return payload


@router.get("/countries/{country_code}")
async def get_country_detail(country_code: str, engine: MarketEngine = Depends(get_market_engine)):
    """Deep country insight with real macro indicators from World Bank."""
    code = country_code.upper().strip()
    cache_key = f"map:country-detail:{code}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and isinstance(cached.get("country"), dict):
            return cached

    countries = await _load_restcountries()
    country = next((c for c in countries if c["code"] == code), None)
    if not country:
        return {"error": "Country not supported"}

    gdp = await _latest_worldbank_indicator(code, "NY.GDP.MKTP.CD")
    gdp_pc = await _latest_worldbank_indicator(code, "NY.GDP.PCAP.CD")
    gini = await _latest_worldbank_indicator(code, "SI.POV.GINI")
    electricity_pc = await _latest_worldbank_indicator(code, "EG.USE.ELEC.KH.PC")
    pop = await _latest_worldbank_indicator(code, "SP.POP.TOTL")

    payload = {
        "country": {
            **country,
            "gdp_usd": gdp.get("value"),
            "gdp_year": gdp.get("year"),
            "gdp_trillion_usd": (float(gdp.get("value")) / 1_000_000_000_000) if gdp.get("value") else None,
            "gdp_per_capita_usd": gdp_pc.get("value"),
            "gdp_per_capita_year": gdp_pc.get("year"),
            "gini": gini.get("value"),
            "gini_year": gini.get("year"),
            "electricity_kwh_per_capita": electricity_pc.get("value"),
            "electricity_year": electricity_pc.get("year"),
            "population_wb": pop.get("value") if pop.get("value") else country.get("population"),
            "population_year": pop.get("year"),
            "btc_holding": KNOWN_BTC_HOLDINGS.get(code, 0),
        },
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, payload, ttl=6 * 3600)
    return payload


@router.get("/income-benchmark")
async def get_income_benchmark(
    country: str = Query(..., min_length=2, max_length=2),
    income: float = Query(..., gt=0, description="User income amount in USD"),
    frequency: str = Query("monthly", pattern=r"^(monthly|yearly)$"),
    engine: MarketEngine = Depends(get_market_engine),
):
    """Estimate local income percentile from real GDP/capita + Gini data."""
    code = country.upper().strip()
    annual_income = income * 12.0 if frequency == "monthly" else income
    cache_key = f"income-benchmark:{code}:{frequency}:{round(annual_income, 2)}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and cached.get("country") == code:
            return cached

    countries = await _load_restcountries()
    country_row = next((c for c in countries if c["code"] == code), None)
    if not country_row:
        return {"error": "Country not found"}

    gdp = await _latest_worldbank_indicator(code, "NY.GDP.MKTP.CD")
    gdp_pc = await _latest_worldbank_indicator(code, "NY.GDP.PCAP.CD")
    gini = await _latest_worldbank_indicator(code, "SI.POV.GINI")

    gdp_per_capita = float(gdp_pc.get("value") or 0)
    gini_value = float(gini.get("value") or 37)
    percentile = _income_percentile_from_gdp_and_gini(annual_income, gdp_per_capita, gini_value)

    payload = {
        "country": code,
        "country_name": country_row.get("name"),
        "annual_income_usd": annual_income,
        "gdp_trillion_usd": (float(gdp.get("value")) / 1_000_000_000_000) if gdp.get("value") else None,
        "gdp_per_capita_usd": gdp_per_capita if gdp_per_capita > 0 else None,
        "gini": gini_value,
        "estimated_percentile": round(percentile, 2),
        "estimated_top_percent": round(max(0.0, 100.0 - percentile), 2),
        "benchmark_note": "Percentile is estimated from World Bank GDP per capita + Gini (log-normal approximation).",
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, payload, ttl=15 * 60)
    return payload


@router.get("/local-search")
async def local_search(
    query: str = Query(..., min_length=2, max_length=120),
    category: str = Query("restaurant", pattern=r"^(restaurant|cafe|bar)$"),
    engine: MarketEngine = Depends(get_market_engine),
):
    """Locate nearby places via OpenStreetMap (Nominatim + Overpass)."""
    normalized_query = " ".join(query.strip().lower().split())
    cache_key = f"local-search:{category}:{_stable_hash(normalized_query)}"
    if engine.cache:
        cached = await engine.cache.get(cache_key)
        if isinstance(cached, dict) and isinstance(cached.get("places"), list):
            return cached

    try:
        geo = await _http_get_json(
            NOMINATIM_URL,
            params={"q": query, "format": "jsonv2", "limit": 1},
        )
    except Exception:
        payload = {
            "query": query,
            "category": category,
            "center": {"lat": None, "lon": None},
            "places": [],
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        return payload
    if not isinstance(geo, list) or not geo:
        return {"query": query, "places": []}

    center = geo[0]
    lat = float(center.get("lat") or 0)
    lon = float(center.get("lon") or 0)

    overpass_query = f"""
    [out:json][timeout:25];
    (
      node[\"amenity\"=\"{category}\"](around:2500,{lat},{lon});
      way[\"amenity\"=\"{category}\"](around:2500,{lat},{lon});
      relation[\"amenity\"=\"{category}\"](around:2500,{lat},{lon});
    );
    out center 25;
    """

    try:
        async with httpx.AsyncClient(timeout=30.0, headers={"User-Agent": "NexusFinance/2.1 (+local-search)"}) as client:
            res = await client.post(OVERPASS_URL, data=overpass_query)
            res.raise_for_status()
            payload = res.json()
    except Exception:
        payload = {"elements": []}

    elements = payload.get("elements") if isinstance(payload, dict) else []
    places = []
    for item in (elements or [])[:20]:
        tags = item.get("tags") if isinstance(item.get("tags"), dict) else {}
        place_lat = item.get("lat") if item.get("lat") is not None else ((item.get("center") or {}).get("lat"))
        place_lon = item.get("lon") if item.get("lon") is not None else ((item.get("center") or {}).get("lon"))
        if place_lat is None or place_lon is None:
            continue
        distance = _haversine_km(lat, lon, float(place_lat), float(place_lon))
        opening_hours = str(tags.get("opening_hours") or "")
        places.append(
            {
                "name": str(tags.get("name") or "Unnamed"),
                "lat": float(place_lat),
                "lon": float(place_lon),
                "opening_hours": opening_hours,
                "is_likely_open_24_7": "24/7" in opening_hours,
                "distance_km": round(distance, 3),
            }
        )

    places.sort(key=lambda x: x["distance_km"])
    payload = {
        "query": query,
        "category": category,
        "center": {"lat": lat, "lon": lon},
        "places": places,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if engine.cache:
        await engine.cache.set(cache_key, payload, ttl=5 * 60)
    return payload
