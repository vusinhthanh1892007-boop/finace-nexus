import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "hkg1";

type RiskTolerance = "conservative" | "moderate" | "aggressive";
type AIProvider = "auto" | "gemini" | "openai";

type SettingsState = {
    auto_balance: boolean;
    notifications: boolean;
    risk_tolerance: RiskTolerance;
    ai_provider: AIProvider;
    ai_model: string;
    gemini_scopes: string[];
    openai_scopes: string[];
    api_key_version: number;
    last_secret_rotation_at: string;
    key_rotation_count: number;
    watch_symbols: string[];
    gemini_api_key: string;
    openai_api_key: string;
    updated_at: string;
};

type CountryRow = {
    code: string;
    numeric_code: string;
    name: string;
    official_name: string;
    lat: number;
    lng: number;
    area_km2: number;
    population: number;
    region: string;
    subregion: string;
    capital: string;
    timezones: string[];
    currencies: string[];
    languages: string[];
    btc_holding: number;
    fx_forecast_factor: number;
    real_estate_potential_pct: number;
    ai_signal: "bullish" | "neutral" | "cautious";
};

type CacheEntry = {
    value: unknown;
    expiresAt: number;
    staleUntil: number;
};

const RESTCOUNTRIES_FIELDS_URL =
    "https://restcountries.com/v3.1/all?fields=cca2,ccn3,name,latlng,area,population,region,subregion,capital,currencies";
const COUNTRIES_BACKUP_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
const DEFAULT_FETCH_TIMEOUT_MS = 7000;
const MAX_DATA_CACHE_ITEMS = 1400;

const DEFAULT_SETTINGS: SettingsState = {
    auto_balance: true,
    notifications: true,
    risk_tolerance: "moderate",
    ai_provider: "auto",
    ai_model: "gemini-2.0-flash",
    gemini_scopes: ["chat", "advisor_analysis"],
    openai_scopes: ["chat"],
    api_key_version: 1,
    last_secret_rotation_at: "",
    key_rotation_count: 0,
    watch_symbols: ["AAPL", "BTC", "VNM"],
    gemini_api_key: "",
    openai_api_key: "",
    updated_at: new Date().toISOString(),
};

declare global {
    var __nexus_state: SettingsState | undefined;
    var __nexus_countries: CountryRow[] | undefined;
    var __nexus_data_cache: Map<string, CacheEntry> | undefined;
    var __nexus_inflight_cache: Map<string, Promise<unknown>> | undefined;
}

function getState(): SettingsState {
    if (!globalThis.__nexus_state) {
        globalThis.__nexus_state = { ...DEFAULT_SETTINGS };
    }
    return globalThis.__nexus_state;
}

function toMasked(value: string): string {
    const v = String(value || "");
    if (v.length < 8) return "";
    return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function publicSettings(state: SettingsState) {
    return {
        auto_balance: state.auto_balance,
        notifications: state.notifications,
        risk_tolerance: state.risk_tolerance,
        ai_provider: state.ai_provider,
        ai_model: state.ai_model,
        gemini_scopes: state.gemini_scopes,
        openai_scopes: state.openai_scopes,
        api_key_version: state.api_key_version,
        last_secret_rotation_at: state.last_secret_rotation_at,
        key_rotation_count: state.key_rotation_count,
        watch_symbols: state.watch_symbols,
        gemini_configured: Boolean(state.gemini_api_key),
        gemini_key_masked: toMasked(state.gemini_api_key),
        openai_configured: Boolean(state.openai_api_key),
        openai_key_masked: toMasked(state.openai_api_key),
        updated_at: state.updated_at,
    };
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeSymbol(symbol: string) {
    return String(symbol || "").trim().toUpperCase();
}

function isCryptoLike(symbol: string) {
    return ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "DOT", "MATIC", "AVAX", "LINK", "LTC"].includes(symbol);
}

function toBinancePair(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (!s) return "";
    if (s.endsWith("USDT")) return s;
    return `${s}USDT`;
}

function toYahooSymbol(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (s === "SPX") return "^GSPC";
    if (s === "DOW") return "^DJI";
    if (s === "GOLD") return "GC=F";
    if (s === "BTC") return "BTC-USD";
    if (s === "ETH") return "ETH-USD";
    if (s === "EURUSD") return "EURUSD=X";
    if (s === "USDVND") return "VND=X";
    return s;
}

function toStooqSymbol(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (s === "GOLD") return "GC.F";
    if (s === "BTC") return "BTCUSD";
    if (s === "ETH") return "ETHUSD";
    if (s === "EURUSD") return "EURUSD";
    if (s === "USDVND") return "USDVND";
    if (s === "SPX") return "^SPX";
    if (s === "DOW") return "^DJI";
    if (/^[A-Z0-9]{1,6}$/.test(s)) return `${s}.US`;
    return s;
}

function normalizeLocationText(value: string) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function tokenizeLocation(value: string) {
    const normalized = normalizeLocationText(value);
    const tokens = normalized.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    const compact = tokens.join("");
    const tokenSet = new Set(tokens);
    return { normalized, tokens, compact, tokenSet };
}

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function seededScore(input: string) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}

function getDataCache() {
    if (!globalThis.__nexus_data_cache) {
        globalThis.__nexus_data_cache = new Map<string, CacheEntry>();
    }
    return globalThis.__nexus_data_cache;
}

function getInflightCache() {
    if (!globalThis.__nexus_inflight_cache) {
        globalThis.__nexus_inflight_cache = new Map<string, Promise<unknown>>();
    }
    return globalThis.__nexus_inflight_cache;
}

function pruneDataCache() {
    const cache = getDataCache();
    if (cache.size <= MAX_DATA_CACHE_ITEMS) return;
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.staleUntil <= now) {
            cache.delete(key);
        }
        if (cache.size <= MAX_DATA_CACHE_ITEMS) return;
    }
    while (cache.size > MAX_DATA_CACHE_ITEMS) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) return;
        cache.delete(oldestKey);
    }
}

async function withCache<T>(key: string, ttlMs: number, producer: () => Promise<T>, staleMs = ttlMs * 4): Promise<T> {
    const cache = getDataCache();
    const inflight = getInflightCache();
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
        return cached.value as T;
    }

    const pending = inflight.get(key);
    if (pending) {
        return pending as Promise<T>;
    }

    const task = (async () => {
        try {
            const value = await producer();
            cache.set(key, {
                value,
                expiresAt: now + Math.max(1000, ttlMs),
                staleUntil: now + Math.max(1000, ttlMs + staleMs),
            });
            pruneDataCache();
            return value;
        } catch (error) {
            if (cached && cached.staleUntil > Date.now()) {
                return cached.value as T;
            }
            throw error;
        } finally {
            inflight.delete(key);
        }
    })();

    inflight.set(key, task as Promise<unknown>);
    return task;
}

