# Báo cáo Dev (Agent 3)

Nhánh `claude/bold-meitner-kla168`. Không tạo PR. Không có bí mật trong repo (`git grep` chỉ khớp chuỗi mẫu trong test che log).

## 1. Đã làm theo milestone

| M | Nội dung | Commit |
|---|---|---|
| M1 | Khung repo, FastAPI, `config.py` (pydantic-settings), `.env.example`, `.gitignore`, ruff + pytest, CI tối giản | M1 |
| M2 | Migration 001 (schema, hàm parse, mapping, view), 002 (role), `verify.sql`, `999_rollback.sql`; ÁP THẬT lên Supabase `kxebriimlhwenbzfkekd` | M2 |
| M3 | `sql_guard` (sqlglot), `executor` READ ONLY + timeout, pool, 49+ unit test chặn SQL | M3 |
| M4 | prompt 5 phần, `llm` (Groq JSON mode, fallback model qua env, parse `{...}` + Pydantic), `chart_intent`, `chart_rules`, endpoints, retry đúng 1 lần, rate limit, log che bí mật, demo mode, bộ eval + `run_eval.py` | M4 |
| M5 | Frontend thuần + Chart.js 4.4.4 vendor, `frontend/e2e/smoke.js`, ảnh chụp | M5 |
| M6 | Dockerfile, `.dockerignore`, `render.yaml`, README | M6 |

Migration áp bằng `apply_migration` với đúng nội dung các file trong `db/migrations/`. Không đụng `public.sales`. Role tạo KHÔNG mật khẩu.

## 2. Kết quả verify thật trên DB (chạy qua Supabase MCP)

`verify.sql`: 16/16 phép kiểm `ok = true`:
view = raw = 1800; `ma_giao_dich` distinct 1800; `trang_thai` NULL = 0; `da_ky_hd` = 93; SUM `gia_tri_giao_dich_vnd` = 1556003395101; SUM `hoa_hong_du_kien_vnd` = 24504229256; `dien_tich_m2` 38.40..349.80; cột trùng (team, ten_nv, ten_du_an) khác nhau = 0; dòng raw có giá trị mà view NULL (13 cột ngày/tiền/số) = 0; `ngay_hen_xem` 716, `ngay_dat_coc` 228, `ngay_ky_hd` 93 không NULL; `ngay_tao_lead` 2026-01-01..2026-10-17; vi phạm thứ tự ngày = 0.

Parse 3 định dạng ngày, kiểm tra mẫu thật: serial `46118` -> `2026-04-06`; `2026-10-26 00:00:00` -> `2026-10-26`; `27/01/2026` -> `2026-01-27`; `cap_nhat_luc` `10/04/2026 9:22:00` (giờ 1 chữ số) -> `2026-04-10 09:22:00`; dạng ISO giữ nguyên. Ngày sau 2026-11-08: 2 hợp đồng (tối đa 2026-12-01), 6 đặt cọc (tối đa 2026-12-08): giữ nguyên, chỉ ghi chú (prompt, README).

Quyền role `app_readonly` (kiểm bằng `has_table_privilege`/`has_schema_privilege`): SELECT `sales_clean` = true; INSERT/UPDATE/DELETE trên view = false; SELECT/INSERT/UPDATE/DELETE/TRUNCATE `public.sales` = false; SELECT `pipeline_status_map` = false; CREATE trong `analytics` và `public` = false; `anon`/`authenticated` không có USAGE schema `analytics`. Cấu hình role: `statement_timeout=5s`, `default_transaction_read_only=on`, `search_path=analytics`, giới hạn 10 kết nối.
Chưa kiểm được: từ chối thực tế khi kết nối bằng chính role (không thể `SET ROLE` từ phiên MCP, và chưa có mật khẩu). Việc này nằm trong `backend/tests/integration/test_db.py` (tự skip khi không có `DATABASE_URL`).

### Advisor bảo mật và `public.sales` (CHỜ USER QUYẾT)

- `get_advisors(security)`: chỉ 1 cảnh báo mức INFO `rls_enabled_no_policy` trên `public.sales` (RLS bật, chưa có policy). Không có cảnh báo nào do schema `analytics` (không expose qua PostgREST; `anon`/`authenticated`/PUBLIC không có grant nào trên `analytics`).
- `pg_policies` cho `public.sales`: không có policy nào. Vì RLS bật và không có policy, `anon`/`authenticated` qua PostgREST đọc ra 0 dòng: PII hiện KHÔNG đọc được qua API công khai (key `service_role` vẫn bypass RLS, đó là hành vi mặc định).
- Rủi ro tồn đọng: `anon` và `authenticated` có grant mức bảng rất rộng trên `public.sales` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER). Hiện được RLS chặn, nhưng nếu ai đó tắt RLS hoặc thêm policy rộng thì PII lộ ngay (TRUNCATE còn không chịu RLS, dù PostgREST không cung cấp thao tác này). Khuyến nghị cho user: `REVOKE ALL ON public.sales FROM anon, authenticated;`. Tôi KHÔNG tự đổi.

## 3. Model Groq (không có key, không gọi API)

