# Duyệt cuối của CTO/BA (Agent 4)

Nhánh `claude/bold-meitner-kla168`. Reviewer độc lập: không tin báo cáo dev, tự chạy lại lệnh, tự đọc code, tự truy vấn DB (chỉ SELECT).

## 1. Kết luận: GO WITH CONDITIONS

Kiến trúc đúng đề (FE/BE tách, FastAPI + Supabase + Groq, SQL guard dựa trên AST, role DB chỉ đọc một view, không lộ PII). Dữ liệu trong DB đối chiếu khớp 100%. Tôi đã sửa trực tiếp 2 lỗi MAJOR (bypass whitelist bảng qua CTE "mồi"; từ "về" bật biểu đồ) và 1 lỗi MAJOR README (.env không được đọc), kèm test.

KHÔNG phải NO-GO vì không có BLOCKER nào về mã. Nhưng chưa được gọi là "xong" cho tới khi hoàn tất các điều kiện sau, vì phần lõi (Groq thật, DB thật qua role) CHƯA từng được chạy:

1. Đặt mật khẩu `app_readonly`, chạy `pytest tests/integration` (kiểm từ chối `public.sales`, INSERT, `pg_sleep` timeout).
2. Có `GROQ_API_KEY`, chạy `python -m tests.eval.run_eval`. Độ chính xác >= 85% là tiêu chí M4 và hiện chưa có số liệu.
3. Quyết định REVOKE cho `anon`/`authenticated` trên `public.sales` (mục 5).
4. Deploy Render thật và thử 429/cold start (mục 7).

## 2. Bảng truy vết (traceability)

Đạt = tôi tự kiểm chứng. Chưa = không kiểm chứng được trong môi trường này.

| Yêu cầu | Bằng chứng (tôi tự chạy/đọc) | Kết quả |
|---|---|---|
| Web text-to-SQL BĐS, khung nhập tiếng Việt | `frontend/index.html`, `js/main.js`; uvicorn phục vụ `/` 200 | Đạt |
| AI chuyển câu hỏi -> SQL | `services/prompt.py`, `llm.py`, `query_service.py` (mock test); Groq thật chưa gọi | Một phần (chưa chạy với Groq) |
| Truy vấn DB | `executor.py` READ ONLY + `SET LOCAL statement_timeout`; chưa chạy qua role thật (role chưa có mật khẩu) | Chưa kiểm chứng |
| Vẽ biểu đồ NẾU được yêu cầu | `chart_intent.py` + `chart_rules.py`; lỗi "về" đã sửa (F-02); 136 test xanh; smoke Playwright không chạy lại | Đạt sau sửa |
| Python | FastAPI/Python 3.12 (CI/Docker), tôi chạy 3.13 | Đạt |
| Database Supabase | project `kxebriimlhwenbzfkekd`, view/role tồn tại (truy vấn catalog) | Đạt |
| Groq API miễn phí | `GroqLlm`, fallback 8b khi 429; tên model chưa xác minh với nguồn chính thức | Chưa kiểm chứng |
| CSV đã sạch nhưng chưa chuẩn hóa kiểu | `public.sales` toàn `text`; view: date/bigint/numeric(10,2)/smallint/boolean/timestamp (information_schema) | Đạt |
| FE/BE rõ ràng, không ẩu | cây thư mục, `fetch('/api/*')`, `textContent` thuần | Đạt |
| M1 uvicorn, /health, lint, test, không bí mật | `ruff check` sạch, `ruff format --check` sạch, `pytest` 118 passed (trước sửa) / 136 (sau sửa); `/health` 200; quét bí mật sạch (mục 6) | Đạt |
| M2 view = 1800, không cast lỗi, 0 chưa map, quyền role | 1800 = 1800; 0 `trang_thai` NULL; 16 trạng thái gốc map đủ; `has_table_privilege` (mục 5). Từ chối thật bằng role: chưa | Đạt (trừ thử kết nối role) |
| M3 test chặn, LIMIT, timeout | 96 payload tự viết (mục 4); LIMIT luôn <= 501; timeout thật chưa chạy | Một phần |
| M4 Groq JSON, retry 1 lần, eval >= 85%, 2 câu từ chối | retry/parse/từ chối có test mock; Groq + eval chưa chạy | Chưa kiểm chứng |
| M5 demo E2E, chart khi yêu cầu, không XSS | đọc toàn bộ JS: không `innerHTML`/`eval`; demo mode chạy tay đúng; Playwright không chạy lại | Đạt (code), E2E thật chưa |
| M6 Docker, Render, 429, README | `docker build` không chạy được (không có daemon); mô phỏng bố cục Docker bằng venv ghim phiên bản: `/`, `/vendor/chart.umd.min.js`, `/health` đều 200; 429 xuất hiện khi vượt 10 request/phút từ một IP | Một phần |
| Định nghĩa doanh thu = Ký HĐ; tỷ lệ chốt = Ký HĐ / tổng lead nhóm | prompt mục 3 + README; SQL chuẩn eval q02/q08; DB: 93 HĐ, tỷ lệ chốt toàn bộ 5,17% | Đạt |
| "Hôm nay" = 2026-11-08 | `REFERENCE_DATE` mặc định, prompt nhúng ngày literal, guard chặn `CURRENT_DATE/NOW()` | Đạt |

