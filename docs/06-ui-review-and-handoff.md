# 06 – Duyệt thiết kế UI (hướng A) và bàn giao cho DEV

Người viết: Agent 2 (Tech Lead Reviewer). Phạm vi: chỉ tài liệu, không sửa code ứng dụng.
Nguồn thiết kế: `Empty.dc.html` (trang chủ), `Main.dc.html`, `Mobile.dc.html`, `States.dc.html`, `canvas.json` (hướng A, nền kem + xanh lục đậm; VarB/VarC bỏ).
Đối chiếu với: `frontend/` hiện có, `backend/app/{schemas.py,errors.py,schema_info.py,main.py,api/routes.py,services/*}`, `docs/01-plan.md` mục 4-6.

## 0. Quyết định

**DUYỆT CÓ CHỈNH SỬA.**

- Trang chủ = màn hình Empty (người duyệt đã chốt). Sau khi hỏi, giao diện chuyển sang bố cục Main (hội thoại + thẻ kết quả).
- **Không cần đổi backend** để làm toàn bộ thiết kế này. Mọi thứ đều dựng được ở frontend từ `POST /api/query`, `GET /api/examples`, `GET /api/schema`, `GET /health` và localStorage.
- Có 7 chỗ thiết kế **không thật/không làm được đúng sự thật** nên phải sửa (mục 4): số liệu "1.793 giao dịch · đến 08/11/2026", nút trả lời nhanh trong "Hỏi lại", bộ đếm "24 giây", chữ "5 giây"/"10 câu", cột "Tỷ trọng" + "Tổng 1.793", gợi ý "Chỉ tính nguồn đã ký hợp đồng", nhãn "Một con số/Bảng so sánh".
- Có 4 chỗ thiết kế **vi phạm a11y** cần sửa token (mục 4.2): viền ô nhập 1,74:1, outline bị tắt, cỡ chữ ô nhập mobile 15px (iOS tự phóng to), liên kết giả `<a href="#">`.

## 1. Token thiết kế lấy nguyên văn từ file .dc.html

Đặt thành biến CSS `:root` trong `frontend/css/tokens.css`. Không dùng màu hex rải rác ở nơi khác.

| Biến CSS đề xuất | Giá trị | Dùng cho | Tương phản (tính thật) |
|---|---|---|---|
| `--bg` | `#F5F3EE` | nền trang | chữ `--text` 14,61:1 |
| `--surface` | `#FFFFFF` | thanh bên, thẻ, ô nhập | |
| `--surface-2` | `#FAF9F5` | thanh hành động dưới thẻ | |
| `--track` | `#F0EEE8` | nền rãnh thanh, thanh tiến trình | |
| `--text` | `#17231F` | chữ chính | |
| `--text-2` | `#4A5852` | đoạn mô tả hero | 6,74:1 trên `--bg` |
| `--muted` | `#5B6862` | chữ phụ, nhãn | 5,26:1 trên `--bg`; 5,83:1 trên trắng; 5,03:1 trên `--track` |
| `--line` | `#E1DDD3` | viền thẻ, đường kẻ | trang trí, không dùng làm viền duy nhất của control |
| `--line-btn` | `#D5D0C4` | viền nút phụ/chip | nút đã có chữ nên đạt 1.4.11 qua nhãn |
| `--line-input` | **`#8A8574`** (đổi, xem 4.2) | viền ô nhập câu hỏi | 3,69:1 trên trắng; thiết kế gốc `#C9C4B6` chỉ 1,74:1 |
| `--primary` | `#0E5A4B` | nút Hỏi, thanh biểu đồ, bong bóng câu hỏi, tab chọn, logo | trắng trên nó 8,13:1 |
| `--primary-dark` | `#0A4338` | hover liên kết, chữ tab chọn, chữ trên nền `--primary-tint` | 11,21:1 trên trắng; 9,74:1 trên tint |
| `--primary-tint` | `#E8F1EE` | mục lịch sử đang chọn, badge, chip chọn | |
| `--accent` | `#B45309` | cột lớn nhất, thanh đếm lùi | 5,02:1 trên trắng; 4,33:1 trên `--track` (đạt 3:1 cho đồ họa) |
| `--warn-bg` / `--warn-fg` | `#F3E3D0` / `#7A3E06` | biểu tượng "Từ chối", "Hết lượt" | 6,63:1 |
| `--danger-bg` / `--danger-fg` / `--danger-line` | `#F8DEDA` / `#8E2415` / `#E8C4BE` | "Lỗi hệ thống" | 6,82:1; `--danger-fg` trên trắng 8,70:1 |
| `--neutral-bg` / `--neutral-fg` | `#ECEAE3` / `#3F4B46` | "Không có kết quả" | 7,56:1 |
| `--code-bg` / `--code-fg` / `--code-kw` | `#17231F` / `#E8F1EE` / `#7FD1B9` | khối SQL | 14,07:1; 9,04:1 |
| `--font-sans` | `'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | toàn trang | |
| `--font-mono` | `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` | khối SQL (bỏ JetBrains Mono để khỏi tải thêm font) | |
| `--radius-card` / `-input` / `-btn` / `-chip` | `16px` / `16px` / `10-12px` / `999px` | | |
| Cỡ chữ | body 15px/1.5; h1 hero 40px/1.15 700; h1 màn kết quả 18px 600; h2 thẻ 16px 600; nhãn nhỏ 12-13px; **textarea 16px** | | |
| Khoảng cách | thanh bên 272px, padding 24/20; nội dung rộng tối đa 820px (Empty) / 1040px (Main); lề trang 40px desktop, 16px mobile; gap 8/12/16/24/32 | | |
| Mục tiêu chạm | tối thiểu 44px (nút hành động, chip, tab, nút Hỏi 48px) | | |

Chế độ tối: **bỏ** `prefers-color-scheme: dark` khỏi `style.css` hiện tại và đặt `color-scheme: light`. Thiết kế hướng A chỉ có bản sáng, bản tối chưa được duyệt; để nguyên bản tối cũ sẽ hiện xanh dương `#1f6feb` lạc phong cách.

## 2. Hợp đồng API hiện có (cơ sở cho đối chiếu)

