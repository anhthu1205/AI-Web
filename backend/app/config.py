"""Cấu hình ứng dụng, đọc từ biến môi trường / file .env."""

from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env ở gốc repo (README hướng dẫn) hoặc ở thư mục đang chạy; không phụ thuộc cwd.
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Toàn bộ cấu hình runtime. Không chứa giá trị bí mật mặc định."""

    model_config = SettingsConfigDict(env_file=(_ROOT_ENV, ".env"), extra="ignore")

    groq_api_key: SecretStr | None = None
    groq_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: str = "openai/gpt-oss-20b"
    database_url: SecretStr | None = None
    reference_date: date = date(2026, 11, 8)
    allowed_origins: str = "http://localhost:8000"
    max_rows: int = 500
    statement_timeout_ms: int = 5000
    rate_limit: str = "10/minute"
    max_question_len: int = 300
    demo_mode: bool = False

    @property
    def origins(self) -> list[str]:
        """Danh sách origin CORS đã tách."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Trả về Settings dùng chung (cache)."""
    return Settings()