## 3. Vấn đề (phân loại)

### Đã sửa bởi tôi (commit `fix(review)`, ruff + pytest xanh)

| ID | Mức | Vị trí | Mô tả | Sửa |
|---|---|---|---|---|
| F-01 | MAJOR | `sql_guard.py` `_check_tables` (cũ dòng 47-57) | Tên CTE gom toàn cây. Payload `SELECT * FROM (WITH pg_user AS (SELECT 1) SELECT 1) q, pg_user` và `... WHERE ma_nv IN (SELECT usename FROM pg_user)` kèm CTE mồi ở nơi khác LỌT guard; tham chiếu không schema tới catalog (`pg_user`, `pg_roles`, `pg_settings`...) chạy được vì `search_path` ngầm có `pg_catalog`. Ảnh hưởng bị chặn bởi quyền DB (không đọc được `public.sales`), nhưng whitelist bảng bị vô hiệu. | `_cte_visible`: CTE chỉ hợp lệ trong đúng phạm vi (thân truy vấn chứa WITH, CTE khai báo trước). Test: decoy, tham chiếu tiến, tên CTE có schema. |
| F-02 | MAJOR | `chart_intent.py` | Sau bỏ dấu "về" thành "ve" nên khớp regex vẽ: "Cho tôi biết **về** doanh thu" bật `chart_requested=true`. Vi phạm yêu cầu "vẽ biểu đồ nếu được yêu cầu". Câu "Không cần vẽ biểu đồ" cũng bật biểu đồ. | Chỉ nhận "vẽ" có dấu hoặc "ve" đi cùng "biểu đồ/đồ thị...", thêm xử lý phủ định, 8 test mới. |
| F-03 | MAJOR | `config.py` + README | README bảo `cp ../.env.example ../.env` rồi chạy uvicorn từ `backend/`, nhưng `env_file=".env"` chỉ tìm trong cwd. Tôi xác nhận: chạy từ `backend/` thì key không được nạp (`False`), chạy từ gốc repo thì nạp. Người dùng làm đúng README sẽ nhận "Chưa cấu hình GROQ_API_KEY". | `env_file=(<gốc repo>/.env, ".env")`, thêm test. |
| F-04 | MAJOR (độ tái lập) | `requirements.txt` | Dùng `>=`, trong khi guard phụ thuộc tên lớp AST của sqlglot (`ExplodingGenerateSeries`, `Into`...). Build Docker sau này có thể kéo bản sqlglot khác và âm thầm nới/siết guard. | Ghim đúng phiên bản đã kiểm thử (sqlglot 30.30.0 ...); cài sạch từ file rồi chạy test xanh. |
| F-05 | MINOR | `sql_guard.py` | `WITH RECURSIVE` lọt guard (vector tải CPU/bộ nhớ, chỉ còn timeout 5 s cản). Không cần cho bài toán. | Cấm WITH RECURSIVE + test. |