- `POST /api/query` `{question(1-300), history[≤3]{question, sql?, clarification?}}` trả `{sql, explanation, columns[{name,type: number|date|boolean|string}], rows, row_count, truncated, chart_requested, chart, chart_message, clarification, elapsed_ms}`.
- `chart` (đã dựng sẵn ở server): `type ∈ bar|hbar|line|pie|doughnut|scatter|grouped_bar`, `title`, `labels[]`, `datasets[{label,data}]`, `x_label`, `y_label`. **Chỉ có khi câu hỏi yêu cầu vẽ** (`chart_requested`); không vẽ được thì `chart=null` + `chart_message` (vd. "Có hơn 30 nhóm nên không vẽ biểu đồ."). Server chọn loại: thời gian -> line; 1 nhóm + 1 số -> pie (≤8 dòng, hỏi tròn/cơ cấu/tỷ lệ), hbar (>8 dòng hoặc nhãn dài), bar (còn lại); 2 nhóm + 1 số -> grouped_bar; 2 số -> scatter. Tối đa 30 nhóm.
- Lỗi luôn `{"error":{"code","message"}}`: `INVALID_INPUT` 422/413, `OUT_OF_SCOPE` **HTTP 200** (đã được `api.js` xử lý), `SQL_REJECTED` 400, `DB_TIMEOUT` 504, `DB_UNAVAILABLE` 503, `LLM_UNAVAILABLE` 503, `RATE_LIMITED` 429. `api.js` còn tự sinh `NETWORK` và `HTTP`.
- Hỏi lại = HTTP 200, `sql=null`, `clarification` là **văn bản tự do** (không có danh sách lựa chọn).
- `GET /api/examples` -> `{examples: string[7]}` (chỉ chuỗi, không có nhãn phụ). `GET /api/schema` -> `{table, columns[{name,type,description}], categories{...}}` (33 cột). `GET /health` -> `{status, db, demo}`.
- 429 **không có** header `Retry-After` (handler `rate_limited` trong `main.py` chỉ trả JSON). Số lần/phút (`rate_limit`) và thời gian timeout là cấu hình môi trường, không có trong API.

## 3. Bảng ánh xạ UI -> dữ liệu -> việc cần làm

Ký hiệu: FE = chỉ sửa `frontend/`; BE = phải sửa backend (hiện **không** mục nào bắt buộc).

| # | Thành phần UI | Dữ liệu lấy từ | Sửa BE? | Việc FE cần làm / khoảng cách |
|---|---|---|---|---|
| 1 | Trang chủ (Empty): hero, ô nhập, "Thử hỏi", chú thích riêng tư | Văn bản tĩnh; thẻ "Thử hỏi" từ `GET /api/examples` | Không | Dựng thẻ gợi ý 2 cột (1 cột <640px), hiện 6 trong 7 câu. Nhãn phụ trên thẻ **không có trong API**: suy ra bằng quy tắc client: chứa "biểu đồ" -> "Có biểu đồ", còn lại -> "Bảng kết quả". Bỏ nhãn "Một con số/Bảng so sánh" (không suy ra được đáng tin). Bấm thẻ = gửi ngay câu đó (khác hành vi cũ chỉ điền ô). Nếu `/api/examples` lỗi: ẩn cả khối "Thử hỏi", không dùng câu cứng (tránh lệch với backend). |
| 2 | Chuyển Empty -> Main | Trạng thái client | Không | Một trang, hai chế độ: `home` (khi chưa có lượt nào) và `thread`. "Câu hỏi mới" quay về `home`, **xóa mảng `history` gửi backend** và hủy mọi Chart. Không dùng router. |
| 3 | Thanh bên "Gần đây" + "Câu hỏi mới" | **localStorage** (không có API lịch sử) | Không | Mô-đun `history.js` (mục 5.5). Mục lịch sử là `<button>`, không phải `<a href="#">`. Bấm mục: nếu kết quả còn trong bộ nhớ phiên thì hiện lại ngay, nếu không thì hỏi lại (tốn 1 lượt giới hạn tốc độ, gửi `history=[]`). Có nút "Xóa lịch sử". |
| 4 | Chân thanh bên "1.793 giao dịch · dữ liệu đến 08/11/2026 / Kết nối chỉ đọc" | Không có trong API (`reference_date` ở config BE, số dòng ở dữ liệu) | Không (tùy chọn P3, mục 4.1) | Bỏ hai con số; chỉ giữ "Kết nối chỉ đọc" (đúng sự thật: role `app_readonly` + `sql_guard`). |
| 5 | Huy hiệu "Chỉ đọc · Không thể sửa dữ liệu" | Hằng chữ, đúng sự thật ở chế độ thật | Không | Giữ. Gọi `GET /health`: nếu `demo=true` thì **thay** bằng huy hiệu cam "Chế độ demo · dữ liệu giả lập" (không được tuyên bố "chỉ đọc" cho dữ liệu giả). `/health` lỗi thì giữ huy hiệu mặc định. Cần thêm `getHealth()` vào `api.js`. |
| 6 | Bong bóng câu hỏi + thẻ kết quả, dòng "9 dòng · 0,8 giây" | `question` người dùng; `explanation`, `row_count`, `elapsed_ms`, `truncated` | Không | Luồng theo thứ tự thời gian (cũ trên, mới dưới, tự cuộn tới lượt mới), thay cho `prepend` hiện tại. `elapsed_ms` đổi sang giây định dạng vi-VN 1 chữ số ("0,8 giây"; <100 ms ghi "dưới 0,1 giây"). `truncated=true` thêm "Chỉ hiển thị 500 dòng đầu." (số lấy từ `rows.length`). |
| 7 | Tab Biểu đồ / Bảng / SQL | Cùng một phản hồi: `chart`, `columns+rows`, `sql` | Không | Mẫu ARIA tabs đầy đủ (mục 5.7). Tab "Biểu đồ" **chỉ có khi `chart != null`**; mặc định mở "Biểu đồ" nếu có, ngược lại "Bảng". Nếu `chart_requested && !chart` thì hiện `chart_message` thành dòng thông tin phía trên tab (hành vi hiện có). Tab "SQL" chỉ có khi `sql != null`. |
| 8 | Biểu đồ (thanh ngang xanh, cột lớn nhất cam) | `chart` | Không | Thiết kế vẽ bằng `<div>`; thay bằng Chart.js cùng token (mục 5.2). Bỏ cột "Tỷ trọng" và dòng "Tổng 1.793 lead" (xem 4.1). Giữ dòng chú thích dạng "Cao nhất: Data đối tác (270)" tính từ `datasets[0].data` (an toàn cho mọi loại số liệu). |
| 9 | Bảng | `columns`, `rows` | Không | Dùng lại `table.js` (đã `textContent`). Bổ sung style theo thiết kế (hàng 12px, viền `#EFEBE2`, số căn phải `tabular-nums`). Tên cột hiện đúng như CSDL (`nguon_lead`) như thiết kế. Khung cuộn `tabindex="0" role="region" aria-label="Bảng kết quả"`. |
| 10 | Khối SQL | `sql` | Không | `<pre><code>` + `textContent`. Tô từ khóa là P2: tách token bằng regex rồi tạo `<span>` bằng `createElement`+`textContent`, **không dùng innerHTML**. Chú thích dưới khối ("Chỉ cho phép SELECT trên bảng sales_clean. Tự giới hạn tối đa 500 dòng") giữ, nhưng số 500 lấy từ `rows.length` khi `truncated`, còn chữ chung viết "Hệ thống tự giới hạn số dòng." |
| 11 | Nút "Sao chép SQL" | `sql` | Không | `navigator.clipboard.writeText`; fallback `document.execCommand('copy')` qua `<textarea>` ẩn khi không phải secure context (triển khai HTTP). Báo "Đã sao chép" bằng vùng `role="status"` ~2 giây. Ẩn nút nếu `sql=null`. |
| 12 | Nút "Tải CSV" | `columns`, `rows` (đã có ở client) | Không | Mô-đun `csv.js` (mục 5.6). Ẩn nếu `rows` rỗng. |
| 13 | "Xem cấu trúc dữ liệu" | `GET /api/schema` | Không | Hiện là `<a href="#">` -> đổi thành `<button>` mở `<dialog>` modal liệt kê cột (tên, kiểu, mô tả) và nhóm giá trị (`categories`). Thêm `getSchema()` vào `api.js`, tải khi mở lần đầu rồi cache. Phải có nút đóng 44px, Esc đóng, trả focus về nút mở. Không in tên nhân viên thật (schema chỉ có tên cột, không có giá trị cá nhân: đúng). |
| 14 | "Gợi ý tiếp" | **Quy tắc client + `/api/examples`**, không gọi LLM | Không | Mục 5.4. Bỏ chip "Chỉ tính nguồn đã ký hợp đồng" (nghĩa nghiệp vụ cứng, có thể sai ngữ cảnh). |
| 15 | Trạng thái: Từ chối | HTTP 200 `error.code=OUT_OF_SCOPE`, `message` | Không | Thẻ "Không thể thực hiện yêu cầu này" + tiêu đề cố định; nội dung = `message` của server (textContent). Nút gợi ý lấy 1 câu từ `/api/examples` (không cứng). Hiện bong bóng câu hỏi của người dùng phía trên. |
| 16 | Trạng thái: Hỏi lại | HTTP 200, `sql=null`, `clarification` | Không | Thẻ "Cần làm rõ thêm" + câu hỏi từ server. **Bỏ hai nút trả lời nhanh** (API chỉ trả văn bản tự do). Thay bằng dòng "Gõ câu trả lời ở ô bên dưới", focus vào ô nhập, placeholder "Trả lời câu hỏi trên…". Lượt sau gửi `history` có `clarification` (đã hỗ trợ: `main.js` hiện đã đẩy `clarification` vào history). |
| 17 | Trạng thái: Không có kết quả | `row_count=0` và `sql != null` | Không | Thẻ do client tự quyết định. Liên kết "Xem câu SQL đã chạy" = chuyển sang tab SQL (hiện tại tab SQL vẫn có). Ẩn Tải CSV. |
| 18 | Trạng thái: Hết lượt | HTTP 429, `RATE_LIMITED` | Không (xem 4.1) | Thẻ "Bạn hỏi hơi nhanh". Không biết số giây chính xác: đếm lùi **ước lượng** ở client (4.1). Khóa nút Hỏi trong thời gian đó. |
| 19 | Trạng thái: Lỗi hệ thống | `DB_TIMEOUT`, `DB_UNAVAILABLE`, `LLM_UNAVAILABLE`, `SQL_REJECTED`, `INVALID_INPUT`, `NETWORK`, `HTTP` | Không | Một thẻ `role="alert"`; tiêu đề/nút theo mã (bảng 5.3). Nội dung lấy từ `message` server, **không** viết lại "quá 5 giây" (con số này là cấu hình `statement_timeout_ms`). |
| 20 | Trạng thái: Đang xử lý (4 bước) | Không có tiến trình thật từ API | Không | **Mô phỏng theo thời gian** (5.3). |
| 21 | Mobile 390px | Cùng dữ liệu | Không | Thanh bên thành ngăn kéo; ô nhập dính đáy; xem 5.8. Biểu đồ dùng Chart.js (không phải bố cục "tên trên thanh" của bản mockup). |
| 22 | Chân trang / chú thích riêng tư | Hằng chữ | Không | Câu "Thông tin cá nhân của khách hàng (họ tên, số điện thoại, email) không nằm trong dữ liệu truy vấn" đúng sự thật (xem 4.3). Xóa dòng cũ "Dữ liệu 1.800 lead/giao dịch" trong `index.html` hiện tại (sai: sau làm sạch là 1.793 và sẽ lỗi thời tiếp). |

