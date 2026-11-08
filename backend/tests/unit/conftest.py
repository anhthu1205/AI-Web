import pytest

from app.config import get_settings
from app.main import app
from app.services.executor import QueryResult


class FakeLlm:
    """LLM giả: trả lần lượt các chuỗi đã định sẵn."""

    def __init__(self, outputs: list[str]) -> None:
        self.outputs = list(outputs)
        self.calls: list[list[dict[str, str]]] = []

    async def generate(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        return self.outputs.pop(0)


class FakeExecutor:
    """Executor giả: trả kết quả cố định, ghi lại SQL đã chạy."""

    def __init__(self, result: QueryResult | None = None) -> None:
        self.result = result or QueryResult(
            [{"name": "nguon_lead", "type": "string"}, {"name": "so_lead", "type": "number"}],
            [["Zalo OA", 146], ["Hotline", 160]],
            False,
        )
        self.sqls: list[str] = []

    async def execute(self, sql: str) -> QueryResult:
        self.sqls.append(sql)
        return self.result

    async def ping(self) -> bool:
        return True


@pytest.fixture
def settings():
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture
def overrides():
    """Cho phép test gắn LLM/executor giả vào app."""
    from app.api.routes import get_executor, get_llm

    def apply(llm, executor) -> None:
        app.dependency_overrides[get_llm] = lambda: llm
        app.dependency_overrides[get_executor] = lambda: executor

    yield apply
    app.dependency_overrides.clear()