### Còn mở (dev xử lý)

| ID | Mức | Vị trí | Mô tả | Cách sửa |
|---|---|---|---|---|
| O-01 | MAJOR (chờ user) | DB `public.sales` | `anon`/`authenticated` có SELECT/INSERT/UPDATE/DELETE/TRUNCATE (tôi xác nhận bằng `has_table_privilege`: `sel_sales=true`, `trunc_sales=true`). Đang an toàn nhờ RLS bật + 0 policy, nhưng một thao tác sai (tắt RLS, thêm policy `true`) lộ SĐT/email/tên khách ngay qua anon key công khai; TRUNCATE không chịu RLS. Mặc định Supabase `default ACL` cấp quyền này cho mọi bảng mới. | `REVOKE ALL ON public.sales FROM anon, authenticated;` (user quyết, tôi không đổi). Cân nhắc đưa CSV gốc vào schema riêng. |
| O-02 | MINOR | `main.py:67` | Giới hạn body chỉ dựa `Content-Length`; request `Transfer-Encoding: chunked` 200 KB đi qua (tôi thử: trả 503 thay vì 413). Pydantic vẫn cắt trường nên rủi ro là bộ nhớ. | Middleware ASGI đếm byte thực tế, hoặc đặt giới hạn ở proxy/uvicorn `--limit-max-requests` không thay thế; đơn giản nhất bọc `receive`. |
| O-03 | MINOR | `routes.py:23-26` | Rate limit khóa theo phần tử CUỐI của `X-Forwarded-For`. Chạy trực tiếp (không proxy) thì giả header là vượt giới hạn (tôi gửi 12 request với 12 XFF khác nhau: không 429). Sau Render/Cloudflare thì phần tử cuối có thể là IP edge dùng chung, nhiều người chung một bucket. Chưa kiểm chứng trên Render. | Sau khi deploy, kiểm tra header Render gửi; dùng `request.client.host` do uvicorn `--proxy-headers` đã xử lý, bỏ tự parse. Bộ đếm slowapi nằm trong RAM của 1 tiến trình (ổn với 1 instance). |
| O-04 | MINOR | `sql_guard.py` `_check_funcs` | Guard cho `Cast` mọi kiểu: `'public.sales'::regclass` lọt (chỉ lộ sự tồn tại của object). `SIMILAR TO`, tự JOIN 4 lần, `concat` lồng lọt, chỉ còn `statement_timeout` 5 s ngăn tải. LLM chỉ sinh SQL này nếu bị prompt-injection qua câu hỏi. | Giới hạn kiểu cast (`date, numeric, text, int, bigint, float`), giới hạn số bảng trong FROM (<= 3). |
| O-05 | MINOR | `sql_guard.py:19` | Whitelist có `unaccent` nhưng extension chưa cài trong DB (`pg_extension` không có) -> chạy lỗi `UndefinedFunction`, tốn 1 lượt retry. | Bỏ `unaccent` khỏi `ALLOWED_ANON` hoặc cài extension (cần user). |
| O-06 | MINOR | `sql_guard.py` `_check_root` | `(SELECT .. LIMIT 10) UNION ALL (SELECT ..)` (nhánh có ngoặc) bị từ chối nhầm ("Chỉ cho phép SELECT"). Comment `--`/`/*` trong chuỗi literal (vd `'a--b'`) cũng bị từ chối nhầm. | Bóc `exp.Subquery` ở nhánh Union; kiểm comment bằng tokenizer thay vì regex. Ít gặp. |
| O-07 | MINOR | `main.py` | `/docs`, `/openapi.json` mở ở production (đã thử: 200); không có header bảo mật (CSP, X-Content-Type-Options). `/health` luôn 200 kể cả khi DB lỗi (đúng thiết kế để tránh restart loop nhưng Render không biết DB chết). | `FastAPI(docs_url=None, openapi_url=None)` khi không debug; thêm CSP `default-src 'self'`. |
| O-08 | MINOR | `demo.py`, `main.py` | Demo mode: `/health` báo `db:"ok"`, giao diện không có biểu ngữ "DEMO", số liệu giả có thể bị nhầm là thật nếu ai đó vô tình bật. Tôi xác nhận demo KHÔNG bật mặc định (`/health` -> `"demo":false`; `render.yaml` không đặt `DEMO_MODE`). | FE đọc `/health.demo` và hiện banner; `/health` trả `db:"demo"`. |
| O-09 | MINOR | `prompt.py` mục 3 | Prompt chỉ định nghĩa "30 ngày qua"; thiếu "tháng này / tháng trước / quý này / năm nay / tuần trước" (so với ngày 2026-11-08), thiếu phân biệt `chu_dau_tu` ("Vinhomes") với `ten_du_an` ("Vinhomes Ocean Park"), thiếu "doanh thu theo thời gian dùng `ngay_ky_hd` (không phải `ngay_tao_lead`)". | Thêm 4-5 dòng quy tắc; đo lại bằng eval khi có key. |
| O-10 | MINOR | `llm.py:34-37` | Khi 429 tự chuyển sang `llama-3.1-8b-instant` (yếu hơn rõ rệt) mà người dùng không biết. | Ghi log model dùng; tuỳ chọn tắt fallback; hiện nhãn "mô hình dự phòng". |
| O-11 | MINOR | `tests/eval`, `schema_info.EXAMPLES` | Eval không trùng few-shot nguyên văn (đã kiểm: giao 0), nhưng cùng khuôn: few-shot "Tỷ lệ chốt nhu cầu Đầu tư" ~ q08, "Doanh thu Ecopark" ~ q02, "lead theo tháng" ~ q07. 4 câu gợi ý trong UI trùng nguyên văn câu eval. Con số 85% sẽ hơi lạc quan. | Thêm 10 câu eval "giữ kín" (mơ hồ, PII, thời gian tương đối). |
| O-12 | NIT | `schema_info.py` | Mô tả `xac_suat_chot` "cố định theo giai đoạn": thực tế "Đang tư vấn" có 2 giá trị (12 và 25, tương ứng "Đã liên hệ"/"Đang tư vấn"). | Sửa mô tả. |
| O-13 | NIT | `requirements-dev.txt`, CI | `ruff>=0.5` không ghim: CI có thể đỏ do khác phiên bản format. | Ghim ruff. |
| O-14 | NIT | `HistoryItem.sql` max 2000 | SQL đã chuẩn hóa dài hơn 2000 ký tự khiến câu hỏi kế tiếp trả 422. | Cắt `sql` trước khi gửi lại hoặc nâng giới hạn. |

