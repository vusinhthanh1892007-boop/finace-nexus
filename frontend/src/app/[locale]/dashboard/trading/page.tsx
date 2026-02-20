"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
    ArrowDown,
    ArrowUp,
    ChartLine,
    CurrencyCircleDollar,
    MagnifyingGlass,
    ShoppingCart,
    Storefront,
    TrendDown,
    TrendUp,
    Wallet,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api";
import type { BinanceDepthResponse, BinanceTicker24h, BinanceTradesResponse, Candle } from "@/lib/types";
import { useTrading } from "@/lib/useTrading";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import { isCryptoLikeSymbol, toBinanceSymbol } from "@/lib/marketSymbols";

type ChartType = "candlestick" | "line" | "bar";
type TradeMode = "spot" | "margin" | "long";
type MarginMode = "cross" | "isolated";
type OrderType = "limit" | "market" | "stop_limit";
type PatternHintKey =
    | "uptrend"
    | "downtrend"
    | "bullish_engulfing"
    | "bearish_engulfing"
    | "resistance_breakout_test"
    | "support_retest";

type IndicatorSet = {
    ma7: Array<number | null>;
    ma25: Array<number | null>;
    ema20: Array<number | null>;
    bollMid: Array<number | null>;
    bollUpper: Array<number | null>;
    bollLower: Array<number | null>;
    rsi14: Array<number | null>;
    macd: Array<number | null>;
    macdSignal: Array<number | null>;
    macdHist: Array<number | null>;
    support: number | null;
    resistance: number | null;
    patternHints: PatternHintKey[];
};

type CandleChartProps = {
    candles: Candle[];
    emptyText: string;
    chartType: ChartType;
    showVolume: boolean;
    showMa7: boolean;
    showMa25: boolean;
    showEma20: boolean;
    showBollinger: boolean;
    showSupportResistance: boolean;
    manualSupport: number | null;
    manualResistance: number | null;
    manualGrowthTarget: number | null;
    indicators: IndicatorSet;
};

const INTERVAL_OPTIONS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;

function formatCompact(n: number): string {
    if (!Number.isFinite(n)) return "--";
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(2);
}

function formatPrice(n: number): string {
    if (!Number.isFinite(n)) return "--";
    if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function sma(values: number[], period: number): Array<number | null> {
    const out: Array<number | null> = Array(values.length).fill(null);
    if (period <= 1) return values.slice();
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) {
        sum += values[i];
        if (i >= period) sum -= values[i - period];
        if (i >= period - 1) out[i] = sum / period;
    }
    return out;
}

function ema(values: number[], period: number): Array<number | null> {
    const out: Array<number | null> = Array(values.length).fill(null);
    if (values.length === 0) return out;
    const k = 2 / (period + 1);
    let prev = values[0];
    out[0] = prev;
    for (let i = 1; i < values.length; i += 1) {
        const next = values[i] * k + prev * (1 - k);
        out[i] = next;
        prev = next;
    }
    return out;
}

function stddev(values: number[], period: number, means: Array<number | null>): Array<number | null> {
    const out: Array<number | null> = Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i += 1) {
        const mean = means[i];
        if (mean === null) continue;
        let variance = 0;
        for (let j = i - period + 1; j <= i; j += 1) {
            variance += (values[j] - mean) ** 2;
        }
        out[i] = Math.sqrt(variance / period);
    }
    return out;
}

function rsi(values: number[], period: number = 14): Array<number | null> {
    const out: Array<number | null> = Array(values.length).fill(null);
    if (values.length <= period) return out;

    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i += 1) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0) gain += diff;
        else loss -= diff;
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < values.length; i += 1) {
        const diff = values[i] - values[i - 1];
        const up = diff > 0 ? diff : 0;
        const down = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + up) / period;
        avgLoss = (avgLoss * (period - 1) + down) / period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

function computeIndicators(candles: Candle[]): IndicatorSet {
    const close = candles.map((c) => Number(c.close || 0));

    const ma7 = sma(close, 7);
    const ma25 = sma(close, 25);
    const ema20 = ema(close, 20);
    const bollMid = sma(close, 20);
    const bollStd = stddev(close, 20, bollMid);
    const bollUpper = bollMid.map((v, i) => (v === null || bollStd[i] === null ? null : v + 2 * (bollStd[i] as number)));
    const bollLower = bollMid.map((v, i) => (v === null || bollStd[i] === null ? null : v - 2 * (bollStd[i] as number)));
    const rsi14 = rsi(close, 14);

    const ema12 = ema(close, 12);
    const ema26 = ema(close, 26);
    const macd = ema12.map((v, i) => (v === null || ema26[i] === null ? null : v - (ema26[i] as number)));
    const macdClean = macd.map((v) => v ?? 0);
    const macdSignalRaw = ema(macdClean, 9);
    const macdSignal = macd.map((v, i) => (v === null ? null : macdSignalRaw[i]));
    const macdHist = macd.map((v, i) => (v === null || macdSignal[i] === null ? null : v - (macdSignal[i] as number)));

    const tail = candles.slice(-80);
    const support = tail.length ? Math.min(...tail.map((c) => c.low)) : null;
    const resistance = tail.length ? Math.max(...tail.map((c) => c.high)) : null;

    const patternHints: PatternHintKey[] = [];
    const last6 = candles.slice(-6);
    if (last6.length >= 6) {
        const upTrend = last6.every((c, i) => i === 0 || (c.high >= last6[i - 1].high && c.low >= last6[i - 1].low));
        const downTrend = last6.every((c, i) => i === 0 || (c.high <= last6[i - 1].high && c.low <= last6[i - 1].low));
        if (upTrend) patternHints.push("uptrend");
        if (downTrend) patternHints.push("downtrend");
    }
    const c1 = candles[candles.length - 2];
    const c2 = candles[candles.length - 1];
    if (c1 && c2) {
        const bullishEngulf =
            c1.close < c1.open &&
            c2.close > c2.open &&
            c2.open <= c1.close &&
            c2.close >= c1.open;
        const bearishEngulf =
            c1.close > c1.open &&
            c2.close < c2.open &&
            c2.open >= c1.close &&
            c2.close <= c1.open;
        if (bullishEngulf) patternHints.push("bullish_engulfing");
        if (bearishEngulf) patternHints.push("bearish_engulfing");
        if (c2.close > (resistance ?? Infinity) * 0.995) patternHints.push("resistance_breakout_test");
        if (c2.close < (support ?? 0) * 1.005) patternHints.push("support_retest");
    }

    return {
        ma7,
        ma25,
        ema20,
        bollMid,
        bollUpper,
        bollLower,
        rsi14,
        macd,
        macdSignal,
        macdHist,
        support,
        resistance,
        patternHints: patternHints.slice(0, 4),
    };
}

