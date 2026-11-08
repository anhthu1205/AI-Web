import datetime as dt
from decimal import Decimal

from app.services.executor import NoDbExecutor, column_type, json_safe


def test_json_safe() -> None:
    assert json_safe(Decimal("12.50")) == 12.5
    assert json_safe(Decimal("7")) == 7
    assert json_safe(dt.date(2026, 1, 2)) == "2026-01-02"
    assert json_safe(dt.datetime(2026, 1, 2, 3, 4, 5)) == "2026-01-02T03:04:05"
    assert json_safe("x") == "x"


def test_column_type() -> None:
    assert column_type(20) == "number"
    assert column_type(1700) == "number"
    assert column_type(1082) == "date"
    assert column_type(16) == "boolean"
    assert column_type(25) == "string"


async def test_no_db_ping_false() -> None:
    assert await NoDbExecutor().ping() is False
