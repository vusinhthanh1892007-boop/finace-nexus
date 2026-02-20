"""Router for persisted user settings (SQLite)."""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

_SYMBOL_RE = re.compile(r"^[A-Z0-9\.\-\^]{1,12}$")
_MODEL_RE = re.compile(r"^[A-Za-z0-9._:\-]{2,100}$")
_ALLOWED_SCOPES = {"chat", "advisor_analysis"}

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdatePayload(BaseModel):
    gemini_api_key: str | None = Field(default=None, max_length=256)
    openai_api_key: str | None = Field(default=None, max_length=256)
    gemini_scopes: list[str] | None = None
    openai_scopes: list[str] | None = None
    auto_balance: bool | None = None
    notifications: bool | None = None
    risk_tolerance: Literal["conservative", "moderate", "aggressive"] | None = None
    ai_provider: Literal["auto", "gemini", "openai"] | None = None
    ai_model: str | None = Field(default=None, max_length=100)
    watch_symbols: list[str] | None = None

    @field_validator("gemini_api_key", "openai_api_key")
    @classmethod
    def validate_api_key_shape(cls, value: str | None) -> str | None:
        if value is None:
            return None
        raw = str(value).strip()
        if not raw:
            return ""
        if len(raw) < 16:
            raise ValueError("API key is too short")
        if any(ch.isspace() for ch in raw):
            raise ValueError("API key must not contain spaces")
        return raw

    @field_validator("ai_model")
    @classmethod
    def validate_ai_model(cls, value: str | None) -> str | None:
        if value is None:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        if not _MODEL_RE.match(raw):
            raise ValueError("ai_model contains invalid characters")
        return raw

    @field_validator("watch_symbols")
    @classmethod
    def validate_watch_symbols(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized: list[str] = []
        for raw in value[:12]:
            symbol = str(raw).upper().strip()
            if not _SYMBOL_RE.match(symbol):
                continue
            normalized.append(symbol)
        deduped = list(dict.fromkeys(normalized))
        if not deduped:
            raise ValueError("watch_symbols must include at least one valid ticker")
        return deduped

    @field_validator("gemini_scopes", "openai_scopes")
    @classmethod
    def validate_scopes(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [str(x).strip() for x in value if str(x).strip() in _ALLOWED_SCOPES]
        deduped = list(dict.fromkeys(cleaned))
        if not deduped:
            raise ValueError("At least one valid API scope is required")
        return deduped


class RotateSecretsPayload(BaseModel):
    providers: list[Literal["gemini", "openai"]] = Field(default_factory=lambda: ["gemini", "openai"])
    reason: str | None = Field(default=None, max_length=120)


def _mask_key(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 6:
        return "*" * len(value)
    return f"{value[:3]}{'*' * (len(value) - 6)}{value[-3:]}"


def _decrypt_key(crypto, encrypted: str) -> str:
    if not encrypted:
        return ""
    try:
        decrypted = crypto.decrypt(encrypted)
        return str(decrypted.get("key", "")).strip()
    except Exception:
        return ""


def _serialize_settings(row: dict, crypto) -> dict:
    gemini_raw = _decrypt_key(crypto, str(row.get("gemini_api_key_enc") or ""))
    openai_raw = _decrypt_key(crypto, str(row.get("openai_api_key_enc") or ""))
    ai_provider = str(row.get("ai_provider", "auto"))
    if ai_provider not in {"auto", "gemini", "openai"}:
        ai_provider = "auto"
    return {
        "auto_balance": bool(row.get("auto_balance", True)),
        "notifications": bool(row.get("notifications", True)),
        "risk_tolerance": str(row.get("risk_tolerance", "moderate")),
        "ai_provider": ai_provider,
        "ai_model": str(row.get("ai_model", "gemini-2.0-flash")),
        "watch_symbols": row.get("watch_symbols", ["AAPL", "BTC", "VNM"]),
        "gemini_scopes": row.get("gemini_scopes", ["chat", "advisor_analysis"]),
        "openai_scopes": row.get("openai_scopes", ["chat"]),
        "api_key_version": int(row.get("api_key_version", 1)),
        "last_secret_rotation_at": str(row.get("last_secret_rotation_at", "")),
        "key_rotation_count": int(row.get("key_rotation_count", 0)),
        "gemini_configured": bool(gemini_raw),
        "gemini_key_masked": _mask_key(gemini_raw),
        "openai_configured": bool(openai_raw),
        "openai_key_masked": _mask_key(openai_raw),
        "updated_at": row.get("updated_at", ""),
    }


def _apply_runtime_state(request: Request, row: dict, crypto) -> None:
    advisor_engine = request.app.state.advisor_engine
    gemini_raw = _decrypt_key(crypto, str(row.get("gemini_api_key_enc") or ""))
    openai_raw = _decrypt_key(crypto, str(row.get("openai_api_key_enc") or ""))
    advisor_engine._api_key = gemini_raw
    request.app.state.openai_api_key = openai_raw
    ai_provider = str(row.get("ai_provider", "auto"))
    request.app.state.ai_provider = ai_provider if ai_provider in {"auto", "gemini", "openai"} else "auto"
    request.app.state.ai_model = str(row.get("ai_model", "gemini-2.0-flash"))
    request.app.state.gemini_scopes = row.get("gemini_scopes", ["chat", "advisor_analysis"])
    request.app.state.openai_scopes = row.get("openai_scopes", ["chat"])
    request.app.state.api_key_version = int(row.get("api_key_version", 1))
    request.app.state.last_secret_rotation_at = str(row.get("last_secret_rotation_at", ""))


@router.get("")
async def get_settings(request: Request):
    store = request.app.state.settings_store
    crypto = request.app.state.crypto
    row = store.get_settings()
    return _serialize_settings(row, crypto)


@router.put("")
async def update_settings(payload: SettingsUpdatePayload, request: Request):
    store = request.app.state.settings_store
    crypto = request.app.state.crypto

    update_data: dict[str, object] = {}
    body = payload.model_dump(exclude_unset=True)

    if "gemini_api_key" in body:
        raw_key = str(body.get("gemini_api_key") or "").strip()
        update_data["gemini_api_key_enc"] = crypto.encrypt({"key": raw_key}) if raw_key else ""

    if "openai_api_key" in body:
        raw_openai = str(body.get("openai_api_key") or "").strip()
        update_data["openai_api_key_enc"] = crypto.encrypt({"key": raw_openai}) if raw_openai else ""

    if "gemini_scopes" in body:
        update_data["gemini_scopes"] = body["gemini_scopes"]
    if "openai_scopes" in body:
        update_data["openai_scopes"] = body["openai_scopes"]
    if "auto_balance" in body:
        update_data["auto_balance"] = bool(body["auto_balance"])
    if "notifications" in body:
        update_data["notifications"] = bool(body["notifications"])
    if "risk_tolerance" in body:
        update_data["risk_tolerance"] = str(body["risk_tolerance"])
    if "ai_provider" in body:
        update_data["ai_provider"] = str(body["ai_provider"])
    if "ai_model" in body:
        update_data["ai_model"] = str(body["ai_model"])
    if "watch_symbols" in body:
        update_data["watch_symbols"] = body["watch_symbols"]

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid settings field provided")

    updated = store.update_settings(update_data)
    _apply_runtime_state(request, updated, crypto)

    return {
        "ok": True,
        "settings": _serialize_settings(updated, crypto),
    }


@router.post("/rotate-secrets")
async def rotate_secrets(payload: RotateSecretsPayload, request: Request):
    store = request.app.state.settings_store
    crypto = request.app.state.crypto
    current = store.get_settings()

    providers = payload.providers or ["gemini", "openai"]
    update_data: dict[str, object] = {}

    if "gemini" in providers:
        raw = _decrypt_key(crypto, str(current.get("gemini_api_key_enc") or ""))
        if raw:
            update_data["gemini_api_key_enc"] = crypto.encrypt({"key": raw})

    if "openai" in providers:
        raw = _decrypt_key(crypto, str(current.get("openai_api_key_enc") or ""))
        if raw:
            update_data["openai_api_key_enc"] = crypto.encrypt({"key": raw})

    if not update_data:
        raise HTTPException(status_code=400, detail="No configured API key found to rotate")

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    update_data["api_key_version"] = int(current.get("api_key_version", 1)) + 1
    update_data["key_rotation_count"] = int(current.get("key_rotation_count", 0)) + 1
    update_data["last_secret_rotation_at"] = now_iso
    updated = store.update_settings(update_data)
    _apply_runtime_state(request, updated, crypto)

    return {
        "ok": True,
        "rotated_providers": providers,
        "reason": str(payload.reason or ""),
        "settings": _serialize_settings(updated, crypto),
    }
