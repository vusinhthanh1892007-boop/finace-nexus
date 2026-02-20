"""API routers for ledger calculations and market data.

Phase 4: Includes AES-256 encrypted audit trail and strict validation.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from app.models.schemas import (
    APIResponse,
    LedgerInput,
    LedgerResult,
)
from app.engine.crypto import encrypt_financial_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["finance"])




@router.post("/ledger/calculate", response_model=LedgerResult)
async def calculate_ledger(ledger: LedgerInput, request: Request) -> LedgerResult:
    """Calculate Safe-to-Spend with AES-256 encrypted audit trail."""
    engine = request.app.state.market_engine
    result = engine.calculate_safe_to_spend(ledger)

    try:
        result.encrypted_audit = encrypt_financial_data({
            "income": ledger.income,
            "actual_expenses": ledger.actual_expenses,
            "planned_budget": ledger.planned_budget,
            "calculated_at": str(result.calculated_at),
        })
    except Exception as e:
        logger.warning("Audit encryption failed: %s", e)

    return result




@router.get("/health", response_model=APIResponse)
async def health_check(request: Request) -> APIResponse:
    """Health check with engine + cache + encryption status."""
    engine = request.app.state.market_engine
    cache = getattr(request.app.state, "cache", None)
    advisor = getattr(request.app.state, "advisor_engine", None)
    gemini_available = bool(getattr(advisor, "_api_key", ""))
    openai_available = bool(getattr(request.app.state, "openai_api_key", ""))
    gemini_scopes = getattr(request.app.state, "gemini_scopes", [])
    openai_scopes = getattr(request.app.state, "openai_scopes", [])
    active_ai_providers: list[str] = []
    if gemini_available and "chat" in [str(x).strip() for x in gemini_scopes]:
        active_ai_providers.append("gemini")
    if openai_available and "chat" in [str(x).strip() for x in openai_scopes]:
        active_ai_providers.append("openai")
    return APIResponse(
        success=True,
        data={
            "status": "healthy",
            "engine_initialized": engine._initialized,
            "cache": cache.stats if cache else "n/a",
            "encryption": "AES-256-GCM",
            "gemini_available": gemini_available,
            "openai_available": openai_available,
            "gemini_scopes": gemini_scopes,
            "openai_scopes": openai_scopes,
            "active_ai_providers": active_ai_providers,
            "api_key_version": getattr(request.app.state, "api_key_version", 1),
        },
    )
