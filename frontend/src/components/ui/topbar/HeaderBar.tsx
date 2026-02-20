"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import TaskbarActions from "./TaskbarActions";

export default function HeaderBar() {
    const pathname = usePathname();
    const locale = useLocale();

    const title = useMemo(() => {
        const labels = {
            vi: {
                dashboard: "Bảng điều khiển",
                advisor: "Cố vấn AI",
                globalMap: "Bản đồ Đầu tư Toàn cầu",
                portfolio: "Danh mục Đầu tư",
                analytics: "Phân tích thị trường",
                marketNews: "Tin tức thị trường",
                trading: "Giao dịch",
                settings: "Cài đặt",
            },
            en: {
                dashboard: "Dashboard",
                advisor: "AI Advisor",
                globalMap: "Global Investment Map",
                portfolio: "Portfolio",
                analytics: "Market Analytics",
                marketNews: "Market News",
                trading: "Trading",
                settings: "Settings",
            },
            es: {
                dashboard: "Panel",
                advisor: "Asesor IA",
                globalMap: "Mapa de Inversion Global",
                portfolio: "Portafolio",
                analytics: "Analitica de Mercado",
                marketNews: "Noticias de Mercado",
                trading: "Trading",
                settings: "Configuracion",
            },
        } as const;

        const t = labels[locale as keyof typeof labels] ?? labels.en;

        if (pathname.endsWith("/dashboard/global-map")) return t.globalMap;
        if (pathname.endsWith("/dashboard/portfolio")) return t.portfolio;
        if (pathname.endsWith("/dashboard/analytics")) return t.analytics;
        if (pathname.endsWith("/dashboard/market-news")) return t.marketNews;
        if (pathname.endsWith("/dashboard/advisor")) return t.advisor;
        if (pathname.endsWith("/dashboard/trading")) return t.trading;
        if (pathname.endsWith("/dashboard/settings")) return t.settings;
        return t.dashboard;
    }, [locale, pathname]);

    return (
        <header
            style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                backgroundColor: "color-mix(in srgb, var(--surface) 86%, transparent)",
                borderBottom: "1px solid var(--border)",
                height: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                gap: 10,
            }}
        >
            <h1 style={{ fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>
                {title}
            </h1>
            <TaskbarActions />
        </header>
    );
}
