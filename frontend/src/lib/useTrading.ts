"use client";



import { useState, useCallback } from "react";
import type { Position, Quote, TradeSimulation } from "./types";
import { TRADING_BUDGET, TRADING_FEE_RATE } from "./constants";
import { uniqueId } from "./utils";

export type { Position, Quote, TradeSimulation };


export function useTrading() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(false);
    const [simulation, setSimulation] = useState<TradeSimulation | null>(null);

    const totalInvested = positions.reduce((acc, p) => acc + p.shares * p.avgPrice, 0);
    const availableBudget = TRADING_BUDGET - totalInvested;

    
    const fetchQuote = useCallback(async (ticker: string) => {
        setLoading(true);
        setQuote(null);
        const symbol = ticker.toUpperCase();

        try {
            const res = await fetch(`/api/market/quote/${symbol}`);
            if (!res.ok) throw new Error("API unavailable");

            const data = await res.json();
            setQuote({
                ticker: data.symbol || data.ticker || symbol,
                name: data.name || symbol,
                price: data.price || 0,
                change: data.change || 0,
                changePercent: data.change_percent || 0,
                high: data.day_high || data.high || 0,
                low: data.day_low || data.low || 0,
                volume:
                    typeof data.volume === "number"
                        ? data.volume.toLocaleString("en-US")
                        : data.volume || "N/A",
            });
            sessionStorage.setItem(`quote:${symbol}`, JSON.stringify(data));
        } catch {
            const cached = sessionStorage.getItem(`quote:${symbol}`);
            if (!cached) {
                setQuote(null);
                return;
            }
            try {
                const data = JSON.parse(cached);
                setQuote({
                    ticker: data.symbol || data.ticker || symbol,
                    name: data.name || symbol,
                    price: Number(data.price || 0),
                    change: Number(data.change || 0),
                    changePercent: Number(data.change_percent || data.changePercent || 0),
                    high: Number(data.day_high || data.high || 0),
                    low: Number(data.day_low || data.low || 0),
                    volume:
                        typeof data.volume === "number"
                            ? data.volume.toLocaleString("en-US")
                            : data.volume || "N/A",
                });
            } catch {
                setQuote(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    type TradeOptions = {
        mode?: "spot" | "margin" | "long";
        order_type?: "limit" | "market" | "stop_limit";
        margin_mode?: "cross" | "isolated";
        leverage?: number;
    };

    
    const simulateTrade = useCallback(
        (ticker: string, shares: number, side: "BUY" | "SELL", options: TradeOptions = {}) => {
            if (!quote || shares <= 0) return;

            const mode = options.mode || "spot";
            const leverage = Math.max(1, Math.min(50, Number(options.leverage || 1)));
            const notionalValue = shares * quote.price;
            const requiredMargin = mode === "spot" ? notionalValue : notionalValue / leverage;
            const feeMultiplier = mode === "long" ? 1.3 : mode === "margin" ? 1.15 : 1;
            const fee = notionalValue * TRADING_FEE_RATE * feeMultiplier;
            const totalWithFee = requiredMargin + fee;
            const remainingBudget =
                side === "BUY" ? availableBudget - totalWithFee : availableBudget + notionalValue - fee;
            const budgetImpactPercent = (requiredMargin / TRADING_BUDGET) * 100;

            setSimulation({
                ticker: quote.ticker,
                side,
                mode,
                order_type: options.order_type || "limit",
                margin_mode: options.margin_mode || "cross",
                leverage,
                shares,
                totalCost: totalWithFee,
                remainingBudget,
                budgetImpactPercent,
                fee,
                notionalValue,
                requiredMargin,
            });
        },
        [quote, availableBudget],
    );

    
    const executeTrade = useCallback(
        (ticker: string, shares: number, side: "BUY" | "SELL", options: TradeOptions = {}) => {
            if (!quote || shares <= 0) return;

            setPositions((prev) => [
                ...prev,
                {
                    id: uniqueId(),
                    ticker: quote.ticker,
                    name: quote.name,
                    shares,
                    avgPrice: quote.price,
                    currentPrice: quote.price,
                    side,
                    mode: options.mode || "spot",
                    margin_mode: options.margin_mode || "cross",
                    leverage: Math.max(1, Math.min(50, Number(options.leverage || 1))),
                    order_type: options.order_type || "limit",
                    timestamp: new Date().toLocaleTimeString(),
                },
            ]);
            setSimulation(null);
        },
        [quote],
    );

    const portfolioValue = positions
        .filter((p) => p.side === "BUY")
        .reduce((acc, p) => acc + p.shares * p.currentPrice, 0);

    const totalPnL = positions
        .filter((p) => p.side === "BUY")
        .reduce((acc, p) => acc + p.shares * (p.currentPrice - p.avgPrice), 0);

    return {
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
    };
}