## 4. Điểm cần chỉnh trong thiết kế

### 4.1 Cho đúng sự thật / triển khai được

1. **"1.793 giao dịch · dữ liệu đến 08/11/2026"**: API không trả hai giá trị này (ngày là `reference_date` trong cấu hình BE, số dòng nằm trong dữ liệu và đã đổi một lần: 1.800 -> 1.793). Hằng cứng trong JS sẽ lỗi thời im lặng. **Khuyến nghị: bỏ.** Chỉ giữ "Kết nối chỉ đọc". Nếu PO muốn có lại: bổ sung additive vào `/api/schema` (vd. `row_count`, `as_of`) là việc P3, ngoài phạm vi đợt này, và cần test BE riêng.
2. **"Tổng 1.793 lead" và cột "Tỷ trọng"**: không thể biết một cột số có cộng gộp được hay không (trung bình, tỷ lệ chốt, giá chào…). Tính tổng/tỷ trọng ở client có thể cho số sai. **Bỏ.** Thay bằng "Cao nhất: X (giá trị)". Riêng biểu đồ pie/doughnut, tooltip hiện phần trăm của lát cắt (tính trong Chart.js từ chính các lát đang hiển thị, đúng nghĩa "cơ cấu").
3. **Hai nút trả lời nhanh trong "Hỏi lại"**: backend chỉ trả văn bản tự do -> bỏ nút, dùng ô nhập (mục 3 hàng 16). Đổi backend để trả `options[]` là thay đổi hợp đồng, **không làm** đợt này.
4. **"Mỗi phút chỉ hỏi được tối đa 10 câu. Vui lòng thử lại sau 24 giây."**: số 10 là cấu hình `rate_limit`; 24 giây không có (429 không có `Retry-After`). Chữ mới: "Bạn hỏi hơi nhanh. Vui lòng chờ khoảng một phút rồi hỏi tiếp." Thanh đếm lùi: client ghi thời điểm 10 lần gửi gần nhất; khi nhận 429, thời gian chờ ước lượng = `60s − (now − thời điểm lần gửi cũ nhất trong 10 lần gần nhất)`, tối thiểu 5s, mặc định 60s nếu không đủ dữ liệu (IP dùng chung). Ghi rõ "khoảng". Tùy chọn P3 cho BE: thêm header `Retry-After` trong handler 429 (một dòng, không đổi hợp đồng JSON); FE phải chạy được cả khi không có header, và nếu có thì ưu tiên dùng.
5. **"Truy vấn chạy quá 5 giây"**: 5 là `statement_timeout_ms` cấu hình được. Dùng `message` của server ("Truy vấn quá thời gian cho phép, hãy hỏi cụ thể hơn.") + gợi ý chung "thêm khoảng thời gian hoặc một tỉnh cụ thể". Nút "Thử lại" chỉ cho `NETWORK`, `LLM_UNAVAILABLE`, `DB_UNAVAILABLE`, `HTTP` (lỗi tạm thời). Với `DB_TIMEOUT`, `SQL_REJECTED`, `INVALID_INPUT` thử lại y nguyên sẽ lặp lỗi: dùng nút "Sửa câu hỏi" (đưa câu cũ về ô nhập).
6. **"Đang xử lý" 4 bước**: xem 5.3; phải nói rõ là ước lượng theo thời gian.
7. **Nhãn "Một con số / Bảng so sánh"** trên thẻ gợi ý: bỏ (mục 3 hàng 1).

