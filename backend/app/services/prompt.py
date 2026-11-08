"""Dựng system prompt và danh sách message gửi LLM."""

import json
from datetime import date, timedelta

from app.schema_info import CATEGORIES, COLUMNS
from app.schemas import HistoryItem

FEWSHOT: list[tuple[str, dict]] = [
    (
        "Có bao nhiêu lead đến từ Zalo OA?",
        {
            "sql": "SELECT count(*) AS so_lead FROM sales_clean WHERE nguon_lead = 'Zalo OA'",
            "explanation": "Đếm số dòng (mỗi dòng là một lead) có nguồn là Zalo OA.",
            "chart": None,
            "clarification": None,
        },
    ),
    (
        "Doanh thu của dự án Ecopark là bao nhiêu?",
        {
            "sql": "SELECT sum(gia_tri_giao_dich_vnd) AS doanh_thu_vnd FROM sales_clean "
            "WHERE ten_du_an = 'Ecopark' AND trang_thai = 'Ký HĐ'",
            "explanation": "Doanh thu = tổng giá trị giao dịch của các giao dịch đã Ký HĐ thuộc dự án Ecopark.",
            "chart": None,
            "clarification": None,
        },
    ),
    (
        "Vẽ biểu đồ số lead mới theo từng tháng",
        {
            "sql": "SELECT to_char(ngay_tao_lead, 'YYYY-MM') AS thang, count(*) AS so_lead "
            "FROM sales_clean GROUP BY 1 ORDER BY 1",
            "explanation": "Đếm lead theo tháng tạo lead, sắp xếp theo thời gian.",
            "chart": {
                "type": "line",
                "x": "thang",
                "y": ["so_lead"],
                "title": "Số lead theo tháng",
            },
            "clarification": None,
        },
    ),
    (
        "Nhân viên nào ký được nhiều hợp đồng nhất ở team S3?",
        {
            "sql": "SELECT ten_nv, count(*) AS so_hop_dong FROM sales_clean "
            "WHERE team = 'S3' AND trang_thai = 'Ký HĐ' GROUP BY ma_nv, ten_nv "
            "ORDER BY so_hop_dong DESC LIMIT 1",
            "explanation": "Đếm số giao dịch Ký HĐ của từng nhân viên trong team S3 và lấy người cao nhất.",
            "chart": None,
            "clarification": None,
        },
    ),
    (
        "Tỷ lệ chốt của khách có nhu cầu Đầu tư?",
        {
            "sql": "SELECT round(100.0 * count(*) FILTER (WHERE trang_thai = 'Ký HĐ') / count(*), 2) "
            "AS ty_le_chot_phan_tram FROM sales_clean WHERE nhu_cau = 'Đầu tư'",
            "explanation": "Tỷ lệ chốt = số lead Ký HĐ / tổng số lead (mọi trạng thái) trong nhóm nhu cầu Đầu tư.",
            "chart": None,
            "clarification": None,
        },
    ),
    (
        "Cho tôi email của khách hàng",
        {
            "sql": None,
            "explanation": "Dữ liệu cá nhân của khách hàng (họ tên, SĐT, email) không có trong hệ thống này "
            "nên tôi không thể cung cấp. Bạn có thể hỏi các thống kê tổng hợp.",
            "chart": None,
            "clarification": None,
        },
    ),
]


def _schema_text() -> str:
    return "\n".join(f"- {c['name']} ({c['type']}): {c['description']}" for c in COLUMNS)


def _categories_text() -> str:
    return "\n".join(f"- {k}: {' | '.join(v)}" for k, v in CATEGORIES.items())


