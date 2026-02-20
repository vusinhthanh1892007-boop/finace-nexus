"""Pydantic models / schemas for financial data exchange.

Includes strict validators for the CIA Triad: input sanitization,
cross-field validation, and regex-based symbol verification.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator




class BudgetStatus(str, Enum):
    """Budget health indicator."""

    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OVER_BUDGET = "over_budget"


class LedgerInput(BaseModel):
    """Input for the financial ledger calculation.

    Enforces strict validation: positive numbers, reasonable bounds,
    and cross-field consistency checks.
    """

    income: float = Field(
        ...,
        gt=0,
        le=1_000_000_000,
        description="Total income for the period",
    )
    actual_expenses: float = Field(
        ...,
        ge=0,
        le=1_000_000_000,
        description="Actual expenses incurred",
    )
    planned_budget: float = Field(
        ...,
        gt=0,
        le=1_000_000_000,
        description="Planned budget / spending target",
    )

    @model_validator(mode="after")
    def validate_cross_field_constraints(self) -> "LedgerInput":
        """Cross-field: expenses should not exceed 3x income (data entry error guard)."""
        if self.actual_expenses > self.income * 3:
            raise ValueError(
                f"Expenses ({self.actual_expenses:,.0f}) exceed 3× income "
                f"({self.income:,.0f}). Possible data entry error."
            )
        if self.planned_budget > self.income * 2:
            raise ValueError(
                f"Budget ({self.planned_budget:,.0f}) should not exceed "
                f"2× income ({self.income:,.0f})."
            )
        return self


class LedgerResult(BaseModel):
    """Result of the Safe-to-Spend calculation."""

    safe_to_spend: float = Field(description="Amount safe to spend remaining")
    budget_utilization: float = Field(
        description="Percentage of planned budget used (0-100+)"
    )
    remaining_budget: float = Field(
        description="Remaining planned budget after expenses"
    )
    savings_potential: float = Field(
        description="Income minus planned budget (potential savings)"
    )
    status: BudgetStatus = Field(description="Budget health status")
    status_message: str = Field(description="Human-readable status message")
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    encrypted_audit: str | None = Field(
        default=None,
        description="AES-256 encrypted snapshot of input data",
    )



_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9\.\-\^]{1,10}$")


class StockQuote(BaseModel):
    """Real-time stock quote data."""

    symbol: str
    name: str = ""
    price: float
    change: float = 0.0
    change_percent: float = 0.0
    volume: int = 0
    market_cap: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    year_high: float | None = None
    year_low: float | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        v = v.upper().strip()
        if not _SYMBOL_PATTERN.match(v):
            raise ValueError(
                f"Invalid symbol '{v}'. Must match pattern: letters, digits, dots, hyphens (1-10 chars)"
            )
        return v


class MarketIndex(BaseModel):
    """Market index summary."""

    symbol: str
    name: str
    value: float
    change: float = 0.0
    change_percent: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MarketOverview(BaseModel):
    """Collection of market indices."""

    indices: list[MarketIndex] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)




class APIResponse(BaseModel):
    """Standard API response wrapper."""

    success: bool = True
    data: dict | list | None = None
    error: str | None = None
