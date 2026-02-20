"""API router for the AI Advisor."""

from __future__ import annotations

import logging
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.engine.advisor_engine import AdvisorEngine, AdvisorInput, AdvisorResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


class ChatPayload(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    provider: Literal["auto", "gemini", "openai"] = "auto"
    model: str | None = Field(default=None, max_length=100)
    locale: Literal["vi", "en", "es"] = "en"


def _scope_allowed(request: Request, provider: Literal["gemini", "openai"], scope: str) -> bool:
    scopes_attr = "gemini_scopes" if provider == "gemini" else "openai_scopes"
    scopes = getattr(request.app.state, scopes_attr, []) or []
    return scope in [str(x).strip() for x in scopes]


def _decrypt_key(crypto, token: str) -> str:
    if not token:
        return ""
    try:
        payload = crypto.decrypt(token)
        return str(payload.get("key", "")).strip()
    except Exception:
        return ""


def _refresh_ai_runtime(request: Request) -> None:
    """Hot-reload AI keys/scopes from SQLite to avoid service restart."""
    store = getattr(request.app.state, "settings_store", None)
    crypto = getattr(request.app.state, "crypto", None)
    advisor = getattr(request.app.state, "advisor_engine", None)
    if store is None or crypto is None or advisor is None:
        return
    try:
        row = store.get_settings()
        gemini = _decrypt_key(crypto, str(row.get("gemini_api_key_enc") or ""))
        openai = _decrypt_key(crypto, str(row.get("openai_api_key_enc") or ""))
        advisor._api_key = gemini
        request.app.state.openai_api_key = openai
        ai_provider = str(row.get("ai_provider", "auto"))
        request.app.state.ai_provider = ai_provider if ai_provider in {"auto", "gemini", "openai"} else "auto"
        request.app.state.ai_model = str(row.get("ai_model", "gemini-2.0-flash"))
        request.app.state.gemini_scopes = row.get("gemini_scopes", ["chat", "advisor_analysis"])
        request.app.state.openai_scopes = row.get("openai_scopes", ["chat"])
    except Exception as exc:
        logger.debug("Failed to refresh AI runtime settings: %s", exc)


async def _call_gemini(prompt: str, api_key: str, model: str) -> str:
    async with httpx.AsyncClient(timeout=25.0) as client:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        params = {"key": api_key}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": 800},
        }
        res = await client.post(url, params=params, json=payload)
        res.raise_for_status()
        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        content = candidates[0].get("content", {})
        parts = content.get("parts") or []
        if not parts:
            return ""
        return str(parts[0].get("text", "")).strip()


async def _call_openai(prompt: str, api_key: str, model: str) -> str:
    async with httpx.AsyncClient(timeout=25.0) as client:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a practical financial assistant. Respond concisely."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.6,
        }
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
        res.raise_for_status()
        data = res.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message", {})
        return str(message.get("content", "")).strip()


@router.post("/analyze", response_model=AdvisorResult)
async def analyze_budget(data: AdvisorInput, request: Request) -> AdvisorResult:
    """Run a full AI-powered budget analysis.

    Returns health score, guru verdict, meal plan, and asset allocation.
    """
    advisor: AdvisorEngine = request.app.state.advisor_engine

    try:
        _refresh_ai_runtime(request)
        gemini_configured = bool(getattr(advisor, "_api_key", ""))
        ai_allowed = gemini_configured and _scope_allowed(request, "gemini", "advisor_analysis")
        result = await advisor.analyze(data, allow_ai=ai_allowed)
        if gemini_configured and not ai_allowed:
            result.guru_advice.append(
                "Gemini key is configured but scope 'advisor_analysis' is disabled in Settings."
            )
        return result
    except Exception as e:
        logger.error("Advisor analysis failed: %s", e)
        raise HTTPException(
            status_code=500, detail="Failed to analyze budget"
        ) from e


