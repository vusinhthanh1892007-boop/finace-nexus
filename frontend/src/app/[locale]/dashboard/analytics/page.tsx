"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Pulse, ChartLineUp, LinkSimple, WarningDiamond } from "@phosphor-icons/react";
import type { AnalyticsResponse } from "@/lib/types";
import { apiClient } from "@/lib/api";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "SPX", "DOW", "GOLD"];

export default function AnalyticsPage() {
    const locale = useLocale();

    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS.join(","));

    const labels = {
        vi: {
            title: "Phân tích (Analytics)",
            subtitle: "Bảng phân tích biến động, động lượng và rủi ro tương quan theo dữ liệu hiện tại.",
            volatility: "Biến động 24h",
            momentum: "Động lượng 7 ngày",
            correlation: "Rủi ro tương quan",
            score: "Điểm",
            level: "Mức",
            low: "Thấp",
            medium: "Trung bình",
            high: "Cao",
            loading: "Đang tải dữ liệu phân tích...",
            noData: "Không có dữ liệu phân tích.",
            symbols: "Danh sách mã",
            apply: "Áp dụng",
            riskHighHint: "Biến động đang đồng pha mạnh. Cần đa dạng hóa sang tài sản tương quan thấp.",
            riskMediumHint: "Mức đồng pha trung bình. Nên kiểm soát chặt tỷ trọng vị thế.",
            riskLowHint: "Rủi ro tương quan hiện ở mức thấp.",
        },
        en: {
            title: "Analytics",
            subtitle: "Volatility, momentum and correlation risk from current market data.",
            volatility: "24h Volatility",
            momentum: "7d Momentum",
            correlation: "Correlation Risk",
            score: "Score",
            level: "Level",
            low: "Low",
            medium: "Medium",
            high: "High",
            loading: "Loading analytics data...",
            noData: "No analytics data.",
            symbols: "Symbols",
            apply: "Apply",
            riskHighHint: "Market moves are highly synchronized. Diversify across uncorrelated assets.",
            riskMediumHint: "Moderate synchronization detected. Keep position sizing disciplined.",
            riskLowHint: "Correlation risk is currently low.",
        },
        es: {
            title: "Analitica",
            subtitle: "Volatilidad, momentum y riesgo de correlacion con datos actuales.",
            volatility: "Volatilidad 24h",
            momentum: "Momentum 7d",
            correlation: "Riesgo de correlacion",
            score: "Puntaje",
            level: "Nivel",
            low: "Bajo",
            medium: "Medio",
            high: "Alto",
            loading: "Cargando analitica...",
            noData: "Sin datos de analitica.",
            symbols: "Simbolos",
            apply: "Aplicar",
            riskHighHint: "Los movimientos estan muy sincronizados. Diversifica en activos menos correlacionados.",
            riskMediumHint: "Sincronizacion moderada detectada. Controla el tamano de posiciones.",
            riskLowHint: "El riesgo de correlacion es bajo actualmente.",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const load = useCallback(async (symbolsCsv: string) => {
        setLoading(true);
        try {
            const items = symbolsCsv
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
                .slice(0, 8);
            const payload = await apiClient.getAnalytics(items.length > 0 ? items : DEFAULT_SYMBOLS);
            setData(payload);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(DEFAULT_SYMBOLS.join(","));
    }, [load]);

    const riskColor = useMemo(() => {
        if (!data) return "var(--text-muted)";
        if (data.correlation_risk.level === "high") return "var(--danger)";
        if (data.correlation_risk.level === "medium") return "var(--warning)";
        return "var(--success)";
    }, [data]);

    const levelLabel = useMemo(() => {
        if (!data) return "--";
        if (data.correlation_risk.level === "high") return t.high;
        if (data.correlation_risk.level === "medium") return t.medium;
        return t.low;
    }, [data, t.high, t.low, t.medium]);

    return (
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
            <div className="card card-padding" style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{t.title}</h2>
                <p style={{ color: "var(--text-muted)", marginTop: 6 }}>{t.subtitle}</p>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="input" value={symbols} onChange={(e) => setSymbols(e.target.value.toUpperCase())} placeholder="BTC,ETH,SPX" />
                    <button className="btn btn-primary" onClick={() => void load(symbols)}>{t.apply}</button>
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>{t.symbols}</div>
            </div>

            {loading ? (
                <div className="card" style={{ padding: 14, color: "var(--text-muted)", fontSize: "0.85rem" }}>{t.loading}</div>
            ) : !data ? (
                <div className="card" style={{ padding: 14, color: "var(--text-muted)", fontSize: "0.85rem" }}>{t.noData}</div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 12 }}>
                    <div className="card" style={{ padding: 14 }}>
                        <h3 style={{ margin: 0, marginBottom: 10, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                            <Pulse size={18} weight="duotone" style={{ color: "var(--primary)" }} />
                            {t.volatility}
                        </h3>
                        <div style={{ display: "grid", gap: 8 }}>
                            {data.volatility_24h.slice(0, 6).map((row) => (
                                <div key={row.symbol} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                                    <strong>{row.symbol}</strong>
                                    <span style={{ color: row.change_percent >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                        {row.change_percent >= 0 ? "+" : ""}{row.change_percent.toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 14 }}>
                        <h3 style={{ margin: 0, marginBottom: 10, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                            <ChartLineUp size={18} weight="duotone" style={{ color: "var(--success)" }} />
                            {t.momentum}
                        </h3>
                        <div style={{ display: "grid", gap: 8 }}>
                            {data.momentum_7d.slice(0, 6).map((row) => (
                                <div key={row.symbol} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                                    <strong>{row.symbol}</strong>
                                    <span style={{ color: row.momentum_7d >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                        {row.momentum_7d >= 0 ? "+" : ""}{row.momentum_7d.toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 14 }}>
                        <h3 style={{ margin: 0, marginBottom: 10, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                            <LinkSimple size={18} weight="duotone" style={{ color: "var(--warning)" }} />
                            {t.correlation}
                        </h3>

                        <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                                <span>{t.score}</span>
                                <strong>{data.correlation_risk.score.toFixed(2)}</strong>
                            </div>
                            <div style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                                <span>{t.level}</span>
                                <strong style={{ color: riskColor }}>{levelLabel}</strong>
                            </div>
                            <div style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-hover)", display: "flex", alignItems: "center", gap: 8, color: riskColor }}>
                                <WarningDiamond size={16} weight="duotone" />
                                    <span style={{ fontSize: "0.82rem" }}>
                                        {data.correlation_risk.level === "high"
                                        ? t.riskHighHint
                                        : data.correlation_risk.level === "medium"
                                          ? t.riskMediumHint
                                          : t.riskLowHint}
                                    </span>
                                </div>
                            </div>
                    </div>
                </div>
            )}
        </div>
    );
}
