"""Chấm execution accuracy: so sánh tập kết quả, không phụ thuộc tên cột hay thứ tự dòng."""

import math
from typing import Any


def _norm(v: Any) -> Any:
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, int | float):
        return float(v)
    return str(v).strip().lower()


def _close(a: Any, b: Any) -> bool:
    if isinstance(a, float) and isinstance(b, float):
        return math.isclose(a, b, rel_tol=1e-2, abs_tol=0.06)
    return a == b


def _col_equal(a: list[Any], b: list[Any]) -> bool:
    if len(a) != len(b):
        return False
    key = lambda v: (v is None, isinstance(v, str), v if v is not None else 0)  # noqa: E731
    sa, sb = sorted(map(_norm, a), key=key), sorted(map(_norm, b), key=key)
    return all(_close(x, y) for x, y in zip(sa, sb, strict=True))


def results_match(gold: list[list[Any]], pred: list[list[Any]]) -> bool:
    """Đúng khi cùng số dòng và mỗi cột của đáp án chuẩn xuất hiện (theo giá trị) trong kết quả."""
    if len(gold) != len(pred):
        return False
    if not gold:
        return True
    gold_cols = list(zip(*gold, strict=True))
    pred_cols = [list(c) for c in zip(*pred, strict=True)]
    return all(any(_col_equal(list(g), p) for p in pred_cols) for g in gold_cols)
