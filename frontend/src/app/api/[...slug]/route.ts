import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

async function fetchJson(url: string, init?: RequestInit) {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) {
        throw new Error(`${res.status}`);
    }
    return res.json();
}

async function getBinanceTicker(pair: string) {
    const raw = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`);
    const last = Number(raw.lastPrice || 0);
    const open = Number(raw.openPrice || 0);
    const high = Number(raw.highPrice || 0);
    const low = Number(raw.lowPrice || 0);
    const change = Number(raw.priceChange || 0);
    const changePct = Number(raw.priceChangePercent || 0);
    return {
        symbol: String(raw.symbol || pair),
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

    const ySymbol = toYahooSymbol(s);
    const payload = await fetchJson(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ySymbol)}`);
    const row = payload?.quoteResponse?.result?.[0];
    if (!row) {
        return null;
    }
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
    if (isCryptoLike(s) || s.endsWith("USDT")) {
        const pair = toBinancePair(s.replace("USDT", ""));
        const klineInterval = intervalToBinance(interval);
        const rows = await fetchJson(
            `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(klineInterval)}&limit=${Math.max(20, Math.min(1000, limit))}`,
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
    }

    const ySymbol = toYahooSymbol(s);
    const yInterval = intervalToYahoo(interval);
    const range = rangeForInterval(interval);
    const payload = await fetchJson(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=${encodeURIComponent(yInterval)}&range=${encodeURIComponent(range)}`,
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
        .slice(-Math.max(20, Math.min(1000, limit)));
    return {
        symbol: s,
        interval: yInterval,
        source: "yahoo",
        candles,
        updated_at: nowIso(),
    };
}

function computeBudgetStatus(utilization: number) {
    if (utilization >= 100) return "over_budget";
    if (utilization >= 85) return "critical";
    if (utilization >= 70) return "warning";
    return "healthy";
}

function buildAdvisorFallback(input: Record<string, unknown>) {
    const income = Number(input.income || 0);
    const actualExpenses = Number(input.actual_expenses || 0);
    const plannedBudget = Number(input.planned_budget || 0);
    const familySize = Math.max(1, Number(input.family_size || 1));
    const locale = String(input.locale || "en");
    const savings = income - actualExpenses;
    const utilization = plannedBudget > 0 ? (actualExpenses / plannedBudget) * 100 : 0;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    const healthScore = clampNumber(Math.round(70 + Math.min(20, savingsRate) - Math.max(0, utilization - 80) * 0.6), 1, 99);
    const healthStatus =
        healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : healthScore >= 40 ? "needs_improvement" : "critical";
    const days = locale === "vi" ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : locale === "es" ? ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const mealPlan = days.map((day, idx) => {
        const base = 38000 + idx * 1200;
        const breakfast = Math.round(base * familySize * 0.75);
        const lunch = Math.round(base * familySize * 1.1);
        const dinner = Math.round(base * familySize * 1.3);
        return {
            day,
            breakfast: { name: locale === "vi" ? "Bua sang" : locale === "es" ? "Desayuno" : "Breakfast", cost: breakfast, description: "" },
            lunch: { name: locale === "vi" ? "Bua trua" : locale === "es" ? "Almuerzo" : "Lunch", cost: lunch, description: "" },
            dinner: { name: locale === "vi" ? "Bua toi" : locale === "es" ? "Cena" : "Dinner", cost: dinner, description: "" },
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
            query: String(input.location || ""),
            resolved_location: String(input.location || ""),
            country_code: "",
            lat: null,
            lon: null,
            local_price_multiplier: 1,
            average_restaurant_meal_vnd: 95000,
            estimated_home_meal_per_person_vnd: 42000,
            nearby_restaurants: 0,
            nearby_examples: [],
            note: locale === "vi" ? "Che do vercel-only." : locale === "es" ? "Modo vercel-only." : "Vercel-only mode.",
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

async function getCountries() {
    if (globalThis.__nexus_countries && globalThis.__nexus_countries.length > 0) {
        return globalThis.__nexus_countries;
    }
    const payload = await fetchJson("https://restcountries.com/v3.1/all");
    const rows = (Array.isArray(payload) ? payload : [])
        .map((c: Record<string, unknown>) => {
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
        })
        .filter(Boolean) as CountryRow[];
    globalThis.__nexus_countries = rows;
    return rows;
}

async function getWorldBankLatest(country: string, indicator: string) {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=70`;
    const payload = await fetchJson(url);
    const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
    const found = rows.find((row: Record<string, unknown>) => row.value !== null && row.value !== undefined);
    if (!found) return { value: null as number | null, year: null as string | null };
    return {
        value: Number(found.value || 0),
        year: String(found.date || ""),
    };
}

async function handleGet(slug: string[], req: NextRequest) {
    const state = getState();
    if (slug.length === 1 && slug[0] === "health") {
        return NextResponse.json({
            backend: "healthy",
            latency: 15,
            gemini: Boolean(state.gemini_api_key),
            openai: Boolean(state.openai_api_key),
            active_ai_providers: [state.gemini_api_key ? "gemini" : "", state.openai_api_key ? "openai" : ""].filter(Boolean),
        });
    }

    if (slug.length === 1 && slug[0] === "settings") {
        return NextResponse.json(publicSettings(state));
    }

    if (slug[0] === "market" && slug[1] === "quote" && slug[2]) {
        const quote = await getQuote(slug[2]);
        if (!quote) return NextResponse.json({ detail: "quote_not_found" }, { status: 404 });
        return NextResponse.json(quote);
    }

    if (slug[0] === "market" && slug[1] === "quotes") {
        const symbolsCsv = req.nextUrl.searchParams.get("symbols") || "";
        const symbols = symbolsCsv.split(",").map(normalizeSymbol).filter(Boolean).slice(0, 30);
        const rows = await Promise.all(symbols.map(async (symbol) => getQuote(symbol).catch(() => null)));
        return NextResponse.json(rows.filter(Boolean));
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
        return NextResponse.json({ indices, updated_at: nowIso() });
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
        return NextResponse.json(payload);
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "ticker" && slug[3]) {
        const payload = await getBinanceTicker(slug[3]);
        return NextResponse.json(payload);
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "depth" && slug[3]) {
        const limit = Math.max(5, Math.min(100, Number(req.nextUrl.searchParams.get("limit") || "20")));
        const raw = await fetchJson(`https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(slug[3])}&limit=${limit}`);
        const toLevel = (row: unknown[]) => ({ price: Number(row?.[0] || 0), quantity: Number(row?.[1] || 0) });
        return NextResponse.json({
            symbol: String(raw.symbol || slug[3]),
            last_update_id: Number(raw.lastUpdateId || 0),
            bids: Array.isArray(raw.bids) ? raw.bids.map(toLevel) : [],
            asks: Array.isArray(raw.asks) ? raw.asks.map(toLevel) : [],
            updated_at: nowIso(),
        });
    }

    if (slug[0] === "market" && slug[1] === "binance" && slug[2] === "trades" && slug[3]) {
        const limit = Math.max(5, Math.min(200, Number(req.nextUrl.searchParams.get("limit") || "40")));
        const raw = await fetchJson(`https://api.binance.com/api/v3/trades?symbol=${encodeURIComponent(slug[3])}&limit=${limit}`);
        return NextResponse.json({
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
        });
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
        return NextResponse.json({
            volatility_24h: volatility,
            momentum_7d: momentumRows,
            correlation_risk: { score, level },
            updated_at: nowIso(),
        });
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
        return NextResponse.json({
            watch_symbols: watch,
            allocation,
            total_market_value: total,
            risk_note: "Vercel serverless demo mode.",
            updated_at: nowIso(),
        });
    }

    if (slug[0] === "market" && slug[1] === "countries" && slug.length === 2) {
        const countries = await getCountries();
        return NextResponse.json({ countries, updated_at: nowIso() });
    }

    if (slug[0] === "market" && slug[1] === "countries" && slug[2]) {
        const countries = await getCountries();
        const code = normalizeSymbol(slug[2]);
        const row = countries.find((c) => c.code === code);
        if (!row) return NextResponse.json({ detail: "country_not_found" }, { status: 404 });
        const gdp = await getWorldBankLatest(code, "NY.GDP.MKTP.CD").catch(() => ({ value: null, year: null }));
        const gdpPc = await getWorldBankLatest(code, "NY.GDP.PCAP.CD").catch(() => ({ value: null, year: null }));
        const gini = await getWorldBankLatest(code, "SI.POV.GINI").catch(() => ({ value: null, year: null }));
        const electricity = await getWorldBankLatest(code, "EG.USE.ELEC.KH.PC").catch(() => ({ value: null, year: null }));
        const population = await getWorldBankLatest(code, "SP.POP.TOTL").catch(() => ({ value: null, year: null }));
        return NextResponse.json({
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
        });
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
        return NextResponse.json({
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
        });
    }

    if (slug[0] === "market" && slug[1] === "local-search") {
        const query = req.nextUrl.searchParams.get("query") || "";
        const category = req.nextUrl.searchParams.get("category") || "restaurant";
        if (!query.trim()) {
            return NextResponse.json({ query, category, places: [] });
        }
        try {
            const nominatim = await fetchJson(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
                { headers: { "User-Agent": "NexusFinance/1.0" } },
            );
            const found = Array.isArray(nominatim) ? nominatim[0] : null;
            if (!found) return NextResponse.json({ query, category, places: [] });
            const lat = Number(found.lat || 0);
            const lon = Number(found.lon || 0);
            const overpassQuery = `[out:json][timeout:15];node(around:2500,${lat},${lon})["amenity"="${category}"];out body 12;`;
            const overpass = await fetchJson("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: `data=${encodeURIComponent(overpassQuery)}`,
            });
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
            return NextResponse.json({ query, category, places: places.slice(0, 12) });
        } catch {
            return NextResponse.json({ query, category, places: [] });
        }
    }

    if (slug[0] === "market" && slug[1] === "convert") {
        const amount = Number(req.nextUrl.searchParams.get("amount") || "0");
        const fromCurrency = normalizeSymbol(req.nextUrl.searchParams.get("from_currency") || "USD");
        const toCurrency = normalizeSymbol(req.nextUrl.searchParams.get("to_currency") || "USD");
        const fiat = ["USD", "VND", "EUR", "JPY", "GBP", "AUD", "CAD", "CHF", "CNY", "SGD"];
        const isFromCrypto = !fiat.includes(fromCurrency) && fromCurrency !== "USDT";
        const isToCrypto = !fiat.includes(toCurrency) && toCurrency !== "USDT";

        const usdRates = await fetchJson("https://open.er-api.com/v6/latest/USD").catch(() => ({ rates: {} as Record<string, number> }));
        const rates = (usdRates?.rates || {}) as Record<string, number>;

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
        return NextResponse.json({
            amount,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            rate,
            converted,
            source: isFromCrypto || isToCrypto ? "binance+open.er-api" : "open.er-api",
            updated_at: nowIso(),
        });
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
        return NextResponse.json({ ok: true, settings: publicSettings(state) });
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
        });
    }

    if (slug[0] === "advisor" && slug[1] === "analyze") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        return NextResponse.json(buildAdvisorFallback(body));
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
                return NextResponse.json({ provider: "gemini", model, reply });
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
                });
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
                return NextResponse.json({ provider: "openai", model, reply });
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
                });
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
        });
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
        });
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
