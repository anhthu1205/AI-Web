"""Nhận biết người dùng có yêu cầu vẽ biểu đồ hay không (không phụ thuộc dấu)."""

import re
import unicodedata

# Từ khóa không dấu. KHÔNG có "ve" đứng riêng vì "về" (rất phổ biến) bỏ dấu cũng thành "ve".
_CHART_RE = re.compile(r"\b(bieu do|do thi|chart|plot|truc quan|dang cot|dang tron|dang duong)\b")
# "vẽ" (có dấu hỏi/ngã) chỉ nhận khi người dùng gõ có dấu; "ve" trần chỉ nhận trước từ khóa trên.
_VE_RE = re.compile(r"\bvẽ\b")
_NEGATED_RE = re.compile(
    r"\b(khong|dung|khoi|chua)\s+(can\s+|can phai\s+|muon\s+)?(ve|bieu do|do thi|chart|plot)\b"
)


def strip_accents(text: str) -> str:
    """Bỏ dấu tiếng Việt và hạ chữ thường."""
    text = text.replace("đ", "d").replace("Đ", "d")
    norm = unicodedata.normalize("NFD", text)
    return "".join(c for c in norm if unicodedata.category(c) != "Mn").lower()


def wants_chart(question: str) -> bool:
    """True nếu câu hỏi yêu cầu biểu đồ."""
    plain = strip_accents(question)
    if _NEGATED_RE.search(plain):
        return False
    lowered = unicodedata.normalize("NFC", question).lower()
    return bool(_CHART_RE.search(plain) or _VE_RE.search(lowered))
