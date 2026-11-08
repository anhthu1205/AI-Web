"""Luồng hỏi-đáp: câu hỏi -> LLM -> kiểm tra SQL -> chạy -> dựng biểu đồ."""

import logging
import time

from app.config import Settings
from app.errors import AppError, llm_unavailable
from app.schemas import Column, QueryRequest, QueryResponse
from app.services.chart_intent import wants_chart
from app.services.chart_rules import build_chart
from app.services.executor import QueryExecutor
from app.services.llm import LlmClient, parse_llm_output
from app.services.prompt import build_messages, build_system_prompt
from app.services.sql_guard import validate_and_limit

log = logging.getLogger("app.query")
MAX_ATTEMPTS = 2  # lần đầu + đúng 1 lần thử lại kèm thông báo lỗi


class OutOfScope(Exception):
    """LLM từ chối vì câu hỏi ngoài phạm vi (không phải lỗi hệ thống)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _empty(req_chart: bool, text: str | None, explanation: str, t0: float) -> QueryResponse:
    return QueryResponse(
        sql=None,
        explanation=explanation,
        columns=[],
        rows=[],
        row_count=0,
        truncated=False,
        chart_requested=req_chart,
        chart=None,
        clarification=text,
        elapsed_ms=int((time.monotonic() - t0) * 1000),
    )


async def answer(
    req: QueryRequest, settings: Settings, llm: LlmClient, executor: QueryExecutor
) -> QueryResponse:
    """Trả lời một câu hỏi. Ném OutOfScope hoặc AppError khi không trả lời được."""
    t0 = time.monotonic()
    chart_requested = wants_chart(req.question)
    messages = build_messages(
        build_system_prompt(settings.reference_date), req.question, req.history
    )
    last_error = ""
    for attempt in range(MAX_ATTEMPTS):
        raw = await llm.generate(messages)
        try:
            out = parse_llm_output(raw)
            if out.sql is None:
                if out.clarification:
                    return _empty(chart_requested, out.clarification, out.explanation, t0)
                raise OutOfScope(out.explanation or "Câu hỏi nằm ngoài phạm vi dữ liệu.")
            sql = validate_and_limit(out.sql, settings.max_rows)
            result = await executor.execute(sql)
        except ValueError as exc:
            last_error = str(exc)
        except AppError as exc:
            if exc.code != "SQL_REJECTED":
                raise
            last_error = exc.message
            log.info("attempt=%d rejected: %s", attempt + 1, last_error)
        else:
            columns = [Column(**c) for c in result.columns]
            chart, note = (None, None)
            if chart_requested:
                chart, note = build_chart(columns, result.rows, out.chart, req.question)
            log.info("sql=%s rows=%d", sql, len(result.rows))
            return QueryResponse(
                sql=sql,
                explanation=out.explanation,
                columns=columns,
                rows=result.rows,
                row_count=len(result.rows),
                truncated=result.truncated,
                chart_requested=chart_requested,
                chart=chart,
                chart_message=note,
                elapsed_ms=int((time.monotonic() - t0) * 1000),
            )
        messages = [
            *messages,
            {"role": "assistant", "content": raw},
            {
                "role": "user",
                "content": f"Lỗi: {last_error}. Hãy sửa và trả lại JSON đúng định dạng.",
            },
        ]
    if "JSON" in last_error:
        raise llm_unavailable("AI trả về kết quả không hợp lệ, vui lòng thử diễn đạt lại câu hỏi.")
    raise AppError("SQL_REJECTED", f"Không tạo được truy vấn hợp lệ: {last_error}", 400)
