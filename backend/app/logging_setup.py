"""Cấu hình log: che khóa API và chuỗi kết nối trước khi ghi."""

import logging
import re

_PATTERNS = [
    (re.compile(r"gsk_[A-Za-z0-9]+"), "gsk_***"),
    (re.compile(r"(postgres(?:ql)?://[^:/\s]+:)[^@\s]+@"), r"\1***@"),
]


class RedactFilter(logging.Filter):
    """Thay thế bí mật trong thông điệp log."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        for pat, repl in _PATTERNS:
            msg = pat.sub(repl, msg)
        record.msg, record.args = msg, None
        return True


def setup_logging() -> None:
    """Gắn bộ lọc che bí mật vào mọi handler của root logger."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    for handler in logging.getLogger().handlers:
        handler.addFilter(RedactFilter())
