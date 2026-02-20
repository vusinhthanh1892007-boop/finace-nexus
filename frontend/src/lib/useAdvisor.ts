"use client";



import { useState, useCallback } from "react";
import type {
    AdvisorInput,
    AdvisorResult,
    MealItem,
    DailyMeal,
    AssetAllocation,
} from "./types";
import { clamp } from "./utils";

export type { AdvisorInput, AdvisorResult };



function computeScore(savingsRate: number, utilization: number, underBudget: boolean): number {
    let score = 50;
    if (savingsRate >= 30) score += 30;
    else if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate < 0) score -= 20;

    if (utilization <= 80) score += 15;
    else if (utilization <= 100) score += 5;
    else score -= 15;

    if (underBudget) score += 5;
    return clamp(score, 0, 100);
}


function scoreToStatus(score: number): string {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "needs_improvement";
    return "critical";
}


function buildVerdict(score: number, savingsRate: number, utilization: number, locale: string): string {
    const verdicts: Record<string, string> = {
        vi: score >= 60
            ? `👍 Khá tốt! Điểm: ${score}/100. Tỷ lệ tiết kiệm ${savingsRate.toFixed(0)}%.`
            : `⚠️ Cần cải thiện! Điểm: ${score}/100. Chi tiêu ${utilization.toFixed(0)}% ngân sách.`,
        en: score >= 60
            ? `👍 Good! Score: ${score}/100. Savings rate ${savingsRate.toFixed(0)}%.`
            : `⚠️ Needs work! Score: ${score}/100. Using ${utilization.toFixed(0)}% of budget.`,
        es: score >= 60
            ? `👍 ¡Bien! Puntuación: ${score}/100. Tasa de ahorro ${savingsRate.toFixed(0)}%.`
            : `⚠️ ¡Necesita mejorar! Puntuación: ${score}/100.`,
    };
    return verdicts[locale] ?? verdicts["en"];
}


type MenuSeedItem = Omit<MealItem, "cost"> & { unitCost: number };
type RegionKey = "vn" | "us" | "es" | "jp";

const REGION_MENUS: Record<RegionKey, { multiplier: number; breakfasts: MenuSeedItem[]; lunches: MenuSeedItem[]; dinners: MealItem[] }> = {
    vn: {
        multiplier: 1,
        breakfasts: [
            { name: "Banh mi trung", unitCost: 20_000, description: "Egg bread" },
            { name: "Pho bo", unitCost: 45_000, description: "Beef pho" },
            { name: "Bun bo Hue", unitCost: 40_000, description: "Hue noodles" },
            { name: "Xoi ga", unitCost: 25_000, description: "Sticky rice" },
            { name: "Chao ga", unitCost: 25_000, description: "Chicken porridge" },
            { name: "Banh cuon", unitCost: 30_000, description: "Rice rolls" },
            { name: "Bun cha", unitCost: 40_000, description: "Grilled pork noodles" },
        ],
        lunches: [
            { name: "Com tam suon", unitCost: 45_000, description: "Broken rice" },
            { name: "Bun thit nuong", unitCost: 40_000, description: "Grilled meat noodles" },
            { name: "Com ga xoi mo", unitCost: 45_000, description: "Crispy chicken rice" },
            { name: "Mi Quang", unitCost: 35_000, description: "Quang noodles" },
            { name: "Com van phong", unitCost: 35_000, description: "Office lunch" },
            { name: "Hu tieu Nam Vang", unitCost: 40_000, description: "PP noodle soup" },
            { name: "Bun rieu cua", unitCost: 35_000, description: "Crab noodle soup" },
        ],
        dinners: [
            { name: "Com nha nau", cost: 150_000, description: "Fish, veggies, soup" },
            { name: "Com nha nau", cost: 120_000, description: "Braised pork, greens" },
            { name: "Com nha nau", cost: 180_000, description: "Grilled chicken, tofu" },
            { name: "Com nha nau", cost: 130_000, description: "Eggs, stir-fry, soup" },
            { name: "Com nha nau", cost: 160_000, description: "Steamed fish, beans" },
        ],
    },
    us: {
        multiplier: 4.2,
        breakfasts: [
            { name: "Bagel and eggs", unitCost: 120_000, description: "Protein breakfast" },
            { name: "Oatmeal bowl", unitCost: 110_000, description: "Whole grains and fruit" },
            { name: "Greek yogurt bowl", unitCost: 100_000, description: "Yogurt and berries" },
            { name: "Pancake set", unitCost: 135_000, description: "Pancakes and fruits" },
        ],
        lunches: [
            { name: "Turkey sandwich", unitCost: 190_000, description: "Whole wheat sandwich" },
            { name: "Chicken salad", unitCost: 210_000, description: "Lean protein salad" },
            { name: "Burrito bowl", unitCost: 230_000, description: "Rice and protein bowl" },
            { name: "Pasta lunch set", unitCost: 240_000, description: "Pasta and vegetables" },
        ],
        dinners: [
            { name: "Grilled salmon set", cost: 480_000, description: "Salmon, rice, vegetables" },
            { name: "Steak and veggies", cost: 540_000, description: "Steak with sides" },
            { name: "Chicken rice bowl", cost: 420_000, description: "Chicken and mixed greens" },
            { name: "Pasta and meatballs", cost: 460_000, description: "Balanced dinner" },
        ],
    },
    es: {
        multiplier: 3.1,
        breakfasts: [
            { name: "Tostada con huevo", unitCost: 95_000, description: "Toast and eggs" },
            { name: "Yogur con fruta", unitCost: 85_000, description: "Yogurt and fruit" },
            { name: "Avena", unitCost: 80_000, description: "Oatmeal bowl" },
        ],
        lunches: [
            { name: "Pollo con arroz", unitCost: 170_000, description: "Chicken rice set" },
            { name: "Pasta mediterranea", unitCost: 180_000, description: "Pasta and vegetables" },
            { name: "Ensalada con atun", unitCost: 165_000, description: "Tuna salad" },
        ],
        dinners: [
            { name: "Pescado al horno", cost: 320_000, description: "Baked fish and salad" },
            { name: "Tortilla espanola", cost: 280_000, description: "Potato omelette and soup" },
            { name: "Pollo a la plancha", cost: 300_000, description: "Grilled chicken dinner" },
        ],
    },
    jp: {
        multiplier: 3.4,
        breakfasts: [
            { name: "Onigiri and miso soup", unitCost: 100_000, description: "Rice ball set" },
            { name: "Tamago and rice", unitCost: 105_000, description: "Egg and rice" },
            { name: "Tofu breakfast", unitCost: 95_000, description: "Tofu and greens" },
        ],
        lunches: [
            { name: "Bento chicken", unitCost: 180_000, description: "Bento style meal" },
            { name: "Ramen set", unitCost: 190_000, description: "Ramen with side dish" },
            { name: "Curry rice", unitCost: 175_000, description: "Japanese curry" },
        ],
        dinners: [
            { name: "Grilled fish set", cost: 340_000, description: "Fish, rice, vegetables" },
            { name: "Teriyaki chicken", cost: 320_000, description: "Chicken and salad" },
            { name: "Hotpot dinner", cost: 360_000, description: "Shared hotpot meal" },
        ],
    },
};

