

export function isCryptoLikeSymbol(symbol: string): boolean {
    const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!s) return false;
    if (s.endsWith("USDT") || s.endsWith("BUSD") || s.endsWith("USDC") || s.endsWith("FDUSD")) return true;
    return ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "LTC", "TRX", "AVAX", "DOT", "LINK"].includes(s);
}

export function toBinanceSymbol(symbol: string): string {
    const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!s) return "";
    if (s.endsWith("USDT") || s.endsWith("BUSD") || s.endsWith("USDC") || s.endsWith("FDUSD")) return s;
    if (s.endsWith("USD") && s.length >= 6) return `${s.slice(0, -3)}USDT`;
    return `${s}USDT`;
}
