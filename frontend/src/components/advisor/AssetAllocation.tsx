"use client";



import { CHART_COLORS } from "@/lib/constants";
import { formatCompact } from "@/lib/utils";
import { useTranslations } from "next-intl";

const GLOBAL_MARKET_DATA = [
    { category: "Global Equities", percentage: 45, amount: 110_000_000_000_000, rationale: "Developed & Emerging Markets" },
    { category: "Fixed Income", percentage: 35, amount: 130_000_000_000_000, rationale: "Government & Corporate Bonds" },
    { category: "Real Estate", percentage: 15, amount: 300_000_000_000_000, rationale: "Commercial & Residential" },
    { category: "Alternatives", percentage: 5, amount: 20_000_000_000_000, rationale: "Crypto, Gold, Private Equity" },
];

interface AssetAllocationProps {
    allocations?: Array<{
        category: string;
        percentage: number;
        amount: number;
        rationale: string;
    }>;
    investableAmount?: number;
}

export default function AssetAllocation({ allocations, investableAmount }: AssetAllocationProps) {
    const t = useTranslations("advisor");
    const chartData =
        allocations && allocations.length > 0
            ? allocations
            : GLOBAL_MARKET_DATA;
    const totalAmount = chartData.reduce((sum, item) => sum + item.amount, 0);

    const size = 180;
    const center = size / 2;
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const segments = chartData.reduce<Array<{ index: number; segmentLength: number; offset: number }>>(
        (acc, item, index) => {
            const accumulated = chartData
                .slice(0, index)
                .reduce((sum, row) => sum + row.percentage, 0);
            const segmentLength = (item.percentage / 100) * circumference;
            const offset = circumference - (accumulated / 100) * circumference;
            acc.push({ index, segmentLength, offset });
            return acc;
        },
        [],
    );

    return (
        <div className="card card-padding animate-slideUp" style={{ animationDelay: "0.2s" }}>
            {}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.25rem" }}>🌍</span>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.025em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        {t("asset_allocation")}
                    </h3>
                </div>
                <span className="badge badge-success" title="Total Global Value">{formatCompact(totalAmount).replace("₫", "$")}</span>
            </div>

            {}
            <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                {}
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                    {segments.map(({ index, segmentLength, offset }) => {
                        return (
                            <circle
                                key={index}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                strokeWidth="20"
                                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                                strokeDashoffset={offset}
                                style={{
                                    transform: "rotate(-90deg)",
                                    transformOrigin: "center",
                                    transition: "stroke-dasharray 0.8s ease-out",
                                }}
                            />
                        );
                    })}
                    {}
                    <text x={center} y={center - 6} textAnchor="middle" style={{ fontSize: "0.75rem", fill: "var(--text-muted)", fontWeight: 500 }}>
                        Market
                    </text>
                    <text x={center} y={center + 14} textAnchor="middle" style={{ fontSize: "1rem", fill: "var(--text)", fontWeight: 700 }}>
                        100%
                    </text>
                </svg>

                {}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 180 }}>
                    {chartData.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                                background: CHART_COLORS[i % CHART_COLORS.length],
                            }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{item.category}</span>
                                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>{item.percentage}%</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.rationale}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 500 }}>
                                        {formatCompact(item.amount).replace('₫', '$')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {investableAmount !== undefined && (
                <div style={{ marginTop: 16, fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
                    {t("invest")}: {formatCompact(investableAmount)}
                </div>
            )}
        </div>
    );
}