### 4.2 Cho đúng a11y (WCAG 2.1 AA)

1. **Viền ô nhập `#C9C4B6` trên nền trắng chỉ 1,74:1** (yêu cầu 3:1 theo 1.4.11). Đổi viền khung nhập (`form` composer, textarea mobile) sang `--line-input: #8A8574` (3,69:1 trên trắng, 3,33:1 trên nền kem).
2. **`outline: 0` trên textarea** làm mất dấu focus. Khung composer phải có `:focus-within { outline: 3px solid var(--primary); outline-offset: 2px }`; mọi `button`, tab, `summary` có `:focus-visible` cùng kiểu. Không dùng `outline:none` không thay thế.
3. **Textarea mobile 15px**: iOS Safari tự phóng to khi focus nếu <16px. Đặt 16px cho mọi `textarea` ở mọi kích thước.
4. **`<a href="#">` làm nút** (mục lịch sử, "Xem cấu trúc dữ liệu", "Xem câu SQL đã chạy"): đổi thành `<button type="button">`; chỉ dùng `<a>` khi có đích điều hướng thật.
5. Cột lớn nhất màu cam chỉ phân biệt bằng màu: luôn kèm chú thích chữ "Cao nhất: …" (đạt 1.4.1).
6. Mục tiêu chạm: tab, chip, nút hành động, nút đóng ngăn kéo, mục lịch sử ≥ 44px chiều cao (mục lịch sử thiết kế cao ~40px: nâng `padding` lên 12px).
7. Nút Hỏi/Gửi phải có tên truy cập: bản mobile là icon-only (`aria-label="Gửi câu hỏi"` đã có, giữ).
8. Biểu đồ `<canvas>`: `role="img"` + `aria-label` ("Biểu đồ cột: Số lead theo nguồn, 9 nhóm, cao nhất Data đối tác 270"); nội dung tương đương có ở tab Bảng.

### 4.3 Điểm lệch về an toàn / dữ liệu cá nhân

- `ma_khach_hang` (mã khách) và `ten_nv`/`ma_nv` (tên, mã **nhân viên**) có trong view. Câu "không có thông tin cá nhân" chỉ đúng cho **khách hàng** (họ tên, SĐT, email). **Giữ nguyên chữ "của khách hàng"**; tuyệt đối không viết lại thành "không có dữ liệu cá nhân" chung chung. Tên nhân viên sẽ hiện trong bảng/biểu đồ (ví dụ "Top 5 nhân viên"): đây là dữ liệu nghiệp vụ nội bộ, chấp nhận được, nhưng không đưa vào localStorage (lịch sử chỉ lưu câu hỏi, không lưu kết quả).
- Mockup "Từ chối" lấy ví dụ người dùng gõ "Nguyễn Văn A": người dùng có thể gõ thông tin cá nhân vào câu hỏi. Lịch sử localStorage vì vậy **không lưu** câu hỏi bị từ chối/lỗi, và bỏ qua câu có chuỗi ≥9 chữ số liên tiếp hoặc ký tự `@` (nghi SĐT/email).
- Không đưa mã lỗi nội bộ, SQL của lượt lỗi, hay `X-Request-ID` ra giao diện người dùng thường. (Cho phép hiện `code` nhỏ ở thẻ lỗi để hỗ trợ kỹ thuật: P3.)
- Ở chế độ DEMO phải hiện huy hiệu demo (hàng 5, mục 3) để tránh hiểu nhầm dữ liệu giả là thật.

## 5. Quyết định kỹ thuật (mỗi mục một khuyến nghị)

### 5.1 Nền tảng và cấu trúc file
- **Giữ HTML/CSS/JS thuần (ES modules) + Chart.js 4.4.4 đã vendor.** Không thêm framework, bundler, TypeScript, hay thư viện chart/datalabels. FE vẫn do FastAPI `StaticFiles` phục vụ, gọi API cùng origin qua `API_BASE`.
- CSS (nhiều `<link>` thẳng, không `@import` chuỗi): `css/tokens.css` (chỉ `:root`), `css/base.css` (reset, font, focus), `css/layout.css` (thanh bên, main, ngăn kéo mobile, breakpoint), `css/components.css` (nút, chip, thẻ, tab, bảng, khối SQL, dialog), `css/states.css` (thẻ trạng thái, loading). `style.css` cũ xóa hoặc thành file gộp import; không để hai hệ màu song song.
- Breakpoint: `≥ 900px` thanh bên cố định 272px; `< 900px` thanh bên thành ngăn kéo. Nội dung dùng `min-width:0` để flex không tràn.
- Font: **tự lưu** Be Vietnam Pro (400/500/600/700, subset latin + vietnamese, woff2, giấy phép OFL kèm `frontend/fonts/OFL.txt`) bằng `@font-face` + `font-display: swap`; **không** gọi Google Fonts (riêng tư, offline, CSP, e2e ổn định). Nếu môi trường DEV không tải được file font thì dùng system stack trong `--font-sans` và ghi rõ trong báo cáo; không chặn bàn giao vì font.
- JS (mỗi file một trách nhiệm, không có biến toàn cục): `config.js`, `api.js` (thêm `getSchema`, `getHealth`, timeout `AbortController` 45s -> `NETWORK` kèm message "Yêu cầu quá lâu"), `dom.js` (`el()` chỉ dùng `textContent`), `format.js` (`nf`, `shortNumber`, `formatDuration`), `chart.js`, `table.js`, `csv.js`, `history.js`, `followups.js`, `loading.js`, `results.js` (dựng thẻ kết quả + các thẻ trạng thái), `schema-dialog.js`, `main.js` (điều phối, máy trạng thái `home|thread`, giữ `history` gửi BE).
- Giữ nguyên id/class mà `e2e/smoke.js` đang dùng khi có thể: `#ask`, `#question`, `#submit`, `#results`, `#examples`, `.chip`; nếu phải đổi (vd. `details pre`, `#status .banner.info`) thì cập nhật `smoke.js` trong **cùng commit** và nêu rõ trong báo cáo (mục 6, nghiệm thu A5).

