"""AI Advisor Engine — financial analysis, meal planning, and AI verdict."""

from __future__ import annotations

import json
import logging
import os
import random
from datetime import datetime
from math import exp
from typing import Any

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WORLD_BANK_INDICATOR_URL = "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"

COUNTRY_REGION_HINTS = {
    "US": "western",
    "CA": "western",
    "GB": "western",
    "AU": "western",
    "NZ": "western",
    "IE": "western",
    "DE": "western",
    "FR": "western",
    "IT": "western",
    "ES": "latam",
    "MX": "latam",
    "AR": "latam",
    "CL": "latam",
    "CO": "latam",
    "PE": "latam",
    "VN": "asia",
    "TH": "asia",
    "MY": "asia",
    "SG": "asia",
    "JP": "asia",
    "KR": "asia",
    "CN": "asia",
    "IN": "asia",
}

QUERY_COUNTRY_HINTS = {
    "new york": "US",
    "newyork": "US",
    "san francisco": "US",
    "los angeles": "US",
    "california": "US",
    "texas": "US",
    "london": "GB",
    "madrid": "ES",
    "barcelona": "ES",
    "mexico city": "MX",
    "tokyo": "JP",
    "seoul": "KR",
    "singapore": "SG",
    "hanoi": "VN",
    "ha noi": "VN",
    "ho chi minh": "VN",
    "saigon": "VN",
    "da nang": "VN",
    "danang": "VN",
}

COUNTRY_BASE_MULTIPLIER = {
    "US": 2.45,
    "CA": 2.1,
    "GB": 2.2,
    "AU": 2.2,
    "NZ": 1.95,
    "SG": 2.0,
    "JP": 2.1,
    "KR": 1.8,
    "DE": 1.95,
    "FR": 1.9,
    "IT": 1.75,
    "ES": 1.45,
    "MX": 1.2,
    "AR": 1.1,
    "CL": 1.2,
    "CO": 1.05,
    "PE": 1.0,
    "VN": 1.0,
    "TH": 0.95,
    "MY": 1.0,
    "IN": 0.85,
    "CN": 1.1,
}


class AdvisorInput(BaseModel):
    """Input for the AI advisor analysis."""

    income: float = Field(gt=0, description="Monthly income")
    actual_expenses: float = Field(ge=0, description="Actual expenses")
    planned_budget: float = Field(gt=0, description="Planned budget")
    family_size: int = Field(default=4, ge=1, le=20, description="Family members")
    locale: str = Field(default="vi", description="Response language (en/vi/es)")
    location: str = Field(default="", max_length=180, description="User location/address for local meal price estimate")
    meal_seed: int | None = Field(default=None, description="Optional seed to randomize 7-day meal plan")
    expense_categories: dict[str, float] = Field(
        default_factory=dict,
        description="Breakdown of expenses by category",
    )


class IngredientLine(BaseModel):
    name: str
    estimated_cost: float


class MealItem(BaseModel):
    name: str
    cost: float
    description: str = ""
    ingredients: list[IngredientLine] = []


class DailyMeal(BaseModel):
    day: str
    breakfast: MealItem
    lunch: MealItem
    dinner: MealItem
    snack: MealItem | None = None
    total_cost: float = 0


class AssetAllocation(BaseModel):
    category: str
    percentage: float
    amount: float
    rationale: str = ""


class FoodPriceContext(BaseModel):
    query: str = ""
    resolved_location: str = ""
    country_code: str = ""
    lat: float | None = None
    lon: float | None = None
    local_price_multiplier: float = 1.0
    average_restaurant_meal_vnd: float = 90000.0
    estimated_home_meal_per_person_vnd: float = 38000.0
    nearby_restaurants: int = 0
    nearby_examples: list[str] = []
    note: str = ""


class AdvisorResult(BaseModel):
    """Complete advisor analysis result."""

    health_score: int = Field(ge=0, le=100, description="Financial health 0-100")
    health_status: str = ""
    guru_verdict: str = ""
    guru_advice: list[str] = []
    wasteful_habits: list[str] = []
    meal_plan: list[DailyMeal] = []
    daily_food_budget: float = 0
    food_price_context: FoodPriceContext | None = None
    asset_allocation: list[AssetAllocation] = []
    investable_amount: float = 0
    savings_rate: float = 0
    ai_provider_used: str = "rule-based"
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)


