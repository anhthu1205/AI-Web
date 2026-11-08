from pathlib import Path

import yaml

from app.services.sql_guard import validate_and_limit
from tests.eval.scoring import results_match

QUESTIONS = Path(__file__).parents[1] / "eval" / "questions.yaml"


def test_same_rows_different_order() -> None:
    assert results_match([["a", 1], ["b", 2]], [["b", 2], ["a", 1]])


def test_extra_column_ok() -> None:
    assert results_match([["a", 1]], [["x", "a", 1]])


def test_value_mismatch() -> None:
    assert not results_match([["a", 1]], [["a", 2]])


def test_row_count_mismatch() -> None:
    assert not results_match([["a", 1]], [["a", 1], ["b", 2]])


def test_numeric_tolerance() -> None:
    assert results_match([[39.387]], [[39.4]])
    assert not results_match([[39.0]], [[60.0]])


def test_percent_vs_fraction_fails() -> None:
    assert not results_match([[9.5]], [[0.095]])


def test_case_insensitive_text() -> None:
    assert results_match([["Hà Nội"]], [["hà nội"]])


def test_eval_set_shape_and_gold_sql_valid() -> None:
    data = yaml.safe_load(QUESTIONS.read_text("utf-8"))
    assert len(data["questions"]) == 20 and len(data["refusals"]) == 2
    ids = [q["id"] for q in data["questions"]]
    assert len(set(ids)) == 20
    for q in data["questions"]:
        validate_and_limit(q["sql"])
    assert "30000000000" in next(q for q in data["questions"] if q["id"] == "q14")["sql"]
