import pytest

from app.schemas import ChartHint, Column
from app.services.chart_intent import wants_chart
from app.services.chart_rules import build_chart


@pytest.mark.parametrize(
    "q",
    [
        "Vẽ biểu đồ số lead theo nguồn",
        "ve bieu do so lead",
        "cho xem đồ thị doanh thu",
        "show a chart of revenue",
        "trực quan hóa doanh thu",
        "dạng cột",
        "dạng tròn",
        "dạng đường",
        "VẼ cho tôi",
    ],
)
def test_chart_requested(q: str) -> None:
    assert wants_chart(q)


@pytest.mark.parametrize(
    "q",
    ["Có bao nhiêu lead?", "Tổng doanh thu", "Nhân viên nào bán tốt nhất", "bắt đầu từ tháng 1"],
)
def test_chart_not_requested(q: str) -> None:
    assert not wants_chart(q)


def cols(*pairs: tuple[str, str]) -> list[Column]:
    return [Column(name=n, type=t) for n, t in pairs]  # type: ignore[arg-type]


def test_bar() -> None:
    chart, _ = build_chart(
        cols(("nguon", "string"), ("n", "number")), [["A", 1], ["B", 2]], None, "vẽ biểu đồ"
    )
    assert chart and chart.type == "bar" and chart.labels == ["A", "B"]
    assert chart.datasets[0].data == [1, 2]


def test_hbar_long_labels() -> None:
    rows = [["Một nhãn rất là dài dòng", 1], ["Nhãn dài khác nữa đây", 2]]
    chart, _ = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ")
    assert chart and chart.type == "hbar"


def test_hbar_many_rows() -> None:
    rows = [[f"k{i}", i] for i in range(12)]
    chart, _ = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ")
    assert chart and chart.type == "hbar"


def test_pie_when_asked() -> None:
    rows = [["A", 3], ["B", 4]]
    chart, _ = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ biểu đồ tròn")
    assert chart and chart.type == "pie"


def test_pie_rejected_for_negative() -> None:
    rows = [["A", 3], ["B", -4]]
    chart, _ = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ biểu đồ tròn")
    assert chart and chart.type != "pie"


def test_pie_not_over_8_rows() -> None:
    rows = [[f"k{i}", i + 1] for i in range(9)]
    chart, _ = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ biểu đồ tròn")
    assert chart and chart.type == "hbar"


def test_line_for_month_strings() -> None:
    rows = [["2026-01", 5], ["2026-02", 7]]
    chart, _ = build_chart(cols(("thang", "string"), ("v", "number")), rows, None, "vẽ")
    assert chart and chart.type == "line"


def test_line_for_date_column() -> None:
    rows = [["2026-01-01", 5], ["2026-01-02", 7]]
    chart, _ = build_chart(cols(("ngay", "date"), ("v", "number")), rows, None, "vẽ")
    assert chart and chart.type == "line"


def test_grouped_bar() -> None:
    rows = [["A", "x", 1], ["A", "y", 2], ["B", "x", 3]]
    chart, _ = build_chart(
        cols(("a", "string"), ("b", "string"), ("n", "number")), rows, None, "vẽ"
    )
    assert chart and chart.type == "grouped_bar"
    assert chart.labels == ["A", "B"]
    assert [d.data for d in chart.datasets] == [[1, 3], [2, None]]


def test_scatter() -> None:
    rows = [[1, 2], [2, 3]]
    chart, _ = build_chart(cols(("x", "number"), ("y", "number")), rows, None, "vẽ")
    assert chart and chart.type == "scatter"
    assert chart.datasets[0].data == [{"x": 1, "y": 2}, {"x": 2, "y": 3}]


def test_single_value_no_chart() -> None:
    chart, msg = build_chart(cols(("n", "number")), [[5]], None, "vẽ")
    assert chart is None and msg


def test_too_many_groups() -> None:
    rows = [[f"k{i}", i] for i in range(31)]
    chart, msg = build_chart(cols(("a", "string"), ("n", "number")), rows, None, "vẽ")
    assert chart is None and msg


def test_no_rows() -> None:
    chart, msg = build_chart(cols(("a", "string"), ("n", "number")), [], None, "vẽ")
    assert chart is None and msg


def test_valid_hint_picks_columns() -> None:
    c = cols(("a", "string"), ("m", "number"), ("n", "number"))
    hint = ChartHint(type="bar", x="a", y=["n"], title="T")
    chart, _ = build_chart(c, [["A", 1, 10], ["B", 2, 20]], hint, "vẽ")
    assert chart and chart.datasets[0].label == "n" and chart.title == "T"


def test_invalid_hint_ignored() -> None:
    c = cols(("a", "string"), ("n", "number"))
    hint = ChartHint(type="bar", x="khong_ton_tai", y=["n"])
    chart, _ = build_chart(c, [["A", 1], ["B", 2]], hint, "vẽ")
    assert chart and chart.labels == ["A", "B"]


def test_hint_with_non_numeric_y_ignored() -> None:
    c = cols(("a", "string"), ("b", "string"), ("n", "number"))
    hint = ChartHint(type="bar", x="a", y=["b"])
    chart, _ = build_chart(c, [["A", "x", 1], ["B", "y", 2]], hint, "vẽ")
    assert chart is not None
