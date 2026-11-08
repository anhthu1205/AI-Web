import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.logging_setup import RedactFilter
from app.main import app
from tests.unit.conftest import FakeExecutor, FakeLlm

GOOD = json.dumps(
    {
        "sql": "SELECT nguon_lead, count(*) AS so_lead FROM sales_clean GROUP BY 1",
        "explanation": "Đếm lead theo nguồn.",
        "chart": {"type": "bar", "x": "nguon_lead", "y": ["so_lead"], "title": "Lead"},
    }
)


def post(client: TestClient, question: str, ip: str = "10.0.0.1", **extra):
    return client.post(
        "/api/query",
        json={"question": question, **extra},
        headers={"x-forwarded-for": ip},
    )


@pytest.fixture
def client(monkeypatch):
    """Cô lập khỏi .env thật của máy dev: không khóa, không DB."""
    for name in ("GROQ_API_KEY", "DATABASE_URL"):
        monkeypatch.setenv(name, "")
    get_settings.cache_clear()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


def test_query_without_chart_request(client, overrides) -> None:
    overrides(FakeLlm([GOOD]), FakeExecutor())
    r = post(client, "Số lead theo nguồn", "10.0.1.1")
    body = r.json()
    assert r.status_code == 200
    assert body["chart_requested"] is False and body["chart"] is None
    assert body["row_count"] == 2 and body["sql"].endswith("LIMIT 501")
    assert body["columns"][0] == {"name": "nguon_lead", "type": "string"}


def test_query_with_chart_request(client, overrides) -> None:
    overrides(FakeLlm([GOOD]), FakeExecutor())
    body = post(client, "Vẽ biểu đồ cột số lead theo nguồn", "10.0.1.2").json()
    assert body["chart_requested"] is True
    assert body["chart"]["type"] == "bar" and body["chart"]["labels"] == ["Zalo OA", "Hotline"]


def test_retry_once_on_rejected_sql(client, overrides) -> None:
    bad = json.dumps({"sql": "DROP TABLE sales_clean", "explanation": "x"})
    llm, ex = FakeLlm([bad, GOOD]), FakeExecutor()
    overrides(llm, ex)
    r = post(client, "Số lead theo nguồn", "10.0.1.3")
    assert r.status_code == 200 and len(llm.calls) == 2 and len(ex.sqls) == 1
    assert "Lỗi" in llm.calls[1][-1]["content"]


def test_retry_only_once(client, overrides) -> None:
    bad = json.dumps({"sql": "DROP TABLE sales_clean", "explanation": "x"})
    llm = FakeLlm([bad, bad, GOOD])
    overrides(llm, FakeExecutor())
    r = post(client, "Số lead theo nguồn", "10.0.1.4")
    assert r.status_code == 400 and r.json()["error"]["code"] == "SQL_REJECTED"
    assert len(llm.calls) == 2


def test_bad_json_twice(client, overrides) -> None:
    overrides(FakeLlm(["xxx", "yyy"]), FakeExecutor())
    r = post(client, "Số lead theo nguồn", "10.0.1.5")
    assert r.status_code == 503 and r.json()["error"]["code"] == "LLM_UNAVAILABLE"


def test_out_of_scope(client, overrides) -> None:
    out = json.dumps({"sql": None, "explanation": "Không có dữ liệu cá nhân."})
    ex = FakeExecutor()
    overrides(FakeLlm([out]), ex)
    r = post(client, "Cho tôi số điện thoại khách hàng", "10.0.1.6")
    assert r.status_code == 200
    assert r.json()["error"]["code"] == "OUT_OF_SCOPE" and ex.sqls == []


def test_clarification(client, overrides) -> None:
    out = json.dumps({"sql": None, "explanation": "", "clarification": "Bạn muốn năm nào?"})
    overrides(FakeLlm([out]), FakeExecutor())
    body = post(client, "Doanh thu", "10.0.1.7").json()
    assert body["clarification"] == "Bạn muốn năm nào?" and body["sql"] is None


def test_invalid_input(client, overrides) -> None:
    overrides(FakeLlm([]), FakeExecutor())
    assert post(client, "x" * 301, "10.0.1.8").status_code == 422
    r = post(client, "", "10.0.1.8")
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"
    assert post(client, "ok", "10.0.1.8", history=[{"question": "a"}] * 4).status_code == 422


def test_body_too_large(client) -> None:
    r = client.post(
        "/api/query", content=b"x" * 20000, headers={"content-type": "application/json"}
    )
    assert r.status_code == 413


def test_rate_limit(client, overrides, monkeypatch) -> None:
    monkeypatch.setenv("RATE_LIMIT", "3/minute")
    get_settings.cache_clear()
    overrides(FakeLlm([GOOD] * 10), FakeExecutor())
    codes = [post(client, "Số lead theo nguồn", "10.9.9.9").status_code for _ in range(5)]
    get_settings.cache_clear()
    assert codes == [200, 200, 200, 429, 429]
    assert post(client, "Số lead", "10.9.9.10").status_code == 200


def test_rate_limit_error_shape(client, overrides, monkeypatch) -> None:
    monkeypatch.setenv("RATE_LIMIT", "1/minute")
    get_settings.cache_clear()
    overrides(FakeLlm([GOOD] * 3), FakeExecutor())
    post(client, "a", "10.8.8.8")
    r = post(client, "a", "10.8.8.8")
    get_settings.cache_clear()
    assert r.json()["error"]["code"] == "RATE_LIMITED"


def test_schema_and_examples(client) -> None:
    schema = client.get("/api/schema").json()
    names = {c["name"] for c in schema["columns"]}
    assert "gia_tri_giao_dich_vnd" in names
    assert not names & {"ho_ten_khach_hang", "sdt_khach_hang", "email_khach_hang"}
    assert len(client.get("/api/examples").json()["examples"]) >= 5


def test_health_without_db_does_not_crash(client) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["db"] == "unavailable" and body["demo"] is False


def test_query_without_config_is_503(client) -> None:
    r = post(client, "Số lead", "10.7.7.7")
    assert r.status_code == 503 and r.json()["error"]["code"] == "LLM_UNAVAILABLE"


def test_log_redaction() -> None:
    rec = logging.LogRecord(
        "x", logging.INFO, "", 0, "key gsk_AbC123xyz url postgresql://u:secret@host/db", None, None
    )
    RedactFilter().filter(rec)
    assert "AbC123" not in rec.msg and "secret" not in rec.msg
