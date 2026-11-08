import pytest

from app.services.llm import parse_llm_output


def test_plain_json() -> None:
    out = parse_llm_output('{"sql": "SELECT 1", "explanation": "x"}')
    assert out.sql == "SELECT 1" and out.chart is None


def test_json_inside_text() -> None:
    out = parse_llm_output('Đây là kết quả:\n```json\n{"sql": null, "explanation": "từ chối"}\n```')
    assert out.sql is None and out.explanation == "từ chối"


def test_chart_hint() -> None:
    raw = '{"sql": "s", "chart": {"type": "bar", "x": "a", "y": ["b"], "title": "t"}}'
    assert parse_llm_output(raw).chart.y == ["b"]  # type: ignore[union-attr]


@pytest.mark.parametrize("raw", ["", "không phải json", '{"sql": 5}', "[1, 2]"])
def test_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        parse_llm_output(raw)
