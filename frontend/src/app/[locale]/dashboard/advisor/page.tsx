"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { RiRobot2Line, RiSendPlaneLine } from "@remixicon/react";
import { useAdvisor } from "@/lib/useAdvisor";
import { apiClient } from "@/lib/api";

const GuruVerdict = dynamic(() => import("@/components/advisor/GuruVerdict"));
const MealPlan = dynamic(() => import("@/components/advisor/MealPlan"));
const AssetAllocation = dynamic(() => import("@/components/advisor/AssetAllocation"));
const GuruScolding = dynamic(() => import("@/components/advisor/GuruScolding"));

type ChatMessage = {
    role: "user" | "assistant";
    text: string;
    provider?: string;
};

type TxType = "income" | "expense" | "transfer" | "round_up";

type TxRow = {
    id: string;
    type: TxType;
    category: string;
    amount: number;
    delta: number;
    note: string;
    createdAt: string;
};

const CURRENCY_OPTIONS = ["VND", "USD", "EUR", "GBP", "JPY", "USDT", "BTC", "ETH"];

export default function AdvisorPage() {
    const locale = useLocale();
    const t = useTranslations("advisor");
    const tDash = useTranslations("dashboard");
    const { result, loading, analyze } = useAdvisor();

    const [income, setIncome] = useState(80_000_000);
    const [expenses, setExpenses] = useState(52_000_000);
    const [budget, setBudget] = useState(60_000_000);
    const [familySize, setFamilySize] = useState(4);
    const [location, setLocation] = useState(locale === "en" ? "New York, United States" : locale === "es" ? "Madrid, Spain" : "Da Nang, Viet Nam");

    const [chatInput, setChatInput] = useState("");
    const [chatProvider, setChatProvider] = useState<"auto" | "gemini" | "openai">("auto");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const [displayCurrency, setDisplayCurrency] = useState(locale === "vi" ? "VND" : locale === "es" ? "EUR" : "USD");
    const [vndToDisplayRate, setVndToDisplayRate] = useState(1);

    const [converterAmount, setConverterAmount] = useState(1_000_000);
    const [converterFrom, setConverterFrom] = useState("VND");
    const [converterTo, setConverterTo] = useState(locale === "vi" ? "USD" : "VND");
    const [converterResult, setConverterResult] = useState<{ converted: number; rate: number; source: string } | null>(null);
    const [converterLoading, setConverterLoading] = useState(false);

    const [txType, setTxType] = useState<TxType>("expense");
    const [txCategory, setTxCategory] = useState("food");
    const [txAmount, setTxAmount] = useState(500_000);
    const [txNote, setTxNote] = useState("");
    const [txError, setTxError] = useState("");
    const [transactions, setTransactions] = useState<TxRow[]>([]);

    const [goalName, setGoalName] = useState("iPhone");
    const [goalTarget, setGoalTarget] = useState(30_000_000);
    const [goalSaved, setGoalSaved] = useState(0);
    const [roundUnit, setRoundUnit] = useState(10_000);
    const [spendAmount, setSpendAmount] = useState(18_000);
    const [monthlyInterest, setMonthlyInterest] = useState(0.8);
    const [projectionMonths, setProjectionMonths] = useState(12);

    const extraLabels = {
        vi: {
            location: "Nơi bạn sống",
            runAnalysis: "Phân tích lại",
            aiChat: "Chat tư vấn AI",
            chatPlaceholder: "Hỏi AI về ngân sách, cắt giảm chi tiêu, chiến lược đầu tư...",
            noChat: "Chưa có hội thoại. Nhập API key trong Cài đặt để kích hoạt AI cloud.",
            send: "Gửi",
            loading: "Đang trả lời...",
            you: "Bạn",
            assistant: "AI",
            errorPrefix: "Lỗi",
            aiModeRule: "luật cục bộ",
            displayCurrency: "Đơn vị tiền hiển thị",
            converterTitle: "Chuyển đổi tiền tệ theo thị trường",
            converterFrom: "Từ",
            converterTo: "Sang",
            converterAmount: "Số tiền",
            converterRun: "Đổi tiền",
            converterResult: "Kết quả",
            converterRate: "Tỷ giá",
            transactionTitle: "Lịch sử giao dịch",
            transactionSubtitle: "Có phân loại, kiểm tra số dư trước khi ghi nhận.",
            txType: "Loại giao dịch",
            txCategory: "Danh mục",
            txAmount: "Số tiền",
            txNote: "Ghi chú",
            txAdd: "Thêm giao dịch",
            txExportCsv: "Xuất CSV",
            txExportExcel: "Xuất Excel",
            txExportPdf: "Xuất PDF",
            txTypeIncome: "Thu nhập",
            txTypeExpense: "Chi tiêu",
            txTypeTransfer: "Chuyển tiền",
            txTypeRoundup: "Round-up tiết kiệm",
            txBalance: "Số dư khả dụng",
            txNoData: "Chưa có giao dịch.",
            txValidationNegative: "Không thể thực hiện vì số dư sẽ âm.",
            txValidationAmount: "Số tiền phải lớn hơn 0.",
            txColTime: "Thời gian",
            txColType: "Loại",
            txColCategory: "Danh mục",
            txColAmount: "Giá trị",
            txColDelta: "Biến động số dư",
            txColNote: "Ghi chú",
            goalTitle: "Tiết kiệm theo mục tiêu (Round-up)",
            goalName: "Tên mục tiêu",
            goalTarget: "Mục tiêu",
            goalSaved: "Đã tích lũy",
            goalRoundUnit: "Bước làm tròn",
            goalSpendInput: "Chi tiêu giả lập",
            goalApply: "Áp dụng round-up",
            goalProgress: "Tiến độ",
            goalMonthlyInterest: "Lãi suất giả định/tháng (%)",
            goalProjectionMonths: "Số tháng mô phỏng",
            goalProjected: "Giá trị dự phóng",
            goalValidation: "Không đủ số dư cho chi tiêu + round-up.",
            categoryFood: "Ăn uống",
            categoryHousing: "Nhà ở",
            categoryTransport: "Di chuyển",
            categoryEducation: "Giáo dục",
            categoryHealth: "Sức khỏe",
            categoryInvestment: "Đầu tư",
            categoryOther: "Khác",
        },
        en: {
            location: "Your location",
            runAnalysis: "Re-run analysis",
            aiChat: "AI advisory chat",
            chatPlaceholder: "Ask AI about budget cuts, allocation, and financial strategy...",
            noChat: "No conversation yet. Add API key in Settings to activate cloud AI.",
            send: "Send",
            loading: "Replying...",
            you: "You",
            assistant: "AI",
            errorPrefix: "Error",
            aiModeRule: "rule-based",
            displayCurrency: "Display currency",
            converterTitle: "Live currency conversion",
            converterFrom: "From",
            converterTo: "To",
            converterAmount: "Amount",
            converterRun: "Convert",
            converterResult: "Result",
            converterRate: "Rate",
            transactionTitle: "Transaction history",
            transactionSubtitle: "Categorized ledger with negative-balance validation.",
            txType: "Type",
            txCategory: "Category",
            txAmount: "Amount",
            txNote: "Note",
            txAdd: "Add transaction",
            txExportCsv: "Export CSV",
            txExportExcel: "Export Excel",
            txExportPdf: "Export PDF",
            txTypeIncome: "Income",
            txTypeExpense: "Expense",
            txTypeTransfer: "Transfer",
            txTypeRoundup: "Round-up saving",
            txBalance: "Available balance",
            txNoData: "No transactions yet.",
            txValidationNegative: "Cannot continue because balance would become negative.",
            txValidationAmount: "Amount must be greater than 0.",
            txColTime: "Time",
            txColType: "Type",
            txColCategory: "Category",
            txColAmount: "Amount",
            txColDelta: "Balance change",
            txColNote: "Note",
            goalTitle: "Goal-based saving (Round-up)",
            goalName: "Goal name",
            goalTarget: "Target",
            goalSaved: "Saved",
            goalRoundUnit: "Round-up step",
            goalSpendInput: "Simulated spend",
            goalApply: "Apply round-up",
            goalProgress: "Progress",
            goalMonthlyInterest: "Simulated monthly interest (%)",
            goalProjectionMonths: "Projection months",
            goalProjected: "Projected value",
            goalValidation: "Insufficient balance for spend + round-up.",
            categoryFood: "Food",
            categoryHousing: "Housing",
            categoryTransport: "Transport",
            categoryEducation: "Education",
            categoryHealth: "Health",
            categoryInvestment: "Investment",
            categoryOther: "Other",
        },
        es: {
            location: "Tu ubicacion",
            runAnalysis: "Reanalizar",
            aiChat: "Chat de asesoria AI",
            chatPlaceholder: "Pregunta a la IA sobre recortes, asignacion y estrategia financiera...",
            noChat: "Sin conversacion. Agrega API key en Configuracion para activar AI cloud.",
            send: "Enviar",
            loading: "Respondiendo...",
            you: "Tu",
            assistant: "AI",
            errorPrefix: "Error",
            aiModeRule: "reglas locales",
            displayCurrency: "Moneda de visualizacion",
            converterTitle: "Conversion de moneda en vivo",
            converterFrom: "Desde",
            converterTo: "Hacia",
            converterAmount: "Monto",
            converterRun: "Convertir",
            converterResult: "Resultado",
            converterRate: "Tasa",
            transactionTitle: "Historial de transacciones",
            transactionSubtitle: "Libro categorizado con validacion de saldo negativo.",
            txType: "Tipo",
            txCategory: "Categoria",
            txAmount: "Monto",
            txNote: "Nota",
            txAdd: "Agregar transaccion",
            txExportCsv: "Exportar CSV",
            txExportExcel: "Exportar Excel",
            txExportPdf: "Exportar PDF",
            txTypeIncome: "Ingreso",
            txTypeExpense: "Gasto",
            txTypeTransfer: "Transferencia",
            txTypeRoundup: "Ahorro round-up",
            txBalance: "Saldo disponible",
            txNoData: "Sin transacciones.",
            txValidationNegative: "No se puede continuar porque el saldo quedaria negativo.",
            txValidationAmount: "El monto debe ser mayor que 0.",
            txColTime: "Hora",
            txColType: "Tipo",
            txColCategory: "Categoria",
            txColAmount: "Monto",
            txColDelta: "Cambio de saldo",
            txColNote: "Nota",
            goalTitle: "Ahorro por objetivo (Round-up)",
            goalName: "Nombre del objetivo",
            goalTarget: "Meta",
            goalSaved: "Ahorrado",
            goalRoundUnit: "Paso de redondeo",
            goalSpendInput: "Gasto simulado",
            goalApply: "Aplicar round-up",
            goalProgress: "Progreso",
            goalMonthlyInterest: "Interes mensual simulado (%)",
            goalProjectionMonths: "Meses proyectados",
            goalProjected: "Valor proyectado",
            goalValidation: "Saldo insuficiente para gasto + round-up.",
            categoryFood: "Comida",
            categoryHousing: "Vivienda",
            categoryTransport: "Transporte",
            categoryEducation: "Educacion",
            categoryHealth: "Salud",
            categoryInvestment: "Inversion",
            categoryOther: "Otros",
        },
    } as const;
    const x = extraLabels[locale as keyof typeof extraLabels] ?? extraLabels.en;

    const expenseCategories = useMemo(() => {
        const expenseCategoriesByLocale: Record<string, Record<string, number>> = {
            vi: {
                "Nhà ở": 15_000_000,
                "Ăn uống": 12_000_000,
                "Di chuyển": 5_000_000,
                "Giáo dục": 8_000_000,
                "Cà phê": 3_000_000,
                "Giải trí": 2_000_000,
                "Mua sắm": 4_000_000,
                "Khác": 3_000_000,
            },
            es: {
                Vivienda: 15_000_000,
                Comida: 12_000_000,
                Transporte: 5_000_000,
                Educacion: 8_000_000,
                Cafe: 3_000_000,
                Juegos: 2_000_000,
                Compras: 4_000_000,
                Otros: 3_000_000,
            },
            en: {
                Housing: 15_000_000,
                Food: 12_000_000,
                Transport: 5_000_000,
                Education: 8_000_000,
                Coffee: 3_000_000,
                Gaming: 2_000_000,
                Shopping: 4_000_000,
                Other: 3_000_000,
            },
        };
        return expenseCategoriesByLocale[locale] ?? expenseCategoriesByLocale.en;
    }, [locale]);

    const txTypeLabels: Record<TxType, string> = useMemo(
        () => ({
            income: x.txTypeIncome,
            expense: x.txTypeExpense,
            transfer: x.txTypeTransfer,
            round_up: x.txTypeRoundup,
        }),
        [x.txTypeExpense, x.txTypeIncome, x.txTypeRoundup, x.txTypeTransfer],
    );

    const categoryOptions = [
        { value: "food", label: x.categoryFood },
        { value: "housing", label: x.categoryHousing },
        { value: "transport", label: x.categoryTransport },
        { value: "education", label: x.categoryEducation },
        { value: "health", label: x.categoryHealth },
        { value: "investment", label: x.categoryInvestment },
        { value: "other", label: x.categoryOther },
    ];

    const formatMoney = useCallback(
        (amount: number, currency: string = displayCurrency, sourceCurrency: string = "VND") => {
            if (!Number.isFinite(amount)) return "--";
            let normalized = amount;
            if (sourceCurrency !== currency) {
                if (sourceCurrency === "VND" && currency !== "VND") normalized = amount * (vndToDisplayRate || 1);
                if (sourceCurrency !== "VND" && currency === "VND") normalized = amount / Math.max(vndToDisplayRate || 1, 0.00000001);
            }
            if (currency === "VND") {
                return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(normalized)}₫`;
            }
            if (["USD", "EUR", "GBP", "JPY"].includes(currency)) {
                const localeTag = locale === "vi" ? "vi-VN" : locale === "es" ? "es-ES" : "en-US";
                return new Intl.NumberFormat(localeTag, { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(normalized);
            }
            const digits = currency === "BTC" || currency === "ETH" ? 6 : 4;
            return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(normalized)} ${currency}`;
        },
        [displayCurrency, locale, vndToDisplayRate],
    );

    const baseBalance = useMemo(() => Math.max(income - expenses, 0), [income, expenses]);

    const walletBalance = useMemo(
        () => baseBalance + transactions.reduce((sum, row) => sum + row.delta, 0),
        [baseBalance, transactions],
    );

    const runAnalysis = useCallback(() => {
        void analyze({
            income,
            actual_expenses: expenses,
            planned_budget: budget,
            family_size: familySize,
            locale,
            location,
            meal_seed: Date.now(),
            expense_categories: expenseCategories,
        });
    }, [analyze, income, expenses, budget, familySize, locale, location, expenseCategories]);

    useEffect(() => {
        runAnalysis();
    }, [runAnalysis]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (displayCurrency === "VND") {
                setVndToDisplayRate(1);
                return;
            }
            try {
                const fx = await apiClient.convertCurrency(1, "VND", displayCurrency);
                if (mounted) setVndToDisplayRate(Number(fx.converted || 1));
            } catch {
                if (mounted) setVndToDisplayRate(1);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [displayCurrency]);

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        setChatMessages((prev) => [...prev, { role: "user", text }]);
        setChatInput("");
        setChatLoading(true);
        try {
            const payload = await apiClient.aiChat({
                message: text,
                provider: chatProvider,
                locale: locale as "vi" | "en" | "es",
            });
            setChatMessages((prev) => [...prev, { role: "assistant", text: payload.reply, provider: payload.provider }]);
        } catch (error) {
            setChatMessages((prev) => [...prev, { role: "assistant", text: `${x.errorPrefix}: ${(error as Error).message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const runConversion = async () => {
        setConverterLoading(true);
        try {
            const payload = await apiClient.convertCurrency(converterAmount, converterFrom, converterTo);
            setConverterResult({
                converted: Number(payload.converted || 0),
                rate: Number(payload.rate || 0),
                source: String(payload.source || "live"),
            });
        } catch {
            setConverterResult(null);
        } finally {
            setConverterLoading(false);
        }
    };

    const addTransaction = () => {
        setTxError("");
        const amount = Number(txAmount || 0);
        if (amount <= 0) {
            setTxError(x.txValidationAmount);
            return;
        }

        let delta = 0;
        if (txType === "income") delta = amount;
        else delta = -amount;

        if (walletBalance + delta < 0) {
            setTxError(x.txValidationNegative);
            return;
        }

        const row: TxRow = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: txType,
            category: txCategory,
            amount,
            delta,
            note: txNote.trim(),
            createdAt: new Date().toISOString(),
        };

        setTransactions((prev) => [row, ...prev].slice(0, 300));
        setTxNote("");
    };

    const applyRoundUp = () => {
        setTxError("");
        const spend = Number(spendAmount || 0);
        const unit = Math.max(Number(roundUnit || 0), 1);
        if (spend <= 0) {
            setTxError(x.txValidationAmount);
            return;
        }
        const rounded = Math.ceil(spend / unit) * unit;
        const roundup = rounded - spend;
        const totalDebit = spend + roundup;
        if (walletBalance < totalDebit) {
            setTxError(x.goalValidation);
            return;
        }

        const row: TxRow = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "round_up",
            category: "goal",
            amount: totalDebit,
            delta: -totalDebit,
            note: `${goalName}: ${spend.toLocaleString(locale)} + ${roundup.toLocaleString(locale)}`,
            createdAt: new Date().toISOString(),
        };
        setTransactions((prev) => [row, ...prev].slice(0, 300));
        setGoalSaved((prev) => prev + roundup);
    };

    const goalProgress = useMemo(() => {
        if (goalTarget <= 0) return 0;
        return Math.max(0, Math.min((goalSaved / goalTarget) * 100, 100));
    }, [goalSaved, goalTarget]);

    const projectedGoal = useMemo(() => {
        const growth = Math.pow(1 + Math.max(monthlyInterest, 0) / 100, Math.max(projectionMonths, 0));
        return goalSaved * growth;
    }, [goalSaved, monthlyInterest, projectionMonths]);

    const exportCsvText = useMemo(() => {
        const header = [x.txColTime, x.txColType, x.txColCategory, x.txColAmount, x.txColDelta, x.txColNote].join(",");
        const rows = transactions.map((row) =>
            [
                new Date(row.createdAt).toLocaleString(locale),
                txTypeLabels[row.type],
                row.category,
                row.amount,
                row.delta,
                (row.note || "").replace(/,/g, " "),
            ].join(","),
        );
        return [header, ...rows].join("\n");
    }, [transactions, locale, txTypeLabels, x.txColAmount, x.txColCategory, x.txColDelta, x.txColNote, x.txColTime, x.txColType]);

    const downloadText = (content: string, filename: string, mime: string) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportCsv = () => downloadText(exportCsvText, `transactions-${Date.now()}.csv`, "text/csv;charset=utf-8");
    const exportExcel = () => downloadText(exportCsvText, `transactions-${Date.now()}.xls`, "application/vnd.ms-excel;charset=utf-8");
    const exportPdf = () => {
        const popup = window.open("", "_blank", "width=1000,height=700");
        if (!popup) return;
        popup.document.write(`
            <html>
                <head>
                    <title>${x.transactionTitle}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
                        th { background: #f3f4f6; text-align: left; }
                    </style>
                </head>
                <body>
                    <h2>${x.transactionTitle}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>${x.txColTime}</th>
                                <th>${x.txColType}</th>
                                <th>${x.txColCategory}</th>
                                <th>${x.txColAmount}</th>
                                <th>${x.txColDelta}</th>
                                <th>${x.txColNote}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions
                                .map(
                                    (row) => `<tr>
                                    <td>${new Date(row.createdAt).toLocaleString(locale)}</td>
                                    <td>${txTypeLabels[row.type]}</td>
                                    <td>${row.category}</td>
                                    <td>${row.amount.toLocaleString(locale)}</td>
                                    <td>${row.delta.toLocaleString(locale)}</td>
                                    <td>${row.note || ""}</td>
                                </tr>`,
                                )
                                .join("")}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
        popup.focus();
        popup.print();
    };

    return (
        <div className="page-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
            <GuruScolding expenseCategories={expenseCategories} />

            <div className="animate-fadeIn" style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>{t("title")}</h1>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
            </div>

            <div className="card card-padding animate-fadeIn" style={{ marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                    <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{tDash("income")}</label>
                        <input type="number" className="input" value={income} onChange={(e) => setIncome(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{tDash("expenses")}</label>
                        <input type="number" className="input" value={expenses} onChange={(e) => setExpenses(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{tDash("budget")}</label>
                        <input type="number" className="input" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{t("family")}</label>
                        <input type="number" className="input" min={1} max={20} value={familySize} onChange={(e) => setFamilySize(Number(e.target.value) || 1)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{x.displayCurrency}</label>
                        <select className="input" value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)}>
                            {CURRENCY_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{x.location}</label>
                        <input
                            type="text"
                            className="input"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder={locale === "vi" ? "Ví dụ: New York, United States" : locale === "es" ? "Ejemplo: New York, United States" : "Example: New York, United States"}
                        />
                    </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={runAnalysis} disabled={loading}>{loading ? "..." : x.runAnalysis}</button>
                </div>
            </div>

            <div className="card card-padding animate-fadeIn" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <RiRobot2Line size={16} />
                    <h3 style={{ fontSize: "0.9rem", margin: 0 }}>{x.aiChat}</h3>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <select className="input" style={{ width: 170 }} value={chatProvider} onChange={(e) => setChatProvider(e.target.value as typeof chatProvider)}>
                            <option value="auto">Auto</option>
                            <option value="gemini">Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                        <input
                            className="input"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void sendChat();
                            }}
                            placeholder={x.chatPlaceholder}
                        />
                        <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading}>
                            <RiSendPlaneLine size={14} /> {chatLoading ? x.loading : x.send}
                        </button>
                    </div>
                    <div className="card" style={{ padding: 10, minHeight: 120, maxHeight: 240, overflowY: "auto" }}>
                        {chatMessages.length === 0 ? (
                            <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{x.noChat}</div>
                        ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={`${msg.role}-${idx}`}
                                        style={{
                                            fontSize: "0.82rem",
                                            borderRadius: 10,
                                            padding: "8px 10px",
                                            background: msg.role === "user" ? "color-mix(in srgb, var(--primary) 18%, transparent)" : "var(--surface-hover)",
                                            whiteSpace: "pre-wrap",
                                        }}
                                    >
                                        <strong>{msg.role === "user" ? x.you : `${x.assistant}${msg.provider ? ` (${msg.provider})` : ""}`}:</strong> {msg.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card card-padding animate-fadeIn" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>{x.converterTitle}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.converterAmount}</label>
                        <input className="input" type="number" value={converterAmount} onChange={(e) => setConverterAmount(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.converterFrom}</label>
                        <select className="input" value={converterFrom} onChange={(e) => setConverterFrom(e.target.value)}>
                            {CURRENCY_OPTIONS.map((option) => (
                                <option key={`from-${option}`} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.converterTo}</label>
                        <select className="input" value={converterTo} onChange={(e) => setConverterTo(e.target.value)}>
                            {CURRENCY_OPTIONS.map((option) => (
                                <option key={`to-${option}`} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <button className="btn btn-primary" onClick={runConversion} disabled={converterLoading} style={{ width: "100%" }}>
                            {converterLoading ? "..." : x.converterRun}
                        </button>
                    </div>
                </div>
                {converterResult && (
                    <div className="card" style={{ marginTop: 10, padding: 10 }}>
                        <div style={{ fontSize: "0.82rem" }}>{x.converterResult}: <strong>{formatMoney(converterResult.converted, converterTo, converterTo)}</strong></div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                            {x.converterRate}: {converterResult.rate.toFixed(8)} ({converterResult.source})
                        </div>
                    </div>
                )}
            </div>

            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                    <div className="skeleton" style={{ height: 240 }} />
                    <div className="skeleton" style={{ height: 320 }} />
                    <div className="skeleton" style={{ height: 200 }} />
                </div>
            )}

            {result && !loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <GuruVerdict
                        score={result.health_score}
                        status={result.health_status}
                        verdict={result.guru_verdict}
                        advice={result.guru_advice}
                        wastefulHabits={result.wasteful_habits}
                        savingsRate={result.savings_rate}
                    />

                    <MealPlan
                        meals={result.meal_plan}
                        dailyBudget={result.daily_food_budget}
                        familySize={familySize}
                        locale={locale}
                        foodContext={result.food_price_context}
                        aiProviderUsed={result.ai_provider_used || x.aiModeRule}
                        displayCurrency={displayCurrency}
                        vndToDisplayRate={vndToDisplayRate}
                    />

                    <AssetAllocation allocations={result.asset_allocation} investableAmount={result.investable_amount} />
                </div>
            )}

            <div className="card card-padding animate-fadeIn" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: "0.96rem", marginBottom: 4 }}>{x.transactionTitle}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>{x.transactionSubtitle}</p>

                <div className="card" style={{ padding: 10, marginBottom: 12 }}>
                    <strong>{x.txBalance}: </strong>
                    <span style={{ color: walletBalance >= 0 ? "var(--success)" : "var(--danger)" }}>{formatMoney(walletBalance, displayCurrency)}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.txType}</label>
                        <select className="input" value={txType} onChange={(e) => setTxType(e.target.value as TxType)}>
                            <option value="income">{x.txTypeIncome}</option>
                            <option value="expense">{x.txTypeExpense}</option>
                            <option value="transfer">{x.txTypeTransfer}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.txCategory}</label>
                        <select className="input" value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                            {categoryOptions.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.txAmount}</label>
                        <input className="input" type="number" value={txAmount} onChange={(e) => setTxAmount(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.txNote}</label>
                        <input className="input" value={txNote} onChange={(e) => setTxNote(e.target.value)} />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={addTransaction}>{x.txAdd}</button>
                    <button className="btn" onClick={exportCsv}>{x.txExportCsv}</button>
                    <button className="btn" onClick={exportExcel}>{x.txExportExcel}</button>
                    <button className="btn" onClick={exportPdf}>{x.txExportPdf}</button>
                </div>

                {txError && (
                    <div style={{ marginTop: 10, color: "var(--danger)", fontSize: "0.82rem" }}>{txError}</div>
                )}

                <div style={{ marginTop: 12, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColTime}</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColType}</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColCategory}</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColAmount}</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColDelta}</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>{x.txColNote}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: "10px", color: "var(--text-muted)" }}>{x.txNoData}</td>
                                </tr>
                            )}
                            {transactions.map((row) => (
                                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "8px" }}>{new Date(row.createdAt).toLocaleString(locale)}</td>
                                    <td style={{ padding: "8px" }}>{txTypeLabels[row.type]}</td>
                                    <td style={{ padding: "8px" }}>{row.category}</td>
                                    <td style={{ padding: "8px" }}>{formatMoney(row.amount, displayCurrency)}</td>
                                    <td style={{ padding: "8px", color: row.delta >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                                        {row.delta >= 0 ? "+" : ""}{formatMoney(row.delta, displayCurrency)}
                                    </td>
                                    <td style={{ padding: "8px" }}>{row.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card card-padding animate-fadeIn" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: "0.96rem", marginBottom: 12 }}>{x.goalTitle}</h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalName}</label>
                        <input className="input" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalTarget}</label>
                        <input className="input" type="number" value={goalTarget} onChange={(e) => setGoalTarget(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalRoundUnit}</label>
                        <input className="input" type="number" value={roundUnit} onChange={(e) => setRoundUnit(Math.max(Number(e.target.value) || 0, 1))} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalSpendInput}</label>
                        <input className="input" type="number" value={spendAmount} onChange={(e) => setSpendAmount(Number(e.target.value) || 0)} />
                    </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" onClick={applyRoundUp}>{x.goalApply}</button>
                    <span className="badge badge-success" style={{ alignSelf: "center" }}>{x.goalSaved}: {formatMoney(goalSaved, displayCurrency)}</span>
                </div>

                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
                        <span>{x.goalProgress}</span>
                        <strong>{goalProgress.toFixed(1)}%</strong>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "var(--surface-hover)", overflow: "hidden" }}>
                        <div style={{ width: `${goalProgress}%`, height: "100%", background: "linear-gradient(90deg, var(--warning), var(--primary))" }} />
                    </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalMonthlyInterest}</label>
                        <input className="input" type="number" step="0.1" value={monthlyInterest} onChange={(e) => setMonthlyInterest(Number(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{x.goalProjectionMonths}</label>
                        <input className="input" type="number" value={projectionMonths} onChange={(e) => setProjectionMonths(Number(e.target.value) || 0)} />
                    </div>
                    <div className="card" style={{ padding: 10, alignSelf: "end" }}>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{x.goalProjected}</div>
                        <div style={{ fontWeight: 800, color: "var(--primary)", marginTop: 3 }}>{formatMoney(projectedGoal, displayCurrency)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
