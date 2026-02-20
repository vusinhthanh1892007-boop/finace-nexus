"use client";



import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getStatusColor } from "@/lib/utils";

export default function SidebarHealth() {
    const t = useTranslations("sidebar");
    const tDash = useTranslations("dashboard.status");
    const [healthScore, setHealthScore] = useState(72);

    useEffect(() => {
        const storedBudget = localStorage.getItem("nexus-budget");
        if (!storedBudget) return;
        try {
            const { actual_expenses, planned_budget } = JSON.parse(storedBudget);
            if (planned_budget > 0) {
                const util = (actual_expenses / planned_budget) * 100;
                const frame = window.requestAnimationFrame(() => {
                    setHealthScore(Math.max(0, Math.min(100, Math.round(100 - util))));
                });
                return () => window.cancelAnimationFrame(frame);
            }
        } catch {
            
        }
    }, []);

    const healthStatus =
        healthScore >= 70 ? "healthy" : healthScore >= 40 ? "warning" : "critical";
    const healthColor = getStatusColor(healthStatus);

    const circleR = 18;
    const circumference = 2 * Math.PI * circleR;
    const offset = circumference - (healthScore / 100) * circumference;

    return (
        <div
            style={{
                padding: "16px",
                borderTop: "1px solid var(--sidebar-border)",
                display: "flex",
                alignItems: "center",
                gap: 12,
            }}
        >
            <svg width={48} height={48} viewBox="0 0 48 48">
                <circle
                    cx={24}
                    cy={24}
                    r={circleR}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={3}
                />
                <circle
                    cx={24}
                    cy={24}
                    r={circleR}
                    fill="none"
                    stroke={healthColor}
                    strokeWidth={3}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                        transition: "stroke-dashoffset 1s ease-out",
                    }}
                />
                <text
                    x={24}
                    y={26}
                    textAnchor="middle"
                    style={{
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        fill: healthColor,
                    }}
                >
                    {healthScore}
                </text>
            </svg>
            <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)" }}>
                    {t("health")}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                    {healthScore >= 70
                        ? tDash("healthy")
                        : healthScore >= 40
                            ? tDash("warning")
                            : tDash("critical")}
                </div>
            </div>
        </div>
    );
}
