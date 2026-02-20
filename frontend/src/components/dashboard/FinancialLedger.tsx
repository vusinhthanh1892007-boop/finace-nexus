"use client";



import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { LedgerResult, BudgetStatus } from "@/lib/types";
import { formatVND, getStatusColor } from "@/lib/utils";

type LedgerViewMode = "stats" | "bar" | "pie" | "line" | "table";


function clientFallback(income: number, expenses: number, budget: number): LedgerResult {
    const remaining = budget - expenses;
    const util = budget > 0 ? (expenses / budget) * 100 : 0;
    let status: BudgetStatus = "healthy";
    if (util > 100) status = "over_budget";
    else if (util >= 90) status = "critical";
    else if (util >= 70) status = "warning";

    return {
        safe_to_spend: Math.max(remaining, 0),
        budget_utilization: Math.round(util * 100) / 100,
        remaining_budget: remaining,
        savings_potential: income - budget,
        status,
        status_message: status,
        calculated_at: new Date().toISOString(),
    };
}

const CHART_COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];

function percent(value: number, total: number): string {
    if (total <= 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
}

export default function FinancialLedger() {
    const locale = useLocale();
    const t = useTranslations("dashboard");

    const labels = {
        vi: {
            advancedTitle: "Thống kê sổ cái",
            advancedSubtitle: "Chọn dạng hiển thị dữ liệu: thẻ số liệu, biểu đồ cột/tròn/đường hoặc bảng chi tiết.",
            stats: "Số liệu",
            bar: "Cột",
            pie: "Tròn",
            line: "Đường",
            table: "Bảng",
            sectionStats: "Tổng quan ngân sách",
            sectionChart: "Phân bổ chi tiêu",
            sectionTrend: "Xu hướng mô phỏng 6 kỳ",
            sectionTable: "Bảng chi tiết hạng mục",
            category: "Hạng mục",
            amount: "Giá trị",
            ratio: "Tỷ trọng",
            period: "Kỳ",
            incomeSeries: "Thu nhập",
            expenseSeries: "Chi tiêu",
            budgetSeries: "Ngân sách",
            spentSeries: "Đã dùng",
            remainingSeries: "Còn lại",
            overshootSeries: "Vượt ngân sách",
            essentials: "Nhu cầu thiết yếu",
            housing: "Nhà ở",
            transport: "Di chuyển",
            lifestyle: "Linh hoạt",
            reserve: "Dự phòng",
            noChart: "Dữ liệu chưa sẵn sàng",
            recentCalc: "Tính lần cuối",
        },
        en: {
            advancedTitle: "Ledger Analytics",
            advancedSubtitle: "Switch between KPI cards, bar/pie/line charts, and detailed table view.",
            stats: "Stats",
            bar: "Bar",
            pie: "Pie",
            line: "Line",
            table: "Table",
            sectionStats: "Budget Overview",
            sectionChart: "Spending Allocation",
            sectionTrend: "6-period Simulation Trend",
            sectionTable: "Detailed Category Table",
            category: "Category",
            amount: "Amount",
            ratio: "Ratio",
            period: "Period",
            incomeSeries: "Income",
            expenseSeries: "Expenses",
            budgetSeries: "Budget",
            spentSeries: "Spent",
            remainingSeries: "Remaining",
            overshootSeries: "Over Budget",
            essentials: "Essentials",
            housing: "Housing",
            transport: "Transport",
            lifestyle: "Lifestyle",
            reserve: "Reserve",
            noChart: "No chart data",
            recentCalc: "Last calculated",
        },
        es: {
            advancedTitle: "Analitica del Libro",
            advancedSubtitle: "Cambia entre KPIs, graficos de barras/pastel/linea y tabla detallada.",
            stats: "Metricas",
            bar: "Barras",
            pie: "Pastel",
            line: "Linea",
            table: "Tabla",
            sectionStats: "Resumen del Presupuesto",
            sectionChart: "Distribucion de Gastos",
            sectionTrend: "Tendencia simulada de 6 periodos",
            sectionTable: "Tabla detallada por categoria",
            category: "Categoria",
            amount: "Monto",
            ratio: "Proporcion",
            period: "Periodo",
            incomeSeries: "Ingresos",
            expenseSeries: "Gastos",
            budgetSeries: "Presupuesto",
            spentSeries: "Gastado",
            remainingSeries: "Restante",
            overshootSeries: "Sobre presupuesto",
            essentials: "Necesidades",
            housing: "Vivienda",
            transport: "Transporte",
            lifestyle: "Estilo de vida",
            reserve: "Reserva",
            noChart: "Sin datos de grafico",
            recentCalc: "Ultimo calculo",
        },
    } as const;

    const l = labels[locale as keyof typeof labels] ?? labels.en;

    const [income, setIncome] = useState(80_000_000);
    const [expenses, setExpenses] = useState(52_000_000);
    const [budget, setBudget] = useState(60_000_000);
    const [result, setResult] = useState<LedgerResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<LedgerViewMode>("stats");
    const [chartReady, setChartReady] = useState(false);

    const calculate = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ledger/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ income, actual_expenses: expenses, planned_budget: budget }),
            });
            if (!res.ok) throw new Error("API error");
            setResult(await res.json());
        } catch {
            setResult(clientFallback(income, expenses, budget));
        } finally {
            setLoading(false);
        }
    }, [income, expenses, budget]);

    useEffect(() => {
        const timer = setTimeout(calculate, 300);
        return () => clearTimeout(timer);
    }, [calculate]);

    useEffect(() => {
        setChartReady(true);
    }, []);

    const statusColor = result ? getStatusColor(result.status) : "var(--text-muted)";

    const categoryData = useMemo(() => {
        const total = Math.max(expenses, 0);
        const essentials = Math.round(total * 0.42);
        const housing = Math.round(total * 0.28);
        const transport = Math.round(total * 0.14);
        const lifestyle = Math.round(total * 0.1);
        const reserve = Math.max(total - essentials - housing - transport - lifestyle, 0);

        return [
            { key: "essentials", category: l.essentials, amount: essentials },
            { key: "housing", category: l.housing, amount: housing },
            { key: "transport", category: l.transport, amount: transport },
            { key: "lifestyle", category: l.lifestyle, amount: lifestyle },
            { key: "reserve", category: l.reserve, amount: reserve },
        ];
    }, [expenses, l.essentials, l.housing, l.transport, l.lifestyle, l.reserve]);

    const pieData = useMemo(() => {
        const rows: Array<{ name: string; value: number }> = [
            { name: l.spentSeries, value: Math.max(expenses, 0) },
            { name: l.remainingSeries, value: Math.max((result?.remaining_budget ?? budget - expenses), 0) },
        ];
        const overshoot = Math.max((expenses - budget), 0);
        if (overshoot > 0) rows.push({ name: l.overshootSeries, value: overshoot });
        return rows.filter((row) => row.value > 0);
    }, [budget, expenses, l.overshootSeries, l.remainingSeries, l.spentSeries, result?.remaining_budget]);

    const trendData = useMemo(() => {
        const points = [0.84, 0.9, 0.96, 1, 1.05, 1.1];
        return points.map((factor, idx) => ({
            period: `T-${points.length - idx - 1}`,
            income: Math.round(income * factor),
            expenses: Math.round(expenses * (factor * 0.98 + 0.02)),
            budget: Math.round(budget * (factor * 0.99 + 0.01)),
        }));
    }, [budget, expenses, income]);

    const summaryData = useMemo(() => {
        if (!result) return [];
        return [
            { key: "income", label: t("income"), value: income, color: "var(--primary)" },
            { key: "expenses", label: t("expenses"), value: expenses, color: "var(--danger)" },
            { key: "budget", label: t("budget"), value: budget, color: "var(--warning)" },
            { key: "safe", label: t("safeToSpend"), value: result.safe_to_spend, color: statusColor },
            { key: "remaining", label: t("remaining"), value: result.remaining_budget, color: result.remaining_budget >= 0 ? "var(--success)" : "var(--danger)" },
            { key: "savings", label: t("savings"), value: result.savings_potential, color: result.savings_potential >= 0 ? "var(--success)" : "var(--danger)" },
        ];
    }, [budget, expenses, income, result, statusColor, t]);

    const tooltipFormatter = (value: number | string | undefined) => formatVND(Number(value ?? 0));
    const compactAxisFormatter = (value: number | string) => `${Math.round(Number(value) / 1_000_000)}M`;

    return (
        <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card card-padding">
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20, letterSpacing: "-0.02em" }}>{t("title")}</h2>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                    {[
                        { label: t("income"), value: income, set: setIncome },
                        { label: t("expenses"), value: expenses, set: setExpenses },
                        { label: t("budget"), value: budget, set: setBudget },
                    ].map(({ label, value, set }) => (
                        <div key={label}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                                {label}
                            </label>
                            <input
                                type="number"
                                className="input"
                                value={value}
                                onChange={(e) => set(Number(e.target.value) || 0)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {result && (
                <div className="card card-padding animate-scaleIn">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
                            {t("safeToSpend")}
                        </h3>
                        {loading && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto" }}>{t("updating")}</span>}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: "2.5rem", fontWeight: 800, color: statusColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
                            {formatVND(result.safe_to_spend)}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>
                            {t(`status.${result.status}`)}
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>{t("utilization")}</span>
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: statusColor }}>{result.budget_utilization}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-hover)", overflow: "hidden" }}>
                            <div style={{
                                height: "100%",
                                width: `${Math.min(result.budget_utilization, 100)}%`,
                                borderRadius: 3,
                                background: statusColor,
                                transition: "width 0.6s ease-out",
                            }} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                        {[
                            { label: t("remaining"), value: formatVND(result.remaining_budget), color: result.remaining_budget >= 0 ? "var(--success)" : "var(--danger)" },
                            { label: t("savings"), value: formatVND(result.savings_potential), color: result.savings_potential >= 0 ? "var(--success)" : "var(--danger)" },
                            { label: t("utilization"), value: `${result.budget_utilization}%`, color: statusColor },
                        ].map(({ label, value, color }) => (
                            <div key={label}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {result && (
                <div className="card card-padding animate-fadeIn">
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{l.advancedTitle}</h3>
                            <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.advancedSubtitle}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[
                                { key: "stats", label: l.stats },
                                { key: "bar", label: l.bar },
                                { key: "pie", label: l.pie },
                                { key: "line", label: l.line },
                                { key: "table", label: l.table },
                            ].map((view) => (
                                <button
                                    key={view.key}
                                    className={`btn ${viewMode === view.key ? "btn-primary" : ""}`}
                                    style={{ padding: "6px 10px", fontSize: "0.74rem" }}
                                    onClick={() => setViewMode(view.key as LedgerViewMode)}
                                >
                                    {view.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {viewMode === "stats" && (
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>{l.sectionStats}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                                {summaryData.map((row) => (
                                    <div key={row.key} className="card" style={{ padding: 10 }}>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</div>
                                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: row.color, marginTop: 4 }}>{formatVND(row.value)}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                {l.recentCalc}: {new Date(result.calculated_at).toLocaleString(locale)}
                            </div>
                        </div>
                    )}

                    {viewMode === "bar" && (
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>{l.sectionChart}</div>
                            <div style={{ width: "100%", height: 310 }}>
                                {chartReady ? (
                                    <ResponsiveContainer>
                                        <BarChart data={categoryData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--border) 70%, transparent)" />
                                            <XAxis dataKey="category" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={compactAxisFormatter} />
                                            <Tooltip formatter={tooltipFormatter} />
                                            <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                                {categoryData.map((entry, idx) => (
                                                    <Cell key={`${entry.key}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="skeleton" style={{ height: 300 }} />
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === "pie" && (
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>{l.sectionChart}</div>
                            <div style={{ width: "100%", height: 320 }}>
                                {chartReady ? (
                                    pieData.length > 0 ? (
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={104} label>
                                                    {pieData.map((entry, idx) => (
                                                        <Cell key={`${entry.name}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={tooltipFormatter} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{l.noChart}</div>
                                    )
                                ) : (
                                    <div className="skeleton" style={{ height: 300 }} />
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === "line" && (
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>{l.sectionTrend}</div>
                            <div style={{ width: "100%", height: 320 }}>
                                {chartReady ? (
                                    <ResponsiveContainer>
                                        <LineChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--border) 70%, transparent)" />
                                            <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={compactAxisFormatter} />
                                            <Tooltip formatter={tooltipFormatter} />
                                            <Line type="monotone" dataKey="income" stroke="#3b82f6" strokeWidth={2.2} dot={false} name={l.incomeSeries} />
                                            <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.2} dot={false} name={l.expenseSeries} />
                                            <Line type="monotone" dataKey="budget" stroke="#f59e0b" strokeWidth={2.2} dot={false} name={l.budgetSeries} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="skeleton" style={{ height: 300 }} />
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === "table" && (
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>{l.sectionTable}</div>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                            <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.72rem" }}>{l.category}</th>
                                            <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.72rem" }}>{l.amount}</th>
                                            <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.72rem" }}>{l.ratio}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryData.map((row) => (
                                            <tr key={row.key} style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td style={{ padding: "9px 10px", fontWeight: 600 }}>{row.category}</td>
                                                <td style={{ padding: "9px 10px" }}>{formatVND(row.amount)}</td>
                                                <td style={{ padding: "9px 10px", color: "var(--text-secondary)" }}>{percent(row.amount, expenses)}</td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td style={{ padding: "9px 10px", fontWeight: 700 }}>{t("expenses")}</td>
                                            <td style={{ padding: "9px 10px", fontWeight: 700 }}>{formatVND(expenses)}</td>
                                            <td style={{ padding: "9px 10px", fontWeight: 700 }}>100%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
