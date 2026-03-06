"use client";

import { useTranslations } from "next-intl";
import FinancialLedger from "@/components/dashboard/FinancialLedger";

export default function DashboardPage() {
    const t = useTranslations("dashboard");

    return (
        <div className="page-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
            <div className="animate-fadeIn" style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
                    {t("title")}
                </h1>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
            </div>

            <FinancialLedger />
        </div>
    );
}