function withCacheHeaders(maxAgeSec: number, staleSec = maxAgeSec * 4) {
    return {
        "Cache-Control": `public, s-maxage=${Math.max(1, maxAgeSec)}, stale-while-revalidate=${Math.max(1, staleSec)}`,
    };
}

function jsonWithCache(payload: unknown, maxAgeSec: number, staleSec = maxAgeSec * 4, status = 200) {
    return NextResponse.json(payload, {
        status,
        headers: withCacheHeaders(maxAgeSec, staleSec),
    });
}

function ttlForCandle(interval: string) {
    const i = String(interval || "1h").toLowerCase();
    if (["1m", "2m", "3m", "5m"].includes(i)) return 8000;
    if (["15m", "30m"].includes(i)) return 15000;
    if (["1h", "2h", "4h", "6h"].includes(i)) return 30000;
    return 60000;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
    const initSignal = init?.signal;
    const signal =
        initSignal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function"
            ? AbortSignal.any([initSignal, controller.signal])
            : controller.signal;

    const res = await fetch(url, { ...init, signal, cache: "no-store" }).finally(() => clearTimeout(timer));
    if (!res.ok) {
        throw new Error(`${res.status}`);
    }
    return res.json();
}

async function fetchText(url: string, init?: RequestInit, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
    const initSignal = init?.signal;
    const signal =
        initSignal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function"
            ? AbortSignal.any([initSignal, controller.signal])
            : controller.signal;

    const res = await fetch(url, { ...init, signal, cache: "no-store" }).finally(() => clearTimeout(timer));
    if (!res.ok) {
        throw new Error(`${res.status}`);
    }
    return res.text();
}

async function getBinanceTicker(pair: string) {
    const normalizedPair = normalizeSymbol(pair);
    return withCache(
        `binance:ticker:${normalizedPair}`,
        4000,
        async () => {
            const raw = await fetchJson(
                `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(normalizedPair)}`,
                undefined,
                4500,
            );
            const last = Number(raw.lastPrice || 0);
            const open = Number(raw.openPrice || 0);
            const high = Number(raw.highPrice || 0);
            const low = Number(raw.lowPrice || 0);
            const change = Number(raw.priceChange || 0);
            const changePct = Number(raw.priceChangePercent || 0);
            return {
                symbol: String(raw.symbol || normalizedPair),
                last_price: last,
                open_price: open,
                high_price: high,
                low_price: low,
                price_change: change,
                price_change_percent: changePct,
                volume_base: Number(raw.volume || 0),
                volume_quote: Number(raw.quoteVolume || 0),
                count_24h: Number(raw.count || 0),
                updated_at: nowIso(),
            };
        },
        18000,
    );
}

async function getStooqQuote(symbol: string) {
    const s = normalizeSymbol(symbol);
    const stooqSymbol = toStooqSymbol(s);
    const rawText = await fetchText(
        `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol.toLowerCase())}&i=d`,
        undefined,
        5000,
    );
    const line = String(rawText || "").trim().split("\n")[0] || "";
    const cells = line.split(",");
    if (cells.length < 8) return null;
    const open = Number(cells[3] || 0);
    const high = Number(cells[4] || 0);
    const low = Number(cells[5] || 0);
    const close = Number(cells[6] || 0);
    const volume = Number(cells[7] || 0);
    if (!Number.isFinite(close) || close <= 0) return null;
    const change = Number.isFinite(open) && open > 0 ? close - open : 0;
    const changePct = Number.isFinite(open) && open > 0 ? (change / open) * 100 : 0;
    return {
        symbol: s,
        name: s,
        price: close,
        change,
        change_percent: changePct,
        day_high: Number.isFinite(high) && high > 0 ? high : close,
        day_low: Number.isFinite(low) && low > 0 ? low : close,
        volume: Number.isFinite(volume) ? volume : 0,
        source: "stooq",
    };
}

