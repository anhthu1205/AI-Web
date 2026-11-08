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