@router.post("/chat")
async def chat(payload: ChatPayload, request: Request):
    _refresh_ai_runtime(request)
    advisor: AdvisorEngine = request.app.state.advisor_engine
    provider_setting = str(getattr(request.app.state, "ai_provider", "auto"))
    model_setting = str(getattr(request.app.state, "ai_model", "gemini-2.0-flash"))
    openai_key = str(getattr(request.app.state, "openai_api_key", "") or "")
    gemini_key = str(getattr(advisor, "_api_key", "") or "")

    requested_auto = payload.provider == "auto"
    prompt = payload.message.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Message is empty")

    def provider_ready(name: Literal["gemini", "openai"]) -> bool:
        if name == "gemini":
            return bool(gemini_key) and _scope_allowed(request, "gemini", "chat")
        return bool(openai_key) and _scope_allowed(request, "openai", "chat")

    if requested_auto:
        preferred = provider_setting if provider_setting in {"gemini", "openai"} else "auto"
        if preferred == "gemini" and provider_ready("gemini"):
            provider: Literal["gemini", "openai"] = "gemini"
        elif preferred == "openai" and provider_ready("openai"):
            provider = "openai"
        elif provider_ready("gemini"):
            provider = "gemini"
        elif provider_ready("openai"):
            provider = "openai"
        else:
            raise HTTPException(
                status_code=400,
                detail="No active AI API available. Configure Gemini or OpenAI key and enable chat scope.",
            )
    else:
        provider = payload.provider
        if provider == "gemini" and not provider_ready("gemini"):
            raise HTTPException(status_code=400, detail="Gemini API key/scope is not ready for chat")
        if provider == "openai" and not provider_ready("openai"):
            raise HTTPException(status_code=400, detail="OpenAI API key/scope is not ready for chat")

    model = (payload.model or model_setting or "").strip()

    if provider == "gemini":
        if not provider_ready("gemini"):
            raise HTTPException(status_code=400, detail="Gemini API key/scope is not ready for chat")
        gemini_model = model
        if not gemini_model.startswith("gemini-"):
            gemini_model = model_setting if str(model_setting).startswith("gemini-") else "gemini-2.0-flash"
        try:
            response = await _call_gemini(prompt, gemini_key, gemini_model)
            return {"provider": "gemini", "model": gemini_model, "reply": response}
        except Exception:
            if payload.provider == "auto":
                if provider_ready("openai"):
                    openai_model = model if model.startswith("gpt-") else "gpt-4.1-mini"
                    try:
                        response = await _call_openai(prompt, openai_key, openai_model)
                        return {"provider": "openai", "model": openai_model, "reply": response}
                    except Exception:
                        raise HTTPException(status_code=502, detail="Gemini failed and OpenAI fallback also failed.")
                raise HTTPException(status_code=502, detail="Gemini API request failed. No fallback provider available.")
            else:
                raise HTTPException(status_code=502, detail="Gemini API request failed. Check key/model/quota.")

    if provider == "openai":
        if not provider_ready("openai"):
            raise HTTPException(status_code=400, detail="OpenAI API key/scope is not ready for chat")
        openai_model = model if model.startswith("gpt-") else "gpt-4.1-mini"
        try:
            response = await _call_openai(prompt, openai_key, openai_model)
            return {"provider": "openai", "model": openai_model, "reply": response}
        except Exception:
            if payload.provider == "auto":
                if provider_ready("gemini"):
                    gemini_model = model if model.startswith("gemini-") else "gemini-2.0-flash"
                    try:
                        response = await _call_gemini(prompt, gemini_key, gemini_model)
                        return {"provider": "gemini", "model": gemini_model, "reply": response}
                    except Exception:
                        raise HTTPException(status_code=502, detail="OpenAI failed and Gemini fallback also failed.")
                raise HTTPException(status_code=502, detail="OpenAI API request failed. No fallback provider available.")
            else:
                raise HTTPException(status_code=502, detail="OpenAI API request failed. Check key/model/quota.")
    raise HTTPException(status_code=400, detail="Unsupported provider")
