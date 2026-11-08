"""Chọn và dựng biểu đồ từ cấu trúc kết quả (luật ở server, gợi ý LLM chỉ để chọn cột/loại)."""

import re
from typing import Any

from app.schemas import Chart, ChartHint, Column, Dataset
from app.services.chart_intent import strip_accents

MAX_GROUPS = 30
PIE_MAX = 8
LONG_LABEL = 16
_TIME_RE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?([ T].*)?$")
_PIE_RE = re.compile(r"\b(tron|co cau|ty le|ty trong)\b")
NO_CHART = "Kết quả này không phù hợp để vẽ biểu đồ."


def _is_time(col: Column, rows: list[list[Any]], idx: int) -> bool:
    if col.type == "date":
        return True
    vals = [r[idx] for r in rows if r[idx] is not None]
    return bool(vals) and all(isinstance(v, str) and _TIME_RE.match(v) for v in vals)


def _label(value: Any) -> str:
    return "Không rõ" if value is None else str(value)


def _numbers(rows: list[list[Any]], idx: int) -> list[float | int | None]:
    return [r[idx] if isinstance(r[idx], int | float) else None for r in rows]


def _pick_columns(columns: list[Column], hint: ChartHint | None) -> tuple[list[int], list[int]]:
    """Trả về (chỉ số cột nhãn, chỉ số cột số), ưu tiên cột gợi ý hợp lệ."""
    names = [c.name for c in columns]
    nums = [i for i, c in enumerate(columns) if c.type == "number"]
    cats = [i for i, c in enumerate(columns) if c.type != "number"]
    if hint and hint.x in names and hint.y and all(y in names for y in hint.y):
        y_idx = [names.index(y) for y in hint.y if columns[names.index(y)].type == "number"]
        x_idx = names.index(hint.x)
        if y_idx and x_idx not in y_idx:
            others = [i for i in cats if i != x_idx and i not in y_idx]
            return ([x_idx] + others)[:2], y_idx
    return cats, nums


def _simple(
    kind: str, title: str, labels: list[str], series: list[tuple[str, list[Any]]], xl: str, yl: str
) -> Chart:
    return Chart(
        type=kind,  # type: ignore[arg-type]
        title=title,
        labels=labels,
        datasets=[Dataset(label=n, data=d) for n, d in series],
        x_label=xl,
        y_label=yl,
    )


def build_chart(
    columns: list[Column], rows: list[list[Any]], hint: ChartHint | None, question: str
) -> tuple[Chart | None, str | None]:
    """Trả về (chart, thông báo). chart=None kèm thông báo khi không vẽ được."""
    if not rows:
        return None, "Không có dữ liệu để vẽ biểu đồ."
    cats, nums = _pick_columns(columns, hint)
    title = (hint.title if hint and hint.title else "") or "Biểu đồ"
    wanted = (hint.type or "").lower() if hint else ""

    if len(cats) == 1 and nums and _is_time(columns[cats[0]], rows, cats[0]):
        if len(rows) > MAX_GROUPS * 2:
            return None, "Quá nhiều điểm dữ liệu để vẽ biểu đồ."
        c = cats[0]
        series = [(columns[i].name, _numbers(rows, i)) for i in nums]
        return _simple(
            "line",
            title,
            [_label(r[c]) for r in rows],
            series,
            columns[c].name,
            columns[nums[0]].name,
        ), None

    if len(cats) == 1 and len(nums) >= 1:
        c, n = cats[0], nums[0]
        if len(rows) > MAX_GROUPS:
            return None, f"Có hơn {MAX_GROUPS} nhóm nên không vẽ biểu đồ."
        labels = [_label(r[c]) for r in rows]
        values = _numbers(rows, n)
        series = [
            (columns[i].name, _numbers(rows, i))
            for i in ([n] if wanted in ("pie", "doughnut") else nums)
        ]
        asked_pie = wanted in ("pie", "doughnut") or bool(_PIE_RE.search(strip_accents(question)))
        no_neg = all(v is None or v >= 0 for v in values)
        if asked_pie and len(rows) <= PIE_MAX and no_neg and len(nums) == 1:
            kind = "doughnut" if wanted == "doughnut" else "pie"
        elif len(rows) > PIE_MAX or max(len(x) for x in labels) > LONG_LABEL:
            kind = "hbar"
        else:
            kind = "bar"
        return _simple(kind, title, labels, series, columns[c].name, columns[n].name), None

    if len(cats) == 2 and nums:
        a, b, n = cats[0], cats[1], nums[0]
        xs = list(dict.fromkeys(_label(r[a]) for r in rows))
        gs = list(dict.fromkeys(_label(r[b]) for r in rows))
        if len(xs) > MAX_GROUPS or len(gs) > PIE_MAX:
            return None, "Quá nhiều nhóm để vẽ biểu đồ so sánh."
        grid: dict[tuple[str, str], Any] = {(_label(r[a]), _label(r[b])): r[n] for r in rows}
        series = [(g, [grid.get((x, g)) for x in xs]) for g in gs]
        return _simple("grouped_bar", title, xs, series, columns[a].name, columns[n].name), None

    if not cats and len(nums) == 2 and len(rows) > 1:
        x, y = nums[0], nums[1]
        pts = [{"x": r[x], "y": r[y]} for r in rows if r[x] is not None and r[y] is not None]
        return _simple(
            "scatter", title, [], [(columns[y].name, pts)], columns[x].name, columns[y].name
        ), None

    return None, NO_CHART
