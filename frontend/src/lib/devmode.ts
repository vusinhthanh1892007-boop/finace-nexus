

export function initDevMode() {
    if (typeof window === "undefined") return;
    const locale = (document.documentElement.lang || "en").toLowerCase();
    const text = {
        vi: {
            handcrafted: "Thiet ke thu cong tai Viet Nam boi Thanh & AI",
            budget: "Ngan sach: 80M VND | Nen tang: Next.js + FastAPI + OpenBB | Bao mat: AES-256-GCM",
            tip: "Meo: Bam logo 7 lan de mo bat ngo!",
            devMode: "Che do Dev",
            theme: "Giao dien",
            locale: "Ngon ngu",
            build: "Ban dung: Next.js 16 + React 19",
            security: "Bao mat: AES-256-GCM + CSP Nonce",
            cache: "Cache: Redis (quote 30s, indices 60s)",
        },
        es: {
            handcrafted: "Hecho en Vietnam por Thanh & AI",
            budget: "Presupuesto: 80M VND | Stack: Next.js + FastAPI + OpenBB | Seguridad: AES-256-GCM",
            tip: "Tip: Haz clic 7 veces en el logo para una sorpresa",
            devMode: "Modo Dev",
            theme: "Tema",
            locale: "Idioma",
            build: "Build: Next.js 16 + React 19",
            security: "Seguridad: AES-256-GCM + CSP Nonce",
            cache: "Cache: Redis (quotes 30s, indices 60s)",
        },
        en: {
            handcrafted: "Handcrafted with love in Vietnam by Thanh & AI",
            budget: "Budget: 80M VND | Stack: Next.js + FastAPI + OpenBB | Security: AES-256-GCM",
            tip: "Tip: Click the logo 7 times for a surprise",
            devMode: "Dev Mode",
            theme: "Theme",
            locale: "Locale",
            build: "Build: Next.js 16 + React 19",
            security: "Security: AES-256-GCM + CSP Nonce",
            cache: "Cache: Redis (30s quotes, 60s indices)",
        },
    } as const;
    const t = text[locale as keyof typeof text] ?? text.en;

    console.log(
        "%cNexus Finance",
        "color: #10b981; font-size: 32px; font-weight: 900; text-shadow: 2px 2px 4px rgba(16, 185, 129, 0.3);"
    );
    console.log(
        `%c${t.handcrafted}`,
        "color: #6366f1; font-size: 14px; font-weight: 600;"
    );
    console.log(
        `%c🚀 ${t.budget}`,
        "color: #f59e0b; font-size: 11px;"
    );
    console.log(
        `%c💡 ${t.tip} 🎉`,
        "color: #8b5cf6; font-size: 11px; font-style: italic;"
    );

    let devOverlay: HTMLDivElement | null = null;
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "D") {
            if (devOverlay) {
                devOverlay.remove();
                devOverlay = null;
            } else {
                devOverlay = document.createElement("div");
                devOverlay.style.cssText = `
                    position: fixed; bottom: 60px; right: 16px; z-index: 9999;
                    background: rgba(0,0,0,0.85); color: #10b981; padding: 12px 16px;
                    border-radius: 8px; font-family: 'JetBrains Mono', monospace;
                    font-size: 11px; line-height: 1.6; backdrop-filter: blur(8px);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                `;
                devOverlay.innerHTML = `
                    <div style="font-weight:700;margin-bottom:4px;">🔧 ${t.devMode}</div>
                    <div>${t.theme}: ${document.documentElement.dataset.theme || "unknown"}</div>
                    <div>${t.locale}: ${document.documentElement.lang}</div>
                    <div>${t.build}</div>
                    <div>${t.security}</div>
                    <div>${t.cache}</div>
                `;
                document.body.appendChild(devOverlay);
            }
        }
    });
}
