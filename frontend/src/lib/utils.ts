

import type { BudgetStatus } from "./types";



export function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
}


export function formatCompact(amount: number): string {
    if (Math.abs(amount) >= 1_000_000) {
        return (amount / 1_000_000).toFixed(1) + "M ₫";
    }
    return formatVND(amount);
}


export function formatCurrency(amount: number, locale: string = "vi"): string {
    if (locale === "en") {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
    }
    if (locale === "es") {
        return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
    }
    return formatVND(amount);
}



export function getStatusColor(status: BudgetStatus | string): string {
    switch (status) {
        case "healthy":
        case "excellent":
            return "var(--success)";
        case "warning":
        case "needs_improvement":
            return "var(--warning)";
        case "critical":
        case "over_budget":
            return "var(--danger)";
        default:
            return "var(--text-muted)";
    }
}



export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}


export function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}


export function uniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
