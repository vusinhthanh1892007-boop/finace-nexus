import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Sidebar from "@/components/ui/Sidebar";
import MarketTicker from "@/components/ui/MarketTicker";
import SystemPulse from "@/components/ui/SystemPulse";
import DevModeInit from "@/components/ui/DevModeInit";
import HeaderBar from "@/components/ui/topbar/HeaderBar";
import { WISDOM_QUOTES } from "@/lib/constants";

type Locale = "en" | "vi" | "es";

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as Locale)) {
        notFound();
    }

    const messages = await getMessages();

    const localeKey = (locale in WISDOM_QUOTES ? locale : "en") as keyof typeof WISDOM_QUOTES;
    const quotes = WISDOM_QUOTES[localeKey];
    const dailyWisdom = quotes[new Date().getDate() % quotes.length];

    return (
        <html lang={locale} data-theme="pastel" suppressHydrationWarning>
            <body style={{ backgroundColor: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
                <NextIntlClientProvider messages={messages}>
                    {}
                    <DevModeInit />

                    {}
                    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                        {}
                        <Sidebar locale={locale} />

                        {}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <HeaderBar />

                            {}
                            <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
                        </div>
                    </div>

                    {}
                    <footer style={{ borderTop: "1px solid var(--border)" }}>
                        <MarketTicker />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                            <SystemPulse />
                            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 24px" }}>
                                <span
                                    style={{
                                        fontSize: "0.65rem",
                                        color: "var(--text-muted)",
                                        fontStyle: "italic",
                                        opacity: 0.7,
                                        maxWidth: 300,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    💡 {dailyWisdom}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                    © {new Date().getFullYear()} Nexus Finance · AES-256 🔐
                                </span>
                            </div>
                        </div>
                    </footer>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