### 5.2 Biểu đồ khớp phong cách (Chart.js, cùng token)
- Đọc màu từ biến CSS lúc khởi tạo (`getComputedStyle(document.documentElement).getPropertyValue('--primary')`), có hằng dự phòng; đổi token chỉ ở `tokens.css`. Chờ `document.fonts.ready` trước khi vẽ, đặt `Chart.defaults.font.family` = `--font-sans`, `color` = `--text`, lưới `#EFEBE2`.
- **bar / hbar (một dataset):** nền `--primary` `#0E5A4B`; **cột có giá trị lớn nhất** (chỉ số đầu tiên nếu đồng hạng) `--accent` `#B45309`; `borderRadius: 6`; hbar `barThickness ≈ 28` (desktop) / 18 (≤480px), `categoryPercentage` hợp lý; ẩn lưới trục nhãn; không vẽ viền trục; nhãn giá trị ở cuối thanh bằng **plugin inline nhỏ** (`afterDatasetsDraw`, ~25 dòng, in số `vi-VN`/`shortNumber`), không thêm thư viện.
- **grouped_bar / nhiều dataset:** bảng màu phân loại đề xuất (cần PO nhìn một lần): `#0E5A4B, #B45309, #2F7D9A, #7A5C9E, #6B7A1E, #B0405A, #5B6862, #3B6EA5` (đều ≥4,6:1 trên nền trắng); **không** làm nổi cột lớn nhất; hiện chú giải phía trên.
- **line:** một đường `--primary`, dày 2,5px, điểm tròn bán kính 3, `tension: 0.25` (giữ), không tô nền; trục Y dùng `shortNumber`; nhiều dataset dùng bảng màu trên.
- **pie / doughnut:** các lát theo bảng màu trên (tối đa 8 lát do backend giới hạn), viền trắng 2px, chú giải bên dưới (mobile) hoặc bên phải (desktop), tooltip hiện giá trị + %. doughnut `cutout: 60%`.
- **scatter:** điểm `--primary` bán kính 4, độ trong suốt 0.7; hai trục có tiêu đề (`x_label`, `y_label`) và `shortNumber`.
- Tiêu đề biểu đồ (`chart.title`) hiển thị bằng thẻ `<h2>` của HTML (như thiết kế "Số lead theo nguồn"), tắt `plugins.title` của Chart.js để tránh trùng.
- Chiều cao: hbar = `max(240, số_nhãn × 36 + 56)`px; còn lại 340px desktop / 280px ≤560px (như hiện tại). Container `position:relative`, `maintainAspectRatio:false` (giữ).
- Mobile: nhãn trục dài cắt ở 16 ký tự + "…" qua `ticks.callback` khi `innerWidth ≤ 480`; tooltip luôn hiện nhãn đầy đủ.
- Hủy chart (`chart.destroy()`) khi gỡ thẻ/"Câu hỏi mới" để không rò bộ nhớ. Tab ẩn bằng `hidden`: gọi `chart.resize()` khi chuyển về tab Biểu đồ lần đầu.
- Tôn trọng `prefers-reduced-motion`: `animation: false`.

### 5.3 Trạng thái loading nhiều bước và ánh xạ lỗi
- API trả **một lần duy nhất**, không có tiến trình thật. Thiết kế 4 bước "Hiểu câu hỏi / Viết SQL / Lấy dữ liệu / Dựng bảng và biểu đồ" được hiện như **mô phỏng theo thời gian**: bước 1 xong sau ~1,2s, bước 2 sau ~3s, dừng ở bước 3 ("Lấy dữ liệu từ cơ sở dữ liệu") và **không bao giờ đánh dấu bước 4 hoàn tất trước khi nhận phản hồi**; khi phản hồi về, thay thẻ bằng kết quả. Ghi chú trong mã (`loading.js`): "mô phỏng, không phản ánh tiến trình thật". Không hiện phần trăm, không đếm thời gian giả.
- Vùng `role="status"` chỉ đọc "Đang xử lý câu hỏi" một lần (không đọc từng bước); tắt xoay khi `prefers-reduced-motion`. Khóa nút Hỏi (đã có) trong lúc chờ.
- Bảng ánh xạ lỗi:

| Nguồn | Thẻ | Nút | Ghi chú |
|---|---|---|---|
| 200 + `OUT_OF_SCOPE` | Không thể thực hiện yêu cầu này (cam) | "Hỏi: <1 câu từ examples>" | message server |
| 200 + `clarification` | Cần làm rõ thêm (xanh nhạt) | không (focus ô nhập) | không có nút nhanh |
| 200 + `row_count=0` | Không có dòng nào phù hợp (xám) | "Xem câu SQL đã chạy" | chữ tĩnh của client |
| 429 `RATE_LIMITED` | Bạn hỏi hơi nhanh (cam) | tự mở khóa khi hết đếm lùi | 4.1 mục 4 |
| 504 `DB_TIMEOUT` | Không lấy được dữ liệu (đỏ, `role="alert"`) | "Sửa câu hỏi" | |
| 503 `DB_UNAVAILABLE` / `LLM_UNAVAILABLE`, `NETWORK`, `HTTP` | Hệ thống tạm thời không phản hồi (đỏ) | "Thử lại" | giữ câu hỏi cuối |
| 400 `SQL_REJECTED` | Chưa tạo được truy vấn phù hợp (đỏ) | "Sửa câu hỏi" | rút gọn `message`, không in nội bộ dài |
| 422/413 `INVALID_INPUT` | Câu hỏi chưa hợp lệ (đỏ nhạt) | "Sửa câu hỏi" | chặn trước ở client: rỗng, >300 |

