"use client";



import { useCallback, useState } from "react";
import { Heartbeat, WifiHigh, WifiSlash, SealCheck, SealWarning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { SystemStatus } from "@/lib/types";
import { getStatusColor } from "@/lib/utils";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";


const POLL_INTERVAL_MS = 15_000;

export default function SystemPulse() {
    const t = useTranslations("systemPulse");
    const [status, setStatus] = useState<SystemStatus>({
        backend: "offline",
        latency: 0,
        gemini: false,
        openai: false,
        active_ai_providers: [],
    });

    const checkHealth = useCallback(async (signal: AbortSignal) => {
        const start = performance.now();
        try {
            const res = await fetch("/api/health", { signal, cache: "no-store" });
            const latency = Math.round(performance.now() - start);
            if (res.ok) {
                const data = await res.json();
                const payload = (data?.data ?? data) as Record<string, unknown>;
                const geminiAvailable = Boolean(payload?.gemini_available);
                const openaiAvailable = Boolean(payload?.openai_available);
                const activeProviders = Array.isArray(payload?.active_ai_providers)
                    ? payload.active_ai_providers.map((x) => String(x))
                    : [];
                setStatus({
                    backend: "healthy",
                    latency,
                    gemini: geminiAvailable,
                    openai: openaiAvailable,
                    active_ai_providers: activeProviders,
                });
            } else {
                setStatus({ backend: "degraded", latency, gemini: false, openai: false, active_ai_providers: [] });
            }
        } catch {
            setStatus({ backend: "offline", latency: 0, gemini: false, openai: false, active_ai_providers: [] });
        }
    }, []);

    useVisibilityPolling(checkHealth, POLL_INTERVAL_MS);

    const statusColor = getStatusColor(status.backend === "healthy" ? "healthy" : status.backend === "degraded" ? "warning" : "critical");

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 16, fontSize: "0.7rem",
            fontFamily: "'JetBrains Mono', monospace", color: "var(--text-muted)",
            padding: "6px 24px", flexWrap: "wrap",
        }}>
            {}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Heartbeat size={12} weight="fill" style={{ color: statusColor }} />
                <span>{t("backend")}:</span>
                <span style={{ color: statusColor, fontWeight: 600, textTransform: "capitalize" }}>
                    {t(`status.${status.backend}`)}
                </span>
            </div>

            {}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {status.latency > 0 ? <WifiHigh size={12} weight="fill" /> : <WifiSlash size={12} />}
                <span>{t("latency")}:</span>
                <span style={{ fontWeight: 600, color: status.latency < 100 ? "var(--success)" : status.latency < 300 ? "var(--warning)" : "var(--danger)" }}>
                    {status.latency > 0 ? `${status.latency}ms` : "–"}
                </span>
            </div>

            {}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {status.active_ai_providers.length > 0 ? (
                    <SealCheck size={12} weight="fill" style={{ color: "var(--success)" }} />
                ) : (
                    <SealWarning size={12} weight="fill" style={{ color: "var(--text-muted)" }} />
                )}
                <span>{t("aiApis")}:</span>
                <span style={{ fontWeight: 600, color: status.active_ai_providers.length > 0 ? "var(--success)" : "var(--text-muted)" }}>
                    {status.active_ai_providers.length > 0 ? status.active_ai_providers.join(", ").toUpperCase() : t("inactive")}
                </span>
            </div>
        </div>
    );
}
