"""Lỗi nghiệp vụ có mã và HTTP status, trả về dạng {"error": {"code", "message"}}."""


class AppError(Exception):
    """Lỗi chuẩn của API."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def invalid_input(message: str) -> AppError:
    return AppError("INVALID_INPUT", message, 422)


def sql_rejected(message: str) -> AppError:
    return AppError("SQL_REJECTED", message, 400)


def db_timeout() -> AppError:
    return AppError("DB_TIMEOUT", "Truy vấn quá thời gian cho phép, hãy hỏi cụ thể hơn.", 504)


def db_unavailable() -> AppError:
    return AppError("DB_UNAVAILABLE", "Chưa kết nối được cơ sở dữ liệu.", 503)


def llm_unavailable(message: str = "Dịch vụ AI tạm thời không khả dụng.") -> AppError:
    return AppError("LLM_UNAVAILABLE", message, 503)