`console.groq.com` và `ai-sdk.dev` không truy cập được từ môi trường này (chặn mạng). Chỉ có kết quả WebSearch từ tài liệu bên thứ ba: `llama-3.3-70b-versatile` và `llama-3.1-8b-instant` có trong danh sách model Groq; chế độ `json_object` dùng được và yêu cầu có chữ "JSON" trong prompt (prompt đã có); structured outputs nghiêm ngặt (json_schema) chỉ có ở model mới, nên không dùng. Độ chắc chắn: TRUNG BÌNH, chưa xác minh từ nguồn chính thức. Vì vậy: model để trong env (`GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, mặc định theo trên); code vẫn parse khối `{...}` + Pydantic nếu model không tuân thủ JSON mode. Việc user/dev cần làm khi có key: `GET https://api.groq.com/openai/v1/models` để xác nhận tên model và xem giới hạn RPM/TPM/RPD của gói miễn phí (không hardcode).

## 4. Test, lint, eval

- `ruff check` + `ruff format --check`: sạch. `pytest`: 118 passed (không cần key/DB, LLM/DB được mock). `tests/integration` (5 test): skip vì chưa có `DATABASE_URL`.
- Bộ eval `backend/tests/eval/questions.yaml`: 20 câu + 2 câu từ chối (xóa bảng; xin SĐT khách), câu ngân sách dùng ngưỡng 30 tỷ, "30 ngày qua" tính từ 2026-11-08 (>= 2026-10-09). Đã chạy SQL chuẩn của cả 20 câu (sau khi qua `sql_guard`, đúng dạng SQL sẽ chạy) trên `sales_clean` qua MCP: đều chạy được, không rỗng, không suy biến. Ví dụ: q01 = 1800; q02 = 1556003395101; q10 = 65; q14 = 386; q15 = 135; q17 = 39,39 ngày; q18 = 109; q19 = Vinhomes 773.245.751.709; q20 = 7. Few-shot (6) tách khỏi bộ eval (có test).
- **Eval với Groq thật CHƯA CHẠY (chờ user cấp key)**: `python -m tests.eval.run_eval` (cần `GROQ_API_KEY` + `DATABASE_URL`). Độ chính xác chưa có số liệu; mục tiêu 85% chưa được kiểm chứng.
- Smoke test backend (uvicorn, bố cục thư mục giống Docker): `/health` -> `{"status":"ok","db":"unavailable"}` khi chưa có `DATABASE_URL` (không crash); `/api/schema`, `/api/examples` 200; frontend và `vendor/chart.umd.min.js` được phục vụ; `/api/query` không có key -> 503 `LLM_UNAVAILABLE` rõ ràng.
- Playwright `frontend/e2e/smoke.js` (backend `DEMO_MODE=true`): 12/12 PASS: chart chỉ hiện khi yêu cầu, bảng, SQL, bar/line/pie, câu ngoài phạm vi, dữ liệu chứa `<img onerror>`/`<script>` hiển thị như chữ và không chạy, mobile 390px không cuộn ngang. Ảnh: `docs/screenshots/desktop-bar.png`, `desktop-multi.png`, `mobile-pie.png`. Giao diện đã tự xem, không thấy lỗi bố cục.
- Chart.js: tải qua CDN bị chặn; lấy bản 4.4.4 từ npm registry (`npm pack chart.js@4.4.4`, tệp `dist/chart.umd.js` đã minify, đặt tên `chart.umd.min.js`, kèm LICENSE).

## 5. Đối chiếu tiêu chí nghiệm thu

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| M1 uvicorn, /health, lint/test xanh, không bí mật | Đạt | smoke + ruff/pytest + `git grep` |
| M2 view=1800, không cast lỗi, 0 chưa map, quyền role | Đạt (trừ thử kết nối thật bằng role) | mục 2 |
| M3 test chặn pass; LIMIT; timeout | Một phần | 49+ test guard pass, LIMIT có test; timeout thật (`pg_sleep`) và `SELECT count(*)` bằng role qua pooler: test viết sẵn, chờ mật khẩu |
| M4 Groq thật trả JSON, retry 1 lần, eval >= 85%, 2 câu từ chối | Một phần | retry/parse/từ chối đã test bằng mock; Groq thật + eval chưa chạy |
| M5 demo E2E, chart khi yêu cầu, không XSS | Đạt với backend mock | smoke 12/12; chưa E2E với Groq + DB thật |
| M6 Docker, Render, 429, README | Một phần | Dockerfile/render.yaml/README viết xong; 429 có test; `docker build` KHÔNG chạy được (không có daemon Docker trong môi trường); chưa deploy |

## 6. Còn chờ user / tồn đọng

1. Đặt mật khẩu `app_readonly` (SQL trong README), lấy `DATABASE_URL` Session Pooler, rồi chạy `pytest tests/integration` (kiểm từ chối `public.sales`, INSERT, timeout).
2. Cấp `GROQ_API_KEY`; chạy `python -m tests.eval.run_eval`; xác nhận tên model (mục 3). Nếu eval < 85%, phân tích lỗi trước khi chỉnh prompt.
3. Quyết định về grant của `anon`/`authenticated` trên `public.sales` (mục 2).
4. Tạo dịch vụ Render, đặt secret, kiểm tra cold start; CI GitHub Actions chưa từng chạy trên GitHub.
5. Dữ liệu bất thường: 2 hợp đồng và 6 đặt cọc có ngày sau 2026-11-08 (giữ nguyên).
6. Chưa làm theo handoff: lưu `history` đã có (3 lượt) nhưng chưa test với LLM thật; HF Spaces chỉ nêu trong README.
7. Giả định: `ten_nv` truy vấn bằng ILIKE vì không liệt kê 80 tên trong prompt; `CURRENT_DATE`/`NOW()` bị guard chặn có chủ ý (bắt buộc dùng ngày literal).
