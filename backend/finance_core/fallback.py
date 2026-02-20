"""
Fallback implementation for finance_core when Rust module is unavailable.
"""

def calculate_compound_interest(principal: float, rate: float, times_per_year: int, years: int) -> float:
    """
    Pure Python implementation of compound interest.
    Formula: P * (1 + r/n)^(n*t)
    """
    r = rate / 100.0
    n = float(times_per_year)
    t = float(years)
    return principal * (1.0 + (r / n)) ** (n * t)

def calculate_inflation_impact(amount: float, inflation_rate: float, years: int) -> float:
    """
    Pure Python implementation of inflation impact.
    Formula: Amount / (1 + inflation_rate)^years
    """
    r = inflation_rate / 100.0
    t = float(years)
    return amount / ((1.0 + r) ** t)
