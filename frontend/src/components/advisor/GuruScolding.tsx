"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface GuruScoldingProps {
    expenseCategories: Record<string, number>;
}

export default function GuruScolding({ expenseCategories }: GuruScoldingProps) {
    const t = useTranslations("scolding");
    const alert = useMemo(() => {
        if (!expenseCategories) return null;

        for (const [cat, amount] of Object.entries(expenseCategories)) {
            const lower = cat.toLowerCase();

            if ((lower.includes("gaming") || lower.includes("game") || lower.includes("gacha")) && amount > 10_000_000) {
                return {
                    key: `gaming:${cat}`,
                    message: t("gaming"),
                    subMessage: t("waste_alert", { category: cat }),
                };
            }

            if ((lower.includes("luxury") || lower.includes("xa xỉ") || lower.includes("lujo") || lower.includes("shopping")) && amount > 10_000_000) {
                return {
                    key: `luxury:${cat}`,
                    message: t("luxury"),
                    subMessage: t("waste_alert", { category: cat }),
                };
            }
        }
        return null;
    }, [expenseCategories, t]);

    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    if (!alert || dismissedKey === alert.key) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                animation: "fadeIn 0.3s ease-out",
            }}
            onClick={() => setDismissedKey(alert.key)}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--surface)",
                    border: "2px solid #ef4444",
                    borderRadius: 16,
                    padding: "32px 40px",
                    maxWidth: 420,
                    textAlign: "center",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                    animation: "scaleUp 0.3s ease-out",
                }}
            >
                {}
                <div style={{ fontSize: "3rem", marginBottom: 16 }}>😤</div>

                <h3
                    style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "#ef4444",
                        marginBottom: 8,
                        letterSpacing: "-0.02em",
                    }}
                >
                    {t("title")}
                </h3>

                <p
                    style={{
                        fontSize: "1rem",
                        color: "var(--text)",
                        lineHeight: 1.6,
                        marginBottom: 8,
                        fontWeight: 500,
                    }}
                >
                    {alert.message}
                </p>

                <p
                    style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        marginBottom: 20,
                    }}
                >
                    {alert.subMessage}
                </p>

                <button
                    onClick={() => setDismissedKey(alert.key)}
                    style={{
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        padding: "10px 28px",
                        borderRadius: 8,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "opacity 0.15s ease",
                    }}
                >
                    {t("acknowledge")}
                </button>
            </div>
        </div>
    );
}