async function getQuote(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (!s) {
        return null;
    }

    if (isCryptoLike(s) || s.endsWith("USDT")) {
        const pair = toBinancePair(s.replace("USDT", ""));
        const ticker = await getBinanceTicker(pair);
        return {
            symbol: s.replace("USDT", ""),
            name: `${s.replace("USDT", "")}/USDT`,
            price: ticker.last_price,
            change: ticker.price_change,
            change_percent: ticker.price_change_percent,
            day_high: ticker.high_price,
            day_low: ticker.low_price,
            volume: ticker.volume_base,
            source: "binance",
        };
    }

    return withCache(
        `quote:${s}`,
        12000,
        async () => {
            const ySymbol = toYahooSymbol(s);
            try {
                const payload = await fetchJson(
                    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ySymbol)}`,
                    undefined,
                    5500,
                );
                const row = payload?.quoteResponse?.result?.[0];
                if (row) {
                    return {
                        symbol: s,
                        name: String(row.shortName || row.longName || s),
                        price: Number(row.regularMarketPrice || 0),
                        change: Number(row.regularMarketChange || 0),
                        change_percent: Number(row.regularMarketChangePercent || 0),
                        day_high: Number(row.regularMarketDayHigh || 0),
                        day_low: Number(row.regularMarketDayLow || 0),
                        volume: Number(row.regularMarketVolume || 0),
                        source: "yahoo",
                    };
                }
            } catch {
                // fallback below
            }
            const stooq = await getStooqQuote(s).catch(() => null);
            if (stooq) return stooq;

            if (s === "USDVND") {
                const rates = await getUsdRates().catch(() => ({} as Record<string, number>));
                const vnd = Number(rates.VND || 0);
                if (Number.isFinite(vnd) && vnd > 0) {
                    return {
                        symbol: s,
                        name: "USD/VND",
                        price: vnd,
                        change: 0,
                        change_percent: 0,
                        day_high: vnd,
                        day_low: vnd,
                        volume: 0,
                        source: "open.er-api",
                    };
                }
            }
            return null;
        },
        45000,
    );
}

function intervalToBinance(interval: string) {
    const i = String(interval || "1h").toLowerCase();
    if (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w"].includes(i)) return i;
    return "1h";
}

function intervalToYahoo(interval: string) {
    const i = String(interval || "1h").toLowerCase();
    if (["1m", "2m", "5m", "15m", "30m", "60m", "1d", "1wk"].includes(i)) return i;
    if (i === "1h") return "60m";
    if (i === "4h") return "60m";
    return "1d";
}

function rangeForInterval(interval: string) {
    const i = String(interval || "1h").toLowerCase();
    if (["1m", "5m", "15m", "30m", "1h"].includes(i)) return "5d";
    if (i === "4h") return "1mo";
    return "6mo";
}

async function getCandles(symbol: string, interval: string, limit: number) {
    const s = normalizeSymbol(symbol);
    const safeLimit = Math.max(20, Math.min(1000, limit));
    if (isCryptoLike(s) || s.endsWith("USDT")) {
        const pair = toBinancePair(s.replace("USDT", ""));
        const klineInterval = intervalToBinance(interval);
        return withCache(
            `binance:candles:${pair}:${klineInterval}:${safeLimit}`,
            ttlForCandle(klineInterval),
            async () => {
                const rows = await fetchJson(
                    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(klineInterval)}&limit=${safeLimit}`,
                    undefined,
                    6000,
                );
                const candles = Array.isArray(rows)
                    ? rows.map((row: unknown[]) => ({
                          time: Number(row[0] || 0),
                          open: Number(row[1] || 0),
                          high: Number(row[2] || 0),
                          low: Number(row[3] || 0),
                          close: Number(row[4] || 0),
                          volume: Number(row[5] || 0),
                      }))
                    : [];
                return {
                    symbol: s,
                    interval: klineInterval,
                    source: "binance",
                    candles,
                    updated_at: nowIso(),
                };
            },
            90000,
        );
    }

    const ySymbol = toYahooSymbol(s);
    const yInterval = intervalToYahoo(interval);
    const range = rangeForInterval(interval);
    return withCache(
        `yahoo:candles:${ySymbol}:${yInterval}:${range}:${safeLimit}`,
        ttlForCandle(yInterval),
        async () => {
            const payload = await fetchJson(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=${encodeURIComponent(yInterval)}&range=${encodeURIComponent(range)}`,
                undefined,
                6500,
            );
            const result = payload?.chart?.result?.[0];
            const times: number[] = Array.isArray(result?.timestamp) ? result.timestamp : [];
            const quote = result?.indicators?.quote?.[0] || {};
            const opens: number[] = Array.isArray(quote.open) ? quote.open : [];
            const highs: number[] = Array.isArray(quote.high) ? quote.high : [];
            const lows: number[] = Array.isArray(quote.low) ? quote.low : [];
            const closes: number[] = Array.isArray(quote.close) ? quote.close : [];
            const volumes: number[] = Array.isArray(quote.volume) ? quote.volume : [];
            const candles = times
                .map((t, idx) => ({
                    time: Number(t || 0) * 1000,
                    open: Number(opens[idx] || 0),
                    high: Number(highs[idx] || 0),
                    low: Number(lows[idx] || 0),
                    close: Number(closes[idx] || 0),
                    volume: Number(volumes[idx] || 0),
                }))
                .filter((c) => c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
                .slice(-safeLimit);
            return {
                symbol: s,
                interval: yInterval,
                source: "yahoo",
                candles,
                updated_at: nowIso(),
            };
        },
        120000,
    );
}

function computeBudgetStatus(utilization: number) {
    if (utilization >= 100) return "over_budget";
    if (utilization >= 85) return "critical";
    if (utilization >= 70) return "warning";
    return "healthy";
}

type AdvisorRegionProfile = {
    countryCode: string;
    avgRestaurantMealVnd: number;
    avgHomeMealPerPersonVnd: number;
    breakfasts: string[];
    lunches: string[];
    dinners: string[];
    examples: string[];
};

function detectCountryByLocation(locationText: string) {
    const q = normalizeLocationText(locationText);
    if (!q) return "";
    const { compact, tokenSet } = tokenizeLocation(q);
    if (
        compact.includes("newyork") ||
        compact.includes("sanfrancisco") ||
        compact.includes("losangeles") ||
        compact.includes("unitedstates") ||
        tokenSet.has("us") ||
        tokenSet.has("usa")
    ) return "US";
    if (
        compact.includes("vietnam") ||
        compact.includes("hanoi") ||
        compact.includes("hochiminh") ||
        compact.includes("danang") ||
        compact.includes("saigon") ||
        tokenSet.has("vn")
    ) return "VN";
    if (compact.includes("madrid") || compact.includes("barcelona") || compact.includes("spain") || tokenSet.has("es")) return "ES";
    if (compact.includes("tokyo") || compact.includes("osaka") || compact.includes("japan") || tokenSet.has("jp")) return "JP";
    if (compact.includes("london") || compact.includes("unitedkingdom") || tokenSet.has("uk") || tokenSet.has("gb")) return "GB";
    return "";
}

function getAdvisorRegionProfile(locationText: string, locale: string): AdvisorRegionProfile {
    const country = detectCountryByLocation(locationText) || (locale === "vi" ? "VN" : locale === "es" ? "ES" : "US");
    if (country === "US") {
        return {
            countryCode: "US",
            avgRestaurantMealVnd: 440000,
            avgHomeMealPerPersonVnd: 175000,
            breakfasts: ["Bagel and eggs", "Oatmeal bowl", "Greek yogurt and fruit", "Pancakes and berries", "Egg sandwich"],
            lunches: ["Chicken salad", "Turkey sandwich", "Burrito bowl", "Pasta lunch set", "Sushi lunch box"],
            dinners: ["Grilled salmon and rice", "Steak with vegetables", "Chicken rice bowl", "Pasta and meatballs", "Roast chicken and salad"],
            examples: ["Whole Foods", "Trader Joe's", "Target Grocery"],
        };
    }
    if (country === "ES") {
        return {
            countryCode: "ES",
            avgRestaurantMealVnd: 320000,
            avgHomeMealPerPersonVnd: 132000,
            breakfasts: ["Tostada con huevo", "Avena con fruta", "Yogur con granola", "Pan integral y queso"],
            lunches: ["Paella ligera", "Pollo con arroz", "Ensalada mediterranea", "Pasta con atun"],
            dinners: ["Pescado al horno", "Tortilla espanola", "Pollo a la plancha", "Sopa y pan integral"],
            examples: ["Mercadona", "Carrefour", "Lidl"],
        };
    }
    if (country === "JP") {
        return {
            countryCode: "JP",
            avgRestaurantMealVnd: 360000,
            avgHomeMealPerPersonVnd: 146000,
            breakfasts: ["Onigiri and miso soup", "Tamago and rice", "Yogurt and fruit", "Tofu and rice set"],
            lunches: ["Bento chicken", "Ramen set", "Soba with tempura", "Curry rice"],
            dinners: ["Grilled fish set", "Hotpot", "Chicken teriyaki", "Tofu and vegetable set"],
            examples: ["AEON", "Seiyu", "7-Eleven"],
        };
    }
    return {
        countryCode: "VN",
        avgRestaurantMealVnd: 95000,
        avgHomeMealPerPersonVnd: 42000,
        breakfasts: ["Pho bo", "Banh mi trung", "Xoi ga", "Bun bo Hue", "Chao ga"],
        lunches: ["Com tam suon", "Bun thit nuong", "Mi Quang", "Bun rieu cua", "Com ga"],
        dinners: ["Com nha nau", "Ca kho canh rau", "Ga nuong dau hu", "Bo xao rau", "Canh chua ca"],
        examples: ["WinMart", "Co.opmart", "Bach Hoa Xanh"],
    };
}

function pickBySeed(list: string[], seed: number, fallback: string) {
    if (!Array.isArray(list) || list.length === 0) return fallback;
    const idx = Math.abs(seed) % list.length;
    return list[idx];
}

function buildAdvisorFallback(input: Record<string, unknown>) {
    const income = Number(input.income || 0);
    const actualExpenses = Number(input.actual_expenses || 0);
    const plannedBudget = Number(input.planned_budget || 0);
    const familySize = Math.max(1, Number(input.family_size || 1));
    const locale = String(input.locale || "en");
    const location = String(input.location || "");
    const region = getAdvisorRegionProfile(location, locale);
    const savings = income - actualExpenses;
    const utilization = plannedBudget > 0 ? (actualExpenses / plannedBudget) * 100 : 0;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    const healthScore = clampNumber(Math.round(70 + Math.min(20, savingsRate) - Math.max(0, utilization - 80) * 0.6), 1, 99);
    const healthStatus =
        healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : healthScore >= 40 ? "needs_improvement" : "critical";
    const days = locale === "vi" ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : locale === "es" ? ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const seedBase = seededScore(`${location}|${income}|${actualExpenses}|${plannedBudget}|${familySize}|${locale}`);
    const mealPlan = days.map((day, idx) => {
        const basePerPerson = Math.round(region.avgHomeMealPerPersonVnd * (0.88 + ((seedBase + idx * 11) % 8) * 0.05));
        const breakfast = Math.round(basePerPerson * familySize * 0.75);
        const lunch = Math.round(basePerPerson * familySize * 1.12);
        const dinner = Math.round(basePerPerson * familySize * 1.34);
        return {
            day,
            breakfast: {
                name: pickBySeed(region.breakfasts, seedBase + idx * 17, locale === "vi" ? "Bua sang" : locale === "es" ? "Desayuno" : "Breakfast"),
                cost: breakfast,
                description: locale === "vi" ? "Khau phan uoc tinh theo khu vuc." : locale === "es" ? "Racion estimada por zona." : "Estimated serving by region.",
            },
            lunch: {
                name: pickBySeed(region.lunches, seedBase + idx * 23, locale === "vi" ? "Bua trua" : locale === "es" ? "Almuerzo" : "Lunch"),
                cost: lunch,
                description: locale === "vi" ? "Khau phan uoc tinh theo khu vuc." : locale === "es" ? "Racion estimada por zona." : "Estimated serving by region.",
            },
            dinner: {
                name: pickBySeed(region.dinners, seedBase + idx * 31, locale === "vi" ? "Bua toi" : locale === "es" ? "Cena" : "Dinner"),
                cost: dinner,
                description: locale === "vi" ? "Khau phan uoc tinh theo khu vuc." : locale === "es" ? "Racion estimada por zona." : "Estimated serving by region.",
            },
            snack: null,
            total_cost: breakfast + lunch + dinner,
        };
    });
    return {
        health_score: healthScore,
        health_status: healthStatus,
        guru_verdict:
            locale === "vi"
                ? `Diem ${healthScore}/100. Ty le tiet kiem ${savingsRate.toFixed(1)}%.`
                : locale === "es"
                  ? `Puntaje ${healthScore}/100. Ahorro ${savingsRate.toFixed(1)}%.`
                  : `Score ${healthScore}/100. Savings ${savingsRate.toFixed(1)}%.`,
        guru_advice: [
            locale === "vi" ? "Giu chi tieu duoi ngan sach." : locale === "es" ? "Mantener gasto bajo presupuesto." : "Keep spending under budget.",
            locale === "vi" ? "Tang ty le tiet kiem theo thang." : locale === "es" ? "Aumentar tasa de ahorro mensual." : "Increase monthly savings rate.",
        ],
        wasteful_habits: [],
        meal_plan: mealPlan,
        daily_food_budget: mealPlan.reduce((sum, d) => sum + d.total_cost, 0) / 7,
        food_price_context: {
            query: location,
            resolved_location: location || (locale === "vi" ? "Khu vuc mac dinh" : locale === "es" ? "Zona por defecto" : "Default region"),
            country_code: region.countryCode,
            lat: null,
            lon: null,
            local_price_multiplier: Number((region.avgHomeMealPerPersonVnd / 42000).toFixed(2)),
            average_restaurant_meal_vnd: region.avgRestaurantMealVnd,
            estimated_home_meal_per_person_vnd: region.avgHomeMealPerPersonVnd,
            nearby_restaurants: 0,
            nearby_examples: region.examples,
            note:
                locale === "vi"
                    ? "Du lieu local theo khu vuc uoc tinh."
                    : locale === "es"
                      ? "Datos locales estimados por region."
                      : "Local region-based estimate.",
        },
        asset_allocation: [
            { category: "Stocks / ETF", percentage: 40, amount: Math.max(0, savings * 0.4), rationale: "Growth" },
            { category: "Savings", percentage: 35, amount: Math.max(0, savings * 0.35), rationale: "Safety" },
            { category: "Gold", percentage: 15, amount: Math.max(0, savings * 0.15), rationale: "Hedge" },
            { category: "Cash", percentage: 10, amount: Math.max(0, savings * 0.1), rationale: "Liquidity" },
        ],
        investable_amount: Math.max(0, savings * 0.7),
        savings_rate: Number(savingsRate.toFixed(1)),
        ai_provider_used: "local",
        analyzed_at: nowIso(),
    };
}

function toCountryRow(c: Record<string, unknown>): CountryRow | null {
    const cca2 = String(c.cca2 || "").toUpperCase();
    if (!cca2 || cca2.length !== 2) return null;
    const latlng = Array.isArray(c.latlng) ? c.latlng : [];
    const lat = Number(latlng[0] || 0);
    const lng = Number(latlng[1] || 0);
    const nameObj = (c.name || {}) as Record<string, unknown>;
    const currenciesObj = (c.currencies || {}) as Record<string, unknown>;
    const languagesObj = (c.languages || {}) as Record<string, unknown>;
    const score = seededScore(cca2);
    const ai_signal = score % 3 === 0 ? "bullish" : score % 3 === 1 ? "neutral" : "cautious";
    return {
        code: cca2,
        numeric_code: String(c.ccn3 || ""),
        name: String(nameObj.common || cca2),
        official_name: String(nameObj.official || nameObj.common || cca2),
        lat,
        lng,
        area_km2: Number(c.area || 0),
        population: Number(c.population || 0),
        region: String(c.region || ""),
        subregion: String(c.subregion || ""),
        capital: Array.isArray(c.capital) ? String(c.capital[0] || "") : "",
        timezones: Array.isArray(c.timezones) ? c.timezones.map((v) => String(v)) : [],
        currencies: Object.keys(currenciesObj),
        languages: Object.values(languagesObj).map((v) => String(v)),
        btc_holding: Math.round((Number(c.population || 0) / 1000000) * (10 + (score % 80))),
        fx_forecast_factor: Number((0.9 + (score % 40) / 100).toFixed(4)),
        real_estate_potential_pct: Number((3 + (score % 120) / 10).toFixed(2)),
        ai_signal,
    } as CountryRow;
}

async function getCountries() {
    if (globalThis.__nexus_countries && globalThis.__nexus_countries.length > 0) {
        return globalThis.__nexus_countries;
    }
    let rows: CountryRow[] = [];
    try {
        const payload = await fetchJson(
            RESTCOUNTRIES_FIELDS_URL,
            { headers: { "User-Agent": "NexusFinance/1.0 (+github.com/vusinhthanh1892007-boop/finace-nexus)" } },
            9000,
        );
        rows = (Array.isArray(payload) ? payload : []).map((c: Record<string, unknown>) => toCountryRow(c)).filter(Boolean) as CountryRow[];
        if (rows.length < 180) {
            throw new Error("restcountries_payload_too_small");
        }
    } catch {
        try {
            const backupPayload = await fetchJson(COUNTRIES_BACKUP_URL, undefined, 10000);
            rows = (Array.isArray(backupPayload) ? backupPayload : [])
                .map((c: Record<string, unknown>) => toCountryRow(c))
                .filter(Boolean) as CountryRow[];
        } catch {
            rows = [
                {
                    code: "US",
                    numeric_code: "840",
                    name: "United States",
                    official_name: "United States of America",
                    lat: 38,
                    lng: -97,
                    area_km2: 9833517,
                    population: 335000000,
                    region: "Americas",
                    subregion: "North America",
                    capital: "Washington, D.C.",
                    timezones: ["UTC-05:00"],
                    currencies: ["USD"],
                    languages: ["English"],
                    btc_holding: 4800,
                    fx_forecast_factor: 1.02,
                    real_estate_potential_pct: 6.4,
                    ai_signal: "neutral",
                },
                {
                    code: "VN",
                    numeric_code: "704",
                    name: "Vietnam",
                    official_name: "Socialist Republic of Vietnam",
                    lat: 16.3,
                    lng: 107.8,
                    area_km2: 331212,
                    population: 100300000,
                    region: "Asia",
                    subregion: "South-Eastern Asia",
                    capital: "Hanoi",
                    timezones: ["UTC+07:00"],
                    currencies: ["VND"],
                    languages: ["Vietnamese"],
                    btc_holding: 1200,
                    fx_forecast_factor: 1.08,
                    real_estate_potential_pct: 8.1,
                    ai_signal: "bullish",
                },
                {
                    code: "JP",
                    numeric_code: "392",
                    name: "Japan",
                    official_name: "Japan",
                    lat: 36.2,
                    lng: 138.2,
                    area_km2: 377975,
                    population: 124000000,
                    region: "Asia",
                    subregion: "Eastern Asia",
                    capital: "Tokyo",
                    timezones: ["UTC+09:00"],
                    currencies: ["JPY"],
                    languages: ["Japanese"],
                    btc_holding: 980,
                    fx_forecast_factor: 0.98,
                    real_estate_potential_pct: 5.3,
                    ai_signal: "cautious",
                },
            ];
        }
    }
    rows = rows
        .filter((row) => row.code.length === 2)
        .sort((a, b) => a.name.localeCompare(b.name));
    globalThis.__nexus_countries = rows;
    return rows;
}

async function getWorldBankLatest(country: string, indicator: string) {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=70`;
    return withCache(
        `worldbank:${country}:${indicator}`,
        12 * 60 * 60 * 1000,
        async () => {
            const payload = await fetchJson(url, undefined, 7000);
            const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
            const found = rows.find((row: Record<string, unknown>) => row.value !== null && row.value !== undefined);
            if (!found) return { value: null as number | null, year: null as string | null };
            return {
                value: Number(found.value || 0),
                year: String(found.date || ""),
            };
        },
        48 * 60 * 60 * 1000,
    );
}

async function getUsdRates() {
    return withCache(
        "fx:usd-rates",
        10 * 60 * 1000,
        async () => {
            const payload = await fetchJson("https://open.er-api.com/v6/latest/USD", undefined, 5000);
            return (payload?.rates || {}) as Record<string, number>;
        },
        30 * 60 * 1000,
    );
}

async function handleGet(slug: string[], req: NextRequest) {
    const state = getState();
    if (slug.length === 1 && slug[0] === "health") {
        return jsonWithCache(
            {
                backend: "healthy",
                latency: 15,
                gemini: Boolean(state.gemini_api_key),
                openai: Boolean(state.openai_api_key),
                active_ai_providers: [state.gemini_api_key ? "gemini" : "", state.openai_api_key ? "openai" : ""].filter(Boolean),
            },
            5,
            20,
        );
    }

    if (slug.length === 1 && slug[0] === "settings") {
        return NextResponse.json(publicSettings(state), { headers: { "Cache-Control": "no-store" } });
    }

    if (slug[0] === "market" && slug[1] === "quote" && slug[2]) {
        const quote = await getQuote(slug[2]);
        if (!quote) return NextResponse.json({ detail: "quote_not_found" }, { status: 404 });
        return jsonWithCache(quote, 4, 20);
    }

    if (slug[0] === "market" && slug[1] === "quotes") {
        const symbolsCsv = req.nextUrl.searchParams.get("symbols") || "";
        const symbols = symbolsCsv.split(",").map(normalizeSymbol).filter(Boolean).slice(0, 30);
        const rows = await Promise.all(symbols.map(async (symbol) => getQuote(symbol).catch(() => null)));
        return jsonWithCache(rows.filter(Boolean), 4, 20);
    }

    if (slug[0] === "market" && slug[1] === "indices") {
        const targets = ["SPX", "DOW", "BTC", "ETH", "GOLD", "EURUSD", "USDVND"];
        const rows = await Promise.all(targets.map(async (symbol) => getQuote(symbol).catch(() => null)));
        const indices = rows
            .filter(Boolean)
            .map((q) => ({
                symbol: q!.symbol,
                name: q!.name,
                value: q!.price,
                change: q!.change,
                change_percent: q!.change_percent,
            }));
        return jsonWithCache({ indices, updated_at: nowIso() }, 5, 30);
    }

    if (slug[0] === "market" && slug[1] === "candles" && slug[2]) {
        const interval = req.nextUrl.searchParams.get("interval") || "1h";
        const limit = Number(req.nextUrl.searchParams.get("limit") || "180");
        const payload = await getCandles(slug[2], interval, limit).catch(() => ({
            symbol: normalizeSymbol(slug[2]),
            interval,
            source: "offline",
            candles: [],
            updated_at: nowIso(),
        }));
        return jsonWithCache(payload, 6, 25);
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "ticker" && slug[3]) {
        const payload = await getBinanceTicker(slug[3]);
        return jsonWithCache(payload, 4, 20);
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "depth" && slug[3]) {
        const limit = Math.max(5, Math.min(100, Number(req.nextUrl.searchParams.get("limit") || "20")));
        const cacheKey = `binance:depth:${slug[3]}:${limit}`;
        const raw = await withCache(
            cacheKey,
            3500,
            () => fetchJson(`https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(slug[3])}&limit=${limit}`, undefined, 5000),
            14000,
        );
        const toLevel = (row: unknown[]) => ({ price: Number(row?.[0] || 0), quantity: Number(row?.[1] || 0) });
        return jsonWithCache(
            {
                symbol: String(raw.symbol || slug[3]),
                last_update_id: Number(raw.lastUpdateId || 0),
                bids: Array.isArray(raw.bids) ? raw.bids.map(toLevel) : [],
                asks: Array.isArray(raw.asks) ? raw.asks.map(toLevel) : [],
                updated_at: nowIso(),
            },
            3,
            12,
        );
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "trades" && slug[3]) {
        const limit = Math.max(5, Math.min(200, Number(req.nextUrl.searchParams.get("limit") || "40")));
        const raw = await withCache(
            `binance:trades:${slug[3]}:${limit}`,
            3500,
            () => fetchJson(`https://api.binance.com/api/v3/trades?symbol=${encodeURIComponent(slug[3])}&limit=${limit}`, undefined, 5000),
            12000,
        );
        return jsonWithCache(
            {
                symbol: slug[3],
                trades: Array.isArray(raw)
                    ? raw.map((t: Record<string, unknown>) => ({
                          id: Number(t.id || 0),
                          price: Number(t.price || 0),
                          quantity: Number(t.qty || 0),
                          quote_quantity: Number(t.quoteQty || 0),
                          time: Number(t.time || 0),
                          is_buyer_maker: Boolean(t.isBuyerMaker),
                      }))
                    : [],
                updated_at: nowIso(),
            },
            3,
            12,
        );
    }

    if (slug[0] === "market" && slug[1] === "analytics") {
        const symbols = (req.nextUrl.searchParams.get("symbols") || "BTC,ETH,SPX,DOW,GOLD")
            .split(",")
            .map(normalizeSymbol)
            .filter(Boolean)
            .slice(0, 8);
        const quotes = await Promise.all(symbols.map(async (symbol) => getQuote(symbol).catch(() => null)));
        const volatility = quotes
            .filter(Boolean)
            .map((q) => ({
                symbol: q!.symbol,
                price: q!.price,
                change_percent: q!.change_percent,
                abs_move: Math.abs(q!.change_percent),
            }))
            .sort((a, b) => b.abs_move - a.abs_move);
        const momentumRows = await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    const candles = await getCandles(symbol, "1d", 12);
                    const start = candles.candles[0]?.close || 0;
                    const last = candles.candles[candles.candles.length - 1]?.close || 0;
                    const momentum7 = start > 0 ? ((last - start) / start) * 100 : 0;
                    return { symbol, start, last, momentum_7d: Number(momentum7.toFixed(2)) };
                } catch {
                    return { symbol, start: 0, last: 0, momentum_7d: 0 };
                }
            }),
        );
        const avgMove = volatility.length > 0 ? volatility.reduce((sum, r) => sum + Math.abs(r.change_percent), 0) / volatility.length : 0;
        const score = clampNumber(avgMove * 8, 5, 95);
        const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
        return jsonWithCache(
            {
                volatility_24h: volatility,
                momentum_7d: momentumRows,
                correlation_risk: { score, level },
                updated_at: nowIso(),
            },
            8,
            40,
        );
    }

    if (slug[0] === "market" && slug[1] === "portfolio-overview") {
        const watch = state.watch_symbols;
        const quotes = await Promise.all(watch.map(async (symbol) => getQuote(symbol).catch(() => null)));
        const valid = quotes.filter(Boolean);
        const total = valid.reduce((sum, row) => sum + Number(row!.price || 0), 0);
        const allocation = valid.map((row) => ({
            symbol: row!.symbol,
            name: row!.name,
            price: row!.price,
            change_percent: row!.change_percent,
            weight: total > 0 ? (row!.price / total) * 100 : 0,
        }));
        return jsonWithCache(
            {
                watch_symbols: watch,
                allocation,
                total_market_value: total,
                risk_note: "Vercel serverless demo mode.",
                updated_at: nowIso(),
            },
            6,
            24,
        );
    }

    if (slug[0] === "market" && slug[1] === "countries" && slug.length === 2) {
        const countries = await getCountries();
        return jsonWithCache(
            {
                countries,
                updated_at: nowIso(),
                source: countries.length > 180 ? "restcountries_or_backup" : countries.length > 10 ? "partial" : "limited_fallback",
            },
            900,
            3600,
        );
    }

    if (slug[0] === "market" && slug[1] === "countries" && slug[2]) {
        const countries = await getCountries();
        const code = normalizeSymbol(slug[2]);
        const row = countries.find((c) => c.code === code);
        if (!row) return NextResponse.json({ detail: "country_not_found" }, { status: 404 });
        const [gdp, gdpPc, gini, electricity, population] = await Promise.all([
            getWorldBankLatest(code, "NY.GDP.MKTP.CD").catch(() => ({ value: null, year: null })),
            getWorldBankLatest(code, "NY.GDP.PCAP.CD").catch(() => ({ value: null, year: null })),
            getWorldBankLatest(code, "SI.POV.GINI").catch(() => ({ value: null, year: null })),
            getWorldBankLatest(code, "EG.USE.ELEC.KH.PC").catch(() => ({ value: null, year: null })),
            getWorldBankLatest(code, "SP.POP.TOTL").catch(() => ({ value: null, year: null })),
        ]);
        return jsonWithCache(
            {
                country: {
                    ...row,
                    gdp_usd: gdp.value,
                    gdp_year: gdp.year,
                    gdp_trillion_usd: gdp.value ? gdp.value / 1_000_000_000_000 : null,
                    gdp_per_capita_usd: gdpPc.value,
                    gdp_per_capita_year: gdpPc.year,
                    gini: gini.value,
                    gini_year: gini.year,
                    electricity_kwh_per_capita: electricity.value,
                    electricity_year: electricity.year,
                    population_wb: population.value,
                    population_year: population.year,
                },
                updated_at: nowIso(),
            },
            1800,
            7200,
        );
    }

    if (slug[0] === "market" && slug[1] === "income-benchmark") {
        const country = normalizeSymbol(req.nextUrl.searchParams.get("country") || "US");
        const income = Number(req.nextUrl.searchParams.get("income") || "0");
        const frequency = String(req.nextUrl.searchParams.get("frequency") || "monthly");
        const countries = await getCountries();
        const row = countries.find((c) => c.code === country);
        if (!row) return NextResponse.json({ detail: "country_not_found" }, { status: 404 });
        const gdpPc = await getWorldBankLatest(country, "NY.GDP.PCAP.CD").catch(() => ({ value: null, year: null }));
        const gini = await getWorldBankLatest(country, "SI.POV.GINI").catch(() => ({ value: null, year: null }));
        const annualIncome = frequency === "monthly" ? income * 12 : income;
        const base = Number(gdpPc.value || 15000);
        const ratio = base > 0 ? annualIncome / base : 1;
        const percentile = clampNumber(50 + Math.log10(Math.max(0.1, ratio)) * 35, 1, 99.9);
        const top = Number((100 - percentile).toFixed(2));
        return jsonWithCache(
            {
                country,
                country_name: row.name,
                annual_income_usd: annualIncome,
                gdp_trillion_usd: null,
                gdp_per_capita_usd: gdpPc.value,
                gini: Number(gini.value || 35),
                estimated_percentile: Number(percentile.toFixed(2)),
                estimated_top_percent: top,
                benchmark_note: "Estimated percentile from GDP-per-capita baseline.",
                updated_at: nowIso(),
            },
            1800,
            7200,
        );
    }

    if (slug[0] === "market" && slug[1] === "local-search") {
        const query = req.nextUrl.searchParams.get("query") || "";
        const category = req.nextUrl.searchParams.get("category") || "restaurant";
        if (!query.trim()) {
            return jsonWithCache({ query, category, places: [] }, 300, 1200);
        }
        const normalizedQuery = query.trim().toLowerCase();
        const cacheKey = `local-search:${category}:${normalizedQuery}`;
        const result = await withCache(
            cacheKey,
            10 * 60 * 1000,
            async () => {
                const nominatim = await fetchJson(
                    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
                    { headers: { "User-Agent": "NexusFinance/1.0" } },
                    5500,
                );
                const found = Array.isArray(nominatim) ? nominatim[0] : null;
                if (!found) return { query, category, places: [] as Array<{ name: string; distance_km: number; opening_hours: string }> };
                const lat = Number(found.lat || 0);
                const lon = Number(found.lon || 0);
                const overpassQuery = `[out:json][timeout:15];node(around:2500,${lat},${lon})["amenity"="${category}"];out body 12;`;
                const overpass = await fetchJson(
                    "https://overpass-api.de/api/interpreter",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                        body: `data=${encodeURIComponent(overpassQuery)}`,
                    },
                    7000,
                );
                const places = Array.isArray(overpass?.elements)
                    ? overpass.elements.map((el: Record<string, unknown>) => {
                          const name = String((el.tags as Record<string, unknown> | undefined)?.name || `${category}`);
                          const elLat = Number(el.lat || lat);
                          const elLon = Number(el.lon || lon);
                          const dx = (elLat - lat) * 111;
                          const dy = (elLon - lon) * 111;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          return { name, distance_km: Number(distance.toFixed(2)), opening_hours: "Unknown" };
                      })
                    : [];
                return { query, category, places: places.slice(0, 12) };
            },
            60 * 60 * 1000,
        ).catch(() => ({ query, category, places: [] as Array<{ name: string; distance_km: number; opening_hours: string }> }));
        return jsonWithCache(result, 300, 1200);
    }

    if (slug[0] === "market" && slug[1] === "convert") {
        const amount = Number(req.nextUrl.searchParams.get("amount") || "0");
        const fromCurrency = normalizeSymbol(req.nextUrl.searchParams.get("from_currency") || "USD");
        const toCurrency = normalizeSymbol(req.nextUrl.searchParams.get("to_currency") || "USD");
        const fiat = ["USD", "VND", "EUR", "JPY", "GBP", "AUD", "CAD", "CHF", "CNY", "SGD"];
        const isFromCrypto = !fiat.includes(fromCurrency) && fromCurrency !== "USDT";
        const isToCrypto = !fiat.includes(toCurrency) && toCurrency !== "USDT";

        const rates = await getUsdRates().catch(() => ({} as Record<string, number>));

        async function toUsd(value: number, currency: string): Promise<number> {
            if (currency === "USD" || currency === "USDT") return value;
            if (!isFromCrypto && rates[currency]) return value / Number(rates[currency]);
            const ticker = await getBinanceTicker(toBinancePair(currency));
            return value * Number(ticker.last_price || 0);
        }

        async function fromUsd(value: number, currency: string): Promise<number> {
            if (currency === "USD" || currency === "USDT") return value;
            if (!isToCrypto && rates[currency]) return value * Number(rates[currency]);
            const ticker = await getBinanceTicker(toBinancePair(currency));
            const px = Number(ticker.last_price || 0);
            return px > 0 ? value / px : 0;
        }

        const usd = await toUsd(amount, fromCurrency);
        const converted = await fromUsd(usd, toCurrency);
        const rate = amount !== 0 ? converted / amount : 0;
        return jsonWithCache(
            {
                amount,
                from_currency: fromCurrency,
                to_currency: toCurrency,
                rate,
                converted,
                source: isFromCrypto || isToCrypto ? "binance+open.er-api" : "open.er-api",
                updated_at: nowIso(),
            },
            20,
            90,
        );
    }

    return NextResponse.json({ detail: "not_found" }, { status: 404 });
}

