"""Mô hình dữ liệu vào/ra của API và đầu ra của LLM."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HistoryItem(BaseModel):
    """Một lượt hội thoại trước đó do client gửi lên."""

    question: str = Field(max_length=300)
    sql: str | None = Field(default=None, max_length=2000)
    clarification: str | None = Field(default=None, max_length=500)


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=300)
    history: list[HistoryItem] = Field(default_factory=list, max_length=3)


class ChartHint(BaseModel):
    """Gợi ý biểu đồ từ LLM (server kiểm tra lại trước khi dùng)."""

    type: str | None = None
    x: str | None = None
    y: list[str] = Field(default_factory=list)
    title: str | None = None


class LlmOutput(BaseModel):
    """JSON mà LLM phải trả về."""

    sql: str | None = None
    explanation: str = ""
    chart: ChartHint | None = None
    clarification: str | None = None


class Column(BaseModel):
    name: str
    type: Literal["number", "date", "boolean", "string"]


class Dataset(BaseModel):
    label: str
    data: list[Any]


class Chart(BaseModel):
    """Đặc tả biểu đồ đã dựng sẵn cho frontend."""

    type: Literal["bar", "hbar", "line", "pie", "doughnut", "scatter", "grouped_bar"]
    title: str
    labels: list[str] = Field(default_factory=list)
    datasets: list[Dataset]
    x_label: str = ""
    y_label: str = ""


class QueryResponse(BaseModel):
    sql: str | None
    explanation: str
    columns: list[Column]
    rows: list[list[Any]]
    row_count: int
    truncated: bool
    chart_requested: bool
    chart: Chart | None
    chart_message: str | None = None
    clarification: str | None = None
    elapsed_ms: int
