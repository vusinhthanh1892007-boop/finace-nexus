



export type BudgetStatus = "healthy" | "warning" | "critical" | "over_budget";


export interface LedgerResult {
    safe_to_spend: number;
    budget_utilization: number;
    remaining_budget: number;
    savings_potential: number;
    status: BudgetStatus;
    status_message: string;
    calculated_at: string;
    
    encrypted_audit?: string;
}



export interface AdvisorInput {
    income: number;
    actual_expenses: number;
    planned_budget: number;
    family_size: number;
    locale: string;
    location?: string;
    meal_seed?: number;
    expense_categories?: Record<string, number>;
}

export interface IngredientLine {
    name: string;
    estimated_cost: number;
}


export interface MealItem {
    name: string;
    cost: number;
    description: string;
    ingredients?: IngredientLine[];
}


export interface DailyMeal {
    day: string;
    breakfast: MealItem;
    lunch: MealItem;
    dinner: MealItem;
    snack: MealItem | null;
    total_cost: number;
}


export interface AssetAllocation {
    category: string;
    percentage: number;
    amount: number;
    rationale: string;
}


export interface AdvisorResult {
    health_score: number;
    health_status: string;
    guru_verdict: string;
    guru_advice: string[];
    wasteful_habits: string[];
    meal_plan: DailyMeal[];
    daily_food_budget: number;
    food_price_context?: {
        query: string;
        resolved_location: string;
        country_code: string;
        lat: number | null;
        lon: number | null;
        local_price_multiplier: number;
        average_restaurant_meal_vnd: number;
        estimated_home_meal_per_person_vnd: number;
        nearby_restaurants: number;
        nearby_examples: string[];
        note: string;
    };
    asset_allocation: AssetAllocation[];
    investable_amount: number;
    savings_rate: number;
    ai_provider_used?: string;
    analyzed_at: string;
}



export interface Position {
    id: string;
    ticker: string;
    name: string;
    shares: number;
    avgPrice: number;
    currentPrice: number;
    side: "BUY" | "SELL";
    mode?: "spot" | "margin" | "long";
    margin_mode?: "cross" | "isolated";
    leverage?: number;
    order_type?: "limit" | "market" | "stop_limit";
    timestamp: string;
}


export interface Quote {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    volume: string;
}


export interface TradeSimulation {
    ticker: string;
    side: "BUY" | "SELL";
    mode?: "spot" | "margin" | "long";
    order_type?: "limit" | "market" | "stop_limit";
    margin_mode?: "cross" | "isolated";
    leverage?: number;
    shares: number;
    totalCost: number;
    remainingBudget: number;
    budgetImpactPercent: number;
    fee: number;
    notionalValue?: number;
    requiredMargin?: number;
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface CandleResponse {
    symbol: string;
    interval: string;
    source: string;
    candles: Candle[];
    updated_at?: string;
}

export interface BinanceTicker24h {
    symbol: string;
    last_price: number;
    open_price: number;
    high_price: number;
    low_price: number;
    price_change: number;
    price_change_percent: number;
    volume_base: number;
    volume_quote: number;
    count_24h: number;
    updated_at: string;
}

export interface BinanceDepthLevel {
    price: number;
    quantity: number;
}

export interface BinanceDepthResponse {
    symbol: string;
    last_update_id: number;
    bids: BinanceDepthLevel[];
    asks: BinanceDepthLevel[];
    updated_at: string;
}

export interface BinanceTrade {
    id: number;
    price: number;
    quantity: number;
    quote_quantity: number;
    time: number;
    is_buyer_maker: boolean;
}

export interface BinanceTradesResponse {
    symbol: string;
    trades: BinanceTrade[];
    updated_at: string;
}

export interface AnalyticsVolatilityRow {
    symbol: string;
    price: number;
    change_percent: number;
    abs_move: number;
}

export interface AnalyticsMomentumRow {
    symbol: string;
    start: number;
    last: number;
    momentum_7d: number;
}

export interface AnalyticsResponse {
    volatility_24h: AnalyticsVolatilityRow[];
    momentum_7d: AnalyticsMomentumRow[];
    correlation_risk: {
        score: number;
        level: "low" | "medium" | "high";
    };
    updated_at: string;
}

export interface PortfolioAllocationRow {
    symbol: string;
    name: string;
    price: number;
    change_percent: number;
    weight: number;
}

export interface PortfolioOverviewResponse {
    watch_symbols: string[];
    allocation: PortfolioAllocationRow[];
    total_market_value: number;
    risk_note: string;
    updated_at: string;
}

export interface SettingsPayload {
    auto_balance: boolean;
    notifications: boolean;
    risk_tolerance: "conservative" | "moderate" | "aggressive";
    ai_provider: "auto" | "gemini" | "openai";
    ai_model: string;
    gemini_scopes: string[];
    openai_scopes: string[];
    api_key_version: number;
    last_secret_rotation_at: string;
    key_rotation_count: number;
    watch_symbols: string[];
    gemini_configured: boolean;
    gemini_key_masked: string;
    openai_configured: boolean;
    openai_key_masked: string;
    updated_at: string;
}

export interface CountryMapRow {
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
}

export interface CountryDetailResponse {
    country: CountryMapRow & {
        gdp_usd: number | null;
        gdp_year: string | null;
        gdp_trillion_usd: number | null;
        gdp_per_capita_usd: number | null;
        gdp_per_capita_year: string | null;
        gini: number | null;
        gini_year: string | null;
        electricity_kwh_per_capita: number | null;
        electricity_year: string | null;
        population_wb: number | null;
        population_year: string | null;
    };
    updated_at: string;
}

export interface IncomeBenchmarkResponse {
    country: string;
    country_name: string;
    annual_income_usd: number;
    gdp_trillion_usd: number | null;
    gdp_per_capita_usd: number | null;
    gini: number;
    estimated_percentile: number;
    estimated_top_percent: number;
    benchmark_note: string;
    updated_at: string;
}

export interface AIChatResponse {
    provider: "gemini" | "openai";
    model: string;
    reply: string;
}

export interface CurrencyConversionResponse {
    amount: number;
    from_currency: string;
    to_currency: string;
    rate: number;
    converted: number;
    source: string;
    updated_at: string;
}



export interface NavItem {
    href: string;
    icon: React.ReactNode;
    label: string;
    badge?: string;
}


export interface WatchItem {
    symbol: string;
    price: number;
    change: number;
}


export interface TickerItem {
    symbol: string;
    price: string;
    change: number;
    changePercent: string;
}


export interface SystemStatus {
    backend: "healthy" | "degraded" | "offline";
    latency: number;
    gemini: boolean;
    openai: boolean;
    active_ai_providers: string[];
}


export interface StatusConfig {
    color: string;
    ringColor: string;
    label: string;
}