async function handlePut(slug: string[], req: NextRequest) {
    const state = getState();
    if (slug.length === 1 && slug[0] === "settings") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        if (typeof body.auto_balance === "boolean") state.auto_balance = body.auto_balance;
        if (typeof body.notifications === "boolean") state.notifications = body.notifications;
        if (body.risk_tolerance === "conservative" || body.risk_tolerance === "moderate" || body.risk_tolerance === "aggressive") {
            state.risk_tolerance = body.risk_tolerance;
        }
        if (body.ai_provider === "auto" || body.ai_provider === "gemini" || body.ai_provider === "openai") {
            state.ai_provider = body.ai_provider;
        }
        if (typeof body.ai_model === "string" && body.ai_model.trim()) {
            state.ai_model = body.ai_model.trim();
        }
        if (Array.isArray(body.gemini_scopes) && body.gemini_scopes.length > 0) {
            state.gemini_scopes = body.gemini_scopes.map((s) => String(s));
        }
        if (Array.isArray(body.openai_scopes) && body.openai_scopes.length > 0) {
            state.openai_scopes = body.openai_scopes.map((s) => String(s));
        }
        if (Array.isArray(body.watch_symbols) && body.watch_symbols.length > 0) {
            state.watch_symbols = body.watch_symbols.map((s) => normalizeSymbol(String(s))).filter(Boolean).slice(0, 12);
        }
        if (typeof body.gemini_api_key === "string") {
            state.gemini_api_key = body.gemini_api_key.trim();
        }
        if (typeof body.openai_api_key === "string") {
            state.openai_api_key = body.openai_api_key.trim();
        }
        state.updated_at = nowIso();
        return NextResponse.json({ ok: true, settings: publicSettings(state) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ detail: "not_found" }, { status: 404 });
}

