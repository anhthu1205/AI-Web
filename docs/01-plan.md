# Phương án đồ án: Web Text-to-SQL bất động sản (Agent 1)

## 1. Kiến trúc và tech stack
- **Backend:** FastAPI + Uvicorn (Python 3.12), Pydantic v2, `sqlglot` (kiểm tra SQL), `psycopg[binary,pool]` v3, `groq` SDK, `slowapi` (rate limit).
- **Frontend:** HTML/CSS/JS thuần (ES modules) + Chart.js 4 trong `frontend/`, chỉ gọi backend qua `fetch('/api/...')`; `API_BASE` đặt trong `config.js`. Khi deploy FastAPI mount `frontend/` bằng `StaticFiles` (1 service).
- **Lý do không chọn Streamlit:** trộn FE/BE, không đạt yêu cầu tách bạch. Không chọn React: thừa toolchain Node cho một trang.
- **DB:** `psycopg_pool.AsyncConnectionPool` dùng role `app_readonly` qua **Supabase Session Pooler** (5432, user `app_readonly.kxebriimlhwenbzfkekd`) vì direct connection chỉ IPv6.
- Mỗi truy vấn: transaction `READ ONLY` + `SET LOCAL statement_timeout='5s'`.

```
AI-Web/
├─ backend/app/{main.py,config.py,api/{routes.py,schemas.py},services/{llm,prompt,sql_guard,executor,chart_rules,chart_intent}.py,db/pool.py}
├─ backend/tests/{unit/,eval/{questions.yaml,run_eval.py}}
├─ backend/{requirements.txt,requirements-dev.txt,pyproject.toml}
├─ frontend/{index.html,css/,js/{api,chart,table,main}.js,vendor/chart.umd.min.js}
├─ db/migrations/{001_clean_view.sql,002_readonly_role.sql,999_rollback.sql,verify.sql}
├─ docs/  Dockerfile  .dockerignore  .env.example  .gitignore  README.md
```

## 2. Chuẩn hóa dữ liệu
- Không ALTER `public.sales`. Tạo schema `analytics` (không lộ qua PostgREST) chứa VIEW phẳng `analytics.sales_clean` + bảng `analytics.pipeline_status_map`. Rollback: `DROP SCHEMA analytics CASCADE`.
- Một view phẳng (không tách dimension) để LLM không phải JOIN.
- **Bỏ khỏi view:** `ho_ten_khach_hang, sdt_khach_hang, email_khach_hang, nhan_vien__mail, ghi_chu_cham_soc, llbh__ghi_chu` và các cột trùng (`nhan_vien__team, nhan_vien__ten_nv, du_an__ten_du_an`) — chỉ bỏ sau khi `verify.sql` xác nhận trùng giá trị.
- **Đổi tên:** `du_an__khu_vuc→khu_vuc, du_an__tinh_tp→tinh_tp, du_an__chu_dau_tu_don_vi_phat_trien→chu_dau_tu, du_an__loai_hinh_du_an→loai_hinh_du_an, du_an__loai_bds→loai_bds_du_an`.
- **Thêm:** `trang_thai`, `trang_thai_goc`, `thu_tu_pipeline smallint`, `da_ky_hd boolean`.
- **Ép kiểu** (bọc regex để lỗi 1 dòng không hỏng view): tiền → `bigint`; `dien_tich_m2` → `numeric(10,2)` (đổi `,`→`.`); `ngay_*` → `date`; `cap_nhat_luc` → `timestamp`; `xac_suat_chot` → `smallint`.

| thu_tu | trang_thai chuẩn | Giá trị gốc |
|---|---|---|
| 1 | Mới | Lead mới, Mới |
| 2 | Đang tư vấn | Đã liên hệ, Đang tư vấn |
| 3 | Hẹn xem | Hẹn xem, Hẹn tham quan |
| 4 | Đã xem | Đã xem, Đã tham quan |
| 5 | Đàm phán | Đàm phán, Đang thương lượng |
| 6 | Đặt cọc | Đặt cọc |
| 7 | Ký HĐ | Ký HĐ, Đã ký hợp đồng |
| 8 | Thất bại | Không nhu cầu, Không phù hợp, Mất liên lạc |