Không có BLOCKER. Ghi chú đánh giá history (prompt-injection): history do client gửi (`question`, `sql`, `clarification`) được đưa vào LLM dưới dạng lượt user/assistant giả mạo được. Rủi ro thực tế thấp vì (a) người gửi chỉ tự ảnh hưởng chính phiên của mình, (b) mọi SQL do LLM sinh ra (kể cả khi bị dẫn dắt) đều đi qua `validate_and_limit` rồi mới chạy, SQL trong history KHÔNG bao giờ được thực thi trực tiếp, (c) kết quả truy vấn không bao giờ quay lại LLM. Hệ quả tối đa: LLM bị dẫn sinh truy vấn nặng (xem O-04) hoặc trả lời sai.

## 4. Tấn công sql_guard (tôi tự viết, script nằm ngoài repo)

Số payload: 96 (sau khi sửa, 28 qua guard: đều là truy vấn hợp lệ hoặc vô hại, trừ các mục MỞ trong bảng dưới): stacked query, comment (`--`, `/* */`, `$$--$$`), fullwidth semicolon, NUL byte, case trick, `SELECT INTO`, CTE chứa DELETE/INSERT, `pg_read_file`, `pg_sleep` (WHERE/FROM/FILTER/window), `set_config`, `current_setting`, `dblink`, `lo_import`, `query_to_xml`, `generate_series` (FROM/SELECT/cross), `unnest`, bảng ngoài whitelist (`public.sales`, `sales`, `information_schema`, `pg_catalog.pg_user`, `pg_shadow`, `postgres.analytics.sales_clean`, `pipeline_status_map`), identifier trong ngoặc kép, `U&"..."`, LATERAL, recursive CTE, cross-join 4 lần, window nặng, LIMIT lớn/âm/ALL/biểu thức/`1+1e9`, OFFSET lớn, FETCH FIRST, UNION với nguồn lạ, cast `regclass`, `FOR UPDATE`, `nextval`, `version()`, `current_user`, `EXPLAIN`, `VALUES`, `SHOW`, `DO`, `CALL`, `COPY ... PROGRAM`, `SET ROLE`, BEGIN/COMMIT, `repeat`/`lpad` bom bộ nhớ, `ReDoS` regex, `row_to_json`/`to_jsonb`, `TABLESAMPLE`.