from app.data.meals import MEAL_LIBRARY_BY_REGION


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_location_query(value: str) -> str:
    raw = " ".join(str(value or "").strip().split())
    normalized = raw.lower()
    replacements = {
        "newyork": "new york",
        "hochiminh": "ho chi minh",
        "hcmc": "ho chi minh",
    }
    for src, dst in replacements.items():
        normalized = normalized.replace(src, dst)
    return normalized


def _guess_country_code_from_query(value: str) -> str:
    normalized = _normalize_location_query(value)
    for key, code in QUERY_COUNTRY_HINTS.items():
        if key in normalized:
            return code
    return ""


def _base_multiplier_by_country(country_code: str, locale: str) -> float:
    code = country_code.upper().strip()
    if code in COUNTRY_BASE_MULTIPLIER:
        return COUNTRY_BASE_MULTIPLIER[code]
    if locale == "en":
        return 1.35
    if locale == "es":
        return 1.15
    return 1.0


def _localized_food_note(locale: str, precise: bool) -> str:
    if locale == "vi":
        return (
            "Ước tính theo geocode + mật độ nhà hàng + dữ liệu vĩ mô."
            if precise
            else "Ước tính theo khu vực. Hãy nhập địa chỉ đầy đủ để tăng độ chính xác."
        )
    if locale == "es":
        return (
            "Estimado con geocodificacion + densidad de restaurantes + datos macro."
            if precise
            else "Estimacion regional. Agrega una direccion completa para mayor precision."
        )
    return (
        "Estimated from geocoding + restaurant density + macro indicators."
        if precise
        else "Estimated by regional baseline. Add a full address for more precise local pricing."
    )


def _meal_region(country_code: str) -> str:
    code = country_code.upper().strip()
    return COUNTRY_REGION_HINTS.get(code, "asia")