- LEFT JOIN bảng mapping; `trang_thai IS NULL` bị `verify.sql` bắt.
- **verify.sql:** count view = count raw = 1800; distinct PK = 1800; non-null mỗi cột raw = view; 0 trạng thái chưa map; cột trùng thật sự bằng nhau; min/max ngày & diện tích hợp lý.
- Áp migration bằng Supabase MCP `apply_migration` đồng thời lưu file trong `db/migrations/`.

## 3. Pipeline Text-to-SQL
- Model `llama-3.3-70b-versatile` (env `GROQ_MODEL`), fallback `llama-3.1-8b-instant` khi 429; `temperature=0`, `response_format=json_object`. Agent 3 phải xác nhận tên model còn hiệu lực.
- Luồng: kiểm tra độ dài (≤300 ký tự) + `chart_requested` → build prompt → LLM → `sql_guard` → execute → chart → response. Lỗi ở guard/execute: retry đúng 1 lần kèm thông báo lỗi.
- **System prompt 5 phần:** (1) vai trò & quy tắc (1 câu SELECT trên `sales_clean`, từ chối ngoài phạm vi/PII/sửa xóa); (2) schema + mô tả tiếng Việt + đơn vị; (3) giá trị phân loại đầy đủ + ghi chú (`loai_bds_du_an` dùng `ILIKE`, `gia_tri_giao_dich_vnd` chỉ có nghĩa khi `Ký HĐ`, tỷ=1e9, triệu=1e6); (4) "Hôm nay là {REFERENCE_DATE}", dùng ngày literal không dùng `CURRENT_DATE`; (5) 6 few-shot tách khỏi bộ eval.
- **JSON:** `{"sql":str|null,"explanation":str,"chart":{"type","x","y":[],"title"}|null,"clarification":str|null}`.
- **Chart intent:** regex không dấu `ve|bieu do|do thi|chart|plot|truc quan|dang cot|dang tron|dang duong`; nếu false server ép `chart=null`.
- **Hội thoại:** server stateless; client gửi ≤3 lượt gần nhất `history:[{question,sql,clarification?}]`.

## 4. An toàn
1. Role `app_readonly`: chỉ USAGE schema `analytics` + SELECT `sales_clean`; REVOKE ALL trên `public`; `statement_timeout=5s`, `default_transaction_read_only=on`, `search_path=analytics`, `CONNECTION LIMIT 10`.
2. `sql_guard` (sqlglot, postgres): đúng 1 statement; root là Select/With/Union toàn Select; cấm Insert/Update/Delete/Create/Drop/Alter/Command/Copy/Set/Into/FOR UPDATE; whitelist bảng `sales_clean`; whitelist hàm, cấm `pg_*, set_config, current_setting, dblink, lo_*, generate_series`; cấm comment.
3. LIMIT tự động (mặc định/clamp 500), `fetchmany(501)` đặt cờ `truncated`.
4. PII không có trong view → LLM không thấy; prompt từ chối + test riêng.
5. `slowapi` 10 req/phút/IP; giới hạn kích thước body.
6. Log có request id/SQL/thời gian/mã lỗi; filter che `gsk_...` và `postgresql://...:pwd@`.
7. Kết quả truy vấn không bao giờ đưa lại vào LLM.
8. Frontend dùng `textContent`; CORS theo env.

## 5. Biểu đồ
Chart.js 4 (vendor). Loại: bar, hbar, line, pie/doughnut, scatter, grouped bar.

| Cấu trúc kết quả | Chart |
|---|---|
| cột thời gian + ≥1 số | line |
| 1 phân loại + 1 số, ≤8 dòng, hỏi "tròn/cơ cấu/tỷ lệ" | pie |
| 1 phân loại + 1 số, nhãn dài hoặc >8 dòng | hbar |
| 1 phân loại + 1 số, còn lại | bar |
| 2 phân loại + 1 số | grouped bar |
| 2 số | scatter |
| còn lại | null + "không phù hợp để vẽ" |

Gợi ý LLM chỉ giữ nếu `x`/`y` tồn tại và `y` là số; tối đa 30 nhóm; pie không nhận giá trị âm; số định dạng `vi-VN`.

## 6. API
- `POST /api/query` — req `{question, history[]}`; res `{sql, explanation, columns[{name,type}], rows[][], row_count, truncated, chart_requested, chart, clarification, elapsed_ms}`.
- Lỗi `{"error":{"code","message"}}`: `INVALID_INPUT`(422), `OUT_OF_SCOPE`(200), `SQL_REJECTED`(400), `DB_TIMEOUT`(504), `RATE_LIMITED`(429), `LLM_UNAVAILABLE`(503).
- `GET /api/schema`, `GET /api/examples`, `GET /health` (`SELECT 1`).

