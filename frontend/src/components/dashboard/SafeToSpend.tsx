"use client";

import { useTranslations } from "next-intl";
import {
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    XCircleIcon,
    InformationCircleIcon,
} from "@heroicons/react/24/outline";
import type { LedgerResult } from "@/lib/types";

interface SafeToSpendProps {
    result: LedgerResult | null;
    loading: boolean;
}

const STATUS_CONFIG = {
    healthy: {
        Icon: ShieldCheckIcon,
        color: "var(--success)",
        bg: "color-mix(in srgb, var(--success) 18%, transparent)",
    },
    warning: {
        Icon: ExclamationTriangleIcon,
        color: "var(--warning)",
        bg: "color-mix(in srgb, var(--warning) 18%, transparent)",
    },
    critical: {
        Icon: ExclamationCircleIcon,
        color: "var(--danger)",
        bg: "color-mix(in srgb, var(--danger) 18%, transparent)",
    },
    over_budget: {
        Icon: XCircleIcon,
        color: "var(--danger)",
        bg: "color-mix(in srgb, var(--danger) 18%, transparent)",
    },
} as const;

export default function SafeToSpend({ result, loading }: SafeToSpendProps) {
    const t = useTranslations("safeToSpend");

    if (!result) {
        return (
            <div
                className="card flex flex-col items-center justify-center animate-fadeIn"
                style={{
                    minHeight: "400px",
                }}
            >
                <InformationCircleIcon
                    className="h-12 w-12 mb-4"
                    style={{ color: "var(--text-muted)" }}
                />
                <p
                    className="text-sm font-medium text-center"
                    style={{ color: "var(--text-muted)" }}
                >
                    {t("enterData")}
                </p>
            </div>
        );
    }

    const config = STATUS_CONFIG[result.status];
    const StatusIcon = config.Icon;
    const usedPct = Math.min(Math.max(result.budget_utilization, 0), 100);
    const donutTrack = `conic-gradient(${config.color} ${usedPct}%, var(--border) 0)`;

    return (
        <div
            className={`card animate-slideUp ${loading ? "opacity-70" : ""}`}
            style={{
                transition: "opacity 0.2s ease",
                padding: 20,
            }}
        >
            {}
            <div className="mb-6">
                <h2
                    className="text-xl font-bold"
                    style={{ color: "var(--text)" }}
                >
                    {t("title")}
                </h2>
                <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--text-muted)" }}
                >
                    {t("subtitle")}
                </p>
            </div>

            {}
            <div
                className="mb-6 rounded-xl p-6 text-center"
                style={{
                    background: config.bg,
                    opacity: 0.95,
                }}
            >
                <div className="flex items-center justify-center gap-2 mb-2">
                    <StatusIcon className="h-5 w-5" style={{ color: config.color }} />
                    <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        {t("amount")}
                    </span>
                </div>
                <p className="text-4xl font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
                    ${result.safe_to_spend.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
            </div>

            {}
            <div className="mb-6 flex justify-center">
                <div
                    aria-label="Budget utilization donut"
                    style={{
                        width: 144,
                        height: 144,
                        borderRadius: "50%",
                        background: donutTrack,
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    <div
                        style={{
                            width: 104,
                            height: 104,
                            borderRadius: "50%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            display: "grid",
                            placeItems: "center",
                            color: "var(--text)",
                            fontWeight: 800,
                            fontSize: "1.25rem",
                        }}
                    >
                        {usedPct.toFixed(0)}%
                    </div>
                </div>
            </div>

            {}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: "var(--text-muted)" }}>
                        {t("budgetUtilization")}
                    </span>
                    <span
                        className="font-semibold"
                        style={{ color: config.color }}
                    >
                        {result.budget_utilization.toFixed(1)}%
                    </span>
                </div>
                <div
                    style={{
                        height: 8,
                        borderRadius: 9999,
                        background: "var(--border)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${usedPct}%`,
                            height: "100%",
                            background: config.color,
                            transition: "width 220ms ease",
                        }}
                    />
                </div>
            </div>

            {}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div
                    className="rounded-lg p-3"
                    style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                    }}
                >
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        {t("remainingBudget")}
                    </p>
                    <p
                        className="text-lg font-bold"
                        style={{
                            color:
                                result.remaining_budget >= 0
                                    ? "var(--success)"
                                    : "var(--danger)",
                        }}
                    >
                        ${result.remaining_budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div
                    className="rounded-lg p-3"
                    style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                    }}
                >
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        {t("savingsPotential")}
                    </p>
                    <p
                        className="text-lg font-bold"
                        style={{
                            color:
                                result.savings_potential >= 0
                                    ? "var(--success)"
                                    : "var(--danger)",
                        }}
                    >
                        ${result.savings_potential.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {}
            <div
                className="flex items-start gap-2 rounded-lg p-3 text-sm"
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                }}
            >
                <StatusIcon
                    className="h-4 w-4 mt-0.5 flex-shrink-0"
                    style={{ color: config.color }}
                />
                <div>
                    <span
                        className="font-semibold"
                        style={{ color: config.color }}
                    >
                        {t(result.status === "over_budget" ? "overBudget" : result.status)}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                        {" — "}
                        {result.status_message}
                    </span>
                </div>
            </div>
        </div>
    );
}
