"""Application configuration using pydantic-settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-this-to-a-secure-random-string"

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    openbb_token: str = ""
    fmp_api_key: str = ""
    polygon_api_key: str = ""
    alpha_vantage_api_key: str = ""

    gemini_api_key: str = ""

    rate_limit_per_minute: int = 60
    rate_limit_window_seconds: int = 60
    rate_limit_prefix: str = "nexus:ratelimit"
    rate_limit_fail_open: bool = True
    rate_limit_trust_proxy: bool = True
    encryption_salt: str = "nexus-finance-aes256-salt-2024"

    redis_url: str = "redis://localhost:6379/0"

    database_path: str = "./data/finance.db"


settings = Settings()