### 5.4 "Gợi ý tiếp" rẻ, không gọi LLM
Nguồn: **quy tắc client + `/api/examples` đã tải sẵn**, sinh tối đa 3 chip sau mỗi kết quả thành công. Bấm chip = gửi một câu hỏi bình thường (có tốn 1 lượt giới hạn tốc độ và 1 lượt LLM do **người dùng chủ động**, không phải gợi ý tự gọi).
1. Nếu kết quả là 1 cột nhóm + 1 cột số (≤8 dòng, số không âm) và chưa phải biểu đồ tròn: "Vẽ biểu đồ tròn" -> gửi `"<câu gốc đã bỏ đuôi vẽ biểu đồ>, vẽ biểu đồ tròn"`.
2. Nếu có cột thời gian và chưa là line: "Vẽ biểu đồ đường"; nếu 1 nhóm + 1 số mà chưa có biểu đồ: "Vẽ biểu đồ cột".
3. Điền tiếp bằng câu trong `/api/examples` **chưa hỏi trong phiên** (so sánh bỏ dấu/hoa thường) cho đủ 3.
- Câu ghép luôn đầy đủ (≤300 ký tự, cắt phần đầu nếu dài), không phụ thuộc LLM nhớ ngữ cảnh. Không sinh chip có nghĩa nghiệp vụ tự nghĩ ra ("chỉ tính đã ký").
- P2 tùy chọn: ô "Đổi dạng biểu đồ" đổi bar/hbar/pie ngay ở client trên cùng `rows` (không tốn lượt nào). Không làm ở đợt đầu.

### 5.5 Lịch sử câu hỏi (localStorage)
- Khóa `t2s.history.v1`; mảng tối đa **20** mục `{q: string(≤300), t: epoch_ms}`; trùng câu thì đưa lên đầu; chỉ lưu khi lượt trả lời **thành công** (có `sql`, không phải từ chối/hỏi lại/lỗi); bỏ qua câu có ≥9 chữ số liên tiếp hoặc `@`.
- **Không lưu** `rows`, `sql`, `explanation` hay phản hồi nào. Kết quả đã xem giữ trong bộ nhớ phiên (một `Map` có tối đa 20 phần tử) để bấm lại hiện ngay; tải lại trang thì chỉ còn câu hỏi và phải hỏi lại.
- Mọi `getItem/setItem/removeItem` bọc `try/catch` (chế độ riêng tư, bị chặn, đầy dung lượng); dữ liệu đọc ra được kiểm tra (`Array.isArray`, kiểu chuỗi, cắt độ dài) rồi mới dùng; hỏng thì coi như rỗng. Ứng dụng phải chạy bình thường khi localStorage không dùng được (thanh bên hiện "Chưa có câu hỏi nào…").
- Render bằng `textContent`. Nút "Xóa lịch sử" có xác nhận nhẹ (một lần bấm thứ hai trong 3 giây hoặc `confirm`-free dialog); không dùng `alert/confirm` (smoke.js coi dialog là lỗi).
- Đồng bộ giữa các tab: lắng nghe sự kiện `storage` (P3).

### 5.6 CSV và sao chép SQL
- CSV: BOM `﻿` ở đầu (Excel đọc tiếng Việt đúng), dòng `\r\n`, bao `"…"` và nhân đôi `"` khi có `,` `"` hoặc xuống dòng; `null` -> rỗng; boolean -> `true/false` (không dịch "Có/Không" để máy đọc được); ngày giữ nguyên chuỗi; số xuất **thô** (không định dạng vi-VN) để Excel/Sheets tính được. **Chống CSV injection:** ô kiểu `string` bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR thì thêm tiền tố `'`. Tạo `Blob` `text/csv;charset=utf-8`, `URL.createObjectURL`, `a[download]`, rồi `revokeObjectURL`. Tên file `ket-qua-YYYYMMDD-HHmm.csv`. Nếu `truncated`, thêm vào thông báo cạnh nút: "CSV gồm 500 dòng đầu".
- Sao chép SQL: xem hàng 11, mục 3.

### 5.7 A11y (bắt buộc, kiểm bằng Playwright ở mục 6)
- Tab: `role="tablist"` > `role="tab"` (`aria-selected`, `aria-controls`, `id`, **roving tabindex**: tab chọn `tabindex=0`, còn lại `-1`) > `role="tabpanel"` (`aria-labelledby`, `hidden` khi không chọn, `tabindex="0"`). Bàn phím: ←/→ chuyển và kích hoạt, Home/End về đầu/cuối.
- Landmark: một `<main>`, thanh bên là `<aside>` có `<nav aria-label="Câu hỏi gần đây">`, một `<h1>` mỗi màn hình (hero ở home; "Hỏi dữ liệu bất động sản" ở thread), thẻ trạng thái dùng `<h2>`.
- Mục lịch sử đang xem có `aria-current="true"`. Lỗi: `role="alert"`; kết quả mới/đếm lùi: `role="status"` `aria-live="polite"`; chuyển lượt mới thì đưa focus vào tiêu đề thẻ kết quả (`tabindex="-1"`) hoặc giữ ở ô nhập nhưng thông báo "Đã có kết quả: N dòng" qua status (chọn một, nhất quán).
- Ngăn kéo mobile và dialog schema dùng `<dialog>` + `showModal()` (bẫy focus, Esc, trả focus có sẵn); có nút đóng 44px.
- Tương phản: bảng token mục 1 đã đạt ≥4,5:1 cho mọi chữ; viền ô nhập ≥3:1 theo `--line-input`; kiểm bằng axe-core nếu có thể (tùy chọn) hoặc script tính tương phản trong e2e.
- `lang="vi"`, `<label>` cho textarea (mobile dùng nhãn ẩn thị giác nhưng vẫn có), `prefers-reduced-motion`.
- Enter gửi, Shift+Enter xuống dòng, **bỏ qua khi `e.isComposing`** (gõ Telex/VNI bằng IME): lỗi tiềm ẩn ở `main.js` hiện tại phải sửa.

### 5.8 Mobile (390px)
- `<meta viewport>` giữ; dùng `100dvh`, `min-width:0`, `overflow-wrap:anywhere` cho bong bóng/tiêu đề; **không** thẻ nào có `min-width` lớn hơn khung ngoài trừ vùng cuộn riêng (bảng, khối SQL) nằm trong khung `overflow-x:auto`.
- Header 56px: logo + nút ☰ 44×44 "Lịch sử câu hỏi" mở ngăn kéo (bố cục như thanh bên, gồm "Câu hỏi mới", danh sách, "Xem cấu trúc dữ liệu").
- Ô nhập dính đáy (`position: sticky; bottom: 0`, `padding-bottom: calc(16px + env(safe-area-inset-bottom))`), textarea 16px, nút gửi 48×48. Tự giãn 1-5 dòng.
- Home trên mobile: hero 28px, thẻ gợi ý 1 cột.
- Hàng nút hành động xuống dòng (`flex-wrap`), mỗi nút ≥44px.

