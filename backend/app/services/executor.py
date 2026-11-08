"""Chạy SQL chỉ-đọc trên Postgres và chuẩn hóa kết quả để trả JSON."""

import datetime as dt
from decimal import Decimal
from typing import Any, Protocol

import psycopg
from psycopg import errors as pg_errors
from psycopg_pool import AsyncConnectionPool

from app.errors import db_timeout, db_unavailable, sql_rejected

NUMBER_OIDS = {20, 21, 23, 700, 701, 1700}
DATE_OIDS = {1082, 1114, 1184}
BOOL_OID = 16


class QueryResult:
    """Kết quả truy vấn: cột (tên, kiểu), dòng, cờ bị cắt."""

    def __init__(
        self, columns: list[dict[str, str]], rows: list[list[Any]], truncated: bool
    ) -> None:
        self.columns = columns
        self.rows = rows
        self.truncated = truncated


class QueryExecutor(Protocol):
    """Giao diện thực thi truy vấn (có bản thật và bản giả cho test/demo)."""

    async def execute(self, sql: str) -> QueryResult: ...

    async def ping(self) -> bool: ...


def column_type(type_code: int) -> str:
    """Quy OID Postgres về 4 nhóm: number, date, boolean, string."""
    if type_code in NUMBER_OIDS:
        return "number"
    if type_code in DATE_OIDS:
        return "date"
    if type_code == BOOL_OID:
        return "boolean"
    return "string"


def json_safe(value: Any) -> Any:
    """Chuyển Decimal/date về kiểu JSON được."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dt.datetime | dt.date):
        return value.isoformat()
    return value


class PgExecutor:
    """Thực thi qua pool kết nối role app_readonly: READ ONLY + statement_timeout."""

    def __init__(self, pool: AsyncConnectionPool, max_rows: int, timeout_ms: int) -> None:
        self.pool = pool
        self.max_rows = max_rows
        self.timeout_ms = int(timeout_ms)

    async def execute(self, sql: str) -> QueryResult:
        try:
            async with (
                self.pool.connection() as conn,
                conn.transaction(),
                conn.cursor() as cur,
            ):
                await cur.execute(f"SET LOCAL statement_timeout = {self.timeout_ms}")
                await cur.execute(sql)
                fetched = await cur.fetchmany(self.max_rows + 1)
                desc = cur.description or []
        except pg_errors.QueryCanceled as exc:
            raise db_timeout() from exc
        except (pg_errors.SyntaxError, pg_errors.UndefinedColumn, pg_errors.UndefinedFunction,
                pg_errors.DatatypeMismatch, pg_errors.InvalidTextRepresentation,
                pg_errors.DivisionByZero, pg_errors.UndefinedTable,
                pg_errors.InsufficientPrivilege, pg_errors.AmbiguousColumn,
                pg_errors.GroupingError) as exc:  # fmt: skip
            raise sql_rejected(f"Lỗi khi chạy SQL: {exc.diag.message_primary}") from exc
        except (psycopg.OperationalError, TimeoutError) as exc:
            raise db_unavailable() from exc
        columns = [{"name": c.name, "type": column_type(c.type_code)} for c in desc]
        rows = [[json_safe(v) for v in row] for row in fetched[: self.max_rows]]
        return QueryResult(columns, rows, len(fetched) > self.max_rows)

    async def ping(self) -> bool:
        """SELECT 1 để kiểm tra DB; trả False nếu lỗi."""
        try:
            async with self.pool.connection() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:
            return False


class NoDbExecutor:
    """Dùng khi chưa cấu hình DATABASE_URL: mọi truy vấn báo DB chưa sẵn sàng."""

    async def execute(self, sql: str) -> QueryResult:
        raise db_unavailable()

    async def ping(self) -> bool:
        return False
