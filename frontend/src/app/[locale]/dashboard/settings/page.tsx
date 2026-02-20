"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
    Bell,
    FloppyDisk,
    GearSix,
    Key,
    Robot,
    Scales,
    Shield,
    ToggleLeft,
    ToggleRight,
    X,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api";

export default function SettingsPage() {
    const locale = useLocale();

    const [geminiKey, setGeminiKey] = useState("");
    const [geminiMasked, setGeminiMasked] = useState("");
    const [geminiConfigured, setGeminiConfigured] = useState(false);
    const [openaiKey, setOpenaiKey] = useState("");
    const [openaiMasked, setOpenaiMasked] = useState("");
    const [openaiConfigured, setOpenaiConfigured] = useState(false);
    const [geminiScopes, setGeminiScopes] = useState<string[]>(["chat", "advisor_analysis"]);
    const [openaiScopes, setOpenaiScopes] = useState<string[]>(["chat"]);
    const [aiProvider, setAiProvider] = useState<"auto" | "gemini" | "openai">("auto");
    const [aiModel, setAiModel] = useState("gemini-2.0-flash");
    const [apiKeyVersion, setApiKeyVersion] = useState(1);
    const [lastRotationAt, setLastRotationAt] = useState("");
    const [rotationCount, setRotationCount] = useState(0);
    const [autoBalance, setAutoBalance] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [riskTolerance, setRiskTolerance] = useState<"conservative" | "moderate" | "aggressive">("moderate");
    const [saved, setSaved] = useState(false);
    const [rotated, setRotated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const labels = {
        vi: {
            title: "Cài đặt Wealth",
            subtitle: "Cấu hình nền tảng tài chính",
            api: "API Keys",
            geminiLabel: "Gemini API Key",
            openaiLabel: "OpenAI API Key",
            geminiHint: "Lưu an toàn trên backend, dùng cho AI Advisor",
            openaiHint: "Lưu an toàn trên backend, dùng cho AI chat trong taskbar",
            geminiSaved: "Đã kết nối Gemini",
            openaiSaved: "Đã kết nối OpenAI",
            clearKey: "Xóa key",
            scopes: "Phạm vi API",
            scopeChat: "Chat AI",
            scopeAdvisor: "Phân tích tài chính",
            securityTitle: "Security Hardening",
            rotateSecrets: "Rotate encrypted secrets",
            rotated: "Đã rotate key secrets",
            rotationVersion: "Key version",
            rotationCount: "Số lần rotate",
            lastRotation: "Lần rotate gần nhất",
            aiEngine: "AI Engine",
            aiProvider: "Nhà cung cấp AI",
            aiModel: "Model ưu tiên",
            auto: "Tự động",
            openai: "OpenAI",
            gemini: "Gemini",
            modelHint: "Gemini: 1.5/2.0 hoặc GPT phù hợp theo provider.",
            automation: "Tự động hóa",
            autoBalanceLabel: "Tự động cân bằng danh mục",
            autoBalanceDesc: "Tự động tái cân bằng khi lệch > 10%",
            notifLabel: "Thông báo",
            notifDesc: "Nhận cảnh báo khi tài sản giảm mạnh",
            risk: "Khẩu vị rủi ro",
            conservative: "Bảo thủ",
            moderate: "Cân bằng",
            aggressive: "Mạo hiểm",
            save: "Lưu cài đặt",
            savedMsg: "Đã lưu!",
            loadFailed: "Không tải được cài đặt từ backend.",
            saveFailed: "Lưu cài đặt thất bại.",
        },
        en: {
            title: "Wealth Settings",
            subtitle: "Configure your financial platform",
            api: "API Keys",
            geminiLabel: "Gemini API Key",
            openaiLabel: "OpenAI API Key",
            geminiHint: "Stored securely on backend and used by AI Advisor",
            openaiHint: "Stored securely on backend for taskbar AI chat",
            geminiSaved: "Gemini is connected",
            openaiSaved: "OpenAI is connected",
            clearKey: "Clear key",
            scopes: "API scopes",
            scopeChat: "AI chat",
            scopeAdvisor: "Financial analysis",
            securityTitle: "Security Hardening",
            rotateSecrets: "Rotate encrypted secrets",
            rotated: "Secrets rotated",
            rotationVersion: "Key version",
            rotationCount: "Rotation count",
            lastRotation: "Last rotation",
            aiEngine: "AI Engine",
            aiProvider: "AI provider",
            aiModel: "Preferred model",
            auto: "Auto",
            openai: "OpenAI",
            gemini: "Gemini",
            modelHint: "Pick Gemini 1.5/2.0 or GPT models by selected provider.",
            automation: "Automation",
            autoBalanceLabel: "Auto-Balance Portfolio",
            autoBalanceDesc: "Automatically rebalance when drift exceeds 10%",
            notifLabel: "Notifications",
            notifDesc: "Alert when assets move sharply",
            risk: "Risk Tolerance",
            conservative: "Conservative",
            moderate: "Moderate",
            aggressive: "Aggressive",
            save: "Save Settings",
            savedMsg: "Saved!",
            loadFailed: "Failed to load settings from backend.",
            saveFailed: "Failed to save settings.",
        },
        es: {
            title: "Configuracion Wealth",
            subtitle: "Configura tu plataforma financiera",
            api: "Claves API",
            geminiLabel: "Clave API Gemini",
            openaiLabel: "Clave API OpenAI",
            geminiHint: "Guardada de forma segura en backend para Asesor IA",
            openaiHint: "Guardada de forma segura en backend para chat AI",
            geminiSaved: "Gemini esta conectado",
            openaiSaved: "OpenAI esta conectado",
            clearKey: "Borrar clave",
            scopes: "Scopes API",
            scopeChat: "Chat AI",
            scopeAdvisor: "Analisis financiero",
            securityTitle: "Seguridad Avanzada",
            rotateSecrets: "Rotar secretos cifrados",
            rotated: "Secretos rotados",
            rotationVersion: "Version de key",
            rotationCount: "Conteo de rotacion",
            lastRotation: "Ultima rotacion",
            aiEngine: "Motor AI",
            aiProvider: "Proveedor AI",
            aiModel: "Modelo preferido",
            auto: "Auto",
            openai: "OpenAI",
            gemini: "Gemini",
            modelHint: "Selecciona Gemini 1.5/2.0 o modelos GPT segun proveedor.",
            automation: "Automatizacion",
            autoBalanceLabel: "Auto-Balance de Portafolio",
            autoBalanceDesc: "Rebalanceo automatico cuando la desviacion supera 10%",
            notifLabel: "Notificaciones",
            notifDesc: "Alertar cuando los activos cambian fuerte",
            risk: "Tolerancia al Riesgo",
            conservative: "Conservador",
            moderate: "Moderado",
            aggressive: "Agresivo",
            save: "Guardar Configuracion",
            savedMsg: "Guardado!",
            loadFailed: "No se pudieron cargar ajustes del backend.",
            saveFailed: "No se pudieron guardar ajustes.",
        },
    } as const;
    const t = labels[locale as keyof typeof labels] ?? labels.en;

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const data = await apiClient.getSettings();
                if (!mounted) return;
                setAutoBalance(Boolean(data.auto_balance));
                setNotifications(Boolean(data.notifications));
                setRiskTolerance(data.risk_tolerance);
                setGeminiConfigured(Boolean(data.gemini_configured));
                setGeminiMasked(String(data.gemini_key_masked || ""));
                setOpenaiConfigured(Boolean(data.openai_configured));
                setOpenaiMasked(String(data.openai_key_masked || ""));
                setGeminiScopes(Array.isArray(data.gemini_scopes) && data.gemini_scopes.length > 0 ? data.gemini_scopes : ["chat", "advisor_analysis"]);
                setOpenaiScopes(Array.isArray(data.openai_scopes) && data.openai_scopes.length > 0 ? data.openai_scopes : ["chat"]);
                setApiKeyVersion(Number(data.api_key_version || 1));
                setLastRotationAt(String(data.last_secret_rotation_at || ""));
                setRotationCount(Number(data.key_rotation_count || 0));
                setAiProvider(data.ai_provider === "gemini" || data.ai_provider === "openai" || data.ai_provider === "auto" ? data.ai_provider : "auto");
                setAiModel(String(data.ai_model || "gemini-2.0-flash"));
            } catch {
                if (mounted) setError(t.loadFailed);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [t.loadFailed]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const payload: {
                gemini_api_key?: string;
                openai_api_key?: string;
                gemini_scopes: string[];
                openai_scopes: string[];
                auto_balance: boolean;
                notifications: boolean;
                risk_tolerance: "conservative" | "moderate" | "aggressive";
                ai_provider: "auto" | "gemini" | "openai";
                ai_model: string;
            } = {
                gemini_scopes: geminiScopes,
                openai_scopes: openaiScopes,
                auto_balance: autoBalance,
                notifications,
                risk_tolerance: riskTolerance,
                ai_provider: aiProvider,
                ai_model: aiModel,
            };
            if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();
            if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
            const result = await apiClient.updateSettings(payload);
            setGeminiConfigured(Boolean(result.settings.gemini_configured));
            setGeminiMasked(String(result.settings.gemini_key_masked || ""));
            setOpenaiConfigured(Boolean(result.settings.openai_configured));
            setOpenaiMasked(String(result.settings.openai_key_masked || ""));
            setGeminiScopes(Array.isArray(result.settings.gemini_scopes) ? result.settings.gemini_scopes : ["chat", "advisor_analysis"]);
            setOpenaiScopes(Array.isArray(result.settings.openai_scopes) ? result.settings.openai_scopes : ["chat"]);
            setApiKeyVersion(Number(result.settings.api_key_version || 1));
            setLastRotationAt(String(result.settings.last_secret_rotation_at || ""));
            setRotationCount(Number(result.settings.key_rotation_count || 0));
            setGeminiKey("");
            setOpenaiKey("");
            setRotated(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const clearGemini = async () => {
        setSaving(true);
        setError("");
        try {
            const result = await apiClient.updateSettings({ gemini_api_key: "" });
            setGeminiConfigured(Boolean(result.settings.gemini_configured));
            setGeminiMasked("");
            setGeminiKey("");
            setGeminiScopes(Array.isArray(result.settings.gemini_scopes) ? result.settings.gemini_scopes : ["chat", "advisor_analysis"]);
            setApiKeyVersion(Number(result.settings.api_key_version || 1));
            setLastRotationAt(String(result.settings.last_secret_rotation_at || ""));
            setRotationCount(Number(result.settings.key_rotation_count || 0));
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const clearOpenAI = async () => {
        setSaving(true);
        setError("");
        try {
            const result = await apiClient.updateSettings({ openai_api_key: "" });
            setOpenaiConfigured(Boolean(result.settings.openai_configured));
            setOpenaiMasked("");
            setOpenaiKey("");
            setOpenaiScopes(Array.isArray(result.settings.openai_scopes) ? result.settings.openai_scopes : ["chat"]);
            setApiKeyVersion(Number(result.settings.api_key_version || 1));
            setLastRotationAt(String(result.settings.last_secret_rotation_at || ""));
            setRotationCount(Number(result.settings.key_rotation_count || 0));
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const toggleScope = (provider: "gemini" | "openai", scope: "chat" | "advisor_analysis") => {
        if (provider === "gemini") {
            setGeminiScopes((prev) => {
                const next = prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope];
                return next.length > 0 ? next : ["chat"];
            });
            return;
        }
        setOpenaiScopes((prev) => {
            const next = prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope];
            return next.length > 0 ? next : ["chat"];
        });
    };

    const rotateSecrets = async () => {
        setSaving(true);
        setError("");
        try {
            const result = await apiClient.rotateSecrets({
                providers: ["gemini", "openai"],
                reason: "manual-hardening",
            });
            const settings = result.settings;
            setApiKeyVersion(Number(settings.api_key_version || 1));
            setRotationCount(Number(settings.key_rotation_count || 0));
            setLastRotationAt(String(settings.last_secret_rotation_at || ""));
            setRotated(true);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-container" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 700 }}>
            <div className="animate-fadeIn" style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
                    <GearSix size={28} weight="duotone" className="icon-glow" style={{ color: "var(--primary)" }} />
                    {t.title}
                </h1>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{t.subtitle}</p>
            </div>

            {error && (
                <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: "color-mix(in srgb, var(--danger) 45%, var(--border))", color: "var(--danger)" }}>
                    {error}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 20, opacity: loading ? 0.8 : 1 }}>
                <div className="card card-padding animate-fadeIn">
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Key size={18} weight="duotone" style={{ color: "var(--warning)" }} />
                        {t.api}
                    </h2>
                    <div>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                            {t.geminiLabel}
                        </label>
                        <input
                            type="password"
                            className="input"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIza..."
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>{t.geminiHint}</p>
                        {geminiConfigured && (
                            <div style={{ marginTop: 8, fontSize: "0.76rem", color: "var(--success)", fontWeight: 600 }}>
                                {t.geminiSaved} ({geminiMasked || "***"})
                            </div>
                        )}
                        <button
                            className="btn"
                            onClick={clearGemini}
                            disabled={saving || !geminiConfigured}
                            style={{ marginTop: 8, padding: "6px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                            <X size={13} />
                            {t.clearKey}
                        </button>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>{t.scopes}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    className={`btn ${geminiScopes.includes("chat") ? "btn-primary" : ""}`}
                                    type="button"
                                    onClick={() => toggleScope("gemini", "chat")}
                                    style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                    {t.scopeChat}
                                </button>
                                <button
                                    className={`btn ${geminiScopes.includes("advisor_analysis") ? "btn-primary" : ""}`}
                                    type="button"
                                    onClick={() => toggleScope("gemini", "advisor_analysis")}
                                    style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                    {t.scopeAdvisor}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                            {t.openaiLabel}
                        </label>
                        <input
                            type="password"
                            className="input"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>{t.openaiHint}</p>
                        {openaiConfigured && (
                            <div style={{ marginTop: 8, fontSize: "0.76rem", color: "var(--success)", fontWeight: 600 }}>
                                {t.openaiSaved} ({openaiMasked || "***"})
                            </div>
                        )}
                        <button
                            className="btn"
                            onClick={clearOpenAI}
                            disabled={saving || !openaiConfigured}
                            style={{ marginTop: 8, padding: "6px 10px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                            <X size={13} />
                            {t.clearKey}
                        </button>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>{t.scopes}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    className={`btn ${openaiScopes.includes("chat") ? "btn-primary" : ""}`}
                                    type="button"
                                    onClick={() => toggleScope("openai", "chat")}
                                    style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                    {t.scopeChat}
                                </button>
                                <button
                                    className={`btn ${openaiScopes.includes("advisor_analysis") ? "btn-primary" : ""}`}
                                    type="button"
                                    onClick={() => toggleScope("openai", "advisor_analysis")}
                                    style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                    {t.scopeAdvisor}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card card-padding animate-fadeIn">
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Robot size={18} weight="duotone" style={{ color: "var(--primary)" }} />
                        {t.aiEngine}
                    </h2>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t.aiProvider}</label>
                            <select className="input" value={aiProvider} onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}>
                                <option value="auto">{t.auto}</option>
                                <option value="gemini">{t.gemini}</option>
                                <option value="openai">{t.openai}</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t.aiModel}</label>
                            <select className="input" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                                {(aiProvider === "openai"
                                    ? ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"]
                                    : aiProvider === "gemini"
                                      ? ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
                                      : ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"]
                                ).map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6 }}>{t.modelHint}</p>
                        </div>
                    </div>
                </div>

                <div className="card card-padding animate-fadeIn">
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Shield size={18} weight="duotone" style={{ color: "var(--danger)" }} />
                        {t.securityTitle}
                    </h2>
                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{t.rotationVersion}: <strong>{apiKeyVersion}</strong></div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{t.rotationCount}: <strong>{rotationCount}</strong></div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{t.lastRotation}: <strong>{lastRotationAt || "--"}</strong></div>
                    </div>
                    <button
                        className="btn"
                        type="button"
                        onClick={rotateSecrets}
                        disabled={saving}
                        style={{ padding: "8px 12px" }}
                    >
                        {t.rotateSecrets}
                    </button>
                    {rotated && (
                        <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--success)", fontWeight: 600 }}>
                            {t.rotated}
                        </div>
                    )}
                </div>

                <div className="card card-padding animate-fadeIn">
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Scales size={18} weight="duotone" style={{ color: "var(--primary)" }} />
                        {t.automation}
                    </h2>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                        <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 2 }}>{t.autoBalanceLabel}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t.autoBalanceDesc}</div>
                        </div>
                        <button
                            onClick={() => setAutoBalance(!autoBalance)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: autoBalance ? "var(--success)" : "var(--text-muted)", transition: "color 0.15s ease" }}
                        >
                            {autoBalance ? <ToggleRight size={32} weight="fill" /> : <ToggleLeft size={32} weight="fill" />}
                        </button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                        <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                                <Bell size={14} weight="duotone" /> {t.notifLabel}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t.notifDesc}</div>
                        </div>
                        <button
                            onClick={() => setNotifications(!notifications)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: notifications ? "var(--success)" : "var(--text-muted)", transition: "color 0.15s ease" }}
                        >
                            {notifications ? <ToggleRight size={32} weight="fill" /> : <ToggleLeft size={32} weight="fill" />}
                        </button>
                    </div>
                </div>

                <div className="card card-padding animate-fadeIn">
                    <h2 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Shield size={18} weight="duotone" style={{ color: "var(--danger)" }} />
                        {t.risk}
                    </h2>
                    <div style={{ display: "flex", gap: 8 }}>
                        {(["conservative", "moderate", "aggressive"] as const).map((level) => {
                            const active = riskTolerance === level;
                            const colors = { conservative: "var(--success)", moderate: "var(--warning)", aggressive: "var(--danger)" };
                            return (
                                <button
                                    key={level}
                                    onClick={() => setRiskTolerance(level)}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: active ? colors[level] : "var(--surface-hover)",
                                        color: active ? "white" : "var(--text-secondary)",
                                        border: active ? "none" : "1px solid var(--border)",
                                        fontWeight: active ? 700 : 500,
                                        transition: "all 0.15s ease",
                                    }}
                                >
                                    {t[level]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving || loading}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 24px", fontSize: "0.9rem" }}
                >
                    <FloppyDisk size={18} weight="duotone" />
                    {saved ? `✓ ${t.savedMsg}` : saving ? "..." : t.save}
                </button>
            </div>
        </div>
    );
}
