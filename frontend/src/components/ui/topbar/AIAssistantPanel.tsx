"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { RiCloseLine, RiRobot2Line, RiSendPlaneLine, RiSearchLine } from "@remixicon/react";
import { apiClient } from "@/lib/api";

interface AIAssistantPanelProps {
    open: boolean;
    onClose: () => void;
}

type TabKey = "chat" | "gdp" | "locate";

type Message = {
    role: "user" | "assistant";
    text: string;
};

export default function AIAssistantPanel({ open, onClose }: AIAssistantPanelProps) {
    const locale = useLocale();

    const [tab, setTab] = useState<TabKey>("chat");
    const [provider, setProvider] = useState<"auto" | "gemini" | "openai">("auto");
    const [model, setModel] = useState("gemini-2.0-flash");
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [geminiConfigured, setGeminiConfigured] = useState(false);
    const [openaiConfigured, setOpenaiConfigured] = useState(false);
    const [geminiScopes, setGeminiScopes] = useState<string[]>([]);
    const [openaiScopes, setOpenaiScopes] = useState<string[]>([]);

    const [countryCode, setCountryCode] = useState("VN");
    const [income, setIncome] = useState(1200);
    const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly");
    const [benchmark, setBenchmark] = useState<{
        country_name: string;
        estimated_percentile: number;
        estimated_top_percent: number;
        gdp_per_capita_usd: number | null;
        gdp_trillion_usd: number | null;
        benchmark_note: string;
    } | null>(null);
    const [benchmarkLoading, setBenchmarkLoading] = useState(false);

    const [placeQuery, setPlaceQuery] = useState("");
    const [placeCategory, setPlaceCategory] = useState<"restaurant" | "cafe" | "bar">("restaurant");
    const [places, setPlaces] = useState<Array<{ name: string; distance_km: number; opening_hours: string }>>([]);
    const [placeLoading, setPlaceLoading] = useState(false);

    const labels = {
        vi: {
            title: "AI Assistant",
            subtitle: "Chat AI, benchmark GDP và tìm địa điểm gần bạn.",
            tabs: { chat: "Chat", gdp: "GDP", locate: "Địa điểm" },
            provider: "Provider",
            model: "Model",
            chatPlaceholder: "Hỏi AI về đầu tư, portfolio, rủi ro...",
            send: "Gửi",
            noMessages: "Chưa có tin nhắn.",
            you: "Bạn",
            assistant: "AI",
            country: "Mã quốc gia",
            income: "Thu nhập",
            monthly: "Tháng",
            yearly: "Năm",
            runBenchmark: "Đánh giá vị trí thu nhập",
            searching: "Đang xử lý...",
            topPercent: "Top",
            percentile: "Bách phân vị",
            gdpPc: "GDP/người",
            gdpTotal: "GDP",
            locationPlaceholder: "Ví dụ: Da Nang, Viet Nam",
            locationSearch: "Tìm địa điểm",
            categoryRestaurant: "Nhà hàng",
            categoryCafe: "Quán cafe",
            categoryBar: "Quán bar",
            noPlaces: "Không có kết quả.",
            openingNA: "Giờ mở cửa: chưa có dữ liệu",
            status: "Trạng thái",
            activeApis: "API đang hoạt động",
            connected: "Kết nối",
            missing: "Chưa có key",
            scopeOff: "Tắt scope chat",
            autoRoute: "Auto đang dùng",
            noProvider: "Chưa có API chat hoạt động",
            errorPrefix: "Lỗi",
            emptyReply: "(không có phản hồi)",
        },
        en: {
            title: "AI Assistant",
            subtitle: "AI chat, GDP benchmark, and local place lookup.",
            tabs: { chat: "Chat", gdp: "GDP", locate: "Locate" },
            provider: "Provider",
            model: "Model",
            chatPlaceholder: "Ask AI about portfolio, risk, strategy...",
            send: "Send",
            noMessages: "No messages yet.",
            you: "You",
            assistant: "AI",
            country: "Country code",
            income: "Income",
            monthly: "Monthly",
            yearly: "Yearly",
            runBenchmark: "Run Income Benchmark",
            searching: "Processing...",
            topPercent: "Top",
            percentile: "Percentile",
            gdpPc: "GDP per capita",
            gdpTotal: "GDP",
            locationPlaceholder: "Example: San Francisco, United States",
            locationSearch: "Search places",
            categoryRestaurant: "Restaurant",
            categoryCafe: "Cafe",
            categoryBar: "Bar",
            noPlaces: "No places found.",
            openingNA: "opening_hours: n/a",
            status: "Status",
            activeApis: "Active APIs",
            connected: "Connected",
            missing: "Missing key",
            scopeOff: "Chat scope off",
            autoRoute: "Auto route",
            noProvider: "No active chat API",
            errorPrefix: "Error",
            emptyReply: "(empty reply)",
        },
        es: {
            title: "Asistente AI",
            subtitle: "Chat AI, benchmark GDP y busqueda local.",
            tabs: { chat: "Chat", gdp: "GDP", locate: "Ubicar" },
            provider: "Proveedor",
            model: "Modelo",
            chatPlaceholder: "Pregunta sobre portafolio, riesgo, estrategia...",
            send: "Enviar",
            noMessages: "Sin mensajes aun.",
            you: "Tu",
            assistant: "AI",
            country: "Codigo pais",
            income: "Ingreso",
            monthly: "Mensual",
            yearly: "Anual",
            runBenchmark: "Evaluar ingreso",
            searching: "Procesando...",
            topPercent: "Top",
            percentile: "Percentil",
            gdpPc: "GDP per capita",
            gdpTotal: "GDP",
            locationPlaceholder: "Ejemplo: Madrid, Spain",
            locationSearch: "Buscar lugares",
            categoryRestaurant: "Restaurante",
            categoryCafe: "Cafe",
            categoryBar: "Bar",
            noPlaces: "Sin resultados.",
            openingNA: "horario: sin datos",
            status: "Estado",
            activeApis: "APIs activas",
            connected: "Conectado",
            missing: "Sin key",
            scopeOff: "Scope chat desactivado",
            autoRoute: "Ruta auto",
            noProvider: "No hay API de chat activa",
            errorPrefix: "Error",
            emptyReply: "(respuesta vacia)",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const settings = await apiClient.getSettings();
                if (!mounted) return;
                setProvider(settings.ai_provider === "gemini" || settings.ai_provider === "openai" || settings.ai_provider === "auto" ? settings.ai_provider : "auto");
                setModel(settings.ai_model || "gemini-2.0-flash");
                setGeminiConfigured(Boolean(settings.gemini_configured));
                setOpenaiConfigured(Boolean(settings.openai_configured));
                setGeminiScopes(Array.isArray(settings.gemini_scopes) ? settings.gemini_scopes : []);
                setOpenaiScopes(Array.isArray(settings.openai_scopes) ? settings.openai_scopes : []);
            } catch {
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const geminiChatReady = geminiConfigured && geminiScopes.includes("chat");
    const openaiChatReady = openaiConfigured && openaiScopes.includes("chat");
    const autoProvider: "gemini" | "openai" | null = geminiChatReady ? "gemini" : openaiChatReady ? "openai" : null;
    const effectiveProvider: "gemini" | "openai" = provider === "auto" ? autoProvider ?? "gemini" : provider;
    const modelOptions =
        effectiveProvider === "openai"
            ? ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"]
            : ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    const activeProviders = [
        geminiChatReady ? "Gemini" : null,
        openaiChatReady ? "OpenAI" : null,
    ].filter(Boolean) as string[];

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;

        setMessages((prev) => [...prev, { role: "user", text }]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await apiClient.aiChat({ message: text, provider, model, locale: locale as "vi" | "en" | "es" });
            setMessages((prev) => [...prev, { role: "assistant", text: res.reply || t.emptyReply }]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: "assistant", text: `${t.errorPrefix}: ${(error as Error).message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const runBenchmark = async () => {
        setBenchmarkLoading(true);
        try {
            const result = await apiClient.getIncomeBenchmark(countryCode.toUpperCase(), Number(income), frequency);
            setBenchmark(result);
        } catch {
            setBenchmark(null);
        } finally {
            setBenchmarkLoading(false);
        }
    };

    const runLocate = async () => {
        const q = placeQuery.trim();
        if (!q) return;
        setPlaceLoading(true);
        try {
            const result = await apiClient.getLocalSearch(q, placeCategory);
            setPlaces(Array.isArray(result.places) ? result.places : []);
        } catch {
            setPlaces([]);
        } finally {
            setPlaceLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 90,
                background: "rgba(0, 0, 0, 0.35)",
                backdropFilter: "blur(4px)",
                display: "flex",
                justifyContent: "flex-end",
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: "min(560px, 96vw)", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 18, overflowY: "auto" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "grid", placeItems: "center", color: "white" }}>
                            <RiRobot2Line size={18} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{t.title}</h3>
                            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.78rem" }}>{t.subtitle}</p>
                        </div>
                    </div>
                    <button className="btn" onClick={onClose} style={{ padding: 8 }}><RiCloseLine size={16} /></button>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {(["chat", "gdp", "locate"] as const).map((k) => (
                        <button key={k} className={`btn ${tab === k ? "btn-primary" : ""}`} onClick={() => setTab(k)} style={{ padding: "6px 10px", fontSize: "0.78rem" }}>
                            {t.tabs[k]}
                        </button>
                    ))}
                </div>

                {tab === "chat" && (
                    <div className="card" style={{ padding: 12 }}>
                        <div
                            className="card"
                            style={{
                                padding: 8,
                                marginBottom: 8,
                                fontSize: "0.76rem",
                                display: "grid",
                                gap: 4,
                                background: "var(--surface-hover)",
                            }}
                        >
                            <div>
                                <strong>{t.status}:</strong>{" "}
                                Gemini {geminiConfigured ? (geminiScopes.includes("chat") ? t.connected : t.scopeOff) : t.missing} | OpenAI{" "}
                                {openaiConfigured ? (openaiScopes.includes("chat") ? t.connected : t.scopeOff) : t.missing}
                            </div>
                            <div>
                                <strong>{t.autoRoute}:</strong> {autoProvider || t.noProvider}
                            </div>
                            <div>
                                <strong>{t.activeApis}:</strong> {activeProviders.length > 0 ? activeProviders.join(", ") : t.noProvider}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.provider}</label>
                                <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
                                    <option value="auto">Auto</option>
                                    <option value="gemini">Gemini</option>
                                    <option value="openai">OpenAI</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.model}</label>
                                <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                                    {modelOptions.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 8, paddingRight: 4 }}>
                            {messages.length === 0 && (
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.noMessages}</div>
                            )}
                            {messages.map((msg, idx) => (
                                <div
                                    key={`${msg.role}-${idx}-${msg.text.slice(0, 16)}`}
                                    style={{
                                        borderRadius: 10,
                                        padding: "8px 10px",
                                        background: msg.role === "user" ? "color-mix(in srgb, var(--primary) 18%, transparent)" : "var(--surface-hover)",
                                        fontSize: "0.82rem",
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    <strong style={{ marginRight: 6 }}>{msg.role === "user" ? t.you : t.assistant}:</strong>
                                    {msg.text}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                            <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={t.chatPlaceholder} />
                            <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading}>
                                <RiSendPlaneLine size={14} /> {chatLoading ? t.searching : t.send}
                            </button>
                        </div>
                    </div>
                )}

                {tab === "gdp" && (
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.country}</label>
                                <input className="input" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{t.income} (USD)</label>
                                <input className="input" type="number" value={income} onChange={(e) => setIncome(Number(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className={`btn ${frequency === "monthly" ? "btn-primary" : ""}`} onClick={() => setFrequency("monthly")}>{t.monthly}</button>
                            <button className={`btn ${frequency === "yearly" ? "btn-primary" : ""}`} onClick={() => setFrequency("yearly")}>{t.yearly}</button>
                            <button className="btn btn-primary" onClick={runBenchmark} disabled={benchmarkLoading} style={{ marginLeft: "auto" }}>
                                {benchmarkLoading ? t.searching : t.runBenchmark}
                            </button>
                        </div>

                        {benchmark && (
                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                <div className="card" style={{ padding: 10 }}><strong>{benchmark.country_name}</strong></div>
                                <div className="card" style={{ padding: 10 }}>{t.percentile}: <strong>{benchmark.estimated_percentile.toFixed(2)}%</strong></div>
                                <div className="card" style={{ padding: 10 }}>{t.topPercent}: <strong>{benchmark.estimated_top_percent.toFixed(2)}%</strong></div>
                                <div className="card" style={{ padding: 10 }}>{t.gdpPc}: <strong>{benchmark.gdp_per_capita_usd?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "--"} USD</strong></div>
                                <div className="card" style={{ padding: 10 }}>{t.gdpTotal}: <strong>{benchmark.gdp_trillion_usd?.toFixed(2) ?? "--"} T USD</strong></div>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{benchmark.benchmark_note}</div>
                            </div>
                        )}
                    </div>
                )}

                {tab === "locate" && (
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input className="input" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder={t.locationPlaceholder} />
                            <select className="input" style={{ width: 130 }} value={placeCategory} onChange={(e) => setPlaceCategory(e.target.value as typeof placeCategory)}>
                                <option value="restaurant">{t.categoryRestaurant}</option>
                                <option value="cafe">{t.categoryCafe}</option>
                                <option value="bar">{t.categoryBar}</option>
                            </select>
                            <button className="btn btn-primary" onClick={runLocate} disabled={placeLoading}>
                                <RiSearchLine size={14} /> {placeLoading ? t.searching : t.locationSearch}
                            </button>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                            {places.length === 0 && !placeLoading && (
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.noPlaces}</div>
                            )}
                            {places.map((p) => (
                                <div key={`${p.name}-${p.distance_km}`} className="card" style={{ padding: 10 }}>
                                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.distance_km.toFixed(2)} km</div>
                                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{p.opening_hours || t.openingNA}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
