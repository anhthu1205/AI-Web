"""Gọi LLM (Groq) và phân tích đầu ra JSON."""

import json
import re
from typing import Protocol

from groq import AsyncGroq, RateLimitError
from pydantic import ValidationError

from app.errors import llm_unavailable
from app.schemas import LlmOutput


class LlmClient(Protocol):
    """Giao diện LLM (có bản thật và bản giả cho test/demo)."""

    async def generate(self, messages: list[dict[str, str]]) -> str: ...


class GroqLlm:
    """Gọi Groq ở chế độ JSON; đổi sang model dự phòng khi bị giới hạn tốc độ (429)."""

    def __init__(self, api_key: str, model: str, fallback_model: str | None) -> None:
        self.client = AsyncGroq(api_key=api_key, timeout=30, max_retries=1)
        self.models = [m for m in (model, fallback_model) if m]

    async def generate(self, messages: list[dict[str, str]]) -> str:
        last: Exception | None = None
        for model in self.models:
            try:
                resp = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,  # type: ignore[arg-type]
                    temperature=0,
                    max_tokens=1000,
                    response_format={"type": "json_object"},
                )
                return resp.choices[0].message.content or ""
            except RateLimitError as exc:
                last = exc
            except Exception as exc:
                raise llm_unavailable() from exc
        raise llm_unavailable("AI đang quá tải, vui lòng thử lại sau ít phút.") from last


class NoLlm:
    """Dùng khi chưa có GROQ_API_KEY."""

    async def generate(self, messages: list[dict[str, str]]) -> str:
        raise llm_unavailable("Chưa cấu hình GROQ_API_KEY cho máy chủ.")


_BRACE_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_llm_output(raw: str) -> LlmOutput:
    """Parse JSON (hoặc khối {...} đầu-cuối trong văn bản) rồi kiểm tra bằng Pydantic."""
    candidates = [raw]
    m = _BRACE_RE.search(raw)
    if m:
        candidates.append(m.group(0))
    for text in candidates:
        try:
            return LlmOutput.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError):
            continue
    raise ValueError("Phản hồi của AI không phải JSON đúng định dạng.")