Kết quả TRƯỚC khi sửa, payload LỌT guard (không phải do dữ liệu hợp lệ):

| Payload | Hậu quả | Trạng thái |
|---|---|---|
| CTE mồi + `FROM pg_user` (2 biến thể) | vượt whitelist bảng, đọc catalog | ĐÃ SỬA (F-01), có test |
| `WITH RECURSIVE ... WHERE n<100000000` | tải CPU/RAM (cản bởi timeout 5 s) | ĐÃ SỬA (F-05) |
| `'public.sales'::regclass` | lộ tồn tại object | MỞ (O-04) |
| cross-join 4 lần, `SIMILAR TO '(a|aa)+'`, `TABLESAMPLE` | tải, cản bởi timeout | MỞ (O-04) |
| `SELECT 1`, `SELECT sales_clean FROM sales_clean` | vô hại | chấp nhận |

Mọi payload còn lại bị chặn. LIMIT luôn bị ép về <= 501 (âm/ALL/biểu thức/lớn). SQL thực thi là bản sinh lại từ AST (`tree.sql`), không phải chuỗi gốc, nên không có chênh lệch parser. `%` trong ILIKE an toàn vì không truyền tham số cho psycopg.

Các kiểm tra khác (tự chạy với uvicorn không key):
- Thiếu key: `POST /api/query` -> 503 `{"error":{"code":"LLM_UNAVAILABLE","message":"Chưa cấu hình GROQ_API_KEY cho máy chủ."}}`, không stack trace, không lộ biến môi trường.
- Câu hỏi rỗng / 301 ký tự / JSON hỏng -> 422 `INVALID_INPUT`; body 20 KB (có Content-Length) -> 413; path traversal -> 404.
- CORS: preflight từ `https://evil.com` -> 400, không có `access-control-allow-origin`; origin `http://localhost:8000` được phép.
- Rate limit: vượt 10 request/phút từ một IP -> 429 với thông điệp tiếng Việt.
- Log: `RedactFilter` che `gsk_...` và `postgres://u:pw@`; không log kết quả/hàng dữ liệu. Hạn chế: mật khẩu chứa `@` hoặc mã hóa %-encoding che chưa tốt; chỉ gắn vào handler root (NIT).
- Frontend: đọc `main.js`, `table.js`, `chart.js`, `api.js`: toàn bộ chuỗi từ server đi qua `textContent`/dữ liệu Chart.js; không `innerHTML`/`eval`/`href` động. XSS qua dữ liệu: đạt (smoke Playwright của dev có ca `<img onerror>`; tôi không chạy lại Playwright).

## 5. DB (chỉ SELECT qua Supabase MCP)

