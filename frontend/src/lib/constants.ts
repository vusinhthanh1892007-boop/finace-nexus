

import type { WatchItem, StatusConfig, Quote } from "./types";



export const CHART_COLORS = [
    "#10b981",
    "#f59e0b",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
] as const;


export const CONFETTI_COLORS = [
    "#FFD700", "#FFA500", "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFEAA7",
] as const;



export const WATCH_FALLBACK: WatchItem[] = [
    { symbol: "AAPL", price: 0, change: 0 },
    { symbol: "BTC", price: 0, change: 0 },
    { symbol: "VNM", price: 0, change: 0 },
];


export const WATCH_SYMBOLS = ["AAPL", "BTC", "VNM"] as const;


export const WISDOM_QUOTES = {
    en: [
        "Pho is temporary, compound interest is forever.",
        "The best time to invest was yesterday. The second best is now.",
        "Budget like a guru, spend like a monk.",
        "Cash is king, but diversification is the kingdom.",
        "Noodles today, penthouse tomorrow. Stay disciplined.",
        "Warren Buffett did not get rich buying coffee every day.",
        "Your savings rate is more important than your salary.",
    ],
    vi: [
        "Pho ngon mot luc, lai kep ben vung ca doi.",
        "Thoi diem tot nhat de dau tu la hom qua. Tot nhi la hom nay.",
        "Lap ngan sach nhu guru, chi tieu nhu nha su.",
        "Tien mat la vua, da dang hoa la ca vuong quoc.",
        "An tiet kiem hom nay, huong thanh qua ngay mai.",
        "Giau len nhờ ky luat, khong phai nhờ mua sam cam tinh.",
        "Ty le tiet kiem quan trong hon muc luong.",
    ],
    es: [
        "El pho es temporal, el interes compuesto es para siempre.",
        "El mejor momento para invertir fue ayer. El segundo mejor es hoy.",
        "Presupuesta como un guru, gasta como un monje.",
        "El efectivo es rey, pero la diversificacion es el reino.",
        "Disciplina hoy, libertad financiera manana.",
        "La riqueza nace de la constancia, no de compras impulsivas.",
        "Tu tasa de ahorro importa mas que tu salario.",
    ],
} as const;



export const HEALTH_STATUS_CONFIG: Record<string, StatusConfig> = {
    excellent: {
        color: "var(--success)",
        ringColor: "conic-gradient(var(--success) var(--pct), var(--border) 0)",
        label: "Excellent",
    },
    good: {
        color: "var(--primary)",
        ringColor: "conic-gradient(var(--primary) var(--pct), var(--border) 0)",
        label: "Good",
    },
    needs_improvement: {
        color: "var(--warning)",
        ringColor: "conic-gradient(var(--warning) var(--pct), var(--border) 0)",
        label: "Needs Work",
    },
    critical: {
        color: "var(--danger)",
        ringColor: "conic-gradient(var(--danger) var(--pct), var(--border) 0)",
        label: "Critical",
    },
};



export const TRADING_BUDGET = 80_000_000;


export const TRADING_FEE_RATE = 0.0015;


export const MOCK_QUOTES: Record<string, Quote> = {
    VNM: { ticker: "VNM", name: "Vinamilk", price: 76_200, change: 1_200, changePercent: 1.6, high: 77_000, low: 75_800, volume: "2.4M" },
    VIC: { ticker: "VIC", name: "Vingroup", price: 42_500, change: -350, changePercent: -0.82, high: 43_100, low: 42_200, volume: "5.1M" },
    FPT: { ticker: "FPT", name: "FPT Corp", price: 138_000, change: 2_800, changePercent: 2.07, high: 139_500, low: 135_200, volume: "3.8M" },
    HPG: { ticker: "HPG", name: "Hòa Phát", price: 25_400, change: 400, changePercent: 1.6, high: 25_800, low: 25_000, volume: "12M" },
    AAPL: { ticker: "AAPL", name: "Apple Inc.", price: 4_650_000, change: 47_500, changePercent: 1.03, high: 4_700_000, low: 4_600_000, volume: "58M" },
    GOOGL: { ticker: "GOOGL", name: "Alphabet", price: 4_125_000, change: -28_000, changePercent: -0.67, high: 4_180_000, low: 4_100_000, volume: "22M" },
};



export const FALLBACK_TICKER_DATA = [
    { symbol: "VN30", price: "--", change: 0, changePercent: "--" },
    { symbol: "SPX", price: "--", change: 0, changePercent: "--" },
    { symbol: "DOW", price: "--", change: 0, changePercent: "--" },
    { symbol: "BTC", price: "--", change: 0, changePercent: "--" },
    { symbol: "ETH", price: "--", change: 0, changePercent: "--" },
    { symbol: "GOLD", price: "--", change: 0, changePercent: "--" },
    { symbol: "EURUSD", price: "--", change: 0, changePercent: "--" },
    { symbol: "USDVND", price: "--", change: 0, changePercent: "--" },
] as const;



export const LOCALES = [
    { code: "en", label: "EN", flag: "🇬🇧" },
    { code: "vi", label: "VI", flag: "🇻🇳" },
    { code: "es", label: "ES", flag: "🇪🇸" },
] as const;


export const THEMES = [
    { id: "pastel" as const, label: "Pastel", icon: "🌸" },
    { id: "bold" as const, label: "Bold", icon: "⚡" },
    { id: "minimal" as const, label: "Minimal", icon: "◻️" },
] as const;