### 5.9 Chống XSS
- Mọi chuỗi từ API, LLM, localStorage, người dùng (câu hỏi, `explanation`, `clarification`, `message`, nhãn biểu đồ, ô bảng, `sql`, danh sách cột) chỉ được gán bằng `textContent`/`setAttribute` với giá trị đã biết. **Cấm `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`** trong `frontend/js` (kiểm bằng `grep` trong CI/nghiệm thu). Icon SVG tĩnh dựng bằng hàm tạo phần tử, không ghép chuỗi chứa dữ liệu.
- Nhãn Chart.js được vẽ lên canvas nên an toàn. `aria-label` tạo từ dữ liệu cũng gán qua `setAttribute` (không gây thực thi).
- Thêm `<meta http-equiv="Content-Security-Policy">` tối thiểu: `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'` (nếu cần `API_BASE` khác origin thì thêm riêng). Không dùng style/script inline để CSP này chạy được; style động đặt qua `element.style.setProperty` (được phép) hoặc class.

## 6. Việc cho DEV (theo thứ tự) và tiêu chí nghiệm thu

Quy ước: mỗi bước một commit nhỏ, `pytest` backend và `node frontend/e2e/smoke.js` (với `DEMO_MODE=true`) phải xanh sau **mỗi** bước. Không sửa file trong `backend/app`.

| Bước | Việc | Tiêu chí nghiệm thu (đo được) |
|---|---|---|
| **D1** | Token + nền tảng: `tokens.css`, `base.css`, bỏ dark mode, nạp font tự lưu, thêm CSP meta, tách module (`dom.js`, `format.js`) | Không còn mã hex ngoài `tokens.css` (`grep -E '#[0-9a-fA-F]{3,6}' frontend/css | grep -v tokens.css` rỗng, trừ `chart.js` có hằng dự phòng); không có request tới `fonts.googleapis.com`/`gstatic` (Playwright `page.on('request')`); `grep -rnE "innerHTML|insertAdjacentHTML|outerHTML|document\.write|eval\(" frontend/js` rỗng |
| **D2** | Layout home (Empty) + thanh bên + chân thanh bên + huy hiệu chỉ đọc/demo (`getHealth`) | Home hiện h1, ô nhập, ≥4 thẻ "Thử hỏi" từ API, câu riêng tư về khách hàng; thanh bên 272px ở 1440px; mobile 390px: không `scrollWidth > innerWidth`; với `demo=true` hiện huy hiệu demo và **không** hiện chữ "Chỉ đọc"; không còn chữ "1.793"/"08/11/2026" trong DOM |
| **D3** | Luồng hỏi: máy trạng thái home<->thread, bong bóng câu hỏi + thẻ kết quả theo thời gian, "Câu hỏi mới" reset history/Chart, validate trước khi gửi, IME-safe Enter, timeout 45s, loading mô phỏng | Sau hỏi, DOM đổi sang thread, kết quả mới nằm cuối; "Câu hỏi mới" quay về home và lần hỏi kế gửi `history=[]` (kiểm bằng `page.route` ghi body); Enter khi `isComposing` không gửi; loading không bao giờ hiện bước 4 hoàn tất khi API chưa trả (mock trì hoãn 6s) |
| **D4** | Tab Biểu đồ/Bảng/SQL (ARIA đầy đủ), bảng theo token, khối SQL, Sao chép SQL, Tải CSV | Tab chuyển bằng chuột và ←/→/Home/End; chỉ 1 tab `tabindex=0`; tab Biểu đồ vắng khi `chart=null`; CSV tải được: bắt `download` event, file bắt đầu bằng BOM, ô `=1+1` thành `'=1+1`, số xuất thô; sao chép ghi đúng `sql` vào clipboard (cấp quyền `clipboard-read`) hoặc fallback chạy không lỗi |
| **D5** | Biểu đồ Chart.js theo mục 5.2 cho đủ 5 loại bar/hbar/line/pie/scatter (+ doughnut, grouped_bar) | Với mock `chart` từng loại: canvas hiện, không lỗi console; bar/hbar có đúng 1 cột màu `#B45309` (đọc `chart.data.datasets[0].backgroundColor`) còn lại `#0E5A4B`; canvas có `role="img"` + `aria-label` khác rỗng; ≤480px nhãn dài bị cắt ≤17 ký tự; `chart.destroy` được gọi khi "Câu hỏi mới" (số `Chart.instances` = 0) |
| **D6** | Lịch sử localStorage + "Câu hỏi mới" + ngăn kéo mobile | Hỏi 25 câu -> lưu đúng 20; tải lại trang vẫn còn danh sách; `localStorage` bị chặn (ghi đè `getItem/setItem` ném lỗi) thì trang vẫn hoạt động; không có `rows`/`sql` trong giá trị đã lưu; câu có SĐT/`@` và câu lỗi/bị từ chối không được lưu; mục lịch sử là `<button>` cao ≥44px |
| **D7** | 6 trạng thái theo bảng 5.3, bộ đếm 429 ước lượng, "Gợi ý tiếp" (5.4), dialog "Xem cấu trúc dữ liệu" (`getSchema`) | Mock từng mã lỗi -> đúng thẻ, đúng nút (bảng 5.3), `role="alert"` ở lỗi hệ thống; 429 khóa nút Hỏi rồi mở khóa; clarification focus vào ô nhập; gợi ý tiếp ≤3 chip và **không** có request mạng nào phát sinh cho đến khi bấm (đếm request `/api/query`); dialog mở/đóng bằng Esc, focus trả về nút; toàn bộ chữ hiển thị là tiếng Việt |
| **D8** | Hoàn thiện a11y + e2e + cập nhật tài liệu | Mọi mục 7 (bộ Playwright) xanh; chạy `DEMO_MODE=true` ở 1440px và 390px; ảnh chụp lưu vào `docs/screenshots/` (ghi đè ảnh cũ nếu trùng tên); cập nhật `docs/screenshots` và README (chỉ lệnh chạy e2e) |

## 7. Bộ kiểm thử Playwright cần viết

Mở rộng `frontend/e2e/smoke.js` (giữ các kiểm tra cũ, chỉnh selector nếu bắt buộc) và thêm `frontend/e2e/ui.js` (cùng cách chạy: `DEMO_MODE=true`, `BASE_URL`). Lỗi JS/dialog/console.error đều làm test đỏ. Dùng `page.route('**/api/query', …)` để giả lập các mã lỗi và phản hồi chart cụ thể (không phụ thuộc DEMO_MODE).

