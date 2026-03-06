"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
    ArrowsLeftRight,
    ArrowCircleDown,
    ArrowCircleUp,
    ChartBar,
    CreditCard,
    LockKey,
    Target,
    UserCircle,
    Wallet,
} from "@phosphor-icons/react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type TxStatus = "completed" | "pending" | "cancelled";
type TxCategory = "transfer" | "subscription" | "shopping" | "investment" | "utilities";
type TxPeriod = "today" | "week" | "month";
type AccountType = "all" | "card" | "wallet" | "bank";
type ActivityView = "month" | "quarter";

type TxRow = {
    id: string;
    name: string;
    note: string;
    amount: number;
    status: TxStatus;
    category: TxCategory;
    account: Exclude<AccountType, "all">;
    period: TxPeriod;
    time: string;
};

type CardRow = {
    id: string;
    holder: string;
    network: string;
    last4: string;
    used: number;
    limit: number;
    frozen: boolean;
};

const MONTH_ACTIVITY = [
    { label: "Jan", income: 6200, expense: 4100 },
    { label: "Feb", income: 6800, expense: 4700 },
    { label: "Mar", income: 6400, expense: 4200 },
    { label: "Apr", income: 7200, expense: 5100 },
    { label: "May", income: 7600, expense: 5200 },
    { label: "Jun", income: 7400, expense: 4980 },
];

const QUARTER_ACTIVITY = [
    { label: "Q1", income: 19400, expense: 13000 },
    { label: "Q2", income: 22200, expense: 15280 },
    { label: "Q3", income: 23500, expense: 16020 },
    { label: "Q4", income: 24700, expense: 16910 },
];

const DEFAULT_TRANSACTIONS: TxRow[] = [
    { id: "tx1", name: "Netflix", note: "Streaming plan", amount: -12.99, status: "completed", category: "subscription", account: "card", period: "today", time: "08:41" },
    { id: "tx2", name: "Salary", note: "Monthly payroll", amount: 2750, status: "completed", category: "transfer", account: "bank", period: "today", time: "09:12" },
    { id: "tx3", name: "Uber", note: "Airport transfer", amount: -18.25, status: "completed", category: "utilities", account: "wallet", period: "week", time: "18:05" },
    { id: "tx4", name: "Amazon", note: "Office supplies", amount: -76.5, status: "pending", category: "shopping", account: "card", period: "week", time: "14:24" },
    { id: "tx5", name: "ETF DCA", note: "Auto invest", amount: -150, status: "completed", category: "investment", account: "bank", period: "week", time: "11:00" },
    { id: "tx6", name: "Cloud bill", note: "Infra service", amount: -42.2, status: "cancelled", category: "utilities", account: "card", period: "month", time: "17:30" },
    { id: "tx7", name: "Client payout", note: "Consulting", amount: 920, status: "completed", category: "transfer", account: "bank", period: "month", time: "10:16" },
];

const DEFAULT_GOALS = [
    { id: "g1", name: "Macbook", current: 920, target: 2200 },
    { id: "g2", name: "Travel fund", current: 1650, target: 2500 },
    { id: "g3", name: "Emergency fund", current: 3800, target: 5000 },
];

const DEFAULT_CARDS: CardRow[] = [
    { id: "c1", holder: "Thanh Vu", network: "Visa", last4: "7609", used: 1540, limit: 3500, frozen: false },
    { id: "c2", holder: "Thanh Vu", network: "Mastercard", last4: "1298", used: 820, limit: 2000, frozen: false },
];

function getStatusTone(status: TxStatus) {
    if (status === "completed") return "var(--success)";
    if (status === "pending") return "var(--warning)";
    return "var(--danger)";
}

