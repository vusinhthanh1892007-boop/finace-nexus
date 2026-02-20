

import type {
    AIChatResponse,
    AnalyticsResponse,
    BinanceDepthResponse,
    BinanceTicker24h,
    BinanceTradesResponse,
    CandleResponse,
    CurrencyConversionResponse,
    CountryDetailResponse,
    CountryMapRow,
    IncomeBenchmarkResponse,
    LedgerResult,
    PortfolioOverviewResponse,
    SettingsPayload,
} from "./types";
import type { LedgerInput } from "./validations";

const API_BASE = "/api";

class APIClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    
    async calculateLedger(input: LedgerInput): Promise<LedgerResult> {
        return this.request<LedgerResult>("/ledger/calculate", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    
    async getStockQuote(symbol: string) {
        return this.request<{
            symbol: string;
            name: string;
            price: number;
            change: number;
            change_percent: number;
            volume: number;
        }>(`/market/quote/${encodeURIComponent(symbol)}`);
    }

    
    async getMarketIndices() {
        return this.request<{
            indices: Array<{
                symbol: string;
                name: string;
                value: number;
                change: number;
                change_percent: number;
            }>;
            updated_at: string;
        }>("/market/indices");
    }

    
    async healthCheck(): Promise<{ success: boolean; data: Record<string, unknown> }> {
        return this.request("/health");
    }

    
    async getCandles(symbol: string, interval: string, limit: number = 180): Promise<CandleResponse> {
        return this.request(`/market/candles/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&limit=${limit}`);
    }

    
    async getBinanceTicker24h(symbol: string): Promise<BinanceTicker24h> {
        return this.request(`/market/binance/ticker/${encodeURIComponent(symbol)}`);
    }

    
    async getBinanceDepth(symbol: string, limit: number = 20): Promise<BinanceDepthResponse> {
        return this.request(`/market/binance/depth/${encodeURIComponent(symbol)}?limit=${limit}`);
    }

    
    async getBinanceTrades(symbol: string, limit: number = 50): Promise<BinanceTradesResponse> {
        return this.request(`/market/binance/trades/${encodeURIComponent(symbol)}?limit=${limit}`);
    }

    
    async getAnalytics(symbols: string[]): Promise<AnalyticsResponse> {
        const value = symbols.join(",");
        return this.request(`/market/analytics?symbols=${encodeURIComponent(value)}`);
    }

    
    async getPortfolioOverview(): Promise<PortfolioOverviewResponse> {
        return this.request("/market/portfolio-overview");
    }

    
    async getSettings(): Promise<SettingsPayload> {
        return this.request("/settings");
    }

    
    async updateSettings(payload: Partial<SettingsPayload> & { gemini_api_key?: string; openai_api_key?: string }): Promise<{ ok: boolean; settings: SettingsPayload }> {
        return this.request("/settings", {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    }

    
    async rotateSecrets(payload: { providers?: Array<"gemini" | "openai">; reason?: string } = {}) {
        return this.request<{ ok: boolean; rotated_providers: string[]; settings: SettingsPayload }>("/settings/rotate-secrets", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    
    async getCountries(): Promise<{ countries: CountryMapRow[]; updated_at: string }> {
        return this.request("/market/countries");
    }

    
    async getCountryDetail(countryCode: string): Promise<CountryDetailResponse> {
        return this.request(`/market/countries/${encodeURIComponent(countryCode)}`);
    }

    
    async getIncomeBenchmark(countryCode: string, income: number, frequency: "monthly" | "yearly" = "monthly"): Promise<IncomeBenchmarkResponse> {
        return this.request(
            `/market/income-benchmark?country=${encodeURIComponent(countryCode)}&income=${income}&frequency=${frequency}`,
        );
    }

    
    async getLocalSearch(query: string, category: "restaurant" | "cafe" | "bar" = "restaurant") {
        return this.request<{ query: string; category: string; places: Array<{ name: string; distance_km: number; opening_hours: string }> }>(
            `/market/local-search?query=${encodeURIComponent(query)}&category=${category}`,
        );
    }

    
    async convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<CurrencyConversionResponse> {
        return this.request(
            `/market/convert?amount=${encodeURIComponent(amount)}&from_currency=${encodeURIComponent(fromCurrency)}&to_currency=${encodeURIComponent(toCurrency)}`,
        );
    }

    
    async aiChat(payload: { message: string; provider: "auto" | "gemini" | "openai"; model?: string; locale?: "vi" | "en" | "es" }): Promise<AIChatResponse> {
        return this.request("/advisor/chat", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }
}


export const apiClient = new APIClient();
