"use client";

import { useLocale } from "next-intl";

export default function MarketNewsPage() {
    const locale = useLocale();

    const labels = {
        vi: {
            title: "Tin tức thị trường",
            subtitle: "Luồng tin nhanh theo thời gian thực và tín hiệu ảnh hưởng danh mục.",
        },
        en: {
            title: "Market News",
            subtitle: "Real-time headlines and impact signals for your portfolio.",
        },
        es: {
            title: "Noticias de Mercado",
            subtitle: "Titulares en tiempo real y senales de impacto al portafolio.",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const rows = [
        "ETF dòng tiền tăng ở nhóm công nghệ vốn hóa lớn.",
        "Giá vàng tăng khi lợi suất trái phiếu hạ nhiệt.",
        "Crypto phục hồi cùng thanh khoản phái sinh.",
    ];

    return (
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 56 }}>
            <div className="card card-padding">
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{t.title}</h2>
                <p style={{ color: "var(--text-muted)", marginTop: 6 }}>{t.subtitle}</p>
                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {rows.map((row) => (
                        <div key={row} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-hover)", fontSize: "0.9rem" }}>
                            {row}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
