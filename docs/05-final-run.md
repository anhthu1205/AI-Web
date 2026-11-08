# Lần chạy thật cuối (Groq + Supabase)

Ngày chạy: 2026-11-08. Mô hình: `openai/gpt-oss-120b` (dự phòng `openai/gpt-oss-20b`).

## Phát hiện và sửa
- `llama-3.3-70b-versatile` và `llama-3.1-8b-instant` **không còn** trong `GET /openai/v1/models` của Groq → mặc định cũ sẽ lỗi khi chạy thật. Đã đổi mặc định sang `openai/gpt-oss-120b` / `openai/gpt-oss-20b` (cả hai trả JSON đúng với `response_format=json_object`) trong `config.py`, `.env.example`, `render.yaml`.
- `tests/unit/test_api.py` phụ thuộc việc máy không có `.env` → cô lập bằng monkeypatch.
- Đã `REVOKE ALL ON public.sales FROM anon, authenticated` (không ảnh hưởng app; app chỉ dùng role `app_readonly`).
- Đã đặt mật khẩu cho `app_readonly` (không lưu trong repo).

## Kết quả eval
Pipeline thật (prompt → Groq → sql_guard) sinh SQL cho 20 câu + 2 câu từ chối; SQL sinh ra và SQL chuẩn cùng chạy trên `analytics.sales_clean` rồi so kết quả.
- Độ chính xác thực thi: **20/20** (so số dòng + giá trị, làm tròn đến đơn vị; chạy 1 lần, chưa lặp).
- Từ chối đúng: **2/2**.
- Giới hạn: executor thật (psycopg → pooler) không chạy được từ sandbox vì chặn cổng 5432, nên SQL được chạy qua Supabase MCP thay vì `run_eval.py`.

## Chưa kiểm chứng
- Kết nối `app_readonly` thật qua Session Pooler (host chưa phân giải được từ sandbox).
- `docker build`, deploy Render, CI GitHub.

## Xử lý ngày sau 2026-11-08 (lỗi nhập liệu — user xác nhận)
- Có 7 dòng (6 dòng có `ngay_dat_coc` và 2 dòng có `ngay_ky_hd` sau 2026-11-08; `GD-C9-26-0020` thuộc cả hai nhóm): `GD-C2-26-0030, GD-C3-26-0003, GD-C5-26-0070, GD-C7-26-0070, GD-C8-26-0002, GD-C8-26-0048, GD-C9-26-0020`.
- Migration `db/migrations/003_exclude_future_dated_rows.sql` loại 7 dòng này khỏi `analytics.sales_clean`. `public.sales` giữ nguyên (1800 dòng), hoàn tác bằng cách chạy lại câu `CREATE OR REPLACE VIEW` trong 001.
- Số liệu mới của view: 1793 dòng; 91 hợp đồng; tổng giá trị ký HĐ 1.530.903.395.101 (giảm 25,1 tỷ so với trước); hoa hồng dự kiến 24.071.929.256; 221 ngày đặt cọc; 91 ngày ký.
- Đã kiểm trên DB thật: không còn ngày cọc/ký sau 2026-11-08; không cột nào bị NULL khi ép kiểu; thứ tự ngày 0 vi phạm; cột trùng 0 khác biệt; `app_readonly` vẫn chỉ SELECT được view (không INSERT, không đọc `public.sales`).
- Cập nhật theo: `verify.sql`, mô tả trong prompt (1793 dòng), test tích hợp, dữ liệu demo.
- Lưu ý: nhóm `ngay_hen_xem` ở tương lai được giữ vì lịch hẹn xem là ngày tương lai hợp lệ.
