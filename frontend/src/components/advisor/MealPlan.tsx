"use client";



import type { DailyMeal } from "@/lib/types";
import { useTranslations } from "next-intl";

interface MealPlanProps {
    meals: DailyMeal[];
    dailyBudget: number;
    familySize: number;
    locale: string;
    foodContext?: {
        resolved_location: string;
        local_price_multiplier: number;
        average_restaurant_meal_vnd: number;
        estimated_home_meal_per_person_vnd: number;
        nearby_restaurants: number;
        nearby_examples: string[];
        note: string;
    };
    aiProviderUsed?: string;
    displayCurrency?: string;
    vndToDisplayRate?: number;
}

export default function MealPlan({
    meals,
    dailyBudget,
    familySize,
    foodContext,
    aiProviderUsed,
    locale,
    displayCurrency = "VND",
    vndToDisplayRate = 1,
}: MealPlanProps) {
    const t = useTranslations("advisor");
    const weeklyTotal = meals.reduce((sum, m) => sum + m.total_cost, 0);
    const monthlyEstimate = weeklyTotal * 4.3;

    const labels = {
        vi: {
            location: "Khu vực",
            avgRestaurant: "Giá bữa ăn nhà hàng TB",
            avgHome: "Giá bữa ăn tự nấu/người",
            priceIndex: "Chỉ số giá",
            nearbyRestaurants: "Nhà hàng lân cận",
            nearbyExamples: "Ví dụ gần đây",
            aiMode: "Chế độ AI",
            month: "tháng",
        },
        en: {
            location: "Location",
            avgRestaurant: "Avg restaurant meal",
            avgHome: "Avg home meal/person",
            priceIndex: "Price index",
            nearbyRestaurants: "Nearby restaurants",
            nearbyExamples: "Nearby examples",
            aiMode: "AI mode",
            month: "month",
        },
        es: {
            location: "Ubicacion",
            avgRestaurant: "Comida restaurante prom.",
            avgHome: "Comida casera prom./persona",
            priceIndex: "Indice de precio",
            nearbyRestaurants: "Restaurantes cercanos",
            nearbyExamples: "Ejemplos cercanos",
            aiMode: "Modo AI",
            month: "mes",
        },
    } as const;

    const x = labels[locale as keyof typeof labels] ?? labels.en;

    const formatMoney = (valueVnd: number) => {
        const converted = displayCurrency === "VND" ? valueVnd : valueVnd * (vndToDisplayRate || 1);
        if (displayCurrency === "VND") {
            return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(converted)}₫`;
        }
        if (["USD", "EUR", "GBP", "JPY"].includes(displayCurrency)) {
            const localeTag = locale === "vi" ? "vi-VN" : locale === "es" ? "es-ES" : "en-US";
            return new Intl.NumberFormat(localeTag, {
                style: "currency",
                currency: displayCurrency,
                maximumFractionDigits: displayCurrency === "JPY" ? 0 : 2,
            }).format(converted);
        }
        const digits = displayCurrency === "BTC" || displayCurrency === "ETH" ? 6 : 4;
        return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(converted)} ${displayCurrency}`;
    };

    return (
        <div className="card animate-slideUp" style={{ animationDelay: "0.1s" }}>
            <div className="card-padding" style={{ paddingBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "1.25rem" }}>🍽️</span>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.025em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {t("meal_plan")}
                        </h3>
                    </div>
                    <span className="badge badge-success">{familySize} 👤</span>
                </div>

                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
                    {t("avg_food_cost")}: {formatMoney(dailyBudget)}/{t("day")} • {formatMoney(monthlyEstimate)}/{x.month}
                </p>

                {foodContext && (
                    <div className="card" style={{ padding: 10, marginBottom: 14, background: "var(--surface-hover)" }}>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "grid", gap: 4 }}>
                            <div><strong>{x.location}:</strong> {foodContext.resolved_location || "--"}</div>
                            <div><strong>{x.avgRestaurant}:</strong> {formatMoney(foodContext.average_restaurant_meal_vnd)}</div>
                            <div><strong>{x.avgHome}:</strong> {formatMoney(foodContext.estimated_home_meal_per_person_vnd)}</div>
                            <div><strong>{x.priceIndex}:</strong> {foodContext.local_price_multiplier.toFixed(2)}x</div>
                            <div><strong>{x.nearbyRestaurants}:</strong> {foodContext.nearby_restaurants}</div>
                            {foodContext.nearby_examples.length > 0 && (
                                <div><strong>{x.nearbyExamples}:</strong> {foodContext.nearby_examples.slice(0, 3).join(", ")}</div>
                            )}
                            {foodContext.note && <div style={{ color: "var(--text-muted)" }}>{foodContext.note}</div>}
                            {aiProviderUsed && <div><strong>{x.aiMode}:</strong> {aiProviderUsed}</div>}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="meal-table">
                    <thead>
                        <tr>
                            <th>{t("day")}</th>
                            <th>{t("breakfast")}</th>
                            <th>{t("lunch")}</th>
                            <th>{t("dinner")}</th>
                            <th style={{ textAlign: "right" }}>{t("total")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meals.map((meal, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
                                    {meal.day}
                                </td>
                                <td>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{meal.breakfast.name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatMoney(meal.breakfast.cost)}</div>
                                    {(meal.breakfast.ingredients ?? []).length > 0 && (
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            {(meal.breakfast.ingredients ?? []).slice(0, 3).map((it) => `${it.name} (${formatMoney(it.estimated_cost)})`).join(", ")}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{meal.lunch.name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatMoney(meal.lunch.cost)}</div>
                                    {(meal.lunch.ingredients ?? []).length > 0 && (
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            {(meal.lunch.ingredients ?? []).slice(0, 3).map((it) => `${it.name} (${formatMoney(it.estimated_cost)})`).join(", ")}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{meal.dinner.name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{meal.dinner.description}</div>
                                    {(meal.dinner.ingredients ?? []).length > 0 && (
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            {(meal.dinner.ingredients ?? []).slice(0, 4).map((it) => `${it.name} (${formatMoney(it.estimated_cost)})`).join(", ")}
                                        </div>
                                    )}
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--primary)", whiteSpace: "nowrap" }}>
                                    {formatMoney(meal.total_cost)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4} style={{ fontWeight: 700, color: "var(--text)", borderTop: "2px solid var(--border)", paddingTop: 16 }}>
                                {t("week_total")}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)", fontSize: "1rem", borderTop: "2px solid var(--border)", paddingTop: 16 }}>
                                {formatMoney(weeklyTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