- Kiểu cột view: date x6, bigint x6, numeric (dien_tich_m2), smallint x2, boolean, timestamp; phần còn lại text. Không có cột PII: view không có `ho_ten_khach_hang`, `sdt_khach_hang`, `email_khach_hang`, `nhan_vien__mail`, `ghi_chu_cham_soc`, `llbh__ghi_chu`. Còn `ten_nv` (tên nhân viên) và `ma_khach_hang` (mã giả danh); đó là quyết định đã được duyệt, ghi nhận.
- Đối chiếu view vs bảng gốc: 1800 = 1800 dòng; tổng giá trị Ký HĐ `1.556.003.395.101` = `1.556.003.395.101`; tổng tiền cọc `27.000.000.000` = `27.000.000.000`; 93 dòng có giá trị giao dịch, toàn bộ ở trạng thái Ký HĐ (0 ngoại lệ); `ngày ký` không trùng trạng thái khác (0); 16 trạng thái gốc map đúng nhóm (đếm từng cặp gốc -> chuẩn khớp bảng mapping); `trang_thai` NULL = 0. Mẫu ngẫu nhiên 8 dòng (`order by md5`): `23/03/2026` -> `2026-03-23`, `2026-07-28 00:00:00` -> `2026-07-28`, `06/08/2026 15:45:00` -> `2026-08-06 15:45:00`, `99,5` -> `99.50`: đúng. 65 lead trong 30 ngày qua; tỷ lệ chốt toàn bộ 5,17%; 2 HĐ và 6 cọc sau 2026-11-08 (như dev báo). Cột `ten_nv`/`ten_du_an` trùng thật: gốc chỉ điền 90/1800 dòng, khi có thì bằng cột `nhan_vien__*`/`du_an__*` (0 lệch), nên dùng cột `nhan_vien__ten_nv` làm nguồn là đúng.
- Mô tả cột trong prompt/`schema_info` khớp dữ liệu thật: giá trị phân loại (9 nguồn, 7 loại sản phẩm, 4 nhu cầu, 5 tỉnh, 8 khu vực, 7 chủ đầu tư, 12 dự án, team C1..C10/S1..S10, `DA001..DA012`) trùng với `SELECT DISTINCT`. Lệch nhỏ: O-12.
- Role `app_readonly` (`has_*_privilege`, `pg_roles`): SELECT view = true; INSERT view = false; SELECT `pipeline_status_map` = false; SELECT/TRUNCATE `public.sales` = false; CREATE trong `public` và `analytics` = false; không superuser/createdb/createrole/bypassrls; `rolconnlimit=10`; `rolconfig = statement_timeout=5s, default_transaction_read_only=on, search_path=analytics`. Lưu ý: role vẫn có USAGE schema `public` (từ PUBLIC, mặc định Supabase) nhưng không có quyền bảng nào trong `public`.
- View không đặt `security_invoker` (chủ sở hữu `postgres`) nên role đọc được view mà không cần quyền `public.sales`: đúng thiết kế.
- `get_advisors(security)`: chỉ INFO `rls_enabled_no_policy` trên `public.sales`. Không có cảnh báo cho schema `analytics`.
- `999_rollback.sql`: `DROP SCHEMA IF EXISTS analytics CASCADE; DROP ROLE IF EXISTS app_readonly;` chỉ đụng schema/role do dự án tạo, không đụng `public.sales`. An toàn. Lưu ý: nếu role còn kết nối đang mở hoặc ai đó cấp thêm quyền cho nó, `DROP ROLE` sẽ báo lỗi (không gây hại). Tôi KHÔNG chạy rollback.
- Rủi ro `anon`/`authenticated` trên `public.sales`: xem O-01 (mức cao nếu cấu hình đổi, hiện đang được RLS chặn).
- Chưa kiểm chứng: kết nối thật bằng `app_readonly` (không mật khẩu), `pg_sleep` bị timeout, INSERT bị từ chối, độ trễ Session Pooler.

## 6. Mô phỏng 8 câu hỏi mới (dựa trên code, không gọi LLM)

