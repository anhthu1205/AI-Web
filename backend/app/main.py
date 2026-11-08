"""Điểm vào FastAPI: gắn router, CORS, rate limit, xử lý lỗi, phục vụ frontend."""

import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.api.routes import limiter, router
from app.config import get_settings
from app.errors import AppError
from app.logging_setup import setup_logging
from app.services.executor import NoDbExecutor, PgExecutor
from app.services.llm import GroqLlm, NoLlm

log = logging.getLogger("app")
MAX_BODY = 16 * 1024
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Khởi tạo LLM + executor theo cấu hình; đóng pool khi tắt."""
    s = get_settings()
    pool = None
    app.state.demo = s.demo_mode
    if s.demo_mode:
        from app.demo import DemoExecutor, DemoLlm

        log.warning("DEMO_MODE đang bật: dữ liệu và AI là giả lập, không dùng cho production.")
        app.state.llm, app.state.executor = DemoLlm(), DemoExecutor(s.max_rows)
    else:
        key = s.groq_api_key.get_secret_value() if s.groq_api_key else ""
        app.state.llm = GroqLlm(key, s.groq_model, s.groq_fallback_model) if key else NoLlm()
        if s.database_url:
            from app.db.pool import create_pool

            pool = create_pool(s.database_url.get_secret_value())
            await pool.open()
            app.state.executor = PgExecutor(pool, s.max_rows, s.statement_timeout_ms)
        else:
            app.state.executor = NoDbExecutor()
    yield
    if pool:
        await pool.close()


def create_app() -> FastAPI:
    """Tạo ứng dụng FastAPI."""
    setup_logging()
    app = FastAPI(title="Text-to-SQL Bất động sản", lifespan=lifespan)
    app.state.limiter = limiter
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def guard_body_and_log(request: Request, call_next):  # type: ignore[no-untyped-def]
        if int(request.headers.get("content-length") or 0) > MAX_BODY:
            return _error("INVALID_INPUT", "Nội dung yêu cầu quá lớn.", 413)
        rid = uuid.uuid4().hex[:8]
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        if request.url.path.startswith("/api/"):
            log.info(
                "rid=%s %s %s -> %s", rid, request.method, request.url.path, response.status_code
            )
        return response

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error(exc.code, exc.message, exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error("INVALID_INPUT", "Câu hỏi không hợp lệ (1-300 ký tự).", 422)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return _error("RATE_LIMITED", "Bạn hỏi quá nhanh, vui lòng thử lại sau ít phút.", 429)

    app.include_router(router)
    if FRONTEND_DIR.is_dir():
        app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    return app


app = create_app()
