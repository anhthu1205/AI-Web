"""Kiểm thử với DB thật (role app_readonly). Chạy: DATABASE_URL=... pytest tests/integration.

Tự bỏ qua khi chưa có DATABASE_URL.
"""

import os

import pytest

from app.db.pool import create_pool
from app.errors import AppError
from app.services.executor import PgExecutor

URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="chưa có DATABASE_URL")


@pytest.fixture
async def executor():
    pool = create_pool(URL or "")
    await pool.open()
    try:
        yield PgExecutor(pool, max_rows=500, timeout_ms=1000)
    finally:
        await pool.close()


async def test_count(executor: PgExecutor) -> None:
    res = await executor.execute("SELECT count(*) AS n FROM sales_clean")
    assert res.rows == [[1800]]


async def test_truncated(executor: PgExecutor) -> None:
    res = await executor.execute("SELECT ma_giao_dich FROM sales_clean LIMIT 501")
    assert res.truncated and len(res.rows) == 500


async def test_public_denied(executor: PgExecutor) -> None:
    with pytest.raises(AppError):
        await executor.execute("SELECT * FROM public.sales LIMIT 1")


async def test_write_denied(executor: PgExecutor) -> None:
    with pytest.raises(AppError):
        await executor.execute("INSERT INTO sales_clean (ma_giao_dich) VALUES ('x')")


async def test_timeout(executor: PgExecutor) -> None:
    with pytest.raises(AppError) as err:
        await executor.execute("SELECT pg_sleep(3)")
    assert err.value.code == "DB_TIMEOUT"