## 7. Testing
- pytest: `sql_guard` (DROP, nhiều câu, `pg_sleep`, bảng ngoài whitelist, comment, SELECT INTO, CTE chứa DML), LIMIT clamp, `chart_intent` (có/không dấu), `chart_rules`, mapping trạng thái, LLM mock cho `/api/query`.
- Eval: `run_eval.py` chấm **execution accuracy** (so tập kết quả), mục tiêu ≥85% trên 20 câu + 2 câu từ chối (xóa bảng; xin SĐT khách). Bộ câu: đếm giao dịch; tổng giá trị đã ký; lead theo nguồn (+chart cột); giao dịch theo trạng thái; diện tích TB căn hộ; top 5 NV; doanh thu ký HĐ theo tháng (line); tỷ lệ chốt theo nguồn; hoa hồng theo team; lead 30 ngày qua; dự án TP.HCM nhiều giao dịch nhất; giá chào TB theo loại (cột); cơ cấu loại SP đã cọc (tròn); khách ngân sách >5 tỷ; xác suất >70% chưa ký; tiền cọc theo tỉnh; số ngày TB tạo lead→ký; Biệt thự/Liền kề ở Hà Nội; chủ đầu tư có tổng GTGD cao nhất.
- ruff + black + pre-commit + GitHub Actions (lint + unit, không gọi Groq).

## 8. Deploy
Render (Docker, free; cold start khi demo). Dự phòng HF Spaces. Dockerfile `python:3.12-slim`, user non-root, `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
`.env.example`: `GROQ_API_KEY, GROQ_MODEL, GROQ_FALLBACK_MODEL, DATABASE_URL, REFERENCE_DATE=2026-11-08, ALLOWED_ORIGINS, MAX_ROWS=500, STATEMENT_TIMEOUT_MS=5000, RATE_LIMIT=10/minute`.
Bí mật: `.env` trong `.gitignore`; secret qua dashboard; không dùng `service_role`/mật khẩu `postgres`; mật khẩu `app_readonly` do user đặt thủ công (migration dùng placeholder).

## 9. Rủi ro & câu hỏi mở
Rủi ro: LLM hiểu sai nghiệp vụ ("doanh thu"); rate limit Groq free; cold start Render; dữ liệu bất nhất (có ngày ký nhưng trạng thái chưa Ký HĐ).
Câu hỏi cho user: (1) GROQ_API_KEY qua env; (2) cho phép tạo role `app_readonly` + schema `analytics` trên project `kxebriimlhwenbzfkekd` và tự đặt mật khẩu; (3) xác nhận ngày 2026 hợp lệ, hôm nay 2026-11-08; (4) "doanh thu"/"tỷ lệ chốt" chỉ tính `Ký HĐ` hay gồm `Đặt cọc`; (5) cho phép gom trạng thái như bảng mapping; (6) chấp nhận ẩn PII + 2 cột ghi chú; (7) nơi deploy (mặc định Render).

## 10. Milestone
| M | Nội dung | Nghiệm thu |
|---|---|---|
| M1 | Khung repo, FastAPI, `/health`, config, lint/CI, `.env.example`, `.gitignore` | uvicorn chạy; ruff/black/pytest xanh; không key trong repo |
| M2 | Migration: schema `analytics`, mapping, `sales_clean`, role `app_readonly`, `verify.sql`, `999_rollback.sql` | view=1800 dòng; không cast lỗi; 0 trạng thái chưa map; role chỉ SELECT `sales_clean`, INSERT/SELECT `public.sales` bị từ chối |
| M3 | `sql_guard` + `executor` + unit test | mọi test chặn pass; LIMIT & timeout hoạt động |
| M4 | `prompt`+`llm`+`chart_intent`+endpoints | Groq thật trả JSON đúng schema; retry 1 lần; eval ≥85%; 2 câu từ chối đúng |
| M5 | Frontend: nhập, bảng, SQL/giải thích, Chart.js, lịch sử, lỗi/loading | demo 5 câu E2E; chart chỉ hiện khi yêu cầu; không XSS |
| M6 | Dockerfile, deploy Render, rate limit, README | URL công khai chạy; 429 hoạt động; README có hướng dẫn + sơ đồ |