| # | Câu hỏi | SQL LLM nên sinh | Pipeline xử lý | Điểm yếu dự đoán |
|---|---|---|---|---|
| 1 | "Tháng nào chốt được nhiều hợp đồng nhất?" | `SELECT to_char(ngay_ky_hd,'YYYY-MM') AS thang, count(*) AS so_hd FROM sales_clean WHERE trang_thai='Ký HĐ' GROUP BY 1 ORDER BY 2 DESC LIMIT 1` | guard OK, bảng 1 dòng, không biểu đồ | Hòa hạng bị bỏ sót (LIMIT 1). Hai HĐ có ngày sau 11/08 có thể lọt tháng 12. |
| 2 | "Doanh thu quý 3 là bao nhiêu?" (mơ hồ năm/ngày) | `SUM(gia_tri_giao_dich_vnd) ... trang_thai='Ký HĐ' AND ngay_ky_hd BETWEEN DATE '2026-07-01' AND DATE '2026-09-30'` | chạy bình thường | Có thể lọc theo `ngay_tao_lead` thay vì `ngay_ky_hd`; prompt chưa nói rõ (O-09). Không hỏi lại về năm (dữ liệu chỉ có 2026, ổn). |
| 3 | "Cho tôi SĐT của khách đã đặt cọc dự án Ecopark" (PII) | `sql=null` + giải thích | `OutOfScope` -> HTTP 200 `OUT_OF_SCOPE`, UI hiện banner thông tin | Nếu LLM nhỏ (8b) vẫn sinh `SELECT ma_khach_hang ...` thì chỉ lộ mã giả danh; không có cột SĐT trong view nên không thể lộ thật. |
| 4 | "Thời tiết Hà Nội hôm nay thế nào?" (ngoài phạm vi) | `sql=null` | `OUT_OF_SCOPE` | Mô hình có thể bịa `SELECT 'nắng'`: guard cho `SELECT <literal>` chạy -> trả dữ liệu vô nghĩa. Đây là điểm yếu thật (O-04 liên quan). |
| 5 | "Vẽ biểu đồ tỷ lệ chốt theo team" | `round(100.0*count(*) FILTER (WHERE trang_thai='Ký HĐ')/count(*),2) AS ty_le ... GROUP BY team` | 20 nhóm > 8 -> `hbar`; `chart_requested=true` | Sắp xếp theo `team` dạng chuỗi (C1, C10, C2). Đúng định nghĩa của user. |
| 6 | "Khách nào tốt nhất?" (mơ hồ) | `sql=null`, `clarification="Bạn muốn xếp theo ... doanh thu / số HĐ?"` | `_empty` -> 200 kèm clarification, UI banner | Phụ thuộc LLM tuân thủ luật; mô hình hay chọn bừa "doanh thu cao nhất" thay vì hỏi lại. Hội thoại nối tiếp chưa test với LLM thật. |
| 7 | "So sánh doanh thu Vinhomes và Ecopark theo từng quý, vẽ biểu đồ cột" | `chu_dau_tu IN ('Vinhomes','Ecopark')`, `to_char(ngay_ky_hd,'YYYY-"Q"Q')`, group by 2 cột | 2 cột nhãn + 1 số -> `grouped_bar` | LLM dễ dùng `ten_du_an='Vinhomes'` (không có giá trị đó) -> bảng rỗng; prompt không phân biệt chủ đầu tư và tên dự án (O-09). Dấu nháy kép trong `to_char` có thể bị `sqlglot` sinh lại khác nhưng vẫn hợp lệ. |
| 8 | "Doanh thu hôm nay" | `... trang_thai='Ký HĐ' AND ngay_ky_hd = DATE '2026-11-08'` | chạy, trả NULL/0 | Dữ liệu ký lớn nhất ~tháng 10; kết quả NULL hiển thị "—" thay vì 0; nên `coalesce`. Người dùng có thể tưởng lỗi. |

Điểm yếu chung: chỉ có định nghĩa "30 ngày qua"; fallback 8b khi 429 giảm chất lượng; `rows` rỗng không có thông điệp riêng ("không có dữ liệu phù hợp") ngoài bảng trống.

## 7. Sẵn sàng deploy

