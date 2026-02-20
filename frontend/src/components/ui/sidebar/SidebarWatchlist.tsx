"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    RiAddLine,
    RiArrowDownLine,
    RiArrowUpLine,
    RiCloseLine,
    RiSettings3Line,
} from "@remixicon/react";
import { useLocale, useTranslations } from "next-intl";
import type { WatchItem } from "@/lib/types";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";
import { apiClient } from "@/lib/api";
import { isCryptoLikeSymbol, toBinanceSymbol } from "@/lib/marketSymbols";

function toFallback(symbols: string[]): WatchItem[] {
    return symbols.map((symbol) => ({ symbol, price: 0, change: 0 }));
}

export default function SidebarWatchlist() {
    const locale = useLocale();
    const t = useTranslations("sidebar");

    const [symbols, setSymbols] = useState<string[]>(["AAPL", "BTC", "VNM"]);
    const [watchlist, setWatchlist] = useState<WatchItem[]>(toFallback(["AAPL", "BTC", "VNM"]));
    const [backendLive, setBackendLive] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draftSymbol, setDraftSymbol] = useState("");

    const syncWatchSymbols = useCallback(async (next: string[]) => {
        setSymbols(next);
        setWatchlist(toFallback(next));
        try {
            await apiClient.updateSettings({ watch_symbols: next });
        } catch {
        }
    }, []);

    const addSymbol = useCallback(async () => {
        const symbol = draftSymbol.trim().toUpperCase();
        if (!symbol) return;
        if (!/^[A-Z0-9.\-^]{1,12}$/.test(symbol)) return;
        if (symbols.includes(symbol)) {
            setDraftSymbol("");
            return;
        }
        const next = [...symbols, symbol].slice(0, 10);
        setDraftSymbol("");
        await syncWatchSymbols(next);
    }, [draftSymbol, symbols, syncWatchSymbols]);

    const removeSymbol = useCallback(
        async (symbol: string) => {
            const next = symbols.filter((s) => s !== symbol);
            if (next.length === 0) return;
            await syncWatchSymbols(next);
        },
        [symbols, syncWatchSymbols],
    );

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const settings = await apiClient.getSettings();
                if (!mounted) return;
                const next = (settings.watch_symbols ?? ["AAPL", "BTC", "VNM"])
                    .map((s) => String(s).toUpperCase())
                    .filter((s) => /^[A-Z0-9.\-^]{1,12}$/.test(s))
                    .slice(0, 10);
                if (next.length > 0) {
                    setSymbols(next);
                    setWatchlist(toFallback(next));
                }
            } catch {
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const symbolsCsv = useMemo(() => symbols.join(","), [symbols]);

    const fetchWatchlist = useCallback(
        async (signal: AbortSignal) => {
            try {
                const res = await fetch(`/api/market/quotes?symbols=${symbolsCsv}`, {
                    signal,
                    cache: "no-store",
                });
                if (!res.ok) throw new Error("watchlist request failed");
                const rows = await res.json();
                const data = Array.isArray(rows) ? rows : [];
                const mapped = data
                    .map((row: { symbol?: string; price?: number; change_percent?: number; name?: string }) => ({
                        symbol: String(row.symbol ?? "").toUpperCase(),
                        price: Number(row.price ?? 0),
                        change: Number(row.change_percent ?? 0),
                        name: String(row.name ?? ""),
                    }))
                    .filter(
                        (row: WatchItem & { name: string }) =>
                            symbols.includes(row.symbol) &&
                            Number.isFinite(row.price) &&
                            row.price > 0 &&
                            !row.name.includes("(Mock)"),
                    )
                    .map((row: WatchItem & { name: string }) => ({
                        symbol: row.symbol,
                        price: row.price,
                        change: row.change,
                    }));

                const cryptoSymbols = symbols.filter((symbol) => isCryptoLikeSymbol(symbol));
                const cryptoMapped = (
                    await Promise.all(
                        cryptoSymbols.map(async (symbol) => {
                            try {
                                const pair = toBinanceSymbol(symbol);
                                if (!pair) return null;
                                const tickerRes = await fetch(`/api/market/binance/ticker/${encodeURIComponent(pair)}`, {
                                    signal,
                                    cache: "no-store",
                                });
                                if (!tickerRes.ok) return null;
                                const ticker = await tickerRes.json();
                                const price = Number(ticker?.last_price || 0);
                                if (!Number.isFinite(price) || price <= 0) return null;
                                return {
                                    symbol,
                                    price,
                                    change: Number(ticker?.price_change_percent || 0),
                                } as WatchItem;
                            } catch {
                                return null;
                            }
                        }),
                    )
                ).filter((row): row is WatchItem => Boolean(row));

                const bySymbol = new Map(mapped.map((item: WatchItem) => [item.symbol, item]));
                for (const row of cryptoMapped) {
                    bySymbol.set(row.symbol, row);
                }
                const result = symbols.map((sym) => bySymbol.get(sym) ?? { symbol: sym, price: 0, change: 0 });
                setWatchlist(result);
                setBackendLive(mapped.length > 0 || cryptoMapped.length > 0);
            } catch {
                setWatchlist(toFallback(symbols));
                setBackendLive(false);
            }
        },
        [symbols, symbolsCsv],
    );

    useVisibilityPolling(fetchWatchlist, 10_000);

    return (
        <div
            style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--sidebar-border)",
                borderBottom: "1px solid var(--sidebar-border)",
            }}
        >
            <div
                style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span>{t("watchlist")}</span>
                <button
                    onClick={() => setEditing((v) => !v)}
                    title="Watchlist Settings"
                    style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                    <RiSettings3Line size={13} />
                </button>
            </div>

            {editing && (
                <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <input
                            className="input"
                            value={draftSymbol}
                            onChange={(e) => setDraftSymbol(e.target.value.toUpperCase())}
                            placeholder="BTC"
                            style={{ height: 30, fontSize: "0.72rem", padding: "6px 8px" }}
                        />
                        <button className="btn" style={{ height: 30, padding: "0 9px" }} onClick={addSymbol}>
                            <RiAddLine size={13} />
                        </button>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {symbols.map((symbol) => (
                            <button
                                key={symbol}
                                onClick={() => removeSymbol(symbol)}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    border: "1px solid var(--border)",
                                    borderRadius: 999,
                                    padding: "2px 7px",
                                    fontSize: "0.66rem",
                                    background: "var(--surface-hover)",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                }}
                            >
                                {symbol}
                                <RiCloseLine size={11} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!backendLive && (
                <div style={{ marginBottom: 8, fontSize: "0.66rem", color: "var(--text-muted)" }}>
                    {t("no_live_data")}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {watchlist.map((item) => (
                    <div
                        key={item.symbol}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.8rem",
                        }}
                    >
                        <span style={{ fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>{item.symbol}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                {item.price <= 0
                                    ? "--"
                                    : item.price >= 1000
                                      ? item.price.toLocaleString(locale, { maximumFractionDigits: 0 })
                                      : item.price.toFixed(2)}
                            </span>
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    color:
                                        item.price <= 0
                                            ? "var(--text-muted)"
                                            : item.change >= 0
                                              ? "#10b981"
                                              : "#ef4444",
                                }}
                            >
                                {item.price <= 0 ? null : item.change >= 0 ? (
                                    <RiArrowUpLine size={12} />
                                ) : (
                                    <RiArrowDownLine size={12} />
                                )}
                                {item.price <= 0 ? "--" : `${Math.abs(item.change).toFixed(2)}%`}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