export default function ProductDashboardShowcase() {
    const locale = useLocale();

    const [periodFilter, setPeriodFilter] = useState<TxPeriod>("today");
    const [accountFilter, setAccountFilter] = useState<AccountType>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | TxStatus>("all");
    const [categoryFilter, setCategoryFilter] = useState<"all" | TxCategory>("all");
    const [activityView, setActivityView] = useState<ActivityView>("month");
    const [cards, setCards] = useState<CardRow[]>(DEFAULT_CARDS);
    const [fromAccount, setFromAccount] = useState("Visa •••• 7609");
    const [toAccount, setToAccount] = useState("2203 8760 1276 9965");
    const [amount, setAmount] = useState("1500");
    const [lastAction, setLastAction] = useState("Transfer");
    const [transferStatus, setTransferStatus] = useState("");

    const labels = {
        vi: {
            greeting: "Chao buoi sang, Thanh Vu",
            subtitle: "Nen tang tai chinh ca nhan va dau tu da duoc to chuc lai de dep CV hon.",
            balance: "So du",
            income: "Thu nhap",
            expenses: "Chi tieu",
            transactionsCenter: "Transactions Center",
            transferPanel: "Payments / Transfer",
            cardsPanel: "Cards Management",
            goalsPanel: "My Goals",
            activityPanel: "Activity Overview",
            quickActions: "Quick Actions",
            transfer: "Transfer",
            receive: "Receive",
            topup: "Top up",
            freeze: "Freeze card",
            period: "Period",
            account: "Account",
            status: "Status",
            category: "Category",
            all: "All",
            today: "Today",
            week: "Week",
            month: "Month",
            chartMonth: "6 months",
            chartQuarter: "Quarter",
            from: "From",
            to: "To",
            amount: "Amount",
            send: "Execute transfer",
            txName: "Transaction",
            txAmount: "Amount",
            txState: "Status",
            txTime: "Time",
            noTx: "No transactions for current filters.",
            used: "Used",
            limit: "Limit",
            frozen: "Frozen",
            active: "Active",
            progress: "Progress",
            personalize: "Product profile",
            role: "Fintech Product Build",
            actionDone: "Action queued:",
            visual1: "Investments",
            visual2: "Your finances",
            visual3: "Savings plan",
        },
        en: {
            greeting: "Good morning, Thanh Vu",
            subtitle: "Personal finance and investment surface is now organized in product-ready layout.",
            balance: "Balance",
            income: "Income",
            expenses: "Expenses",
            transactionsCenter: "Transactions Center",
            transferPanel: "Payments / Transfer",
            cardsPanel: "Cards Management",
            goalsPanel: "My Goals",
            activityPanel: "Activity Overview",
            quickActions: "Quick Actions",
            transfer: "Transfer",
            receive: "Receive",
            topup: "Top up",
            freeze: "Freeze card",
            period: "Period",
            account: "Account",
            status: "Status",
            category: "Category",
            all: "All",
            today: "Today",
            week: "Week",
            month: "Month",
            chartMonth: "6 months",
            chartQuarter: "Quarter",
            from: "From",
            to: "To",
            amount: "Amount",
            send: "Execute transfer",
            txName: "Transaction",
            txAmount: "Amount",
            txState: "Status",
            txTime: "Time",
            noTx: "No transactions for current filters.",
            used: "Used",
            limit: "Limit",
            frozen: "Frozen",
            active: "Active",
            progress: "Progress",
            personalize: "Product profile",
            role: "Fintech Product Build",
            actionDone: "Action queued:",
            visual1: "Investments",
            visual2: "Your finances",
            visual3: "Savings plan",
        },
        es: {
            greeting: "Buenos dias, Thanh Vu",
            subtitle: "La capa de finanzas personales e inversion ahora tiene layout de producto.",
            balance: "Balance",
            income: "Ingresos",
            expenses: "Gastos",
            transactionsCenter: "Transactions Center",
            transferPanel: "Payments / Transfer",
            cardsPanel: "Cards Management",
            goalsPanel: "My Goals",
            activityPanel: "Activity Overview",
            quickActions: "Quick Actions",
            transfer: "Transfer",
            receive: "Receive",
            topup: "Top up",
            freeze: "Freeze card",
            period: "Period",
            account: "Account",
            status: "Status",
            category: "Category",
            all: "All",
            today: "Today",
            week: "Week",
            month: "Month",
            chartMonth: "6 months",
            chartQuarter: "Quarter",
            from: "From",
            to: "To",
            amount: "Amount",
            send: "Execute transfer",
            txName: "Transaction",
            txAmount: "Amount",
            txState: "Status",
            txTime: "Time",
            noTx: "No transactions for current filters.",
            used: "Used",
            limit: "Limit",
            frozen: "Frozen",
            active: "Active",
            progress: "Progress",
            personalize: "Product profile",
            role: "Fintech Product Build",
            actionDone: "Action queued:",
            visual1: "Investments",
            visual2: "Your finances",
            visual3: "Savings plan",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const filteredTransactions = useMemo(() => {
        return DEFAULT_TRANSACTIONS.filter((row) => {
            if (periodFilter !== row.period) return false;
            if (accountFilter !== "all" && row.account !== accountFilter) return false;
            if (statusFilter !== "all" && row.status !== statusFilter) return false;
            if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
            return true;
        });
    }, [accountFilter, categoryFilter, periodFilter, statusFilter]);

    const totals = useMemo(() => {
        const income = DEFAULT_TRANSACTIONS.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
        const expenses = Math.abs(DEFAULT_TRANSACTIONS.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0));
        return {
            income,
            expenses,
            balance: 18987.19,
        };
    }, []);

    const activityData = activityView === "month" ? MONTH_ACTIVITY : QUARTER_ACTIVITY;

    return (
        <div className="animate-fadeIn" style={{ display: "grid", gap: 16 }}>
            <section className="card card-padding" style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                        <h2 style={{ fontSize: "1.36rem", marginBottom: 6 }}>{t.greeting}</h2>
                        <p style={{ fontSize: "0.9rem", maxWidth: 760 }}>{t.subtitle}</p>
                    </div>
                    <div className="card" style={{ padding: 10, minWidth: 250, display: "flex", alignItems: "center", gap: 10 }}>
                        <UserCircle size={34} />
                        <div>
                            <div style={{ fontWeight: 700 }}>Thanh Vu</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.personalize}</div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>{t.role}</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <div className="card" style={{ padding: 12, background: "color-mix(in srgb, var(--primary) 13%, var(--surface))" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            <Wallet size={16} /> {t.balance}
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 8 }}>{formatCurrency(totals.balance, locale)}</div>
                    </div>
                    <div className="card" style={{ padding: 12, background: "color-mix(in srgb, var(--success) 14%, var(--surface))" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            <ArrowCircleUp size={16} /> {t.income}
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 8 }}>{formatCurrency(totals.income, locale)}</div>
                    </div>
                    <div className="card" style={{ padding: 12, background: "color-mix(in srgb, var(--danger) 12%, var(--surface))" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            <ArrowCircleDown size={16} /> {t.expenses}
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 8 }}>{formatCurrency(totals.expenses, locale)}</div>
                    </div>
                </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div className="card card-padding" style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: "1.08rem" }}>{t.transactionsCenter}</h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                        <select className="input" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as TxPeriod)}>
                            <option value="today">{t.period}: {t.today}</option>
                            <option value="week">{t.period}: {t.week}</option>
                            <option value="month">{t.period}: {t.month}</option>
                        </select>
                        <select className="input" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value as AccountType)}>
                            <option value="all">{t.account}: {t.all}</option>
                            <option value="card">{t.account}: Card</option>
                            <option value="wallet">{t.account}: Wallet</option>
                            <option value="bank">{t.account}: Bank</option>
                        </select>
                        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | TxStatus)}>
                            <option value="all">{t.status}: {t.all}</option>
                            <option value="completed">{t.status}: Completed</option>
                            <option value="pending">{t.status}: Pending</option>
                            <option value="cancelled">{t.status}: Cancelled</option>
                        </select>
                        <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "all" | TxCategory)}>
                            <option value="all">{t.category}: {t.all}</option>
                            <option value="transfer">{t.category}: Transfer</option>
                            <option value="subscription">{t.category}: Subscription</option>
                            <option value="shopping">{t.category}: Shopping</option>
                            <option value="investment">{t.category}: Investment</option>
                            <option value="utilities">{t.category}: Utilities</option>
                        </select>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.txName}</th>
                                    <th style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.txAmount}</th>
                                    <th style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.txState}</th>
                                    <th style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.txTime}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)", fontSize: "0.84rem" }}>{t.noTx}</td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((row) => (
                                        <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "10px 6px" }}>
                                                <div style={{ fontWeight: 600 }}>{row.name}</div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.note}</div>
                                            </td>
                                            <td style={{ padding: "10px 6px", fontWeight: 700, color: row.amount >= 0 ? "var(--success)" : "var(--danger)" }}>
                                                {row.amount >= 0 ? "+" : ""}{formatCurrency(row.amount, locale)}
                                            </td>
                                            <td style={{ padding: "10px 6px" }}>
                                                <span className="badge" style={{ background: "color-mix(in srgb, currentColor 12%, transparent)", color: getStatusTone(row.status) }}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: "10px 6px", color: "var(--text-secondary)" }}>{row.time}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                    <div className="card card-padding" style={{ display: "grid", gap: 10 }}>
                        <h3 style={{ fontSize: "1.02rem" }}>{t.transferPanel}</h3>
                        <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.from}</label>
                        <input className="input" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} />
                        <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.to}</label>
                        <input className="input" value={toAccount} onChange={(e) => setToAccount(e.target.value)} />
                        <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.amount}</label>
                        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        <button
                            className="btn btn-primary"
                            onClick={() => setTransferStatus(`${t.actionDone} ${t.transfer} ${amount}`)}
                            style={{ width: "100%", justifyContent: "center" }}
                        >
                            <ArrowsLeftRight size={15} />
                            {t.send}
                        </button>
                        {transferStatus ? <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{transferStatus}</div> : null}
                    </div>

                    <div className="card card-padding" style={{ display: "grid", gap: 8 }}>
                        <h3 style={{ fontSize: "1.02rem" }}>{t.quickActions}</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                            <button className="btn btn-secondary" onClick={() => setLastAction(t.transfer)}><ArrowsLeftRight size={14} />{t.transfer}</button>
                            <button className="btn btn-secondary" onClick={() => setLastAction(t.receive)}><ArrowCircleDown size={14} />{t.receive}</button>
                            <button className="btn btn-secondary" onClick={() => setLastAction(t.topup)}><ArrowCircleUp size={14} />{t.topup}</button>
                            <button className="btn btn-secondary" onClick={() => setLastAction(t.freeze)}><LockKey size={14} />{t.freeze}</button>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.actionDone} {lastAction}</div>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                        <div className="card" style={{ minHeight: 76, padding: 12, background: "linear-gradient(140deg, color-mix(in srgb, var(--primary) 55%, #1f2937) 0%, color-mix(in srgb, var(--surface) 70%, #111827) 100%)", color: "var(--primary-foreground)" }}>
                            <div style={{ fontWeight: 700 }}>{t.visual1}</div>
                        </div>
                        <div className="card" style={{ minHeight: 76, padding: 12, background: "linear-gradient(140deg, color-mix(in srgb, var(--accent) 45%, #111827) 0%, color-mix(in srgb, var(--surface) 70%, #1f2937) 100%)", color: "var(--text)" }}>
                            <div style={{ fontWeight: 700 }}>{t.visual2}</div>
                        </div>
                        <div className="card" style={{ minHeight: 76, padding: 12, background: "linear-gradient(140deg, color-mix(in srgb, var(--warning) 45%, #111827) 0%, color-mix(in srgb, var(--surface) 72%, #1f2937) 100%)", color: "var(--text)" }}>
                            <div style={{ fontWeight: 700 }}>{t.visual3}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div className="card card-padding" style={{ display: "grid", gap: 12 }}>
                    <h3 style={{ fontSize: "1.05rem" }}>{t.cardsPanel}</h3>
                    <div style={{ display: "grid", gap: 8 }}>
                        {cards.map((card) => {
                            const utilization = card.limit > 0 ? Math.min(100, (card.used / card.limit) * 100) : 0;
                            return (
                                <div key={card.id} className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{card.network} •••• {card.last4}</div>
                                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{card.holder}</div>
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: "6px 9px" }}
                                            onClick={() => setCards((prev) => prev.map((x) => (x.id === card.id ? { ...x, frozen: !x.frozen } : x)))}
                                        >
                                            <CreditCard size={14} />
                                            {card.frozen ? t.frozen : t.active}
                                        </button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                                        <div style={{ height: 7, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden" }}>
                                            <div style={{ width: `${utilization}%`, height: "100%", background: "var(--gradient)" }} />
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                            {t.used}: {formatCurrency(card.used, locale)} / {t.limit}: {formatCurrency(card.limit, locale)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                    <div className="card card-padding" style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <h3 style={{ fontSize: "1.05rem" }}>{t.goalsPanel}</h3>
                            <Target size={17} />
                        </div>
                        {DEFAULT_GOALS.map((goal) => {
                            const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                            return (
                                <div key={goal.id} style={{ display: "grid", gap: 5 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <strong>{goal.name}</strong>
                                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{progress}%</span>
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                        {formatCurrency(goal.current, locale)} / {formatCurrency(goal.target, locale)}
                                    </div>
                                    <div style={{ height: 7, background: "var(--surface-hover)", borderRadius: 999, overflow: "hidden" }}>
                                        <div style={{ width: `${progress}%`, height: "100%", background: "var(--gradient)" }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="card card-padding" style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <h3 style={{ fontSize: "1.05rem" }}>{t.activityPanel}</h3>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button className={`btn ${activityView === "month" ? "btn-primary" : "btn-secondary"}`} style={{ padding: "6px 10px" }} onClick={() => setActivityView("month")}>
                                    {t.chartMonth}
                                </button>
                                <button className={`btn ${activityView === "quarter" ? "btn-primary" : "btn-secondary"}`} style={{ padding: "6px 10px" }} onClick={() => setActivityView("quarter")}>
                                    {t.chartQuarter}
                                </button>
                            </div>
                        </div>
                        <div style={{ width: "100%", height: 230 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activityData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 10,
                                            border: "1px solid var(--border)",
                                            background: "var(--surface)",
                                            color: "var(--text)",
                                        }}
                                        formatter={(value: number | string | undefined) => formatCurrency(Number(value || 0), locale)}
                                    />
                                    <Bar dataKey="income" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="expense" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <ChartBar size={14} /> {t.income}
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <ChartBar size={14} /> {t.expenses}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
