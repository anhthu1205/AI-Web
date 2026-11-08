"""Nhận biết người dùng có yêu cầu vẽ biểu đồ hay không (không phụ thuộc dấu)."""

import re
import unicodedata

_CHART_RE = re.compile(
    r"\b(ve|bieu do|do thi|chart|plot|truc quan|dang cot|dang tron|dang duong)\b"
)  # "ve" đứng riêng là "vẽ" sau khi bỏ dấu


def strip_accents(text: str) -> str:
    """Bỏ dấu tiếng Việt và hạ chữ thường."""
    text = text.replace("đ", "d").replace("Đ", "d")
    norm = unicodedata.normalize("NFD", text)
    return "".join(c for c in norm if unicodedata.category(c) != "Mn").lower()


def wants_chart(question: str) -> bool:
    """True nếu câu hỏi yêu cầu biểu đồ."""
    return bool(_CHART_RE.search(strip_accents(question)))
