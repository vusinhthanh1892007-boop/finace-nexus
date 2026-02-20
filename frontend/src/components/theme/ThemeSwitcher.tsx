"use client";



import { useState, useEffect } from "react";
import { THEMES } from "@/lib/constants";

type Theme = (typeof THEMES)[number]["id"];

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState<Theme>("pastel");
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("theme") as Theme | null;
        const resolvedTheme = stored && THEMES.some((t) => t.id === stored) ? stored : "pastel";
        const frame = window.requestAnimationFrame(() => {
            setTheme(resolvedTheme);
            setReady(true);
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!ready) return;
        localStorage.setItem("theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
    }, [ready, theme]);

    const switchTheme = (t: Theme) => {
        setTheme(t);
    };

    return (
        <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)" }}>
            {THEMES.map((t) => (
                <button
                    key={t.id}
                    onClick={() => switchTheme(t.id)}
                    title={t.label}
                    style={{
                        padding: "4px 8px",
                        borderRadius: "calc(var(--radius) - 2px)",
                        border: "none",
                        background: theme === t.id ? "var(--surface-hover)" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        transition: "all 0.15s ease",
                        lineHeight: 1,
                        opacity: theme === t.id ? 1 : 0.6,
                    }}
                >
                    {t.icon}
                </button>
            ))}
        </div>
    );
}
