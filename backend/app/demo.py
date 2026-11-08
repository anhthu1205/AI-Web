"""Chế độ DEMO (DEMO_MODE=true): AI và dữ liệu giả lập để thử giao diện, KHÔNG dùng cho production."""

import json
from dataclasses import dataclass

from app.errors import llm_unavailable
from app.services.chart_intent import strip_accents
from app.services.executor import QueryResult
from app.services.sql_guard import validate_and_limit


@dataclass
class Case:
    keywords: tuple[str, ...]
    sql: str
    explanation: str
    chart: dict | None
    columns: list[dict[str, str]]
    rows: list[list]


def _c(name: str, kind: str) -> dict[str, str]:
    return {"name": name, "type": kind}


CASES: list[Case] = [
    Case(
        ("nguon",),
        "SELECT nguon_lead, count(*) AS so_lead FROM sales_clean GROUP BY nguon_lead ORDER BY 2 DESC",
        "Đếm số lead theo từng nguồn (dữ liệu demo).",
        {"type": "bar", "x": "nguon_lead", "y": ["so_lead"], "title": "Số lead theo nguồn"},
        [_c("nguon_lead", "string"), _c("so_lead", "number")],
        [
            ["Facebook Ads", 310],
            ["Data đối tác", 271],
            ["Website", 240],
            ["Google Ads", 179],
            ["Hotline", 160],
            ["Zalo OA", 146],
            ["Giới thiệu", 120],
            ["Sự kiện mở bán", 175],
            ["TikTok", 199],
        ],
    ),
    Case(
        ("thang",),
        "SELECT to_char(ngay_ky_hd, 'YYYY-MM') AS thang, sum(gia_tri_giao_dich_vnd) AS doanh_thu_vnd "
        "FROM sales_clean WHERE trang_thai = 'Ký HĐ' GROUP BY 1 ORDER BY 1",
        "Doanh thu = tổng giá trị giao dịch Ký HĐ theo tháng ký (dữ liệu demo).",
        {"type": "line", "x": "thang", "y": ["doanh_thu_vnd"], "title": "Doanh thu theo tháng"},
        [_c("thang", "string"), _c("doanh_thu_vnd", "number")],
        [
            ["2026-01", 5081771193],
            ["2026-02", 52705813420],
            ["2026-03", 219004016235],
            ["2026-04", 287650725529],
            ["2026-05", 240100000000],
            ["2026-06", 310200000000],
        ],
    ),
    Case(
        ("co cau", "tron"),
        "SELECT loai_san_pham, count(*) AS so_giao_dich FROM sales_clean "
        "WHERE trang_thai = 'Đặt cọc' GROUP BY loai_san_pham",
        "Đếm giao dịch ở trạng thái Đặt cọc theo loại sản phẩm (dữ liệu demo).",
        {
            "type": "pie",
            "x": "loai_san_pham",
            "y": ["so_giao_dich"],
            "title": "Cơ cấu loại sản phẩm",
        },
        [_c("loai_san_pham", "string"), _c("so_giao_dich", "number")],
        [["Căn hộ", 32], ["Biệt thự", 22], ["Nhà phố", 11], ["Duplex", 5], ["Shophouse", 18]],
    ),
    Case(
        ("top", "nhan vien"),
        "SELECT ten_nv, sum(gia_tri_giao_dich_vnd) AS doanh_thu_vnd FROM sales_clean "
        "WHERE trang_thai = 'Ký HĐ' GROUP BY ma_nv, ten_nv ORDER BY 2 DESC LIMIT 5",
        "Top 5 nhân viên theo doanh thu Ký HĐ (dữ liệu demo).",
        {"type": "hbar", "x": "ten_nv", "y": ["doanh_thu_vnd"], "title": "Top 5 nhân viên"},
        [_c("ten_nv", "string"), _c("doanh_thu_vnd", "number")],
        [
            ["Lê Tú Anh", 94158095438],
            ["Phạm Gia Huy", 88177264269],
            ["Phạm Thanh Bình", 85440745599],
            ["Phạm Hà My", 80000000000],
            ["Lê Bảo Châu", 76000000000],
        ],
    ),
    Case(
        ("xss",),
        "SELECT ten_nv, count(*) AS so_lead FROM sales_clean GROUP BY ten_nv LIMIT 2",
        "Kiểm thử chống XSS: dữ liệu chứa thẻ HTML phải hiển thị như chữ.",
        None,
        [_c("ten_nv", "string"), _c("so_lead", "number")],
        [['<img src=x onerror="window.__xss=1">', 1], ["<script>window.__xss=1</script>", 2]],
    ),
    Case(
        ("tong", "bao nhieu"),
        "SELECT sum(gia_tri_giao_dich_vnd) AS doanh_thu_vnd FROM sales_clean WHERE trang_thai = 'Ký HĐ'",
        "Doanh thu = tổng giá trị giao dịch Ký HĐ (dữ liệu demo).",
        None,
        [_c("doanh_thu_vnd", "number")],
        [[1556003395101]],
    ),
]


def _match(question: str) -> Case | None:
    q = strip_accents(question)
    for case in CASES:
        if any(k in q for k in case.keywords):
            return case
    return None


class DemoLlm:
    """LLM giả: chọn câu trả lời dựng sẵn theo từ khóa; từ chối nếu không khớp."""

    async def generate(self, messages: list[dict[str, str]]) -> str:
        question = messages[-1]["content"]
        if messages[-1]["role"] != "user":
            raise llm_unavailable()
        case = _match(question)
        if "xoa " in strip_accents(question) or case is None:
            out = {
                "sql": None,
                "explanation": "Chế độ demo chỉ trả lời vài câu mẫu (nguồn lead, doanh thu theo tháng, "
                "cơ cấu, top nhân viên, tổng doanh thu).",
                "chart": None,
                "clarification": None,
            }
        else:
            out = {"sql": case.sql, "explanation": case.explanation, "chart": case.chart,
                   "clarification": None}  # fmt: skip
        return json.dumps(out, ensure_ascii=False)


class DemoExecutor:
    """Executor giả: trả kết quả dựng sẵn cho SQL của các Case."""

    def __init__(self, max_rows: int) -> None:
        self.by_sql = {validate_and_limit(c.sql, max_rows): c for c in CASES}

    async def execute(self, sql: str) -> QueryResult:
        case = self.by_sql[sql]
        return QueryResult(case.columns, case.rows, False)

    async def ping(self) -> bool:
        return True
