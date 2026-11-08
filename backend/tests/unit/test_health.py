from fastapi.testclient import TestClient

from app.main import app


def test_health_ok() -> None:
    assert TestClient(app).get("/health").json()["status"] == "ok"


def test_env_file_does_not_depend_on_cwd(tmp_path, monkeypatch) -> None:
    """README bảo đặt .env ở gốc repo; Settings phải tìm thấy dù chạy từ backend/."""
    from app.config import _ROOT_ENV, Settings

    assert _ROOT_ENV.name == ".env" and _ROOT_ENV.parent.name != "backend"
    env = tmp_path / ".env"
    env.write_text("REFERENCE_DATE=2026-01-02\n")
    monkeypatch.setitem(Settings.model_config, "env_file", (env,))
    assert str(Settings().reference_date) == "2026-01-02"
