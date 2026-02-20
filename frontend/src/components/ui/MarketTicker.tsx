"use client";



import { useCallback, useState } from "react";
import { TrendUp, TrendDown, Minus } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import type { TickerItem } from "@/lib/types";
import { FALLBACK_TICKER_DATA } from "@/lib/constants";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";


const POLL_INTERVAL_MS = 20_000;

export default function MarketTicker() {
    const locale = useLocale();
    const [data, setData] = useState<TickerItem[]>([...FALLBACK_TICKER_DATA]);

    const fetchTicker = useCallback(async (signal: AbortSignal) => {
        try {
            const res = await fetch("/api/market/indices", { signal });
            if (!res.ok) return;
            const payload = await res.json();
            const indices = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.indices)
                    ? payload.indices
                    : [];
            if (Array.isArray(indices) && indices.length > 0) {
                setData(
                    indices.map((idx: { symbol: string; value: number; change: number; change_percent: number }) => {
                        const symbol = String(idx.symbol ?? "").toUpperCase();
                        const maxFractionDigits =
                            symbol === "USDVND" ? 0 : symbol === "EURUSD" ? 4 : symbol === "BTC" || symbol === "ETH" ? 2 : 2;
                        return {
                            symbol,
                            price: Number(idx.value || 0).toLocaleString(locale, {
                                maximumFractionDigits: maxFractionDigits,
                            }),
                            change: Number(idx.change || 0),
                            changePercent: `${Number(idx.change_percent || 0) >= 0 ? "+" : ""}${Number(idx.change_percent || 0).toFixed(2)}%`,
                        };
                    }),
                );
            }
        } catch {
        }
    }, [locale]);

    useVisibilityPolling(fetchTicker, POLL_INTERVAL_MS);

    const duplicated = [...data, ...data];

    return (
        <div className="ticker-container" style={{ overflow: "hidden", whiteSpace: "nowrap", borderTop: "1px solid var(--border)", background: "var(--sidebar-bg)" }}>
            <div className="ticker-scroll" style={{ display: "inline-flex", gap: 32, padding: "8px 0" }}>
                {duplicated.map((item, i) => {
                    const unavailable = item.price === "--" || item.changePercent === "--";
                    return (
                        <div
                            key={`${item.symbol}-${i}`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                paddingRight: 16,
                                fontSize: "0.8rem",
                            }}
                        >
                            <span style={{ fontWeight: 600, color: "var(--text)", letterSpacing: "0.01em" }}>
                                {item.symbol}
                            </span>
                            <span style={{ color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem" }}>
                                {item.price}
                            </span>
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 2,
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    color: unavailable
                                        ? "var(--text-muted)"
                                        : item.change > 0
                                            ? "var(--success)"
                                            : item.change < 0
                                                ? "var(--danger)"
                                                : "var(--text-muted)",
                                }}
                            >
                                {unavailable
                                    ? <Minus size={12} />
                                    : item.change > 0
                                        ? <TrendUp size={12} weight="bold" />
                                        : item.change < 0
                                            ? <TrendDown size={12} weight="bold" />
                                            : <Minus size={12} />}
                                {unavailable ? "--" : item.changePercent}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
