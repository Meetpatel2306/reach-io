"""Application configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──
    app_env: str = "development"
    app_debug: bool = True
    app_base_url: str = "http://localhost:8000"

    # ── Supabase ──
    supabase_url: str = ""
    supabase_key: str = ""

    # ── WhatsApp Business Cloud API (Meta Direct) ──
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "agentca_verify_2026"
    whatsapp_app_secret: str = ""  # For webhook HMAC verification

    # ── Groq (FREE — primary AI) ──
    groq_api_key: str = ""

    # ── Google Gemini (FREE — fallback AI + OCR) ──
    gemini_api_key: str = ""

    # ── Upstash Redis (FREE — rate limiting + cache) ──
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    # ── Razorpay (Phase 2 — subscriptions) ──
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # ── Sentry (FREE — error tracking) ──
    sentry_dsn: str = ""

    # ── PostHog (FREE — analytics) ──
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    @field_validator("supabase_url", "supabase_key", "groq_api_key")
    @classmethod
    def must_not_be_empty(cls, v: str, info) -> str:
        if not v and info.data.get("app_env") != "test":
            raise ValueError(f"{info.field_name} is required — set it in .env")
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
