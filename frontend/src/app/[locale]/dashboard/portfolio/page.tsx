"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { ChartPie, ShieldWarning, TrendUp } from "@phosphor-icons/react";
import type { PortfolioAllocationRow } from "@/lib/types";
import { apiClient } from "@/lib/api";

function asCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function PortfolioPage() {
    const locale = useLocale();

    const [rows, setRows] = useState<PortfolioAllocationRow[]>([]);
    const [watchSymbols, setWatchSymbols] = useState<string[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [riskNote, setRiskNote] = useState("");
    const [loading, setLoading] = useState(true);

    const labels = {
        vi: {
            title: "Danh mục (Portfolio)",
            subtitle: "Theo dõi phân bổ tài sản và độ tập trung rủi ro theo dữ liệu real-time.",
            watch: "Danh sách theo dõi",
            total: "Tổng giá trị tham chiếu",
            concentration: "Tập trung",
            symbol: "Mã",
            price: "Giá",
            change: "24h",
            weight: "Tỷ trọng",
            risk: "Rủi ro",
            loading: "Đang tải dữ liệu danh mục...",
            noData: "Chưa có dữ liệu danh mục.",
        },
        en: {
            title: "Portfolio",
            subtitle: "Track allocation and concentration risk using live market data.",
            watch: "Watchlist",
            total: "Reference Value",
            concentration: "Concentration",
            symbol: "Symbol",
            price: "Price",
            change: "24h",
            weight: "Weight",
            risk: "Risk",
            loading: "Loading portfolio data...",
            noData: "No portfolio data yet.",
        },
        es: {
            title: "Portafolio",
            subtitle: "Monitorea asignacion y concentracion con datos en tiempo real.",
            watch: "Watchlist",
            total: "Valor de referencia",
            concentration: "Concentracion",
            symbol: "Simbolo",
            price: "Precio",
            change: "24h",
            weight: "Peso",
            risk: "Riesgo",
            loading: "Cargando datos del portafolio...",
            noData: "Sin datos de portafolio.",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const payload = await apiClient.getPortfolioOverview();
                if (!mounted) return;
                setRows(payload.allocation || []);
                setWatchSymbols(payload.watch_symbols || []);
                setTotalValue(Number(payload.total_market_value || 0));
                setRiskNote(String(payload.risk_note || ""));
            } catch {
                if (!mounted) return;
                setRows([]);
                setWatchSymbols([]);
                setTotalValue(0);
                setRiskNote("");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const topConcentration = useMemo(() => {
        if (rows.length === 0) return null;
        return [...rows].sort((a, b) => b.weight - a.weight)[0];
    }, [rows]);

    return (
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
            <div className="card card-padding" style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 8 }}>
                    <ChartPie size={26} weight="duotone" style={{ color: "var(--primary)" }} />
                    {t.title}
                </h2>
                <p style={{ color: "var(--text-muted)", marginTop: 6 }}>{t.subtitle}</p>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>{t.watch}</div>
                        <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{watchSymbols.join(", ") || "--"}</div>
                    </div>
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>{t.total}</div>
                        <div style={{ fontWeight: 700 }}>{asCurrency(totalValue)}</div>
                    </div>
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>{t.concentration}</div>
                        <div style={{ fontWeight: 700 }}>
                            {topConcentration ? `${topConcentration.symbol} ${topConcentration.weight.toFixed(1)}%` : "--"}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <ShieldWarning size={18} weight="duotone" style={{ color: "var(--warning)" }} />
                    <strong>{t.risk}</strong>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>{riskNote || "--"}</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
                {loading ? (
                    <div style={{ padding: "20px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>{t.loading}</div>
                ) : rows.length === 0 ? (
                    <div style={{ padding: "20px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>{t.noData}</div>
                ) : (
                    <>
                        <div style={{ overflowX: "auto", marginBottom: 12 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                        {[t.symbol, t.price, t.change, t.weight].map((h) => (
                                            <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.symbol} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "9px 10px", fontWeight: 700 }}>{row.symbol}</td>
                                            <td style={{ padding: "9px 10px" }}>{asCurrency(row.price)}</td>
                                            <td style={{ padding: "9px 10px", color: row.change_percent >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                                {row.change_percent >= 0 ? "+" : ""}{row.change_percent.toFixed(2)}%
                                            </td>
                                            <td style={{ padding: "9px 10px", fontWeight: 700 }}>{row.weight.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: "grid", gap: 7 }}>
                            {rows.map((row) => (
                                <div key={`bar-${row.symbol}`}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, fontSize: "0.77rem" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                            <TrendUp size={12} weight="duotone" style={{ color: "var(--primary)" }} />
                                            {row.symbol}
                                        </span>
                                        <span style={{ fontWeight: 700 }}>{row.weight.toFixed(2)}%</span>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "var(--surface-hover)", overflow: "hidden" }}>
                                        <div style={{ width: `${Math.min(100, row.weight)}%`, height: "100%", background: "linear-gradient(90deg, var(--primary), var(--accent))" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
