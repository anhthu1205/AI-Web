"""Các endpoint HTTP."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import Settings, get_settings
from app.schema_info import CATEGORIES, COLUMNS, EXAMPLES
from app.schemas import QueryRequest, QueryResponse
from app.services.executor import QueryExecutor
from app.services.llm import LlmClient
from app.services.query_service import OutOfScope, answer

router = APIRouter()


def client_key(request: Request) -> str:
    """IP client: ưu tiên phần tử cuối của X-Forwarded-For (do proxy tin cậy thêm vào)."""
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[-1].strip() if fwd else get_remote_address(request)


limiter = Limiter(key_func=client_key, default_limits=[])


def get_llm(request: Request) -> LlmClient:
    return request.app.state.llm


def get_executor(request: Request) -> QueryExecutor:
    return request.app.state.executor


@router.post("/api/query", response_model=QueryResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def query(
    request: Request,
    body: QueryRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    llm: Annotated[LlmClient, Depends(get_llm)],
    executor: Annotated[QueryExecutor, Depends(get_executor)],
) -> QueryResponse | JSONResponse:
    """Hỏi bằng tiếng Việt, nhận SQL + kết quả (+ biểu đồ nếu được yêu cầu)."""
    try:
        return await answer(body, settings, llm, executor)
    except OutOfScope as exc:
        return JSONResponse({"error": {"code": "OUT_OF_SCOPE", "message": exc.message}})


@router.get("/api/schema")
async def schema() -> dict:
    """Mô tả các cột và giá trị phân loại cho người dùng."""
    return {"table": "sales_clean", "columns": COLUMNS, "categories": CATEGORIES}


@router.get("/api/examples")
async def examples() -> dict:
    """Câu hỏi gợi ý."""
    return {"examples": EXAMPLES}


@router.get("/health")
async def health(request: Request) -> dict:
    """Tiến trình luôn 'ok'; trường db cho biết kết nối CSDL."""
    ok = await request.app.state.executor.ping()
    return {"status": "ok", "db": "ok" if ok else "unavailable", "demo": request.app.state.demo}
