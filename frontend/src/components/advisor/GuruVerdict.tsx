"use client";



import { HEALTH_STATUS_CONFIG } from "@/lib/constants";
import { useTranslations } from "next-intl";

interface GuruVerdictProps {
    score: number;
    status: string;
    verdict: string;
    advice: string[];
    wastefulHabits: string[];
    savingsRate: number;
}

export default function GuruVerdict({
    score,
    status,
    verdict,
    advice,
    wastefulHabits,
    savingsRate,
}: GuruVerdictProps) {
    const t = useTranslations("advisor");
    const config = HEALTH_STATUS_CONFIG[status] ?? HEALTH_STATUS_CONFIG.good;

    return (
        <div className="card card-padding animate-slideUp">
            {}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: config.color,
                    boxShadow: `0 0 8px ${config.color}`,
                }} />
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.025em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {t("health_score")}
                </h3>
                <span className="badge" style={{ marginLeft: "auto", background: `color-mix(in srgb, ${config.color} 15%, transparent)`, color: config.color }}>
                    {config.label}
                </span>
            </div>

            {}
            <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
                {}
                <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
                    <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                        <circle
                            cx="60" cy="60" r="52" fill="none"
                            stroke={config.color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${score * 3.267} 326.7`}
                            style={{ transition: "stroke-dasharray 1s ease-out" }}
                        />
                    </svg>
                    <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                    }}>
                        <span style={{ fontSize: "2rem", fontWeight: 800, color: config.color, lineHeight: 1 }}>{score}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500 }}>/ 100</span>
                    </div>
                </div>

                {}
                <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--text)", fontWeight: 400, marginBottom: 16 }}>
                        {verdict}
                    </p>

                    {}
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{t("savings_rate")}</div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: savingsRate >= 20 ? "var(--success)" : "var(--danger)" }}>{savingsRate}%</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{t("health_score")}</div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: config.color }}>{score}/100</div>
                        </div>
                    </div>
                </div>
            </div>

            {}
            {advice.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                        💡 {t("advice")}
                    </h4>
                    <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        {advice.map((a, i) => (
                            <li key={i} style={{
                                fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6,
                                paddingLeft: 16, position: "relative",
                            }}>
                                <span style={{ position: "absolute", left: 0, color: "var(--primary)" }}>→</span>
                                {a}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {}
            {wastefulHabits.length > 0 && (
                <div style={{ marginTop: 20, padding: 16, background: "var(--danger-bg)", borderRadius: "var(--radius)", border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--danger)", marginBottom: 8 }}>
                        🔴 {t("wasteful")}
                    </h4>
                    {wastefulHabits.map((w, i) => (
                        <p key={i} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 4 }}>{w}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
