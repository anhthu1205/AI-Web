"""Tạo pool kết nối Postgres (Session Pooler) cho role chỉ đọc."""

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool


async def _configure(conn: AsyncConnection) -> None:
    await conn.set_read_only(True)


def create_pool(database_url: str) -> AsyncConnectionPool:
    """Pool nhỏ, mở lười (chưa kết nối đến khi dùng)."""
    return AsyncConnectionPool(
        database_url,
        min_size=0,
        max_size=5,
        open=False,
        timeout=8,
        configure=_configure,
        kwargs={"autocommit": False, "connect_timeout": 8},
    )