function seriesPath(
    values: Array<number | null>,
    xAt: (i: number) => number,
    yAt: (v: number) => number,
): string {
    let path = "";
    for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        if (v === null || !Number.isFinite(v)) continue;
        const cmd = path === "" ? "M" : "L";
        path += `${cmd}${xAt(i)},${yAt(v)} `;
    }
    return path.trim();
}

function safeLastNumber(values: Array<number | null>): number | null {
    if (!Array.isArray(values) || values.length === 0) return null;
    const raw = values[values.length - 1];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    return raw;
}

const CandleChart = memo(function CandleChart({
    candles,
    emptyText,
    chartType,
    showVolume,
    showMa7,
    showMa25,
    showEma20,
    showBollinger,
    showSupportResistance,
    manualSupport,
    manualResistance,
    manualGrowthTarget,
    indicators,
}: CandleChartProps) {
    if (candles.length === 0) {
        return <div style={{ color: "var(--text-muted)", fontSize: "0.84rem", textAlign: "center", padding: "32px 0" }}>{emptyText}</div>;
    }

    const width = 1120;
    const height = 420;
    const topPadding = 18;
    const chartHeight = 250;
    const volumeTop = 286;
    const volumeHeight = 88;
    const leftPadding = 16;
    const rightPadding = 16;

    const maxHigh = Math.max(...candles.map((c) => c.high));
    const minLow = Math.min(...candles.map((c) => c.low));
    const maxVol = Math.max(...candles.map((c) => c.volume), 1);
    const priceRange = Math.max(maxHigh - minLow, 0.000001);
    const step = (width - leftPadding - rightPadding) / candles.length;
    const candleWidth = Math.max(2, step * 0.58);

    const y = (price: number) => topPadding + ((maxHigh - price) / priceRange) * chartHeight;
    const vy = (volume: number) => volumeTop + (1 - volume / maxVol) * volumeHeight;
    const xAt = (i: number) => leftPadding + i * step + step / 2;

    const closeSeries = candles.map((c) => c.close);
    const closePath = seriesPath(closeSeries, xAt, y);
    const ma7Path = seriesPath(indicators.ma7, xAt, y);
    const ma25Path = seriesPath(indicators.ma25, xAt, y);
    const ema20Path = seriesPath(indicators.ema20, xAt, y);
    const bollUpperPath = seriesPath(indicators.bollUpper, xAt, y);
    const bollLowerPath = seriesPath(indicators.bollLower, xAt, y);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", minHeight: 410 }}>
            <rect x={0} y={0} width={width} height={height} fill="transparent" />
            {[0, 1, 2, 3, 4].map((idx) => {
                const yPos = topPadding + (idx / 4) * chartHeight;
                return <line key={`grid-${idx}`} x1={0} y1={yPos} x2={width} y2={yPos} stroke="color-mix(in srgb, var(--border) 70%, transparent)" strokeWidth={1} />;
            })}

            {showSupportResistance && indicators.support !== null && (
                <line x1={0} y1={y(indicators.support)} x2={width} y2={y(indicators.support)} stroke="rgba(16,185,129,0.65)" strokeDasharray="5 4" />
            )}
            {showSupportResistance && indicators.resistance !== null && (
                <line x1={0} y1={y(indicators.resistance)} x2={width} y2={y(indicators.resistance)} stroke="rgba(239,68,68,0.65)" strokeDasharray="5 4" />
            )}
            {manualSupport !== null && (
                <line x1={0} y1={y(manualSupport)} x2={width} y2={y(manualSupport)} stroke="rgba(34,197,94,0.9)" strokeDasharray="8 4" />
            )}
            {manualResistance !== null && (
                <line x1={0} y1={y(manualResistance)} x2={width} y2={y(manualResistance)} stroke="rgba(234,88,12,0.9)" strokeDasharray="8 4" />
            )}
            {manualGrowthTarget !== null && (
                <line x1={0} y1={y(manualGrowthTarget)} x2={width} y2={y(manualGrowthTarget)} stroke="rgba(250,204,21,0.95)" strokeDasharray="8 4" />
            )}

            {chartType === "candlestick" &&
                candles.map((c, idx) => {
                    const x = xAt(idx);
                    const bullish = c.close >= c.open;
                    const color = bullish ? "#10b981" : "#ef4444";
                    const bodyTop = y(Math.max(c.open, c.close));
                    const bodyBottom = y(Math.min(c.open, c.close));
                    const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
                    return (
                        <g key={`${c.time}-${idx}`}>
                            <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={color} strokeWidth={1.2} />
                            <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} opacity={0.93} />
                            {showVolume && (
                                <rect
                                    x={x - candleWidth / 2}
                                    y={vy(c.volume)}
                                    width={candleWidth}
                                    height={Math.max(1, volumeTop + volumeHeight - vy(c.volume))}
                                    fill={color}
                                    opacity={0.35}
                                />
                            )}
                        </g>
                    );
                })}

            {chartType === "bar" &&
                candles.map((c, idx) => {
                    const x = xAt(idx);
                    const bullish = c.close >= c.open;
                    const color = bullish ? "#10b981" : "#ef4444";
                    return (
                        <g key={`${c.time}-${idx}`}>
                            <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={color} strokeWidth={1.2} />
                            <line x1={x - candleWidth * 0.65} y1={y(c.open)} x2={x} y2={y(c.open)} stroke={color} strokeWidth={1.2} />
                            <line x1={x} y1={y(c.close)} x2={x + candleWidth * 0.65} y2={y(c.close)} stroke={color} strokeWidth={1.2} />
                            {showVolume && (
                                <rect
                                    x={x - candleWidth / 2}
                                    y={vy(c.volume)}
                                    width={candleWidth}
                                    height={Math.max(1, volumeTop + volumeHeight - vy(c.volume))}
                                    fill={color}
                                    opacity={0.28}
                                />
                            )}
                        </g>
                    );
                })}

            {chartType === "line" && (
                <>
                    <path d={closePath} fill="none" stroke="#38bdf8" strokeWidth={2} />
                    {showVolume &&
                        candles.map((c, idx) => (
                            <rect
                                key={`v-${c.time}-${idx}`}
                                x={xAt(idx) - candleWidth / 2}
                                y={vy(c.volume)}
                                width={candleWidth}
                                height={Math.max(1, volumeTop + volumeHeight - vy(c.volume))}
                                fill="rgba(148,163,184,0.45)"
                            />
                        ))}
                </>
            )}

            {showMa7 && <path d={ma7Path} fill="none" stroke="#f59e0b" strokeWidth={1.6} />}
            {showMa25 && <path d={ma25Path} fill="none" stroke="#a855f7" strokeWidth={1.6} />}
            {showEma20 && <path d={ema20Path} fill="none" stroke="#22d3ee" strokeWidth={1.6} />}
            {showBollinger && (
                <>
                    <path d={bollUpperPath} fill="none" stroke="rgba(248,113,113,0.8)" strokeWidth={1.2} strokeDasharray="3 3" />
                    <path d={bollLowerPath} fill="none" stroke="rgba(96,165,250,0.8)" strokeWidth={1.2} strokeDasharray="3 3" />
                </>
            )}

            {showVolume && <line x1={0} y1={volumeTop} x2={width} y2={volumeTop} stroke="color-mix(in srgb, var(--border) 70%, transparent)" strokeWidth={1} />}
        </svg>
    );
});

