"use client";



import { useEffect, useMemo, useState } from "react";
import { RiFlashlightFill, RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import { useConfetti } from "@/lib/useConfetti";
import { WISDOM_QUOTES } from "@/lib/constants";
import { randomItem } from "@/lib/utils";

import SidebarNav from "./sidebar/SidebarNav";
import SidebarWatchlist from "./sidebar/SidebarWatchlist";
import SidebarHealth from "./sidebar/SidebarHealth";
import SidebarProfile from "./sidebar/SidebarProfile";

interface SidebarProps {
    locale: string;
}

export default function Sidebar({ locale }: SidebarProps) {
    const t = useTranslations("nav");
    const tFooter = useTranslations("footer");
    const [collapsed, setCollapsed] = useState(false);
    const wisdom = useMemo(() => {
        const localeKey = (locale in WISDOM_QUOTES ? locale : "en") as keyof typeof WISDOM_QUOTES;
        const quotes = WISDOM_QUOTES[localeKey];
        return quotes[0] ?? randomItem([...quotes]);
    }, [locale]);
    const { goldenMode, handleLogoClick } = useConfetti();

    useEffect(() => {
        const stored = localStorage.getItem("sidebar-collapsed");
        if (stored === "true" || stored === "false") {
            const frame = window.requestAnimationFrame(() => {
                setCollapsed(stored === "true");
            });
            return () => window.cancelAnimationFrame(frame);
        }
    }, []);

    const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        localStorage.setItem("sidebar-collapsed", String(next));
    };

    return (
        <aside
            style={{
                width: collapsed ? 64 : 260,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                background: "var(--sidebar-bg)",
                borderRight: "1px solid var(--sidebar-border)",
                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "sticky",
                top: 0,
                flexShrink: 0,
                zIndex: 30,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                overflow: "hidden",
            }}
        >
            {}
            <div
                onClick={handleLogoClick}
                style={{
                    padding: collapsed ? "16px 12px" : "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    height: 56,
                    borderBottom: "1px solid var(--sidebar-border)",
                    cursor: "pointer",
                    userSelect: "none",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: goldenMode
                            ? "linear-gradient(135deg, #FFD700, #FFA500)"
                            : "var(--gradient)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "white",
                        flexShrink: 0,
                        transition: "all 0.3s ease",
                        boxShadow: goldenMode ? "0 0 20px rgba(255, 215, 0, 0.6)" : "none",
                    }}
                >
                    <RiFlashlightFill size={16} />
                </div>
                {!collapsed && (
                    <span
                        style={{
                            fontSize: "0.95rem",
                            fontWeight: 700,
                            color: goldenMode ? "#FFD700" : "var(--text)",
                            letterSpacing: "-0.02em",
                            whiteSpace: "nowrap",
                            transition: "color 0.3s ease",
                        }}
                    >
                        Nexus<span className="text-gradient">Finance</span>
                    </span>
                )}
            </div>

            {}
            <SidebarNav locale={locale} collapsed={collapsed} />

            {!collapsed && <SidebarWatchlist />}

            <div style={{ flex: 1 }} />

            {!collapsed && <SidebarHealth />}
            {!collapsed && <SidebarProfile />}

            {}
            {!collapsed && (
                <div
                    style={{
                        padding: "8px 16px",
                        borderTop: "1px solid var(--sidebar-border)",
                        fontSize: "0.6rem",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        lineHeight: 1.4,
                        opacity: 0.7,
                    }}
                >
                    <div style={{ marginBottom: 4 }}>💡 {wisdom}</div>

                    {}
                    <div
                        className="group"
                        style={{
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            opacity: 0.3,
                            transition: 'opacity 0.2s',
                            cursor: 'default'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                    >
                        <span>{tFooter("made_with_love")}</span>
                    </div>
                </div>
            )}

            <button
                onClick={toggle}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px 16px",
                    margin: "8px",
                    border: "1px solid var(--sidebar-border)",
                    borderRadius: "var(--radius)",
                    background: "transparent",
                    color: "var(--sidebar-text)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    transition: "all 0.15s ease",
                }}
            >
                {collapsed ? <RiArrowRightSLine size={16} /> : <RiArrowLeftSLine size={16} />}
                {!collapsed && <span>{collapsed ? t("expand") : t("collapse")}</span>}
            </button>
        </aside>
    );
}