1. **Trang chủ**: tải `/` -> thấy `h1` chứa "Hỏi dữ liệu bất động sản", ô nhập, nút Hỏi, ≥4 `.chip` từ `/api/examples`, đoạn "khách hàng" về dữ liệu cá nhân; **không** có thanh tab/thẻ kết quả; không có chữ "1.793"; `document.fonts` không gọi domain ngoài.
2. **Hỏi -> kết quả**: bấm một thẻ gợi ý hoặc gõ "Vẽ biểu đồ số lead theo nguồn" -> có bong bóng câu hỏi, thẻ có dòng "N dòng · x,y giây", tab Biểu đồ được chọn, 1 canvas; mục lịch sử mới xuất hiện ở thanh bên; "Câu hỏi mới" quay về trang chủ.
3. **Tab**: Bảng hiện `tbody tr > 3`, SQL chứa `sales_clean`, phím mũi tên/Home/End hoạt động, `aria-selected` đồng bộ với `hidden` của tabpanel. Câu không yêu cầu vẽ -> không có tab Biểu đồ, mặc định tab Bảng, không có canvas (giữ kiểm tra cũ "không vẽ biểu đồ khi không yêu cầu").
4. **Hành động**: Sao chép SQL (clipboard bằng đúng SQL), Tải CSV (bắt `download`, kiểm BOM + tiêu đề cột + tiền tố chống injection bằng route giả lập chứa `=cmd`).
5. **Trạng thái lỗi** (mock route): `OUT_OF_SCOPE` (200), clarification (200, `sql=null`), 0 dòng, 429, 504, 503 (`LLM_UNAVAILABLE`), mạng đứt (`route.abort()`), 422. Mỗi trạng thái đúng tiêu đề thẻ, đúng nút; nút "Thử lại" gửi lại đúng câu hỏi cuối; không dùng `alert`.
6. **Loading**: route trì hoãn 3s -> thấy "Đang xử lý câu hỏi…", nút Hỏi bị khóa, bước cuối chưa hoàn tất; sau khi trả -> thẻ kết quả thay thế.
7. **Biểu đồ**: mỗi loại `bar|hbar|line|pie|doughnut|scatter|grouped_bar` render không lỗi; màu cột lớn nhất `#B45309`, còn lại `#0E5A4B`.
8. **Lịch sử**: giới hạn 20, bền sau tải lại, không lưu câu lỗi/PII, hoạt động khi localStorage ném lỗi.
9. **Mobile 390px**: `document.documentElement.scrollWidth <= innerWidth` ở: trang chủ, kết quả bảng (cuộn trong khung, không cuộn trang), kết quả biểu đồ hbar 9 nhóm và pie, mỗi trạng thái lỗi, ngăn kéo lịch sử mở; ô nhập `font-size` tính toán ≥16px; các nút/tab/chip tương tác có `boundingBox().height >= 44`; ngăn kéo mở bằng ☰, Esc đóng.
10. **XSS**: giữ ca "xss test" cũ; thêm mock trả `explanation`, `clarification`, `message`, nhãn chart, tên cột, `sql` chứa `<img src=x onerror=window.__xss=1>` và `"><script>…`; khẳng định `window.__xss === undefined`, không có `img`/`script` do dữ liệu sinh ra, và văn bản hiển thị đúng như chữ; câu hỏi người dùng chứa HTML cũng hiển thị như chữ ở bong bóng và thanh bên.
11. **A11y cơ bản**: Tab-key đi hết các control theo thứ tự hợp lý, focus nhìn thấy (outline tính toán khác `none`), `<dialog>` trả focus; tương phản chữ chính/phụ theo bảng token (so từ computed style).
12. **Demo**: với `/health` mock `demo=true` -> huy hiệu demo; `demo=false` -> "Chỉ đọc · Không thể sửa dữ liệu".

## 8. Những điều KHÔNG được làm

- Không đổi hợp đồng API (tên trường, mã lỗi, status, kiểu `chart`, độ dài giới hạn) và không sửa `backend/app` trong đợt này. Hai đề xuất BE tùy chọn (header `Retry-After`; `row_count`/`as_of` trong `/api/schema`) chỉ làm khi PO yêu cầu riêng, thêm vào (additive), có test pytest, và FE vẫn phải chạy nếu thiếu.
- Không gọi LLM/API thêm để sinh "Gợi ý tiếp", tiêu đề lịch sử, hay tóm tắt; không gọi `/api/query` tự động (prefetch/polling).
- Không thêm framework/bundler/thư viện (React, Vue, Tailwind, jQuery, chartjs-plugin-datalabels, axios, v.v.), không CDN lúc chạy; font và Chart.js đều phục vụ từ `frontend/`.
- Không bịa tiến trình thật cho loading, không bịa số liệu (số giao dịch, ngày, tổng, tỷ trọng, "24 giây", "5 giây", "10 câu") không có trong API.
- Không dùng `innerHTML` và tương đương với bất kỳ dữ liệu nào; không `alert/confirm/prompt`.
- Không lưu kết quả truy vấn, SQL hay dữ liệu nhạy cảm vào localStorage/IndexedDB/cookie; không ghi log câu hỏi người dùng ra console; không gửi dữ liệu tới bên thứ ba.
- Không xóa/sửa/nới lỏng test hiện có để cho qua (`backend/tests/**`, `frontend/e2e/smoke.js` chỉ được cập nhật selector khi giao diện đổi, giữ nguyên ý nghĩa mọi kiểm tra); không giảm giới hạn 300 ký tự, `maxlength`, `history ≤ 3`.
- Không commit bí mật (`.env`, `GROQ_API_KEY`, `DATABASE_URL`, token); không đưa URL/khóa thật vào `config.js`, ảnh chụp màn hình hay tài liệu.
- Không làm VarB/VarC, chế độ tối, hay các tính năng ngoài thiết kế (ghim, chia sẻ, đăng nhập, xuất PDF).
- Không để lộ tên nhân viên/mã khách trong tài liệu mẫu, ảnh chụp màn hình dùng dữ liệu thật; ảnh chỉ chụp từ `DEMO_MODE`.
- Không mô tả giao diện là "chỉ đọc" khi `demo=true`.

## 9. Chấp nhận cuối (checklist cho người duyệt)

- [ ] Trang chủ giống `Empty.dc.html` (token, bố cục, nội dung đã chỉnh theo mục 4).
- [ ] Kết quả có biểu đồ giống `Main.dc.html`: thanh ngang `#0E5A4B`, cột lớn nhất `#B45309`, 3 tab, hai nút hành động, gợi ý tiếp.
- [ ] 6 trạng thái giống `States.dc.html` với nội dung trung thực (mục 4.1).
- [ ] Mobile 390px giống `Mobile.dc.html`, không cuộn ngang.
- [ ] Mọi nghiệm thu D1-D8 và bộ Playwright mục 7 xanh; `pytest` backend vẫn xanh; không file nào ngoài `frontend/` và `docs/` bị đổi.