class AdvisorEngine:
    """AI Financial Advisor engine with deterministic + Gemini hybrid analysis."""

    def __init__(self, gemini_api_key: str = ""):
        self._api_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        self._model = "gemini-2.0-flash"
        self._base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def analyze(self, input_data: AdvisorInput, *, allow_ai: bool = True) -> AdvisorResult:
        """Run complete financial analysis."""
        food_context = await self._estimate_food_price_context(input_data.location, input_data.locale)
        result = self._rule_based_analysis(input_data, food_context)

        if allow_ai and self._api_key:
            try:
                ai_verdict = await self._gemini_analysis(input_data, result, food_context)
                if ai_verdict:
                    result.guru_verdict = ai_verdict.get("verdict", result.guru_verdict)
                    if ai_verdict.get("advice"):
                        result.guru_advice = [str(x) for x in ai_verdict["advice"]][:8]
                    if ai_verdict.get("wasteful"):
                        result.wasteful_habits = [str(x) for x in ai_verdict["wasteful"]][:8]
                    result.ai_provider_used = "gemini"
            except Exception as e:
                logger.warning("Gemini analysis failed, using rule-based: %s", e)

        return result

    def _rule_based_analysis(self, inp: AdvisorInput, food_context: FoodPriceContext) -> AdvisorResult:
        """Deterministic financial analysis — no external AI required."""
        savings = inp.income - inp.actual_expenses
        savings_rate = (savings / inp.income * 100) if inp.income > 0 else 0
        utilization = (inp.actual_expenses / inp.planned_budget * 100) if inp.planned_budget > 0 else 0
        investable = max(savings * 0.7, 0)

        score = 50
        if savings_rate >= 30:
            score += 30
        elif savings_rate >= 20:
            score += 20
        elif savings_rate >= 10:
            score += 10
        elif savings_rate < 0:
            score -= 20

        if utilization <= 80:
            score += 15
        elif utilization <= 100:
            score += 5
        else:
            score -= 15

        if inp.actual_expenses <= inp.planned_budget:
            score += 5

        score = max(0, min(100, score))

        if score >= 80:
            status = "excellent"
        elif score >= 60:
            status = "good"
        elif score >= 40:
            status = "needs_improvement"
        else:
            status = "critical"

        verdict_map = {
            "vi": self._vn_verdict(score, savings_rate, utilization, inp),
            "en": self._en_verdict(score, savings_rate, utilization, inp),
            "es": self._es_verdict(score, savings_rate, utilization, inp),
        }
        verdict = verdict_map.get(inp.locale, verdict_map["en"])

        advice = self._generate_advice(inp, savings_rate, utilization, food_context)
        wasteful = self._detect_wasteful(inp)
        meal_plan = self._generate_meal_plan(inp, food_context)
        daily_budget = sum(m.total_cost for m in meal_plan) / max(len(meal_plan), 1)
        allocation = self._generate_allocation(investable, score)

        return AdvisorResult(
            health_score=score,
            health_status=status,
            guru_verdict=verdict,
            guru_advice=advice,
            wasteful_habits=wasteful,
            meal_plan=meal_plan,
            daily_food_budget=daily_budget,
            food_price_context=food_context,
            asset_allocation=allocation,
            investable_amount=investable,
            savings_rate=round(savings_rate, 1),
            ai_provider_used="rule-based",
        )

    def _vn_verdict(self, score: int, sr: float, util: float, inp: AdvisorInput) -> str:
        if score >= 80:
            return (
                f"🏆 Xuất sắc! Điểm: {score}/100. Tỷ lệ tiết kiệm {sr:.0f}%. "
                f"Bạn đang giữ kỷ luật tài chính rất tốt."
            )
        if score >= 60:
            return (
                f"👍 Khá tốt! Điểm: {score}/100. Tiết kiệm {sr:.0f}%. "
                f"Mức dùng ngân sách {util:.0f}%."
            )
        if score >= 40:
            return (
                f"⚠️ Cần cải thiện! Điểm: {score}/100. "
                f"Bạn tiêu {inp.actual_expenses:,.0f} trên ngân sách {inp.planned_budget:,.0f}."
            )
        return (
            f"🚨 Báo động! Điểm: {score}/100. "
            f"Mức dùng ngân sách {util:.0f}% và tỷ lệ tiết kiệm {sr:.0f}%."
        )

    def _en_verdict(self, score: int, sr: float, util: float, inp: AdvisorInput) -> str:
        if score >= 80:
            return f"🏆 Excellent! Score {score}/100. Savings rate {sr:.0f}% with strong discipline."
        if score >= 60:
            return f"👍 Good! Score {score}/100. Savings {sr:.0f}%, budget utilization {util:.0f}%."
        if score >= 40:
            return f"⚠️ Needs improvement! Score {score}/100. Spending {inp.actual_expenses:,.0f} on {inp.planned_budget:,.0f} budget."
        return f"🚨 Alert! Score {score}/100. Budget utilization {util:.0f}% and savings only {sr:.0f}%."

    def _es_verdict(self, score: int, sr: float, util: float, inp: AdvisorInput) -> str:
        if score >= 80:
            return f"🏆 Excelente: {score}/100. Ahorro {sr:.0f}% con alta disciplina."
        if score >= 60:
            return f"👍 Bien: {score}/100. Ahorro {sr:.0f}% y uso del presupuesto {util:.0f}%."
        if score >= 40:
            return f"⚠️ Debe mejorar: {score}/100. Gastos {inp.actual_expenses:,.0f} sobre presupuesto {inp.planned_budget:,.0f}."
        return f"🚨 Alerta: {score}/100. Uso del presupuesto {util:.0f}% y ahorro {sr:.0f}%."

    def _generate_advice(self, inp: AdvisorInput, sr: float, util: float, food_context: FoodPriceContext) -> list[str]:
        advice: list[str] = []
        locale = inp.locale
        if sr < 20:
            advice.append(
                "Đặt mục tiêu tiết kiệm ít nhất 20% thu nhập mỗi tháng."
                if locale == "vi"
                else "Ajusta tu meta para ahorrar al menos 20% de tus ingresos mensuales."
                if locale == "es"
                else "Target saving at least 20% of your income each month."
            )
        if util > 90:
            advice.append(
                "Mức sử dụng ngân sách đang cao. Hãy cắt chi phí không thiết yếu trong tuần này."
                if locale == "vi"
                else "El uso del presupuesto es alto. Reduce gastos no esenciales esta semana."
                if locale == "es"
                else "Budget utilization is high. Cut non-essential expenses this week."
            )
        if food_context.local_price_multiplier > 1.15:
            advice.append(
                "Khu vực bạn ở có mặt bằng giá ăn uống cao. Nên ưu tiên nấu ăn tại nhà 4-5 ngày/tuần."
                if locale == "vi"
                else "Tu zona tiene precios de comida elevados. Cocina en casa 4-5 dias por semana."
                if locale == "es"
                else "Your area has above-average food prices. Prefer home-cooked meals 4-5 days/week."
            )
        if food_context.nearby_restaurants > 0:
            if locale == "vi":
                advice.append(
                    f"Phát hiện {food_context.nearby_restaurants} nhà hàng gần bạn. Hãy đặt trần chi tiêu ăn ngoài rõ ràng."
                )
            elif locale == "es":
                advice.append(
                    f"Se detectaron {food_context.nearby_restaurants} restaurantes cercanos. Define un tope estricto para comer fuera."
                )
            else:
                advice.append(
                    f"Nearby restaurants detected ({food_context.nearby_restaurants}). Set a strict outside-eating cap."
                )
        if inp.expense_categories:
            for cat, amount in inp.expense_categories.items():
                ratio = amount / inp.income * 100 if inp.income else 0
                if cat.lower() in ("gaming", "entertainment", "subscriptions", "giai tri", "juegos") and ratio > 5:
                    advice.append(
                        f"'{cat}' chiếm {ratio:.0f}% thu nhập. Nên đặt hạn mức cứng theo tháng."
                        if locale == "vi"
                        else f"'{cat}' representa {ratio:.0f}% de tus ingresos. Define un limite mensual estricto."
                        if locale == "es"
                        else f"'{cat}' is {ratio:.0f}% of income. Set a hard monthly cap."
                    )
        if not advice:
            advice.append(
                "Duy trì kỷ luật hiện tại và tái cân bằng ngân sách theo tháng."
                if locale == "vi"
                else "Mantén tu disciplina actual y rebalancea el presupuesto cada mes."
                if locale == "es"
                else "Maintain your current discipline and rebalance budget monthly."
            )
        return advice[:8]

    def _detect_wasteful(self, inp: AdvisorInput) -> list[str]:
        wasteful: list[str] = []
        if inp.expense_categories:
            for cat, amount in inp.expense_categories.items():
                ratio = amount / inp.income * 100 if inp.income else 0
                lower = cat.lower()
                if lower in ("gaming", "games", "gacha", "juegos") and ratio >= 3:
                    wasteful.append(f"🎮 {cat}: {ratio:.1f}% income")
                if lower in ("coffee", "café", "starbucks", "ca phe") and ratio >= 2.5:
                    wasteful.append(f"☕ {cat}: {ratio:.1f}% income")
                if lower in ("uber", "grab", "taxi") and ratio >= 5:
                    wasteful.append(f"🚗 {cat}: {ratio:.1f}% income")
        return wasteful[:8]

    def _localized_days(self, locale: str) -> list[str]:
        mapping = {
            "vi": ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"],
            "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "es": ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"],
        }
        return mapping.get(locale, mapping["en"])

    def _build_ingredient_lines(self, ingredient_names: list[str], total_cost: float, rng: random.Random) -> list[IngredientLine]:
        if not ingredient_names:
            return []
        raw_weights = [0.6 + rng.random() for _ in ingredient_names]
        total_weight = sum(raw_weights) or 1.0
        lines: list[IngredientLine] = []
        allocated = 0.0
        for idx, name in enumerate(ingredient_names):
            if idx == len(ingredient_names) - 1:
                cost = max(0.0, total_cost - allocated)
            else:
                cost = round(total_cost * raw_weights[idx] / total_weight, 0)
                allocated += cost
            lines.append(IngredientLine(name=str(name), estimated_cost=cost))
        return lines

    def _generate_meal_plan(self, inp: AdvisorInput, food_context: FoodPriceContext) -> list[DailyMeal]:
        """Generate randomized 7-day meal plan with location-adjusted pricing."""
        days = self._localized_days(inp.locale)
        plan: list[DailyMeal] = []
        multiplier = _clamp(food_context.local_price_multiplier, 0.6, 2.8)

        seed = inp.meal_seed if inp.meal_seed is not None else (
            int(datetime.utcnow().timestamp() * 1000) ^ int(inp.income) ^ (inp.family_size * 131)
        )
        seed_i = abs(int(seed))
        seed_mix = seed_i ^ (seed_i >> 5) ^ (seed_i >> 11)
        rng = random.Random(seed_mix)

        region = _meal_region(food_context.country_code)
        meal_library = MEAL_LIBRARY_BY_REGION.get(region, MEAL_LIBRARY_BY_REGION["asia"])

        if region == "western":
            snack_pool = [
                {"name": "Greek yogurt + berries", "cost": 85000, "desc": "High protein snack", "ingredients": ["Yogurt", "Berries"]},
                {"name": "Mixed nuts + milk", "cost": 95000, "desc": "Healthy fats and protein", "ingredients": ["Nuts", "Milk"]},
                {"name": "Banana + peanut butter toast", "cost": 78000, "desc": "Fiber and energy", "ingredients": ["Banana", "Peanut butter", "Bread"]},
            ]
        elif region == "latam":
            snack_pool = [
                {"name": "Fruta + yogur", "cost": 42000, "desc": "Snack ligero", "ingredients": ["Fruta", "Yogur"]},
                {"name": "Nueces + leche", "cost": 46000, "desc": "Snack proteico", "ingredients": ["Nueces", "Leche"]},
                {"name": "Tostada integral", "cost": 39000, "desc": "Snack de fibra", "ingredients": ["Pan integral", "Queso"]},
            ]
        else:
            snack_pool = [
                {"name": "Trái cây + sữa chua", "cost": 18000, "desc": "Bữa phụ nhẹ", "ingredients": ["Trái cây", "Sữa chua"]},
                {"name": "Hạt + sữa", "cost": 22000, "desc": "Bữa phụ giàu đạm", "ingredients": ["Hạt", "Sữa"]},
                {"name": "Khoai lang luộc", "cost": 12000, "desc": "Bữa phụ nhiều chất xơ", "ingredients": ["Khoai lang"]},
            ]

        breakfasts = meal_library["breakfast"]
        lunches = meal_library["lunch"]
        dinners = meal_library["dinner"]

        for day_idx, day in enumerate(days):
            b_idx = (seed_mix + day_idx * 2 + 1) % len(breakfasts)
            l_idx = (seed_mix * 3 + day_idx * 3 + 2) % len(lunches)
            d_idx = (seed_mix * 5 + day_idx * 5 + 3) % len(dinners)

            b = breakfasts[b_idx]
            l = lunches[l_idx]
            d = dinners[d_idx]

            day_factor = rng.uniform(0.94, 1.12)
            b_cost = round(float(b["cost"]) * inp.family_size * multiplier * day_factor, 0)
            l_cost = round(float(l["cost"]) * inp.family_size * multiplier * day_factor, 0)
            d_cost = round(float(d["cost"]) * (inp.family_size / 4.0) * multiplier * day_factor, 0)

            breakfast = MealItem(
                name=str(b["name"]),
                cost=b_cost,
                description=str(b.get("desc", "")),
                ingredients=self._build_ingredient_lines([str(x) for x in b.get("ingredients", [])], b_cost, rng),
            )
            lunch = MealItem(
                name=str(l["name"]),
                cost=l_cost,
                description=str(l.get("desc", "")),
                ingredients=self._build_ingredient_lines([str(x) for x in l.get("ingredients", [])], l_cost, rng),
            )
            dinner = MealItem(
                name=str(d["name"]),
                cost=d_cost,
                description=str(d.get("desc", "")),
                ingredients=self._build_ingredient_lines([str(x) for x in d.get("ingredients", [])], d_cost, rng),
            )

            snack: MealItem | None = None
            if rng.random() >= 0.45:
                s = snack_pool[rng.randrange(len(snack_pool))]
                s_cost = round(float(s["cost"]) * inp.family_size * multiplier * rng.uniform(0.9, 1.15), 0)
                snack = MealItem(
                    name=str(s["name"]),
                    cost=s_cost,
                    description=str(s["desc"]),
                    ingredients=self._build_ingredient_lines([str(x) for x in s.get("ingredients", [])], s_cost, rng),
                )

            total = breakfast.cost + lunch.cost + dinner.cost + (snack.cost if snack else 0)
            plan.append(
                DailyMeal(
                    day=day,
                    breakfast=breakfast,
                    lunch=lunch,
                    dinner=dinner,
                    snack=snack,
                    total_cost=total,
                )
            )
        return plan

    def _generate_allocation(self, investable: float, score: int) -> list[AssetAllocation]:
        """Generate investment allocation based on risk profile."""
        if investable <= 0:
            return []

        if score >= 70:
            splits = [
                ("Stocks / ETF", 40, "Growth exposure via diversified index funds"),
                ("Gold", 15, "Inflation hedge"),
                ("Savings Account", 25, "Emergency fund"),
                ("Government Bonds", 15, "Stable fixed-income returns"),
                ("Cash Reserve", 5, "Liquidity"),
            ]
        elif score >= 50:
            splits = [
                ("Stocks / ETF", 25, "Moderate growth allocation"),
                ("Gold", 20, "Inflation protection"),
                ("Savings Account", 35, "Build emergency fund"),
                ("Government Bonds", 15, "Safe fixed income"),
                ("Cash Reserve", 5, "Immediate liquidity"),
            ]
        else:
            splits = [
                ("Savings Account", 50, "Priority: 6-month emergency fund"),
                ("Gold", 20, "Capital preservation"),
                ("Government Bonds", 20, "Stable returns while rebuilding"),
                ("Cash Reserve", 10, "Liquidity"),
            ]

        return [
            AssetAllocation(
                category=name,
                percentage=pct,
                amount=round(investable * pct / 100, 2),
                rationale=rationale,
            )
            for name, pct, rationale in splits
        ]

    async def _fetch_worldbank_gdp_per_capita(self, country_code: str) -> float | None:
        if len(country_code.strip()) != 2:
            return None
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                url = WORLD_BANK_INDICATOR_URL.format(country=country_code.lower(), indicator="NY.GDP.PCAP.CD")
                res = await client.get(url, params={"format": "json", "per_page": 60})
                res.raise_for_status()
                data = res.json()
                if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
                    return None
                for row in data[1]:
                    if not isinstance(row, dict):
                        continue
                    value = row.get("value")
                    if value is None:
                        continue
                    return float(value)
        except Exception:
            return None
        return None

    async def _estimate_food_price_context(self, location: str, locale: str) -> FoodPriceContext:
        query = " ".join(location.strip().split())
        normalized_query = _normalize_location_query(query)
        guessed_country = _guess_country_code_from_query(normalized_query)
        fallback_multiplier = _base_multiplier_by_country(guessed_country, locale)

        fallback_name = (
            query
            or ("Việt Nam" if locale == "vi" else "Zona local" if locale == "es" else "Local region")
        )
        fallback = FoodPriceContext(
            query=query,
            resolved_location=fallback_name,
            country_code=guessed_country,
            local_price_multiplier=fallback_multiplier,
            average_restaurant_meal_vnd=round(90_000 * fallback_multiplier, 0),
            estimated_home_meal_per_person_vnd=round(38_000 * fallback_multiplier, 0),
            note=_localized_food_note(locale, precise=False),
        )
        if not query:
            return fallback

        try:
            async with httpx.AsyncClient(timeout=24.0, headers={"User-Agent": "NexusFinance/2.1 (+advisor-engine)"}) as client:
                geo = await client.get(
                    NOMINATIM_URL,
                    params={"q": normalized_query or query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
                )
                geo.raise_for_status()
                payload = geo.json()
                if not isinstance(payload, list) or not payload:
                    return fallback

                center = payload[0]
                lat = float(center.get("lat") or 0)
                lon = float(center.get("lon") or 0)
                display_name = str(center.get("display_name") or query)
                address = center.get("address") if isinstance(center.get("address"), dict) else {}
                country_code = str(address.get("country_code") or "").upper() or guessed_country

                overpass_query = f"""
                [out:json][timeout:20];
                (
                  node["amenity"~"restaurant|cafe|fast_food"](around:3200,{lat},{lon});
                  way["amenity"~"restaurant|cafe|fast_food"](around:3200,{lat},{lon});
                  relation["amenity"~"restaurant|cafe|fast_food"](around:3200,{lat},{lon});
                );
                out center 60;
                """
                res = await client.post(OVERPASS_URL, data=overpass_query)
                res.raise_for_status()
                places_payload = res.json()
                elements = places_payload.get("elements") if isinstance(places_payload, dict) else []
                place_names: list[str] = []
                for item in (elements or [])[:20]:
                    tags = item.get("tags") if isinstance(item.get("tags"), dict) else {}
                    name = str(tags.get("name") or "").strip()
                    if name:
                        place_names.append(name)

                gdp_pc = await self._fetch_worldbank_gdp_per_capita(country_code) if country_code else None
                if gdp_pc and gdp_pc > 0:
                    usd_price = _clamp(exp((gdp_pc / 45_000)) * (gdp_pc / 4800), 3.0, 70.0)
                else:
                    usd_price = 8.5

                base_multiplier = _base_multiplier_by_country(country_code, locale)
                avg_restaurant_vnd = usd_price * base_multiplier * 26_000

                density_adjust = 1.0
                if len(place_names) >= 40:
                    density_adjust = 1.12
                elif len(place_names) <= 8:
                    density_adjust = 0.94

                keyword = normalized_query
                if any(k in keyword for k in ("hanoi", "ha noi", "ho chi minh", "saigon", "tokyo", "new york", "san francisco", "london")):
                    density_adjust *= 1.08
                elif any(k in keyword for k in ("rural", "village", "countryside")):
                    density_adjust *= 0.88

                avg_restaurant_vnd = round(avg_restaurant_vnd * density_adjust, 0)
                home_vnd = round(avg_restaurant_vnd * 0.42, 0)
                multiplier = _clamp(home_vnd / 38_000.0, 0.6, 2.8)

                return FoodPriceContext(
                    query=query,
                    resolved_location=display_name,
                    country_code=country_code,
                    lat=lat,
                    lon=lon,
                    local_price_multiplier=multiplier,
                    average_restaurant_meal_vnd=avg_restaurant_vnd,
                    estimated_home_meal_per_person_vnd=home_vnd,
                    nearby_restaurants=len(place_names),
                    nearby_examples=place_names[:6],
                    note=_localized_food_note(locale, precise=True),
                )
        except Exception as e:
            logger.debug("Food price context fallback for '%s': %s", query, e)
            return fallback

    async def _gemini_analysis(
        self,
        inp: AdvisorInput,
        base_result: AdvisorResult,
        food_context: FoodPriceContext,
    ) -> dict[str, Any] | None:
        """Call Gemini API for enhanced AI analysis."""
        from app.engine.prompts import get_system_instruction, get_user_prompt

        lang_map = {"vi": "Vietnamese", "en": "English", "es": "Spanish"}
        currency_map = {"vi": "VND (₫)", "en": "USD ($)", "es": "EUR (€)"}

        language = lang_map.get(inp.locale, "English")
        currency = currency_map.get(inp.locale, "USD ($)")

        system_instruction = get_system_instruction(language, currency)
        user_prompt = get_user_prompt(
            language=language,
            currency=currency,
            income=inp.income,
            expenses=inp.actual_expenses,
            budget=inp.planned_budget,
            family_size=inp.family_size,
            health_score=base_result.health_score,
            savings_rate=base_result.savings_rate,
            expense_categories=inp.expense_categories,
        )

        food_context_prompt = (
            f"\nLocal meal pricing context:\n"
            f"- Location: {food_context.resolved_location or inp.location}\n"
            f"- Avg restaurant meal: {food_context.average_restaurant_meal_vnd:,.0f} VND\n"
            f"- Home meal per person: {food_context.estimated_home_meal_per_person_vnd:,.0f} VND\n"
            f"- Nearby restaurants: {food_context.nearby_restaurants}\n"
            f"- Price multiplier: {food_context.local_price_multiplier:.2f}\n"
            f"Use this context in advice."
        )

        try:
            async with httpx.AsyncClient(timeout=18.0) as client:
                url = f"{self._base_url}/models/{self._model}:generateContent"
                params = {"key": self._api_key}
                payload = {
                    "system_instruction": {"parts": [{"text": system_instruction}]},
                    "contents": [{"parts": [{"text": user_prompt + food_context_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.65,
                        "maxOutputTokens": 1100,
                        "responseMimeType": "application/json",
                    },
                }
                response = await client.post(url, params=params, json=payload)
                response.raise_for_status()
                data = response.json()
                if "candidates" in data and data["candidates"]:
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(content)
                return None
        except Exception as e:
            logger.error("Gemini API error: %s", e)
            return None