const WEEKDAYS_BY_LOCALE = {
    vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    es: ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"],
} as const;


function getLocationMultiplier(location?: string): number {
    const q = String(location || "").toLowerCase();
    if (!q) return 1;
    if (q.includes("new york") || q.includes("united states") || q.includes("usa")) return 4.2;
    if (q.includes("madrid") || q.includes("spain")) return 3.1;
    if (q.includes("tokyo") || q.includes("japan")) return 3.4;
    if (q.includes("hanoi") || q.includes("ha noi") || q.includes("ho chi minh") || q.includes("saigon")) return 1.2;
    if (q.includes("da nang") || q.includes("danang")) return 1.0;
    return 1;
}

function detectRegion(location?: string, locale?: string): RegionKey {
    const q = String(location || "").toLowerCase();
    if (q.includes("new york") || q.includes("united states") || q.includes("usa")) return "us";
    if (q.includes("madrid") || q.includes("barcelona") || q.includes("spain")) return "es";
    if (q.includes("tokyo") || q.includes("osaka") || q.includes("japan")) return "jp";
    if (q.includes("viet nam") || q.includes("vietnam") || q.includes("hanoi") || q.includes("ha noi") || q.includes("ho chi minh") || q.includes("da nang")) return "vn";
    if (locale === "vi") return "vn";
    if (locale === "es") return "es";
    return "us";
}

function buildMealPlan(familySize: number, locale: string, location?: string, mealSeed?: number): DailyMeal[] {
    const days = WEEKDAYS_BY_LOCALE[locale as keyof typeof WEEKDAYS_BY_LOCALE] ?? WEEKDAYS_BY_LOCALE.en;
    const region = detectRegion(location, locale);
    const menu = REGION_MENUS[region];
    const multiplier = menu.multiplier;
    const rng = Math.abs(Number(mealSeed ?? Date.now())) % 997;
    return days.map((day, i) => {
        const bi = (i * 3 + rng) % menu.breakfasts.length;
        const li = (i * 5 + rng) % menu.lunches.length;
        const di = (i * 7 + rng) % menu.dinners.length;
        const breakfast: MealItem = {
            name: menu.breakfasts[bi].name,
            cost: Math.round(menu.breakfasts[bi].unitCost * familySize * multiplier),
            description: menu.breakfasts[bi].description,
        };
        const lunch: MealItem = {
            name: menu.lunches[li].name,
            cost: Math.round(menu.lunches[li].unitCost * familySize * multiplier),
            description: menu.lunches[li].description,
        };
        const dinner: MealItem = {
            ...menu.dinners[di],
            cost: Math.round(menu.dinners[di].cost * multiplier),
        };
        return {
            day,
            breakfast,
            lunch,
            dinner,
            snack: null,
            total_cost: breakfast.cost + lunch.cost + dinner.cost,
        };
    });
}


