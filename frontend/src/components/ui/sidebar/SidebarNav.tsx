"use client";



import {
    RiDashboardLine,
    RiBrainLine,
    RiGlobalLine,
    RiPieChartLine,
    RiBarChartBoxLine,
    RiExchangeDollarLine,
    RiSettings4Line,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NavItem } from "@/lib/types";

interface SidebarNavProps {
    locale: string;
    collapsed: boolean;
}

export default function SidebarNav({ locale, collapsed }: SidebarNavProps) {
    const pathname = usePathname();
    const t = useTranslations("nav");

    const mainItems: NavItem[] = [
        {
            href: `/${locale}/dashboard`,
            icon: <RiDashboardLine size={20} />,
            label: t("dashboard"),
        },
    ];

    const analysisItems: NavItem[] = [
        {
            href: `/${locale}/dashboard/advisor`,
            icon: <RiBrainLine size={20} />,
            label: t("advisor"),
        },
        {
            href: `/${locale}/dashboard/global-map`,
            icon: <RiGlobalLine size={20} />,
            label: t("global_map"),
        },
        {
            href: `/${locale}/dashboard/portfolio`,
            icon: <RiPieChartLine size={20} />,
            label: t("portfolio"),
        },
        {
            href: `/${locale}/dashboard/analytics`,
            icon: <RiBarChartBoxLine size={20} />,
            label: t("analytics"),
        },
    ];

    const marketItems: NavItem[] = [
        {
            href: `/${locale}/dashboard/trading`,
            icon: <RiExchangeDollarLine size={20} />,
            label: t("trading"),
            badge: "PRO",
        },
        {
            href: `/${locale}/dashboard/settings`,
            icon: <RiSettings4Line size={20} />,
            label: t("settings"),
        },
    ];

    const isActive = (href: string) => {
        if (href.endsWith("/dashboard")) return pathname === href;
        return pathname.startsWith(href);
    };

    const renderItem = (item: NavItem) => {
        const active = isActive(item.href);
        return (
            <Link
                key={item.href}
                href={item.href}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--text)" : "var(--sidebar-text)",
                    background: active ? "var(--surface-hover)" : "transparent",
                    transition: "all 0.15s ease",
                    position: "relative",
                    justifyContent: collapsed ? "center" : "flex-start",
                }}
            >
                <span
                    className={active ? "icon-glow" : ""}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        color: active ? "var(--sidebar-active)" : "var(--sidebar-text)",
                        flexShrink: 0,
                        transition: "color 0.15s ease",
                    }}
                >
                    {item.icon}
                </span>
                {!collapsed && (
                    <>
                        <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
                        {item.badge && (
                            <span
                                style={{
                                    marginLeft: "auto",
                                    fontSize: "0.55rem",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 9999,
                                    background: "linear-gradient(135deg, var(--primary), #8b5cf6)",
                                    color: "white",
                                    lineHeight: 1.3,
                                    letterSpacing: "0.08em",
                                }}
                            >
                                {item.badge}
                            </span>
                        )}
                    </>
                )}
                {!collapsed && active && item.href.endsWith("/global-map") && (
                    <span
                        style={{
                            position: "absolute",
                            right: 10,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--primary)",
                        }}
                    />
                )}
            </Link>
        );
    };

    return (
        <nav style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {mainItems.map(renderItem)}

            {!collapsed && (
                <div style={{ marginTop: 8, padding: "8px 12px 4px", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {t("analysis")}
                </div>
            )}
            {analysisItems.map(renderItem)}

            {!collapsed && (
                <div style={{ marginTop: 8, padding: "8px 12px 4px", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {t("market_section")}
                </div>
            )}
            {marketItems.map(renderItem)}
        </nav>
    );
}