async function handlePost(slug: string[], req: NextRequest) {
    const state = getState();
    if (slug[0] === "ledger" && slug[1] === "calculate") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const income = Number(body.income || 0);
        const expenses = Number(body.actual_expenses || 0);
        const budget = Number(body.planned_budget || 0);
        const safe = Math.max(0, budget - expenses);
        const utilization = budget > 0 ? (expenses / budget) * 100 : 0;
        const status = computeBudgetStatus(utilization);
        const message =
            status === "healthy"
                ? "Budget is healthy."
                : status === "warning"
                  ? "Budget utilization is rising."
                  : status === "critical"
                    ? "High budget utilization."
                    : "You are over budget.";
        return NextResponse.json({
            safe_to_spend: safe,
            budget_utilization: Number(utilization.toFixed(2)),
            remaining_budget: Math.max(0, budget - expenses),
            savings_potential: Math.max(0, income - expenses),
            status,
            status_message: message,
            calculated_at: nowIso(),
            encrypted_audit: "",
        }, { headers: { "Cache-Control": "no-store" } });
    }

    if (slug[0] === "advisor" && slug[1] === "analyze") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        return NextResponse.json(buildAdvisorFallback(body), { headers: { "Cache-Control": "no-store" } });
    }

    if (slug[0] === "advisor" && slug[1] === "chat") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const message = String(body.message || "").trim();
        const locale = String(body.locale || "en");
        const requestedProvider = body.provider === "gemini" || body.provider === "openai" || body.provider === "auto" ? body.provider : "auto";
        const provider =
            requestedProvider === "auto"
                ? state.gemini_api_key
                    ? "gemini"
                    : state.openai_api_key
                      ? "openai"
                      : "gemini"
                : requestedProvider;
        const model = String(body.model || state.ai_model || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"));

        if (provider === "gemini" && state.gemini_api_key) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
                const payload = await fetchJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": state.gemini_api_key,
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: message }] }],
                    }),
                });
                const reply =
                    payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
                    (locale === "vi" ? "Khong nhan duoc phan hoi." : locale === "es" ? "Sin respuesta del modelo." : "No model response.");
                return NextResponse.json({ provider: "gemini", model, reply }, { headers: { "Cache-Control": "no-store" } });
            } catch {
                return NextResponse.json({
                    provider: "gemini",
                    model,
                    reply:
                        locale === "vi"
                            ? "Gemini loi hoac het quota. Kiem tra API key."
                            : locale === "es"
                              ? "Gemini fallo o sin cuota. Revisa API key."
                              : "Gemini failed or quota exceeded. Check API key.",
                }, { headers: { "Cache-Control": "no-store" } });
            }
        }

        if (provider === "openai" && state.openai_api_key) {
            try {
                const payload = await fetchJson("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${state.openai_api_key}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: "user", content: message }],
                        temperature: 0.4,
                    }),
                });
                const reply =
                    payload?.choices?.[0]?.message?.content ||
                    (locale === "vi" ? "Khong nhan duoc phan hoi." : locale === "es" ? "Sin respuesta del modelo." : "No model response.");
                return NextResponse.json({ provider: "openai", model, reply }, { headers: { "Cache-Control": "no-store" } });
            } catch {
                return NextResponse.json({
                    provider: "openai",
                    model,
                    reply:
                        locale === "vi"
                            ? "OpenAI loi hoac het quota. Kiem tra API key."
                            : locale === "es"
                              ? "OpenAI fallo o sin cuota. Revisa API key."
                              : "OpenAI failed or quota exceeded. Check API key.",
                }, { headers: { "Cache-Control": "no-store" } });
            }
        }

        return NextResponse.json({
            provider: provider === "openai" ? "openai" : "gemini",
            model,
            reply:
                locale === "vi"
                    ? "Che do demo: nhap API key trong Settings de chat voi AI that."
                    : locale === "es"
                      ? "Modo demo: agrega API key en Settings para chat IA real."
                      : "Demo mode: add API key in Settings for real AI chat.",
        }, { headers: { "Cache-Control": "no-store" } });
    }

    if (slug[0] === "settings" && slug[1] === "rotate-secrets") {
        state.api_key_version += 1;
        state.key_rotation_count += 1;
        state.last_secret_rotation_at = nowIso();
        state.updated_at = nowIso();
        return NextResponse.json({
            ok: true,
            rotated_providers: ["gemini", "openai"],
            settings: publicSettings(state),
        }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ detail: "not_found" }, { status: 404 });
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
    try {
        const { slug } = await context.params;
        return await handleGet(slug || [], req);
    } catch {
        return NextResponse.json({ detail: "internal_error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
    try {
        const { slug } = await context.params;
        return await handlePut(slug || [], req);
    } catch {
        return NextResponse.json({ detail: "internal_error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
    try {
        const { slug } = await context.params;
        return await handlePost(slug || [], req);
    } catch {
        return NextResponse.json({ detail: "internal_error" }, { status: 500 });
    }
}
