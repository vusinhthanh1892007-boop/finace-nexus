import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
            colors: {
                // ── Soft Pastel ──────────────────────────────────────
                pastel: {
                    bg: "hsl(220, 20%, 97%)",
                    surface: "hsl(220, 20%, 100%)",
                    "surface-hover": "hsl(220, 20%, 95%)",
                    border: "hsl(220, 15%, 90%)",
                    text: "hsl(220, 20%, 25%)",
                    "text-muted": "hsl(220, 10%, 55%)",
                    primary: "hsl(210, 40%, 72%)",
                    "primary-hover": "hsl(210, 40%, 64%)",
                    secondary: "hsl(340, 35%, 78%)",
                    accent: "hsl(160, 30%, 72%)",
                    success: "hsl(145, 35%, 70%)",
                    warning: "hsl(40, 50%, 75%)",
                    danger: "hsl(0, 40%, 75%)",
                },
                // ── Bright & Bold ────────────────────────────────────
                bold: {
                    bg: "hsl(225, 25%, 8%)",
                    surface: "hsl(225, 20%, 12%)",
                    "surface-hover": "hsl(225, 20%, 16%)",
                    border: "hsl(225, 15%, 20%)",
                    text: "hsl(0, 0%, 95%)",
                    "text-muted": "hsl(225, 10%, 55%)",
                    primary: "hsl(160, 100%, 50%)",
                    "primary-hover": "hsl(160, 100%, 42%)",
                    secondary: "hsl(270, 100%, 65%)",
                    accent: "hsl(200, 100%, 55%)",
                    success: "hsl(145, 100%, 50%)",
                    warning: "hsl(45, 100%, 55%)",
                    danger: "hsl(0, 100%, 60%)",
                },
                // ── Minimalism ───────────────────────────────────────
                minimal: {
                    bg: "hsl(0, 0%, 100%)",
                    surface: "hsl(0, 0%, 99%)",
                    "surface-hover": "hsl(0, 0%, 96%)",
                    border: "hsl(0, 0%, 88%)",
                    text: "hsl(0, 0%, 10%)",
                    "text-muted": "hsl(0, 0%, 50%)",
                    primary: "hsl(0, 0%, 15%)",
                    "primary-hover": "hsl(0, 0%, 25%)",
                    secondary: "hsl(0, 0%, 40%)",
                    accent: "hsl(0, 0%, 30%)",
                    success: "hsl(145, 10%, 40%)",
                    warning: "hsl(40, 10%, 45%)",
                    danger: "hsl(0, 10%, 45%)",
                },
                // ── Theme-aware tokens (set via CSS vars) ────────────
                theme: {
                    bg: "var(--theme-bg)",
                    surface: "var(--theme-surface)",
                    "surface-hover": "var(--theme-surface-hover)",
                    border: "var(--theme-border)",
                    text: "var(--theme-text)",
                    "text-muted": "var(--theme-text-muted)",
                    primary: "var(--theme-primary)",
                    "primary-hover": "var(--theme-primary-hover)",
                    secondary: "var(--theme-secondary)",
                    accent: "var(--theme-accent)",
                    success: "var(--theme-success)",
                    warning: "var(--theme-warning)",
                    danger: "var(--theme-danger)",
                },
            },
            borderRadius: {
                tremor: "0.75rem",
            },
            boxShadow: {
                "tremor-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                tremor:
                    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
                "tremor-lg":
                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0", transform: "translateY(8px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(16px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                pulse: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.6" },
                },
            },
            animation: {
                fadeIn: "fadeIn 0.3s ease-out",
                slideUp: "slideUp 0.4s ease-out",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
        },
    },
    plugins: [],
};

export default config;