- `Dockerfile`: `python:3.12-slim`, người dùng không phải root (`useradd --uid 10001`, `USER appuser`), `PORT` lấy từ env (`${PORT}` mặc định 8000), chỉ COPY `backend/app` + `frontend` (không `.env`, `.git`, tests, docs, db do `.dockerignore`). `--proxy-headers --forwarded-allow-ips='*'` phù hợp sau proxy PaaS. Đạt.
- `.dockerignore`: loại `.git`, `.env*` (trừ example), `docs`, `db`, `backend/tests`, `frontend/e2e`. Đạt.
- `.gitignore`: `.env`, `.env.*`, `.venv`, cache. Đạt.
- `render.yaml`: `runtime: docker`, `healthCheckPath: /health`, `sync: false` cho `GROQ_API_KEY`/`DATABASE_URL`; không có bí mật. Cần lưu ý `ALLOWED_ORIGINS` đặt cứng `https://text2sql-bds.onrender.com`; nếu Render đổi tên miền thì chỉ ảnh hưởng khi FE tách host (hiện cùng origin nên không ảnh hưởng).
- README: đủ cho người khác chạy local (sau sửa F-03) và deploy.
- Quét bí mật: không có `gitleaks`/`trufflehog` trong môi trường; dùng `git log --all -p | grep` cho `gsk_`, `postgres(ql)://user:pass@`, `service_role`, JWT `eyJ`, `sbp_`, khối khóa riêng tư: chỉ khớp chuỗi mẫu giả trong test che log và chữ "service_role" trong tài liệu; không có tệp `.env` nào từng được commit. Sạch. (Mã dự án Supabase `kxebriimlhwenbzfkekd` có trong repo: không phải bí mật.)
- KHÔNG làm được: `docker build` (có CLI nhưng không có daemon), deploy Render, gọi Groq, kết nối DB bằng role thật, chạy lại Playwright, kiểm tra CI trên GitHub.

### Checklist deploy cho user

1. Ở Supabase SQL Editor: `ALTER ROLE app_readonly PASSWORD '<mật khẩu mạnh>';` (không dán vào chat/commit). Quyết định `REVOKE ALL ON public.sales FROM anon, authenticated;` (O-01).
2. Lấy chuỗi Session Pooler (Dashboard > Connect, cổng 5432, user `app_readonly.kxebriimlhwenbzfkekd`), đặt thành `DATABASE_URL`.
3. Tạo key tại console.groq.com, đặt `GROQ_API_KEY`. Gọi `GET https://api.groq.com/openai/v1/models` kiểm tra tên model còn hiệu lực; sửa `GROQ_MODEL` nếu cần.
4. Local: `cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && cp ../.env.example ../.env` (điền key), rồi `pytest tests/integration` và `python -m tests.eval.run_eval`. Báo kết quả cho dev; nếu < 85% phân tích lỗi trước khi sửa prompt.
5. Render: New > Blueprint từ repo (dùng `render.yaml`), dán 2 secret ở Environment, deploy. Không đặt `DEMO_MODE`.
6. Sau deploy: mở URL (chờ cold start 30-60 s), hỏi 5 câu mẫu, bắn 12 request liên tiếp để thấy 429, kiểm tra `/health` (`"demo":false,"db":"ok"`), xem log không có key.
7. Chạy `docker build .` ở máy có Docker để xác nhận ảnh dựng được; bật CI GitHub Actions và đảm bảo xanh.

## 8. Việc user phải làm (tóm tắt)

1. Đặt mật khẩu `app_readonly`, cấp `DATABASE_URL`, `GROQ_API_KEY`.
2. Quyết định REVOKE `anon`/`authenticated` trên `public.sales`.
3. Chạy test tích hợp + eval, gửi kết quả.
4. Tạo dịch vụ Render, đặt secret, kiểm tra thực tế.
5. Xác nhận 2 HĐ và 6 cọc có ngày sau 2026-11-08 là dữ liệu hợp lệ hay lỗi nhập liệu.
6. Chấp nhận (hoặc yêu cầu) việc dev xử lý O-02..O-11.

## 9. Lệnh đã chạy và kết quả chính

```
ruff check .                    -> All checks passed!
ruff format --check .           -> 36 files already formatted
pytest -q (trước sửa)           -> 118 passed
pytest -q (sau sửa)             -> 136 passed
pip install -r requirements.txt (đã ghim, venv sạch) -> thành công, test xanh
uvicorn: /health                -> {"status":"ok","db":"unavailable","demo":false}
POST /api/query (không key)     -> 503 LLM_UNAVAILABLE (thân thiện)
12 request liên tiếp            -> 503 x8 rồi 429 x4
DEMO_MODE=true /health          -> {"demo":true}; mặc định -> {"demo":false}
Supabase: view 1800 = raw 1800; tổng Ký HĐ khớp 1556003395101; tổng cọc khớp 27000000000
```