function buildAllocation(investable: number, locale: string): AssetAllocation[] {
    if (investable <= 0) return [];

    if (locale === "vi") {
        return [
            { category: "Co phieu / ETF", percentage: 35, amount: investable * 0.35, rationale: "Tang truong theo chi so thi truong lon" },
            { category: "Vang", percentage: 20, amount: investable * 0.2, rationale: "Phong ho lam phat" },
            { category: "Tiet kiem", percentage: 30, amount: investable * 0.3, rationale: "Quy du phong an toan" },
            { category: "Trai phieu", percentage: 15, amount: investable * 0.15, rationale: "Dong tien on dinh" },
        ];
    }
    if (locale === "es") {
        return [
            { category: "Acciones / ETF", percentage: 35, amount: investable * 0.35, rationale: "Crecimiento a largo plazo del mercado" },
            { category: "Oro", percentage: 20, amount: investable * 0.2, rationale: "Cobertura contra inflacion" },
            { category: "Ahorro", percentage: 30, amount: investable * 0.3, rationale: "Fondo de emergencia" },
            { category: "Bonos", percentage: 15, amount: investable * 0.15, rationale: "Rendimiento estable" },
        ];
    }

    return [
        { category: "Stocks / ETF", percentage: 35, amount: investable * 0.35, rationale: "Growth via VN30 index" },
        { category: "Gold / SJC", percentage: 20, amount: investable * 0.2, rationale: "Inflation hedge" },
        { category: "Savings", percentage: 30, amount: investable * 0.3, rationale: "Emergency fund" },
        { category: "Bonds", percentage: 15, amount: investable * 0.15, rationale: "Stable returns" },
    ];
}

function buildAdvice(locale: string, savingsRate: number): string[] {
    if (locale === "vi") {
        return [
            savingsRate < 20 ? "Tang ty le tiet kiem len it nhat 20% thu nhap" : "Ty le tiet kiem rat tot!",
            "Nau an tai nha de giam chi phi an uong 40-60%",
            "Tranh mua sam cam tinh, doi 24h truoc khi mua do khong thiet yeu",
        ];
    }
    if (locale === "es") {
        return [
            savingsRate < 20 ? "Sube tu tasa de ahorro a por lo menos 20% del ingreso" : "Excelente tasa de ahorro",
            "Cocina en casa para reducir 40-60% de gasto en comida",
            "Evita compras impulsivas, espera 24h antes de compras no esenciales",
        ];
    }
    return [
        savingsRate < 20 ? "Increase savings to at least 20% of income" : "Great savings rate!",
        "Cook at home to cut food costs by 40-60%",
        "Avoid impulse purchases and wait 24h before non-essential buys",
    ];
}


function clientSideAnalysis(input: AdvisorInput): AdvisorResult {
    const savings = input.income - input.actual_expenses;
    const savingsRate = input.income > 0 ? (savings / input.income) * 100 : 0;
    const utilization = input.planned_budget > 0 ? (input.actual_expenses / input.planned_budget) * 100 : 0;
    const investable = Math.max(savings * 0.7, 0);

    const score = computeScore(savingsRate, utilization, input.actual_expenses <= input.planned_budget);
    const mealPlan = buildMealPlan(input.family_size, input.locale, input.location, input.meal_seed);

    return {
        health_score: score,
        health_status: scoreToStatus(score),
        guru_verdict: buildVerdict(score, savingsRate, utilization, input.locale),
        guru_advice: buildAdvice(input.locale, savingsRate),
        wasteful_habits: [],
        meal_plan: mealPlan,
        daily_food_budget: mealPlan.reduce((s, m) => s + m.total_cost, 0) / 7,
            food_price_context: {
                query: input.location || "",
                resolved_location: input.location || (input.locale === "vi" ? "Khu vực địa phương" : input.locale === "es" ? "Zona local" : "Local region"),
                country_code: "",
                lat: null,
                lon: null,
                local_price_multiplier: getLocationMultiplier(input.location),
                average_restaurant_meal_vnd: Math.round(90000 * getLocationMultiplier(input.location)),
                estimated_home_meal_per_person_vnd: Math.round(38000 * getLocationMultiplier(input.location)),
                nearby_restaurants: 0,
                nearby_examples: [],
                note:
                    input.locale === "vi"
                        ? "Ước tính từ dữ liệu cục bộ."
                        : input.locale === "es"
                          ? "Estimado con datos locales."
                          : "Estimated by local fallback data.",
            },
        asset_allocation: buildAllocation(investable, input.locale),
        investable_amount: investable,
        savings_rate: Math.round(savingsRate * 10) / 10,
            ai_provider_used: input.locale === "vi" ? "cục bộ" : input.locale === "es" ? "local" : "local",
            analyzed_at: new Date().toISOString(),
        };
}



export function useAdvisor() {
    const [result, setResult] = useState<AdvisorResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyze = useCallback(async (input: AdvisorInput) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/advisor/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });

            if (res.ok) {
                const data: AdvisorResult = await res.json();
                setResult(data);
            } else {
                throw new Error(`API error: ${res.status}`);
            }
        } catch {
            const fallback = clientSideAnalysis(input);
            setResult(fallback);
        } finally {
            setLoading(false);
        }
    }, []);

    return { result, loading, error, analyze };
}
