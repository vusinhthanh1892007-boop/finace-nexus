"use client";



import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES } from "@/lib/constants";

export default function LocaleSwitcher() {
    const locale = useLocale();
    const pathname = usePathname();
    const router = useRouter();

    const switchLocale = (newLocale: string) => {
        const segments = pathname.split("/");
        segments[1] = newLocale;
        router.push(segments.join("/"));
    };

    return (
        <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: "999px", border: "1px solid var(--border)", background: "var(--surface)" }}>
            {LOCALES.map((l) => (
                <button
                    key={l.code}
                    onClick={() => switchLocale(l.code)}
                    title={l.label}
                    style={{
                        padding: "5px 10px",
                        borderRadius: 9999,
                        border: "none",
                        background: locale === l.code ? "var(--surface-hover)" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        transition: "all 0.15s ease",
                        lineHeight: 1,
                        opacity: locale === l.code ? 1 : 0.55,
                        color: "var(--text-secondary)",
                    }}
                >
                    {l.code === "vi" ? "VIE" : l.code.toUpperCase()}
                </button>
            ))}
        </div>
    );
}
