"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    RiNotification3Line,
    RiRefreshLine,
    RiSearch2Line,
    RiSparklingLine,
} from "@remixicon/react";
import ThemeSwitcher from "@/components/theme/ThemeSwitcher";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";

const AIAssistantPanel = dynamic(() => import("./AIAssistantPanel"), { ssr: false });

type Notice = {
    id: string;
    message: string;
    time: string;
};

type QuickItem = {
    label: string;
    href: string;
};

export default function TaskbarActions() {
    const locale = useLocale();
    const router = useRouter();

    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [showAI, setShowAI] = useState(false);
    const [quoteResult, setQuoteResult] = useState<{ symbol: string; price: number; change_percent: number } | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    const labels = {
        vi: {
            quickSearch: "Tìm nhanh",
            notifications: "Thông báo",
            ai: "AI",
            refresh: "Làm mới",
            searchPlaceholder: "Tìm mã, thị trường, chiến lược...",
            noNoti: "Không có thông báo mới.",
            quickOpen: "Mở nhanh",
            openTrading: "Mở giao dịch",
            noResult: "Không thấy kết quả phù hợp.",
            go: "Tìm",
            notices: [
                { id: "1", message: "SPX đang tiến sát vùng kháng cự 6,900.", time: "2p" },
                { id: "2", message: "BTC biến động mạnh hơn 3% trong 1h.", time: "8p" },
                { id: "3", message: "Danh mục cần tái cân bằng theo mức rủi ro.", time: "12p" },
            ],
            shortcuts: [
                { label: "Bảng điều khiển", href: `/${locale}/dashboard` },
                { label: "Bản đồ toàn cầu", href: `/${locale}/dashboard/global-map` },
                { label: "Danh mục", href: `/${locale}/dashboard/portfolio` },
                { label: "Phân tích", href: `/${locale}/dashboard/analytics` },
                { label: "Giao dịch", href: `/${locale}/dashboard/trading` },
                { label: "Cài đặt", href: `/${locale}/dashboard/settings` },
            ] as QuickItem[],
        },
        en: {
            quickSearch: "Quick Search",
            notifications: "Notifications",
            ai: "AI",
            refresh: "Refresh",
            searchPlaceholder: "Search symbols, markets, strategies...",
            noNoti: "No new notifications.",
            quickOpen: "Quick open",
            openTrading: "Open trading",
            noResult: "No matching result.",
            go: "Go",
            notices: [
                { id: "1", message: "SPX is approaching the 6,900 resistance zone.", time: "2m" },
                { id: "2", message: "BTC moved more than 3% in the last hour.", time: "8m" },
                { id: "3", message: "Portfolio rebalancing is recommended for current risk.", time: "12m" },
            ],
            shortcuts: [
                { label: "Dashboard", href: `/${locale}/dashboard` },
                { label: "Global Map", href: `/${locale}/dashboard/global-map` },
                { label: "Portfolio", href: `/${locale}/dashboard/portfolio` },
                { label: "Analytics", href: `/${locale}/dashboard/analytics` },
                { label: "Trading", href: `/${locale}/dashboard/trading` },
                { label: "Settings", href: `/${locale}/dashboard/settings` },
            ] as QuickItem[],
        },
        es: {
            quickSearch: "Busqueda rapida",
            notifications: "Notificaciones",
            ai: "AI",
            refresh: "Actualizar",
            searchPlaceholder: "Buscar simbolos, mercados, estrategias...",
            noNoti: "No hay notificaciones nuevas.",
            quickOpen: "Acceso rapido",
            openTrading: "Abrir trading",
            noResult: "Sin resultados.",
            go: "Buscar",
            notices: [
                { id: "1", message: "SPX se acerca a la zona de resistencia 6,900.", time: "2m" },
                { id: "2", message: "BTC se movio mas del 3% en la ultima hora.", time: "8m" },
                { id: "3", message: "Se recomienda rebalancear la cartera por riesgo.", time: "12m" },
            ],
            shortcuts: [
                { label: "Panel", href: `/${locale}/dashboard` },
                { label: "Mapa Global", href: `/${locale}/dashboard/global-map` },
                { label: "Portafolio", href: `/${locale}/dashboard/portfolio` },
                { label: "Analitica", href: `/${locale}/dashboard/analytics` },
                { label: "Trading", href: `/${locale}/dashboard/trading` },
                { label: "Configuracion", href: `/${locale}/dashboard/settings` },
            ] as QuickItem[],
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const notices = useMemo<Notice[]>(() => t.notices.map((item) => ({ ...item })), [t]);

    const unread = notices.length;

    const filteredShortcuts = useMemo(() => {
        const q = searchValue.trim().toLowerCase();
        if (!q) return t.shortcuts;
        return t.shortcuts.filter((item) => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q));
    }, [searchValue, t.shortcuts]);

    const openTrading = (symbol: string) => {
        router.push(`/${locale}/dashboard/trading?symbol=${encodeURIComponent(symbol)}`);
        setShowSearch(false);
    };

    const runQuickSearch = async () => {
        const q = searchValue.trim();
        if (!q) return;

        const normalized = q.replace(/\s+/g, "").toUpperCase();
        const shortcut = t.shortcuts.find((s) => s.label.toLowerCase().includes(q.toLowerCase()));
        if (shortcut) {
            router.push(shortcut.href);
            setShowSearch(false);
            return;
        }

        if (/^[A-Z0-9.\-^]{2,12}$/.test(normalized)) {
            setSearchLoading(true);
            try {
                const res = await fetch(`/api/market/quote/${encodeURIComponent(normalized)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Number(data?.price || 0) > 0) {
                        setQuoteResult({
                            symbol: String(data.symbol || normalized),
                            price: Number(data.price || 0),
                            change_percent: Number(data.change_percent || 0),
                        });
                        return;
                    }
                }

                setQuoteResult(null);
                openTrading(normalized);
            } catch {
                setQuoteResult(null);
                openTrading(normalized);
            } finally {
                setSearchLoading(false);
            }
            return;
        }

        setQuoteResult(null);
    };

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                <button className="btn" onClick={() => setShowSearch((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <RiSearch2Line size={15} /> {t.quickSearch}
                </button>

                {showSearch && (
                    <div className="card" style={{ position: "absolute", top: 44, right: 250, width: 380, padding: 10, zIndex: 35 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                className="input"
                                value={searchValue}
                                onChange={(e) => {
                                    setSearchValue(e.target.value);
                                    setQuoteResult(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        void runQuickSearch();
                                    }
                                }}
                                placeholder={t.searchPlaceholder}
                            />
                            <button className="btn btn-primary" onClick={runQuickSearch} disabled={searchLoading}>{t.go}</button>
                        </div>

                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.quickOpen}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {filteredShortcuts.slice(0, 6).map((item) => (
                                    <button
                                        key={item.href}
                                        className="btn"
                                        style={{ padding: "5px 8px", fontSize: "0.72rem" }}
                                        onClick={() => {
                                            router.push(item.href);
                                            setShowSearch(false);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            {quoteResult && (
                                <div className="card" style={{ padding: 8, background: "var(--surface-hover)", marginTop: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <strong>{quoteResult.symbol}</strong>
                                            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                                {quoteResult.price.toLocaleString(locale, { maximumFractionDigits: 4 })}
                                                <span style={{ marginLeft: 6, color: quoteResult.change_percent >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                                    {quoteResult.change_percent >= 0 ? "+" : ""}{quoteResult.change_percent.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: "6px 8px", fontSize: "0.72rem" }}
                                            onClick={() => {
                                                router.push(`/${locale}/dashboard/trading?symbol=${encodeURIComponent(quoteResult.symbol)}`);
                                                setShowSearch(false);
                                            }}
                                        >
                                            {t.openTrading}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!quoteResult && searchValue.trim() && filteredShortcuts.length === 0 && !searchLoading && (
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.noResult}</div>
                            )}
                        </div>
                    </div>
                )}

                <button className="btn" onClick={() => setShowAI(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <RiSparklingLine size={15} /> {t.ai}
                </button>

                <button className="btn" title={t.refresh} onClick={() => router.refresh()}>
                    <RiRefreshLine size={15} />
                </button>

                <button className="btn" title={t.notifications} onClick={() => setShowNotifications((v) => !v)} style={{ position: "relative" }}>
                    <RiNotification3Line size={16} />
                    {unread > 0 && (
                        <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
                    )}
                </button>

                {showNotifications && (
                    <div className="card" style={{ position: "absolute", top: 44, right: 0, width: 300, padding: 10, zIndex: 30 }}>
                        {notices.length === 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.noNoti}</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {notices.map((n) => (
                                    <div key={n.id} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)" }}>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{n.message}</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{n.time}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <ThemeSwitcher />
                <LocaleSwitcher />
            </div>

            <AIAssistantPanel open={showAI} onClose={() => setShowAI(false)} />
        </>
    );
}