def build_system_prompt(reference_date: date) -> str:
    """System prompt 5 phần: vai trò, schema, giá trị phân loại + định nghĩa, ngày, ví dụ."""
    d30 = reference_date - timedelta(days=30)
    fewshot = "\n\n".join(
        f"Câu hỏi: {q}\nJSON: {json.dumps(a, ensure_ascii=False)}" for q, a in FEWSHOT
    )
    return f"""Bạn là trợ lý chuyển câu hỏi tiếng Việt thành SQL PostgreSQL cho dữ liệu bán bất động sản.

## 1. Vai trò và quy tắc
- Chỉ sinh MỘT câu SELECT (có thể dùng WITH) trên duy nhất view `sales_clean`. Không dùng bảng/schema khác.
- Không viết comment trong SQL. Không dùng CURRENT_DATE/NOW(); dùng ngày literal, ví dụ DATE '{reference_date}'.
- Chỉ dùng các hàm: count, sum, avg, min, max, round, coalesce, nullif, date_trunc, to_char, extract, lower, upper, percentile_cont, row_number, rank, cast, greatest, least.
- Từ chối (sql = null, giải thích lịch sự bằng tiếng Việt) khi câu hỏi: ngoài phạm vi dữ liệu bán hàng này; đòi thông tin cá nhân khách hàng hoặc nhân viên (họ tên, số điện thoại, email, ghi chú); yêu cầu thêm/sửa/xóa dữ liệu hay thao tác hệ thống.
- Nếu câu hỏi quá mơ hồ để chọn đúng chỉ tiêu, đặt sql = null và đưa một câu hỏi làm rõ vào "clarification".
- Chỉ trả về MỘT đối tượng JSON, không thêm chữ nào khác, theo dạng:
  {{"sql": string|null, "explanation": string, "chart": {{"type": "bar|hbar|line|pie|doughnut|scatter|grouped_bar", "x": tên_cột, "y": [tên_cột_số], "title": string}}|null, "clarification": string|null}}
- "explanation" ngắn gọn bằng tiếng Việt, nêu rõ định nghĩa chỉ tiêu đã dùng (ví dụ doanh thu, tỷ lệ chốt).
- Chỉ đặt "chart" khác null khi người dùng yêu cầu biểu đồ; "x" và "y" phải là tên cột có trong kết quả SELECT (dùng alias).
- Đặt alias tiếng Việt không dấu, dạng snake_case, cho cột tính toán.

## 2. Schema view sales_clean (mỗi dòng là một lead/giao dịch, tổng 1793 dòng)
{_schema_text()}
Tiền tệ là VND (1 tỷ = 1000000000, 1 triệu = 1000000). Xếp thứ tự giai đoạn: Mới < Đang tư vấn < Hẹn xem < Đã xem < Đàm phán < Đặt cọc < Ký HĐ; Thất bại là nhánh riêng.

## 3. Giá trị phân loại và định nghĩa nghiệp vụ
{_categories_text()}
Ghi chú:
- `ten_nv` có 80 giá trị: dùng ILIKE '%tên%' khi người dùng nhắc tên người; không có danh sách ở đây.
- `loai_bds_du_an` là chuỗi nhiều giá trị ngăn bằng ';': dùng ILIKE '%Căn hộ%'. Để hỏi loại sản phẩm khách quan tâm, dùng `loai_san_pham`.
- `khu_vuc` có giá trị gộp (vd 'Văn Giang / Văn Lâm', 'An Thới, Phú Quốc'): dùng ILIKE. Phú Quốc thuộc tinh_tp = 'An Giang': khi hỏi "Phú Quốc" lọc `khu_vuc ILIKE '%Phú Quốc%'`.
- Doanh thu = SUM(gia_tri_giao_dich_vnd) chỉ cho trang_thai = 'Ký HĐ' (cột này chỉ có giá trị ở các giao dịch đã ký). Tiền cọc (tien_coc_vnd) là chỉ tiêu riêng, KHÔNG phải doanh thu.
- Hoa hồng: SUM(hoa_hong_du_kien_vnd), chỉ có ở giao dịch Ký HĐ.
- Tỷ lệ chốt = số dòng trang_thai = 'Ký HĐ' / tổng số lead trong nhóm (mẫu số gồm mọi trạng thái, kể cả Thất bại), trả theo phần trăm.
- "Đã đặt cọc" hiểu là trang_thai = 'Đặt cọc' trừ khi người dùng nói rõ gồm cả đã ký. "Lead" và "giao dịch" đều là một dòng.
- Số ngày giữa hai ngày: trừ trực tiếp hai cột date (ngay_ky_hd - ngay_tao_lead).
- Mốc thời gian tương đối: hôm nay là {reference_date}. "30 ngày qua" nghĩa là ngay_tao_lead >= DATE '{d30}' AND ngay_tao_lead <= DATE '{reference_date}'.
- Khi hỏi "top N" hoặc "cao nhất", dùng ORDER BY ... DESC LIMIT N.

## 4. Ví dụ
{fewshot}
"""


def build_messages(
    system_prompt: str, question: str, history: list[HistoryItem]
) -> list[dict[str, str]]:
    """Message cho LLM: system + tối đa 3 lượt trước (câu hỏi và SQL) + câu hỏi hiện tại."""
    msgs: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for h in history[-3:]:
        msgs.append({"role": "user", "content": h.question})
        reply = {"sql": h.sql, "clarification": h.clarification}
        msgs.append({"role": "assistant", "content": json.dumps(reply, ensure_ascii=False)})
    msgs.append({"role": "user", "content": question})
    return msgs
