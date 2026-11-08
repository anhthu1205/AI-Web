"""Mô tả schema view analytics.sales_clean dùng cho prompt và /api/schema.

Phải khớp với db/migrations/001_clean_view.sql (có test đối chiếu tên cột).
"""

from typing import TypedDict


class Column(TypedDict):
    name: str
    type: str
    description: str


COLUMNS: list[Column] = [
    {"name": "ma_giao_dich", "type": "text", "description": "Mã giao dịch (khóa chính)"},
    {"name": "ma_khach_hang", "type": "text", "description": "Mã khách hàng (mỗi khách một dòng)"},
    {"name": "nguon_lead", "type": "text", "description": "Nguồn lead (kênh marketing)"},
    {"name": "ngay_tao_lead", "type": "date", "description": "Ngày tạo lead"},
    {"name": "ngay_lien_he_cuoi", "type": "date", "description": "Ngày liên hệ khách gần nhất"},
    {"name": "team", "type": "text", "description": "Team bán hàng C1..C10, S1..S10"},
    {"name": "ma_llbh", "type": "text", "description": "Mã loại liên hệ bán hàng: STDA hoặc CHS"},
    {"name": "ma_nv", "type": "text", "description": "Mã nhân viên kinh doanh (80 người)"},
    {"name": "ten_nv", "type": "text", "description": "Tên nhân viên kinh doanh"},
    {"name": "ma_du_an", "type": "text", "description": "Mã dự án (DA001..DA012)"},
    {"name": "ten_du_an", "type": "text", "description": "Tên dự án"},
    {"name": "khu_vuc", "type": "text", "description": "Khu vực của dự án (dùng ILIKE)"},
    {"name": "tinh_tp", "type": "text", "description": "Tỉnh/thành của dự án"},
    {"name": "chu_dau_tu", "type": "text", "description": "Chủ đầu tư / đơn vị phát triển"},
    {"name": "loai_hinh_du_an", "type": "text", "description": "Loại hình dự án"},
    {"name": "loai_bds_du_an", "type": "text", "description": "Các loại BĐS của dự án, ngăn bằng ';'"},
    {"name": "ma_san_pham_bds", "type": "text", "description": "Mã sản phẩm BĐS (có thể lặp)"},
    {"name": "loai_san_pham", "type": "text", "description": "Loại sản phẩm BĐS khách quan tâm"},
    {"name": "dien_tich_m2", "type": "numeric", "description": "Diện tích (m2)"},
    {"name": "gia_chao_vnd", "type": "bigint", "description": "Giá chào bán (VND)"},
    {"name": "ngan_sach_kh_vnd", "type": "bigint", "description": "Ngân sách khách hàng (VND)"},
    {"name": "nhu_cau", "type": "text", "description": "Nhu cầu của khách"},
    {"name": "trang_thai", "type": "text", "description": "Trạng thái pipeline đã gom (8 nhóm)"},
    {"name": "trang_thai_goc", "type": "text", "description": "Trạng thái gốc trước khi gom"},
    {"name": "thu_tu_pipeline", "type": "smallint", "description": "Thứ tự giai đoạn 1..8"},
    {"name": "da_ky_hd", "type": "boolean", "description": "true nếu trang_thai = 'Ký HĐ'"},
    {"name": "xac_suat_chot", "type": "smallint", "description": "Xác suất chốt (%), cố định theo giai đoạn"},
    {"name": "ngay_hen_xem", "type": "date", "description": "Ngày hẹn xem nhà (có thể ở tương lai)"},
    {"name": "ngay_dat_coc", "type": "date", "description": "Ngày đặt cọc"},
    {"name": "tien_coc_vnd", "type": "bigint", "description": "Tiền đặt cọc (VND), không phải doanh thu"},
    {"name": "ngay_ky_hd", "type": "date", "description": "Ngày ký hợp đồng"},
    {"name": "gia_tri_giao_dich_vnd", "type": "bigint", "description": "Giá trị giao dịch (VND), chỉ có khi Ký HĐ"},
    {"name": "hoa_hong_du_kien_vnd", "type": "bigint", "description": "Hoa hồng dự kiến (VND), chỉ có khi Ký HĐ"},
    {"name": "cap_nhat_luc", "type": "timestamp", "description": "Thời điểm cập nhật bản ghi"},
]  # fmt: skip

CATEGORIES: dict[str, list[str]] = {
    "trang_thai": ["Mới", "Đang tư vấn", "Hẹn xem", "Đã xem", "Đàm phán", "Đặt cọc", "Ký HĐ", "Thất bại"],
    "nguon_lead": ["Data đối tác", "Facebook Ads", "Giới thiệu", "Google Ads", "Hotline", "Sự kiện mở bán", "TikTok", "Website", "Zalo OA"],
    "loai_san_pham": ["Biệt thự", "Căn hộ", "Duplex", "Liền kề", "Nhà phố", "Penthouse", "Shophouse"],
    "nhu_cau": ["Cho thuê", "Đầu tư", "Mua cho người thân", "Mua ở"],
    "ma_llbh": ["CHS", "STDA"],
    "team": [f"C{i}" for i in range(1, 11)] + [f"S{i}" for i in range(1, 11)],
    "tinh_tp": ["An Giang", "Đồng Nai", "Hà Nội", "Hưng Yên", "TP Hồ Chí Minh"],
    "khu_vuc": ["An Thới, Phú Quốc", "Biên Hòa", "Gia Lâm", "Nam Từ Liêm", "Tây Mỗ", "TP Thủ Đức", "Văn Giang", "Văn Giang / Văn Lâm"],
    "chu_dau_tu": ["CapitaLand Development", "Công ty CP Đầu tư Mai Linh / MIK Group phát triển", "Ecopark", "Masterise Homes", "Novaland", "Sun Group", "Vinhomes"],
    "loai_hinh_du_an": ["Căn hộ cao cấp", "Căn hộ nghỉ dưỡng / thương mại", "Chung cư cao cấp", "Khu đô thị hỗn hợp", "Khu đô thị sinh thái"],
    "ten_du_an": ["Aqua City", "Ecopark", "Lumi Hanoi", "Masteri Waterfront", "Sun Grand City Hillside Residence", "The Global City", "The Matrix One", "Vinhomes Grand Park", "Vinhomes Ocean Park", "Vinhomes Ocean Park 2", "Vinhomes Ocean Park 3", "Vinhomes Smart City"],
}  # fmt: skip

EXAMPLES: list[str] = [
    "Tổng doanh thu từ các hợp đồng đã ký là bao nhiêu?",
    "Số lead theo từng nguồn, vẽ biểu đồ cột",
    "Doanh thu theo tháng ký hợp đồng, vẽ biểu đồ đường",
    "Top 5 nhân viên có doanh thu cao nhất",
    "Cơ cấu loại sản phẩm đang ở trạng thái Đặt cọc, vẽ biểu đồ tròn",
    "Tỷ lệ chốt theo từng nguồn lead",
    "Chủ đầu tư nào có tổng giá trị giao dịch cao nhất?",
]
