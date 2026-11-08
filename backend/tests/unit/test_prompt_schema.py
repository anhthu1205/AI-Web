import re
from datetime import date
from pathlib import Path

from app.schema_info import CATEGORIES, COLUMNS
from app.schemas import HistoryItem
from app.services.prompt import FEWSHOT, build_messages, build_system_prompt
from app.services.sql_guard import validate_and_limit

MIGRATION = Path(__file__).parents[3] / "db" / "migrations" / "001_clean_view.sql"


def test_columns_match_migration_comments() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    documented = re.findall(r"COMMENT ON COLUMN analytics\.sales_clean\.(\w+)", sql)
    assert [c["name"] for c in COLUMNS] == documented


def test_status_mapping_in_migration() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    pairs = dict(re.findall(r"\('([^']+)', '([^']+)', \d\)", sql))
    assert len(pairs) == 16
    assert set(pairs.values()) == set(CATEGORIES["trang_thai"])
    assert pairs["Đã ký hợp đồng"] == "Ký HĐ" and pairs["Mất liên lạc"] == "Thất bại"
    assert pairs["Hẹn tham quan"] == "Hẹn xem"


def test_prompt_contains_key_rules() -> None:
    p = build_system_prompt(date(2026, 11, 8))
    assert "DATE '2026-11-08'" in p and "DATE '2026-10-09'" in p
    assert "Doanh thu = SUM(gia_tri_giao_dich_vnd)" in p
    assert "Tỷ lệ chốt" in p and "Phú Quốc" in p and "ILIKE" in p
    assert "JSON" in p
    for forbidden in ("ho_ten", "sdt", "email_khach_hang", "ghi_chu"):
        assert forbidden not in p


def test_fewshot_sql_passes_guard() -> None:
    for _, answer in FEWSHOT:
        if answer["sql"]:
            validate_and_limit(answer["sql"])


def test_fewshot_not_in_eval_set() -> None:
    import yaml

    qs = yaml.safe_load((Path(__file__).parents[1] / "eval" / "questions.yaml").read_text("utf-8"))
    eval_questions = {q["question"].lower() for q in qs["questions"]}
    assert not eval_questions & {q.lower() for q, _ in FEWSHOT}


def test_messages_history_capped() -> None:
    hist = [HistoryItem(question=f"q{i}", sql="SELECT 1") for i in range(5)]
    msgs = build_messages("sys", "now", hist)
    assert msgs[0]["role"] == "system" and msgs[-1]["content"] == "now"
    assert len(msgs) == 1 + 3 * 2 + 1