export default function TradingPage() {
    const locale = useLocale();
    const searchParams = useSearchParams();
    const {
        quote,
        loading,
        positions,
        simulation,
        availableBudget,
        portfolioValue,
        totalPnL,
        fetchQuote,
        simulateTrade,
        executeTrade,
    } = useTrading();

    const [ticker, setTicker] = useState("BTC");
    const [activeSymbol, setActiveSymbol] = useState("BTC");
    const [shares, setShares] = useState(1);
    const [side, setSide] = useState<"BUY" | "SELL">("BUY");
    const [tradeMode, setTradeMode] = useState<TradeMode>("spot");
    const [marginMode, setMarginMode] = useState<MarginMode>("cross");
    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [leverage, setLeverage] = useState(5);

    const [interval, setInterval] = useState<(typeof INTERVAL_OPTIONS)[number]>("5m");
    const [candles, setCandles] = useState<Candle[]>([]);
    const [candleSource, setCandleSource] = useState("");
    const [chartLoading, setChartLoading] = useState(false);
    const [chartType, setChartType] = useState<ChartType>("candlestick");

    const [showVolume, setShowVolume] = useState(true);
    const [showMa7, setShowMa7] = useState(true);
    const [showMa25, setShowMa25] = useState(true);
    const [showEma20, setShowEma20] = useState(false);
    const [showBollinger, setShowBollinger] = useState(false);
    const [showSupportResistance, setShowSupportResistance] = useState(true);
    const [showRsiPanel, setShowRsiPanel] = useState(true);
    const [showMacdPanel, setShowMacdPanel] = useState(true);
    const [manualSupportInput, setManualSupportInput] = useState("");
    const [manualResistanceInput, setManualResistanceInput] = useState("");
    const [manualGrowthTargetInput, setManualGrowthTargetInput] = useState("");

    const [binanceTicker, setBinanceTicker] = useState<BinanceTicker24h | null>(null);
    const [orderbook, setOrderbook] = useState<BinanceDepthResponse | null>(null);
    const [tradeTape, setTradeTape] = useState<BinanceTradesResponse | null>(null);

    const labels = {
        vi: {
            title: "Giao dịch nâng cao",
            subtitle: "OHLC thời gian thực, orderbook/trade tape Binance, chỉ báo kỹ thuật đầy đủ.",
            quickTrade: "Lệnh nhanh",
            search: "Tìm mã / coin...",
            ticker: "Tìm",
            chart: "Biểu đồ",
            chartType: "Loại biểu đồ",
            chartCandle: "Nến",
            chartLine: "Đường",
            chartBar: "Thanh",
            chartSource: "Nguồn",
            interval: "Khung thời gian",
            indicators: "Chỉ báo",
            noChartData: "Không có dữ liệu biểu đồ",
            mode: "Chế độ",
            spot: "Spot",
            margin: "Margin",
            long: "Long",
            orderType: "Loại lệnh",
            limit: "Giới hạn",
            market: "Thị trường",
            stopLimit: "Stop Limit",
            marginType: "Kiểu margin",
            cross: "Cross",
            isolated: "Isolated",
            leverage: "Đòn bẩy",
            side: "Lệnh",
            buy: "MUA",
            sell: "BÁN",
            shares: "Số lượng",
            simulate: "Mô phỏng",
            execute: "Thực hiện",
            impact: "Tác động lệnh",
            positions: "Vị thế",
            budget: "Ngân sách khả dụng",
            portfolio: "Giá trị danh mục",
            pnl: "Lãi / Lỗ",
            noPositions: "Chưa có vị thế",
            loadingQuote: "Đang tải...",
            selectTicker: "Chọn mã để giao dịch",
            enterTickerHint: "Nhập mã rồi bấm tìm kiếm",
            tableTicker: "Mã",
            tableSide: "Lệnh",
            tablePrice: "Giá",
            tableTotal: "Tổng",
            tableTime: "Thời gian",
            tableMode: "Mode",
            tableOrderType: "Loại lệnh",
            lastPrice: "Giá gần nhất",
            volumeShort: "Khối lượng",
            open24h: "Open 24h",
            high24h: "High 24h",
            low24h: "Low 24h",
            close24h: "Close/Last",
            change24h: "Biến động 24h",
            volBase: "KL 24h (base)",
            volQuote: "KL 24h (quote)",
            tradeCount: "Số lệnh 24h",
            orderbook: "Sổ lệnh Binance",
            bids: "Bids",
            asks: "Asks",
            price: "Giá",
            qty: "SL",
            total: "Tổng",
            tradeTape: "Giao dịch gần nhất",
            tradeFlowBuy: "Mua chủ động",
            tradeFlowSell: "Bán chủ động",
            featureGuide: "Hiện tại biểu đồ có các mục chính",
            guideRealtime: "OHLC thời gian thực: Open / High / Low / Close",
            guideTf: "Khung thời gian: 1m, 5m, 1h, 1d, 1w",
            guideType: "Loại chart: nến / đường / thanh",
            guideVolume: "Volume: đánh giá sức mạnh biến động",
            guideIndicators: "Indicators: MA/EMA, RSI, MACD, Bollinger",
            guideSR: "Hỗ trợ/kháng cự và gợi ý mẫu hình",
            drawTools: "Công cụ vẽ mức",
            supportLevel: "Mức hỗ trợ vẽ tay",
            resistanceLevel: "Mức kháng cự vẽ tay",
            growthTarget: "Mức tăng trưởng mục tiêu",
            clearLevels: "Xóa mức vẽ",
            marketBias: "Đánh giá xu hướng",
            biasBull: "Bò (Bullish)",
            biasBear: "Gấu (Bearish)",
            biasNeutral: "Trung tính",
            pattern: "Pattern gợi ý",
            support: "Hỗ trợ",
            resistance: "Kháng cự",
            noPattern: "Chưa phát hiện mẫu rõ ràng",
            patternUptrend: "Xu hướng tăng",
            patternDowntrend: "Xu hướng giảm",
            patternBullishEngulfing: "Nhấn chìm tăng",
            patternBearishEngulfing: "Nhấn chìm giảm",
            patternResistanceBreakout: "Kiểm định phá kháng cự",
            patternSupportRetest: "Kiểm định lại hỗ trợ",
            rsi: "RSI(14)",
            macd: "MACD",
            signal: "Tín hiệu",
            histogram: "Histogram",
            overbought: "Quá mua",
            oversold: "Quá bán",
            neutral: "Trung tính",
            notional: "Notional",
            requiredMargin: "Margin yêu cầu",
            fee: "Phí",
            remaining: "Còn lại",
            impactShort: "Tác động",
            sourceBinance: "binance",
            sourceGeneral: "market",
            hide: "Ẩn",
            show: "Hiện",
        },
        en: {
            title: "Advanced Trading",
            subtitle: "Real-time OHLC, Binance orderbook/trade tape, and technical indicators.",
            quickTrade: "Quick Order",
            search: "Search symbol / coin...",
            ticker: "Search",
            chart: "Chart",
            chartType: "Chart type",
            chartCandle: "Candlestick",
            chartLine: "Line",
            chartBar: "Bar",
            chartSource: "Source",
            interval: "Interval",
            indicators: "Indicators",
            noChartData: "No chart data",
            mode: "Mode",
            spot: "Spot",
            margin: "Margin",
            long: "Long",
            orderType: "Order type",
            limit: "Limit",
            market: "Market",
            stopLimit: "Stop Limit",
            marginType: "Margin type",
            cross: "Cross",
            isolated: "Isolated",
            leverage: "Leverage",
            side: "Side",
            buy: "BUY",
            sell: "SELL",
            shares: "Quantity",
            simulate: "Simulate",
            execute: "Execute",
            impact: "Order Impact",
            positions: "Positions",
            budget: "Available Budget",
            portfolio: "Portfolio Value",
            pnl: "P&L",
            noPositions: "No positions yet",
            loadingQuote: "Loading...",
            selectTicker: "Choose symbol",
            enterTickerHint: "Enter symbol then search",
            tableTicker: "Ticker",
            tableSide: "Side",
            tablePrice: "Price",
            tableTotal: "Total",
            tableTime: "Time",
            tableMode: "Mode",
            tableOrderType: "Order Type",
            lastPrice: "Last",
            volumeShort: "Volume",
            open24h: "Open 24h",
            high24h: "High 24h",
            low24h: "Low 24h",
            close24h: "Close/Last",
            change24h: "Change 24h",
            volBase: "24h Vol (base)",
            volQuote: "24h Vol (quote)",
            tradeCount: "24h trades",
            orderbook: "Binance Orderbook",
            bids: "Bids",
            asks: "Asks",
            price: "Price",
            qty: "Qty",
            total: "Total",
            tradeTape: "Recent Trades",
            tradeFlowBuy: "Aggressive buy",
            tradeFlowSell: "Aggressive sell",
            featureGuide: "Current chart includes",
            guideRealtime: "Real-time OHLC: Open / High / Low / Close",
            guideTf: "Timeframes: 1m, 5m, 1h, 1d, 1w",
            guideType: "Chart types: candlestick / line / bar",
            guideVolume: "Volume bars for move strength",
            guideIndicators: "Indicators: MA/EMA, RSI, MACD, Bollinger",
            guideSR: "Support/resistance and pattern hints",
            drawTools: "Drawing levels",
            supportLevel: "Manual support level",
            resistanceLevel: "Manual resistance level",
            growthTarget: "Growth target level",
            clearLevels: "Clear levels",
            marketBias: "Market bias",
            biasBull: "Bullish",
            biasBear: "Bearish",
            biasNeutral: "Neutral",
            pattern: "Pattern hints",
            support: "Support",
            resistance: "Resistance",
            noPattern: "No clear pattern yet",
            patternUptrend: "Uptrend",
            patternDowntrend: "Downtrend",
            patternBullishEngulfing: "Bullish engulfing",
            patternBearishEngulfing: "Bearish engulfing",
            patternResistanceBreakout: "Resistance breakout test",
            patternSupportRetest: "Support retest",
            rsi: "RSI(14)",
            macd: "MACD",
            signal: "Signal",
            histogram: "Histogram",
            overbought: "Overbought",
            oversold: "Oversold",
            neutral: "Neutral",
            notional: "Notional",
            requiredMargin: "Required Margin",
            fee: "Fee",
            remaining: "Remaining",
            impactShort: "Impact",
            sourceBinance: "binance",
            sourceGeneral: "market",
            hide: "Hide",
            show: "Show",
        },
        es: {
            title: "Trading Avanzado",
            subtitle: "OHLC en tiempo real, orderbook/trades de Binance e indicadores tecnicos.",
            quickTrade: "Orden rapida",
            search: "Buscar simbolo / coin...",
            ticker: "Buscar",
            chart: "Grafico",
            chartType: "Tipo de grafico",
            chartCandle: "Velas",
            chartLine: "Linea",
            chartBar: "Barras",
            chartSource: "Fuente",
            interval: "Intervalo",
            indicators: "Indicadores",
            noChartData: "Sin datos de grafico",
            mode: "Modo",
            spot: "Spot",
            margin: "Margin",
            long: "Long",
            orderType: "Tipo de orden",
            limit: "Limit",
            market: "Market",
            stopLimit: "Stop Limit",
            marginType: "Tipo margin",
            cross: "Cross",
            isolated: "Isolated",
            leverage: "Apalancamiento",
            side: "Lado",
            buy: "COMPRAR",
            sell: "VENDER",
            shares: "Cantidad",
            simulate: "Simular",
            execute: "Ejecutar",
            impact: "Impacto de orden",
            positions: "Posiciones",
            budget: "Presupuesto disponible",
            portfolio: "Valor del portafolio",
            pnl: "Gan/Perd",
            noPositions: "Sin posiciones",
            loadingQuote: "Cargando...",
            selectTicker: "Selecciona simbolo",
            enterTickerHint: "Ingresa simbolo y busca",
            tableTicker: "Ticker",
            tableSide: "Lado",
            tablePrice: "Precio",
            tableTotal: "Total",
            tableTime: "Hora",
            tableMode: "Modo",
            tableOrderType: "Tipo",
            lastPrice: "Ultimo",
            volumeShort: "Volumen",
            open24h: "Open 24h",
            high24h: "High 24h",
            low24h: "Low 24h",
            close24h: "Close/Last",
            change24h: "Cambio 24h",
            volBase: "Vol 24h (base)",
            volQuote: "Vol 24h (quote)",
            tradeCount: "Trades 24h",
            orderbook: "Orderbook Binance",
            bids: "Bids",
            asks: "Asks",
            price: "Precio",
            qty: "Cant",
            total: "Total",
            tradeTape: "Trades recientes",
            tradeFlowBuy: "Compra agresiva",
            tradeFlowSell: "Venta agresiva",
            featureGuide: "El grafico incluye",
            guideRealtime: "OHLC tiempo real: Open / High / Low / Close",
            guideTf: "Intervalos: 1m, 5m, 1h, 1d, 1w",
            guideType: "Tipos: velas / linea / barras",
            guideVolume: "Volumen para validar fuerza",
            guideIndicators: "Indicadores: MA/EMA, RSI, MACD, Bollinger",
            guideSR: "Soporte/resistencia y patrones",
            drawTools: "Niveles de dibujo",
            supportLevel: "Soporte manual",
            resistanceLevel: "Resistencia manual",
            growthTarget: "Objetivo de crecimiento",
            clearLevels: "Limpiar niveles",
            marketBias: "Sesgo de mercado",
            biasBull: "Alcista",
            biasBear: "Bajista",
            biasNeutral: "Neutral",
            pattern: "Patrones",
            support: "Soporte",
            resistance: "Resistencia",
            noPattern: "Sin patron claro",
            patternUptrend: "Tendencia alcista",
            patternDowntrend: "Tendencia bajista",
            patternBullishEngulfing: "Envolvente alcista",
            patternBearishEngulfing: "Envolvente bajista",
            patternResistanceBreakout: "Prueba de ruptura de resistencia",
            patternSupportRetest: "Retesteo de soporte",
            rsi: "RSI(14)",
            macd: "MACD",
            signal: "Senal",
            histogram: "Histograma",
            overbought: "Sobrecompra",
            oversold: "Sobreventa",
            neutral: "Neutral",
            notional: "Notional",
            requiredMargin: "Margin requerido",
            fee: "Comision",
            remaining: "Restante",
            impactShort: "Impacto",
            sourceBinance: "binance",
            sourceGeneral: "mercado",
            hide: "Ocultar",
            show: "Mostrar",
        },
    } as const;
    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const loadMarketData = useCallback(async () => {
        const symbol = ticker.trim().toUpperCase();
        if (!symbol) return;

        if (symbol !== activeSymbol) {
            setActiveSymbol(symbol);
            return;
        }

        setChartLoading(true);
        try {
            const [res] = await Promise.all([
                apiClient.getCandles(symbol, interval, 240),
                fetchQuote(symbol),
            ]);
            const rows = Array.isArray(res.candles) ? res.candles.slice(-160) : [];
            setCandles(rows);
            setCandleSource(res.source || "n/a");
        } catch {
            setCandles([]);
            setCandleSource("offline");
        } finally {
            setChartLoading(false);
        }
    }, [activeSymbol, fetchQuote, interval, ticker]);

    const refreshCandlesOnly = useCallback(
        async (signal: AbortSignal) => {
            const symbol = activeSymbol.trim().toUpperCase();
            if (!symbol) return;
            const res = await fetch(
                `/api/market/candles/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&limit=220`,
                { signal, cache: "no-store" },
            );
            if (!res.ok) return;
            const payload = await res.json();
            const rows = Array.isArray(payload?.candles) ? payload.candles.slice(-160) : [];
            if (rows.length > 0) {
                setCandles(rows);
                setCandleSource(String(payload?.source || "n/a"));
            }
        },
        [activeSymbol, interval],
    );

    const refreshBinanceWidgets = useCallback(
        async (signal: AbortSignal) => {
            const symbol = activeSymbol.trim().toUpperCase();
            if (!symbol || !isCryptoLikeSymbol(symbol)) {
                setBinanceTicker(null);
                setOrderbook(null);
                setTradeTape(null);
                return;
            }
            const pair = toBinanceSymbol(symbol);
            if (!pair) return;

            const [tickerRes, depthRes, tradesRes] = await Promise.all([
                fetch(`/api/market/binance/ticker/${encodeURIComponent(pair)}`, { signal, cache: "no-store" }),
                fetch(`/api/market/binance/depth/${encodeURIComponent(pair)}?limit=20`, { signal, cache: "no-store" }),
                fetch(`/api/market/binance/trades/${encodeURIComponent(pair)}?limit=35`, { signal, cache: "no-store" }),
            ]);

            if (tickerRes.ok) setBinanceTicker(await tickerRes.json());
            if (depthRes.ok) setOrderbook(await depthRes.json());
            if (tradesRes.ok) setTradeTape(await tradesRes.json());
        },
        [activeSymbol],
    );

    useVisibilityPolling(refreshCandlesOnly, 12_000);
    useVisibilityPolling(refreshBinanceWidgets, 3_000);

    useEffect(() => {
        const symbol = activeSymbol.trim().toUpperCase();
        if (!symbol) return;
        (async () => {
            setChartLoading(true);
            try {
                const [candlesRes] = await Promise.all([
                    apiClient.getCandles(symbol, interval, 220),
                    fetchQuote(symbol),
                ]);
                setCandles(Array.isArray(candlesRes.candles) ? candlesRes.candles.slice(-160) : []);
                setCandleSource(candlesRes.source || "n/a");
            } finally {
                setChartLoading(false);
            }
        })();
    }, [activeSymbol, fetchQuote, interval]);

    useEffect(() => {
        const symbol = (searchParams.get("symbol") || "").toUpperCase().trim();
        if (!symbol) return;
        setTicker(symbol);
        setActiveSymbol(symbol);
        void fetchQuote(symbol);
    }, [fetchQuote, searchParams]);

    const latestCandle = useMemo(() => candles[candles.length - 1], [candles]);
    const indicatorSet = useMemo(() => computeIndicators(candles), [candles]);
    const latestRsi = safeLastNumber(indicatorSet.rsi14);
    const latestMacd = safeLastNumber(indicatorSet.macd);
    const latestMacdSignal = safeLastNumber(indicatorSet.macdSignal);
    const latestHist = safeLastNumber(indicatorSet.macdHist);
    const manualSupport = useMemo(() => {
        const value = Number(manualSupportInput);
        return Number.isFinite(value) && value > 0 ? value : null;
    }, [manualSupportInput]);
    const manualResistance = useMemo(() => {
        const value = Number(manualResistanceInput);
        return Number.isFinite(value) && value > 0 ? value : null;
    }, [manualResistanceInput]);
    const manualGrowthTarget = useMemo(() => {
        const value = Number(manualGrowthTargetInput);
        return Number.isFinite(value) && value > 0 ? value : null;
    }, [manualGrowthTargetInput]);

    const rsiState =
        latestRsi === null
            ? t.neutral
            : latestRsi >= 70
                ? t.overbought
                : latestRsi <= 30
                    ? t.oversold
                    : t.neutral;

    const patternLabels: Record<PatternHintKey, string> = {
        uptrend: t.patternUptrend,
        downtrend: t.patternDowntrend,
        bullish_engulfing: t.patternBullishEngulfing,
        bearish_engulfing: t.patternBearishEngulfing,
        resistance_breakout_test: t.patternResistanceBreakout,
        support_retest: t.patternSupportRetest,
    };

    const marketBias = useMemo(() => {
        if (!latestCandle) return t.biasNeutral;
        const ma7Last = safeLastNumber(indicatorSet.ma7);
        const ma25Last = safeLastNumber(indicatorSet.ma25);
        const price = latestCandle.close;
        const bullish =
            (ma7Last !== null && ma25Last !== null && price > ma7Last && ma7Last >= ma25Last) ||
            (latestRsi !== null && latestRsi > 55) ||
            (latestHist !== null && latestHist > 0);
        const bearish =
            (ma7Last !== null && ma25Last !== null && price < ma7Last && ma7Last <= ma25Last) ||
            (latestRsi !== null && latestRsi < 45) ||
            (latestHist !== null && latestHist < 0);
        if (bullish && !bearish) return t.biasBull;
        if (bearish && !bullish) return t.biasBear;
        return t.biasNeutral;
    }, [indicatorSet.ma25, indicatorSet.ma7, latestCandle, latestHist, latestRsi, t.biasBear, t.biasBull, t.biasNeutral]);

    const doSimulate = () => {
        simulateTrade(ticker, shares, side, {
            mode: tradeMode,
            order_type: orderType,
            margin_mode: marginMode,
            leverage,
        });
    };

    const doExecute = () => {
        executeTrade(ticker, shares, side, {
            mode: tradeMode,
            order_type: orderType,
            margin_mode: marginMode,
            leverage,
        });
    };

    const bids = orderbook?.bids?.slice(0, 12) ?? [];
    const asks = orderbook?.asks?.slice(0, 12) ?? [];
    const trades = tradeTape?.trades?.slice(0, 20) ?? [];

    return (
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
            <div className="animate-fadeIn" style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>{t.title}</h1>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{t.subtitle}</p>
            </div>

            <div className="animate-fadeIn" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
                {[
                    { icon: <Wallet size={18} weight="duotone" />, label: t.budget, value: formatPrice(availableBudget), color: "var(--primary)" },
                    { icon: <ChartLine size={18} weight="duotone" />, label: t.portfolio, value: formatPrice(portfolioValue), color: "var(--success)" },
                    {
                        icon: totalPnL >= 0 ? <TrendUp size={18} weight="duotone" /> : <TrendDown size={18} weight="duotone" />,
                        label: t.pnl,
                        value: `${totalPnL >= 0 ? "+" : ""}${formatPrice(totalPnL)}`,
                        color: totalPnL >= 0 ? "var(--success)" : "var(--danger)",
                    },
                ].map(({ icon, label, value, color }) => (
                    <div key={label} className="card" style={{ padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            <span className="icon-glow" style={{ color }}>{icon}</span>
                            {label}
                        </div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color }}>{value}</div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            className="input"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            placeholder={t.search}
                            style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                        />
                        <button className="btn btn-primary" onClick={loadMarketData} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <MagnifyingGlass size={14} weight="bold" />
                            {t.ticker}
                        </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>{t.interval}</span>
                        {INTERVAL_OPTIONS.map((itv) => (
                            <button
                                key={itv}
                                className={`btn ${interval === itv ? "btn-primary" : ""}`}
                                onClick={() => setInterval(itv)}
                                style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                            >
                                {itv}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                    <div className="card" style={{ padding: 8 }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t.chartType}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button className={`btn ${chartType === "candlestick" ? "btn-primary" : ""}`} style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => setChartType("candlestick")}>{t.chartCandle}</button>
                            <button className={`btn ${chartType === "line" ? "btn-primary" : ""}`} style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => setChartType("line")}>{t.chartLine}</button>
                            <button className={`btn ${chartType === "bar" ? "btn-primary" : ""}`} style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => setChartType("bar")}>{t.chartBar}</button>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 8 }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t.indicators}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            {[
                                { key: "volume", active: showVolume, set: setShowVolume, label: "Volume" },
                                { key: "ma7", active: showMa7, set: setShowMa7, label: "MA7" },
                                { key: "ma25", active: showMa25, set: setShowMa25, label: "MA25" },
                                { key: "ema20", active: showEma20, set: setShowEma20, label: "EMA20" },
                                { key: "bb", active: showBollinger, set: setShowBollinger, label: "Boll" },
                                { key: "sr", active: showSupportResistance, set: setShowSupportResistance, label: "S/R" },
                                { key: "rsi", active: showRsiPanel, set: setShowRsiPanel, label: "RSI" },
                                { key: "macd", active: showMacdPanel, set: setShowMacdPanel, label: "MACD" },
                            ].map((item) => (
                                <button key={item.key} className={`btn ${item.active ? "btn-primary" : ""}`} style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => item.set(!item.active)}>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {binanceTicker && (
                <div className="card" style={{ padding: 12, marginBottom: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                        <div className="card" style={{ padding: 8 }}><small>{t.open24h}</small><div style={{ fontWeight: 800 }}>{formatPrice(binanceTicker.open_price)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.high24h}</small><div style={{ fontWeight: 800, color: "var(--success)" }}>{formatPrice(binanceTicker.high_price)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.low24h}</small><div style={{ fontWeight: 800, color: "var(--danger)" }}>{formatPrice(binanceTicker.low_price)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.close24h}</small><div style={{ fontWeight: 800 }}>{formatPrice(binanceTicker.last_price)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.change24h}</small><div style={{ fontWeight: 800, color: Number(binanceTicker.price_change_percent || 0) >= 0 ? "var(--success)" : "var(--danger)" }}>{Number(binanceTicker.price_change_percent || 0) >= 0 ? "+" : ""}{Number(binanceTicker.price_change_percent || 0).toFixed(2)}%</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.volBase}</small><div style={{ fontWeight: 800 }}>{formatCompact(binanceTicker.volume_base)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.volQuote}</small><div style={{ fontWeight: 800 }}>{formatCompact(binanceTicker.volume_quote)}</div></div>
                        <div className="card" style={{ padding: 8 }}><small>{t.tradeCount}</small><div style={{ fontWeight: 800 }}>{binanceTicker.count_24h.toLocaleString("en-US")}</div></div>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700 }}>
                        {t.chart} {activeSymbol ? `• ${activeSymbol}` : ""}
                    </h2>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span>{t.chartSource}: <strong style={{ color: "var(--text)" }}>{candleSource || (binanceTicker ? t.sourceBinance : t.sourceGeneral)}</strong></span>
                        {latestCandle && (
                            <span>
                                O {formatPrice(latestCandle.open)} H {formatPrice(latestCandle.high)} L {formatPrice(latestCandle.low)} C {formatPrice(latestCandle.close)}
                            </span>
                        )}
                    </div>
                </div>

                {chartLoading ? (
                    <div className="skeleton" style={{ height: 410 }} />
                ) : (
                    <div style={{ minHeight: 410 }}>
                        <CandleChart
                            candles={candles}
                            emptyText={t.noChartData}
                            chartType={chartType}
                            showVolume={showVolume}
                            showMa7={showMa7}
                            showMa25={showMa25}
                            showEma20={showEma20}
                            showBollinger={showBollinger}
                            showSupportResistance={showSupportResistance}
                            manualSupport={manualSupport}
                            manualResistance={manualResistance}
                            manualGrowthTarget={manualGrowthTarget}
                            indicators={indicatorSet}
                        />
                    </div>
                )}

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    {showRsiPanel && (
                        <div className="card" style={{ padding: 8 }}>
                            <small>{t.rsi}</small>
                            <div style={{ fontWeight: 800, fontSize: "1.04rem" }}>{latestRsi !== null ? latestRsi.toFixed(2) : "--"}</div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{rsiState}</div>
                        </div>
                    )}
                    {showMacdPanel && (
                        <div className="card" style={{ padding: 8 }}>
                            <small>{t.macd}</small>
                            <div style={{ fontWeight: 800 }}>{latestMacd !== null ? latestMacd.toFixed(4) : "--"}</div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{t.signal}: {latestMacdSignal !== null ? latestMacdSignal.toFixed(4) : "--"} | {t.histogram}: {latestHist !== null ? latestHist.toFixed(4) : "--"}</div>
                        </div>
                    )}
                    <div className="card" style={{ padding: 8 }}>
                        <small>{t.support}</small>
                        <div style={{ fontWeight: 800 }}>{indicatorSet.support !== null ? formatPrice(indicatorSet.support) : "--"}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{t.resistance}: {indicatorSet.resistance !== null ? formatPrice(indicatorSet.resistance) : "--"}</div>
                    </div>
                    <div className="card" style={{ padding: 8 }}>
                        <small>{t.pattern}</small>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            {indicatorSet.patternHints.length > 0
                                ? indicatorSet.patternHints.map((key) => patternLabels[key]).join(" • ")
                                : t.noPattern}
                        </div>
                    </div>
                    <div className="card" style={{ padding: 8 }}>
                        <small>{t.marketBias}</small>
                        <div style={{ fontWeight: 800, color: marketBias === t.biasBull ? "var(--success)" : marketBias === t.biasBear ? "var(--danger)" : "var(--warning)" }}>
                            {marketBias}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 10, padding: 10 }}>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 8 }}>{t.drawTools}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.supportLevel}</label>
                            <input className="input" value={manualSupportInput} onChange={(e) => setManualSupportInput(e.target.value)} placeholder={indicatorSet.support ? formatPrice(indicatorSet.support) : "0"} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.resistanceLevel}</label>
                            <input className="input" value={manualResistanceInput} onChange={(e) => setManualResistanceInput(e.target.value)} placeholder={indicatorSet.resistance ? formatPrice(indicatorSet.resistance) : "0"} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.growthTarget}</label>
                            <input className="input" value={manualGrowthTargetInput} onChange={(e) => setManualGrowthTargetInput(e.target.value)} placeholder={latestCandle ? formatPrice(latestCandle.close * 1.05) : "0"} />
                        </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <button
                            className="btn"
                            style={{ padding: "6px 10px", fontSize: "0.74rem" }}
                            onClick={() => {
                                setManualSupportInput("");
                                setManualResistanceInput("");
                                setManualGrowthTargetInput("");
                            }}
                        >
                            {t.clearLevels}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 12, marginBottom: 16 }}>
                <h3 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem" }}>{t.featureGuide}</h3>
                <div style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <div>• {t.guideRealtime}</div>
                    <div>• {t.guideTf}</div>
                    <div>• {t.guideType}</div>
                    <div>• {t.guideVolume}</div>
                    <div>• {t.guideIndicators}</div>
                    <div>• {t.guideSR}</div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ padding: 14 }}>
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <CurrencyCircleDollar size={18} weight="duotone" className="icon-glow" style={{ color: "var(--primary)" }} />
                        {t.quickTrade}
                    </h2>

                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t.mode}</label>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <button className={`btn ${tradeMode === "spot" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setTradeMode("spot")}>{t.spot}</button>
                                <button className={`btn ${tradeMode === "margin" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setTradeMode("margin")}>{t.margin}</button>
                                <button className={`btn ${tradeMode === "long" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setTradeMode("long")}>{t.long}</button>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t.orderType}</label>
                            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                <button className={`btn ${orderType === "limit" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setOrderType("limit")}>{t.limit}</button>
                                <button className={`btn ${orderType === "market" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setOrderType("market")}>{t.market}</button>
                                <button className={`btn ${orderType === "stop_limit" ? "btn-primary" : ""}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={() => setOrderType("stop_limit")}>{t.stopLimit}</button>
                            </div>
                        </div>
                    </div>

                    {(tradeMode === "margin" || tradeMode === "long") && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.marginType}</label>
                                <select className="input" value={marginMode} onChange={(e) => setMarginMode(e.target.value as MarginMode)}>
                                    <option value="cross">{t.cross}</option>
                                    <option value="isolated">{t.isolated}</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.leverage}</label>
                                <input className="input" type="number" min={1} max={50} value={leverage} onChange={(e) => setLeverage(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.shares}</label>
                            <input className="input" type="number" min={1} value={shares} onChange={(e) => setShares(Math.max(1, Number(e.target.value) || 1))} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.side}</label>
                            <div style={{ display: "flex", gap: 4 }}>
                                <button
                                    className="btn"
                                    onClick={() => setSide("BUY")}
                                    style={{ flex: 1, background: side === "BUY" ? "var(--success)" : "var(--surface-hover)", color: side === "BUY" ? "white" : "var(--text-secondary)", border: "none" }}
                                >
                                    <ArrowUp size={12} weight="bold" /> {t.buy}
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => setSide("SELL")}
                                    style={{ flex: 1, background: side === "SELL" ? "var(--danger)" : "var(--surface-hover)", color: side === "SELL" ? "white" : "var(--text-secondary)", border: "none" }}
                                >
                                    <ArrowDown size={12} weight="bold" /> {t.sell}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={doSimulate} disabled={!quote} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <ShoppingCart size={14} weight="duotone" /> {t.simulate}
                        </button>
                        <button className="btn btn-primary" onClick={doExecute} disabled={!quote} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Storefront size={14} weight="duotone" /> {t.execute}
                        </button>
                    </div>

                    {simulation && (
                        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-hover)", fontSize: "0.8rem" }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t.impact}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div>{t.notional}: <strong>{formatPrice(simulation.notionalValue || 0)}</strong></div>
                                <div>{t.requiredMargin}: <strong>{formatPrice(simulation.requiredMargin || simulation.totalCost)}</strong></div>
                                <div>{t.fee}: <strong>{formatPrice(simulation.fee)}</strong></div>
                                <div>{t.remaining}: <strong style={{ color: simulation.remainingBudget >= 0 ? "var(--success)" : "var(--danger)" }}>{formatPrice(simulation.remainingBudget)}</strong></div>
                                <div>{t.impactShort}: <strong>{simulation.budgetImpactPercent.toFixed(1)}%</strong></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: 14 }}>
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 10 }}>
                        {loading ? t.loadingQuote : quote ? `${quote.ticker} — ${quote.name}` : t.selectTicker}
                    </h2>

                    {quote && !loading ? (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "'JetBrains Mono', monospace" }}>{formatPrice(quote.price)}</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: quote.change >= 0 ? "var(--success)" : "var(--danger)", marginTop: 2 }}>
                                    {quote.change >= 0 ? "+" : ""}{formatPrice(quote.change)} ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                <div>
                                    <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.high24h}</div>
                                    <div style={{ fontWeight: 700 }}>{formatPrice(quote.high)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.low24h}</div>
                                    <div style={{ fontWeight: 700 }}>{formatPrice(quote.low)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.volumeShort}</div>
                                    <div style={{ fontWeight: 700 }}>{quote.volume}</div>
                                </div>
                            </div>
                        </>
                    ) : loading ? (
                        <div className="skeleton" style={{ height: 150 }} />
                    ) : (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>{t.enterTickerHint}</div>
                    )}

                    {latestCandle && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            <div>{t.lastPrice}: <strong>{formatPrice(latestCandle.close)}</strong></div>
                            <div>{t.volumeShort}: <strong>{formatCompact(latestCandle.volume)}</strong></div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div className="card" style={{ padding: 12 }}>
                    <h3 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem" }}>{t.orderbook}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                            <div style={{ fontSize: "0.75rem", marginBottom: 6, color: "var(--success)" }}>{t.bids}</div>
                            <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                                {bids.map((row, idx) => (
                                    <div key={`b-${idx}-${row.price}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: "0.75rem" }}>
                                        <span style={{ color: "var(--success)" }}>{formatPrice(row.price)}</span>
                                        <span>{formatCompact(row.quantity)}</span>
                                        <span>{formatCompact(row.price * row.quantity)}</span>
                                    </div>
                                ))}
                                {bids.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>--</div>}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.75rem", marginBottom: 6, color: "var(--danger)" }}>{t.asks}</div>
                            <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                                {asks.map((row, idx) => (
                                    <div key={`a-${idx}-${row.price}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: "0.75rem" }}>
                                        <span style={{ color: "var(--danger)" }}>{formatPrice(row.price)}</span>
                                        <span>{formatCompact(row.quantity)}</span>
                                        <span>{formatCompact(row.price * row.quantity)}</span>
                                    </div>
                                ))}
                                {asks.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>--</div>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 12 }}>
                    <h3 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem" }}>{t.tradeTape}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>
                        <span>{t.price}</span><span>{t.qty}</span><span>{t.tableTime}</span>
                    </div>
                    <div style={{ display: "grid", gap: 4, maxHeight: 290, overflowY: "auto" }}>
                        {trades.map((row) => {
                            const color = row.is_buyer_maker ? "var(--danger)" : "var(--success)";
                            const time = new Date(row.time).toLocaleTimeString("en-US", { hour12: false });
                            return (
                                <div key={`trade-${row.id}-${row.time}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: "0.76rem" }}>
                                    <span style={{ color }}>{formatPrice(row.price)}</span>
                                    <span>{formatCompact(row.quantity)}</span>
                                    <span>{time}</span>
                                </div>
                            );
                        })}
                        {trades.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>--</div>}
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <ChartLine size={18} weight="duotone" className="icon-glow" style={{ color: "var(--warning)" }} />
                    {t.positions}
                </h2>
                {positions.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>{t.noPositions}</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    {[t.tableTicker, t.tableMode, t.tableOrderType, t.tableSide, t.shares, t.tablePrice, t.tableTotal, t.tableTime].map((h) => (
                                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {positions.slice().reverse().map((p) => (
                                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "9px 10px", fontWeight: 700 }}>{p.ticker}</td>
                                        <td style={{ padding: "9px 10px", color: "var(--text-secondary)" }}>{p.mode || "spot"}{p.leverage && p.mode !== "spot" ? ` x${p.leverage}` : ""}</td>
                                        <td style={{ padding: "9px 10px", color: "var(--text-secondary)" }}>{p.order_type || "limit"}</td>
                                        <td style={{ padding: "9px 10px", color: p.side === "BUY" ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{p.side}</td>
                                        <td style={{ padding: "9px 10px" }}>{p.shares}</td>
                                        <td style={{ padding: "9px 10px" }}>{formatPrice(p.avgPrice)}</td>
                                        <td style={{ padding: "9px 10px", fontWeight: 700 }}>{formatPrice(p.shares * p.avgPrice)}</td>
                                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.timestamp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
