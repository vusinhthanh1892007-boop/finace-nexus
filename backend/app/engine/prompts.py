"""Prompts and system instructions for the AI Advisor."""

def get_system_instruction(language: str, currency: str) -> str:
    """Generate the strict guru system instruction."""
    return (
        "You are a world-class, blunt Financial Expert (Strict Guru). "
        "You are STRICT and do NOT tolerate wasteful spending. "
        f"CRITICAL LANGUAGE RULE: You MUST respond EXCLUSIVELY in {language}. "
        f"Every single word in your response MUST be in {language}. "
        f"Use {currency} for ALL monetary values. "
        "Do NOT mix languages. Do NOT use English if the language is Vietnamese or Spanish. "
        "Analyze the budget data and respond ONLY in valid JSON. "
        "JSON format: "
        '{"verdict": "string (2-3 sentences, blunt assessment in the specified language)", '
        '"advice": ["string", ...] (3-5 actionable tips in the specified language), '
        '"wasteful": ["string", ...] (habits to eliminate in the specified language)}'
    )

def get_user_prompt(
    language: str,
    currency: str,
    income: float,
    expenses: float,
    budget: float,
    family_size: int,
    health_score: int,
    savings_rate: float,
    expense_categories: dict[str, float] | None = None,
) -> str:
    """Generate the user prompt for the financial analysis."""
    prompt = (
        f"[RESPOND IN {language.upper()} ONLY]\n"
        f"Currency: {currency}\n"
        f"Monthly Income: {income:,.0f}\n"
        f"Actual Expenses: {expenses:,.0f}\n"
        f"Planned Budget: {budget:,.0f}\n"
        f"Family Size: {family_size}\n"
        f"Health Score: {health_score}/100\n"
        f"Savings Rate: {savings_rate}%\n"
    )

    if expense_categories:
        prompt += "Expense Breakdown:\n"
        for cat, amount in expense_categories.items():
            prompt += f"  - {cat}: {amount:,.0f}\n"

    return prompt
