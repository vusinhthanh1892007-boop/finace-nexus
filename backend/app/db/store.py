"""SQLite-backed settings storage for app runtime preferences."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_SETTINGS: dict[str, Any] = {
    "gemini_api_key_enc": "",
    "openai_api_key_enc": "",
    "gemini_scopes": ["chat", "advisor_analysis"],
    "openai_scopes": ["chat"],
    "api_key_version": 1,
    "last_secret_rotation_at": "",
    "key_rotation_count": 0,
    "auto_balance": True,
    "notifications": True,
    "risk_tolerance": "moderate",
    "ai_provider": "auto",
    "ai_model": "gemini-2.0-flash",
    "watch_symbols": ["AAPL", "BTC", "VNM"],
    "updated_at": "",
}


class SettingsStore:
    """Simple single-row settings store (SQLite)."""

    def __init__(self, database_path: str):
        self._path = Path(database_path)
        if not self._path.is_absolute():
            self._path = (Path(__file__).resolve().parents[2] / self._path).resolve()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def path(self) -> Path:
        return self._path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        now = datetime.now(tz=timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    gemini_api_key_enc TEXT NOT NULL DEFAULT '',
                    openai_api_key_enc TEXT NOT NULL DEFAULT '',
                    gemini_scopes TEXT NOT NULL DEFAULT '["chat","advisor_analysis"]',
                    openai_scopes TEXT NOT NULL DEFAULT '["chat"]',
                    api_key_version INTEGER NOT NULL DEFAULT 1,
                    last_secret_rotation_at TEXT NOT NULL DEFAULT '',
                    key_rotation_count INTEGER NOT NULL DEFAULT 0,
                    auto_balance INTEGER NOT NULL DEFAULT 1,
                    notifications INTEGER NOT NULL DEFAULT 1,
                    risk_tolerance TEXT NOT NULL DEFAULT 'moderate',
                    ai_provider TEXT NOT NULL DEFAULT 'auto',
                    ai_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
                    watch_symbols TEXT NOT NULL DEFAULT '["AAPL","BTC","VNM"]',
                    updated_at TEXT NOT NULL
                )
                """
            )

            cols = {
                str(row["name"])
                for row in conn.execute("PRAGMA table_info(app_settings)").fetchall()
            }
            if "openai_api_key_enc" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN openai_api_key_enc TEXT NOT NULL DEFAULT ''"
                )
            if "ai_provider" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'auto'"
                )
            if "ai_model" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash'"
                )
            if "gemini_scopes" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN gemini_scopes TEXT NOT NULL DEFAULT '[\"chat\",\"advisor_analysis\"]'"
                )
            if "openai_scopes" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN openai_scopes TEXT NOT NULL DEFAULT '[\"chat\"]'"
                )
            if "api_key_version" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN api_key_version INTEGER NOT NULL DEFAULT 1"
                )
            if "last_secret_rotation_at" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN last_secret_rotation_at TEXT NOT NULL DEFAULT ''"
                )
            if "key_rotation_count" not in cols:
                conn.execute(
                    "ALTER TABLE app_settings ADD COLUMN key_rotation_count INTEGER NOT NULL DEFAULT 0"
                )

            conn.execute(
                """
                INSERT INTO app_settings (
                    id,
                    gemini_api_key_enc,
                    openai_api_key_enc,
                    gemini_scopes,
                    openai_scopes,
                    api_key_version,
                    last_secret_rotation_at,
                    key_rotation_count,
                    auto_balance,
                    notifications,
                    risk_tolerance,
                    ai_provider,
                    ai_model,
                    watch_symbols,
                    updated_at
                )
                VALUES (
                    1,
                    '',
                    '',
                    '["chat","advisor_analysis"]',
                    '["chat"]',
                    1,
                    '',
                    0,
                    1,
                    1,
                    'moderate',
                    'auto',
                    'gemini-2.0-flash',
                    '["AAPL","BTC","VNM"]',
                    ?
                )
                ON CONFLICT(id) DO NOTHING
                """,
                (now,),
            )
            conn.commit()

    def get_settings(self) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM app_settings WHERE id = 1").fetchone()

        if row is None:
            return dict(DEFAULT_SETTINGS)

        watch_symbols_raw = row["watch_symbols"]
        try:
            watch_symbols = json.loads(watch_symbols_raw)
            if not isinstance(watch_symbols, list):
                watch_symbols = DEFAULT_SETTINGS["watch_symbols"]
        except Exception:
            watch_symbols = DEFAULT_SETTINGS["watch_symbols"]
        gemini_scopes_raw = row["gemini_scopes"] if "gemini_scopes" in row.keys() else json.dumps(DEFAULT_SETTINGS["gemini_scopes"])
        openai_scopes_raw = row["openai_scopes"] if "openai_scopes" in row.keys() else json.dumps(DEFAULT_SETTINGS["openai_scopes"])
        try:
            gemini_scopes = json.loads(gemini_scopes_raw)
            if not isinstance(gemini_scopes, list):
                gemini_scopes = DEFAULT_SETTINGS["gemini_scopes"]
        except Exception:
            gemini_scopes = DEFAULT_SETTINGS["gemini_scopes"]
        try:
            openai_scopes = json.loads(openai_scopes_raw)
            if not isinstance(openai_scopes, list):
                openai_scopes = DEFAULT_SETTINGS["openai_scopes"]
        except Exception:
            openai_scopes = DEFAULT_SETTINGS["openai_scopes"]

        return {
            "gemini_api_key_enc": row["gemini_api_key_enc"],
            "openai_api_key_enc": row["openai_api_key_enc"],
            "gemini_scopes": gemini_scopes,
            "openai_scopes": openai_scopes,
            "api_key_version": int(row["api_key_version"]) if "api_key_version" in row.keys() else 1,
            "last_secret_rotation_at": str(row["last_secret_rotation_at"]) if "last_secret_rotation_at" in row.keys() else "",
            "key_rotation_count": int(row["key_rotation_count"]) if "key_rotation_count" in row.keys() else 0,
            "auto_balance": bool(row["auto_balance"]),
            "notifications": bool(row["notifications"]),
            "risk_tolerance": row["risk_tolerance"],
            "ai_provider": row["ai_provider"] if row["ai_provider"] in {"auto", "gemini", "openai"} else "auto",
            "ai_model": row["ai_model"],
            "watch_symbols": watch_symbols,
            "updated_at": row["updated_at"],
        }

    def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.get_settings()
        merged = dict(current)

        if "gemini_api_key_enc" in payload:
            merged["gemini_api_key_enc"] = str(payload["gemini_api_key_enc"] or "")

        if "openai_api_key_enc" in payload:
            merged["openai_api_key_enc"] = str(payload["openai_api_key_enc"] or "")

        if "gemini_scopes" in payload:
            scopes = payload["gemini_scopes"]
            if not isinstance(scopes, list):
                scopes = current["gemini_scopes"]
            merged["gemini_scopes"] = scopes

        if "openai_scopes" in payload:
            scopes = payload["openai_scopes"]
            if not isinstance(scopes, list):
                scopes = current["openai_scopes"]
            merged["openai_scopes"] = scopes

        if "api_key_version" in payload:
            merged["api_key_version"] = int(payload["api_key_version"] or 1)

        if "last_secret_rotation_at" in payload:
            merged["last_secret_rotation_at"] = str(payload["last_secret_rotation_at"] or "")

        if "key_rotation_count" in payload:
            merged["key_rotation_count"] = int(payload["key_rotation_count"] or 0)

        if "auto_balance" in payload:
            merged["auto_balance"] = bool(payload["auto_balance"])

        if "notifications" in payload:
            merged["notifications"] = bool(payload["notifications"])

        if "risk_tolerance" in payload:
            merged["risk_tolerance"] = str(payload["risk_tolerance"])

        if "ai_provider" in payload:
            provider = str(payload["ai_provider"])
            merged["ai_provider"] = provider if provider in {"auto", "gemini", "openai"} else "auto"

        if "ai_model" in payload:
            merged["ai_model"] = str(payload["ai_model"])

        if "watch_symbols" in payload:
            symbols = payload["watch_symbols"]
            if not isinstance(symbols, list):
                symbols = current["watch_symbols"]
            merged["watch_symbols"] = symbols

        merged["updated_at"] = datetime.now(tz=timezone.utc).isoformat()

        with self._connect() as conn:
            conn.execute(
                """
                UPDATE app_settings
                SET gemini_api_key_enc = ?,
                    openai_api_key_enc = ?,
                    gemini_scopes = ?,
                    openai_scopes = ?,
                    api_key_version = ?,
                    last_secret_rotation_at = ?,
                    key_rotation_count = ?,
                    auto_balance = ?,
                    notifications = ?,
                    risk_tolerance = ?,
                    ai_provider = ?,
                    ai_model = ?,
                    watch_symbols = ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    merged["gemini_api_key_enc"],
                    merged["openai_api_key_enc"],
                    json.dumps(merged["gemini_scopes"]),
                    json.dumps(merged["openai_scopes"]),
                    int(merged["api_key_version"]),
                    merged["last_secret_rotation_at"],
                    int(merged["key_rotation_count"]),
                    1 if merged["auto_balance"] else 0,
                    1 if merged["notifications"] else 0,
                    merged["risk_tolerance"],
                    merged["ai_provider"],
                    merged["ai_model"],
                    json.dumps(merged["watch_symbols"]),
                    merged["updated_at"],
                ),
            )
            conn.commit()

        return merged
