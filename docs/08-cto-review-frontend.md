# 08 – Duyệt cuối frontend (CTO/BA, Agent 4)

Người duyệt: Agent 4, reviewer độc lập. Đã tự chạy mọi lệnh và tự xem ảnh chụp riêng (deviceScaleFactor 1, 1440 và 390), không dựa vào báo cáo docs/07. Nhánh `claude/bold-meitner-kla168`.

## 0. Kết luận: GO WITH CONDITIONS

Không có BLOCKER. Giao diện đúng thiết kế hướng A, an toàn XSS/CSP, tích hợp backend đúng, test xanh. Tôi đã sửa 2 lỗi nhỏ (1 MAJOR UX mobile, 1 MINOR riêng tư), commit `86b6cb7`. Điều kiện trước khi gọi là "xong":

1. User xem và chốt bảng 8 màu `--series-1..8` (mục 5) và các chỗ khác thiết kế gốc.
2. Chạy thử một lần với Groq/DB thật (chưa kiểm chứng, tôi bị cấm gọi) và trên Safari/iOS thật.
3. Xử lý hoặc chấp nhận có chủ đích các MINOR còn mở ở mục 3.

## 1. Bảng truy vết (docs/06 mục 6 và 7)

| Mục | Bằng chứng tôi tự kiểm | Kết quả |
|---|---|---|
| D1 token/CSP/font | `tokens.css` là nơi duy nhất có hex (e2e kiểm tĩnh + tôi grep); không request ra ngoài (không `requestfailed`, không CSP violation); grep `innerHTML/outerHTML/insertAdjacentHTML/document.write/eval/new Function` trong `frontend/js` + `index.html`: rỗng; không `<style>`/`style=`/script inline | Đạt |
| D2 home + sidebar + huy hiệu | Ảnh `d-home.png`/`m-home.png`: h1, ô nhập, 6 thẻ "Thử hỏi" từ `/api/examples`, câu về khách hàng; sidebar 272px; huy hiệu demo cam khi `demo=true`; test `demo=false` hiện "Chỉ đọc"; không còn "1.793"/"08/11/2026" | Đạt |
| D3 luồng hỏi | home -> thread, "Câu hỏi mới" quay home; IME: sự kiện Enter `isComposing/keyCode 229` không tạo lượt (4 -> 4); loading mô phỏng (đọc `loading.js`: bước 4 không bao giờ done) | Đạt (IME thật chưa thử) |
| D4 tab/bảng/SQL/CSV | Tab ARIA + phím (e2e); CSV bắt `download`: có BOM, `\r\n`, ô `=cmd`, `-5`, `@x` thành `'=cmd`, `'-5`, `'@x`, số thô | Đạt |
| D5 biểu đồ | Ảnh bar(hbar)/line/pie desktop+mobile: cột lớn nhất `#B45309`, còn lại `#0E5A4B`, nhãn giá trị, chú giải; e2e kiểm 7 loại | Đạt (scatter/doughnut/grouped_bar chỉ qua e2e mock, tôi không xem ảnh) |
| D6 lịch sử | 25 câu -> 20 mục; chỉ `{q,t}`; localStorage ném lỗi: trang vẫn chạy, không lỗi JS; câu có SĐT/`@` không lưu (xem MAJOR-1 đã sửa) | Đạt sau sửa |
| D7 6 trạng thái | Tôi mock 11 phản hồi (OUT_OF_SCOPE, clarification, 0 dòng, 429, 504, 503 DB, 503 LLM, 400, 422, 413, 500 HTML): đúng tiêu đề/nút/`role=alert`, không cuộn ngang ở 390 | Đạt |
| D8 e2e + tài liệu | `ui.js` 191 PASS, `smoke.js` 12/12; README có lệnh e2e | Đạt |
| N1 trang chủ | ảnh + e2e | Đạt |
| N2 hỏi -> kết quả | ảnh bar/line/pie/hbar | Đạt |
| N3 tab | ảnh Bảng/SQL; e2e phím | Đạt |
| N4 hành động | CSV tôi tự bắt; sao chép SQL: e2e (nhánh `execCommand` chưa chạy riêng) | Đạt một phần |
| N5 lỗi | như D7 | Đạt |
| N6 loading | đọc mã + e2e (tôi không tự chụp) | Đạt (tin e2e) |
| N7 biểu đồ | như D5 | Đạt |
| N8 lịch sử | như D6 | Đạt |
| N9 mobile 390 | `scrollWidth==innerWidth` ở home, hbar, pie, line, bảng, SQL, ngăn kéo, 11 trạng thái; textarea 16px; không phần tử tương tác nào <44px (chỉ textarea desktop cao 32px, không áp dụng cho mobile) | Đạt sau sửa bảng |
| N10 XSS | tiêm `<img onerror>` + `"><script>` vào câu hỏi, `explanation`, tên cột, ô bảng, `sql`, tiêu đề/nhãn/trục biểu đồ: `window.__xss` undefined, 0 `img`, 0 script inline, hiển thị thành chữ | Đạt |
| N11 a11y cơ bản | e2e (Tab, focus, dialog, tương phản); tôi không chạy axe-core | Đạt (tin e2e), axe chưa kiểm |
| N12 demo | `/health` thật `demo=true` -> huy hiệu demo; mock `false`/lỗi -> "Chỉ đọc". Demo không bật mặc định (`DEMO_MODE` chỉ qua biến môi trường, README cảnh báo) | Đạt |

## 2. Kết quả lệnh (chạy thật)

- venv `.venv` (gitignore), `pip install -r backend/requirements-dev.txt`.
- `ruff check .`: `All checks passed!`; `ruff format --check .`: `36 files already formatted`.
- `pytest -q`: `136 passed, 1 warning`.
- Backend `DEMO_MODE=true RATE_LIMIT=1000/minute`, Chromium của Playwright, qua HTTP: `smoke.js` 12/12 PASS; `ui.js` trước sửa `190 PASS, 0 FAIL`, sau sửa `191 PASS, 0 FAIL` (thêm 2 kiểm tra hồi quy, 1 bị thay bằng cặp tương đương).
- 429 thật (backend demo, limit mặc định): 10 yêu cầu 200, yêu cầu 11-12 -> `429 {"error":{"code":"RATE_LIMITED",...}}`; không có header `Retry-After` (frontend có đường lui ước lượng 60s).
- Mô phỏng container (`/tmp/.../app/{backend/app,frontend}`, cwd `backend`, uvicorn): `/`, `/css/tokens.css`, `/css/fonts.css`, `/js/main.js`, `/fonts/*.woff2`, `/vendor/chart.umd.min.js`, `/fonts/OFL.txt`: tất cả 200; content-type đúng (`text/html`, `text/css`, `text/javascript`, `font/woff2`). `FRONTEND_DIR = parents[2]/frontend` khớp Dockerfile (`COPY frontend frontend`, WORKDIR `/app/backend`).
- Console/CSP: 0 `securitypolicyviolation`, 0 lỗi/cảnh báo console ở desktop và mobile (chỉ có dòng "Failed to load resource" do trình duyệt tự in cho mã 4xx/5xx khi mock). CSP meta không chặn tài nguyên hợp lệ; backend không gửi header CSP nên không mâu thuẫn.
- Quét bí mật: `frontend/`, docs 06-08, README, toàn bộ lịch sử git: không có khóa `gsk_`, JWT `eyJ`, chuỗi `postgresql://user:pass@` thật (chỉ có fixture test và placeholder `<MAT_KHAU>`); `service_role` chỉ xuất hiện trong câu "không dùng". Font có `OFL.txt` (SIL OFL 1.1), Chart.js có `chart.js.LICENSE.md` (MIT). Không file backend/db nào bị đổi so với commit duyệt thiết kế (chỉ README, đúng D8).

## 3. Vấn đề

### Đã sửa (commit 86b6cb7)

- **MAJOR-1 (mobile) `frontend/css/components.css:312`**: `min-width: 420px` làm bảng 2 cột vẫn tràn ở 390px, cột số (`so_lead`) bị đẩy ra ngoài khung, người dùng không thấy số nếu không biết vuốt. Đã bỏ `min-width`; bảng nhiều cột vẫn cuộn trong khung. Test mới ở `ui.js` nhóm 9.
- **MINOR-1 (riêng tư) `frontend/js/history.js` `looksPersonal`**: chỉ bắt >=9 chữ số liền, nên `0912 345 678` bị lưu vào localStorage. Đã thêm mẫu SĐT Việt có dấu cách/chấm/gạch/+84. Test mới ở `ui.js` nhóm 8.

### Còn mở (không chặn)

- **MINOR-2 `Dockerfile` (`COPY frontend frontend`)**: thư mục `frontend/e2e/` cũng được phục vụ công khai (`GET /e2e/ui.js` = 200). Không lộ bí mật nhưng thừa. Cách sửa: thêm `.dockerignore` loại `frontend/e2e`, hoặc `COPY` từng thư mục con.
- **MINOR-3 `frontend/index.html:6`**: CSP chỉ ở meta nên không có `frame-ancestors` (meta không hỗ trợ). Cách sửa nếu cần chống nhúng khung: thêm header `X-Frame-Options`/CSP từ backend (cần sửa backend, ngoài phạm vi).
- **MINOR-4**: không có `Retry-After` từ backend nên đếm lùi 429 là ước lượng (đúng như tài liệu, đã thông báo "khoảng"). Đề xuất BE tùy chọn đã nêu ở docs/06.
- **MINOR-5 `frontend/js/main.js` `submitQuestion`/`openHistory`**: khi đang xử lý hoặc đang bị khóa 429, bấm thẻ gợi ý/chip/mục lịch sử không làm gì và không có phản hồi (return im lặng). Nên hiện thông báo ngắn qua `showFormMsg`.
- **MINOR-6 (ngữ nghĩa) `chart.js` `highestCaption`**: biểu đồ đường cũng hiện "Cao nhất: 2026-06 (310.200.000.000)", số không rút gọn như trục (`310,2 tỷ`). Chấp nhận được; có thể dùng `shortNumber`.
- **NIT**: tiêu đề cột bảng là tên cột kỹ thuật (`nguon_lead`) như thiết kế gốc.
- Nợ đã biết của dev (đã đọc, đồng ý): dữ liệu demo không sắp xếp giảm dần; chưa có đồng bộ lịch sử giữa tab (P3) và "Đổi dạng biểu đồ" (P2).

## 4. Khác thiết kế gốc, cần user xem lại

Tôi dựng lại Main/States gốc (chữ đặt chỗ `{{...}}` chưa được điền nên chỉ so bố cục) và so với ảnh của tôi. Màu nền kem, xanh `#0E5A4B`, cam `#B45309`, bố cục sidebar 272px, thẻ trạng thái, thanh bên mobile đều khớp. Khác biệt thật:

1. Đã loại có chủ đích (đúng docs/06): "1.793 giao dịch · đến 08/11/2026", cột "Tỷ trọng", "Tổng 1.793", nút trả lời nhanh của "Hỏi lại", chip "Chỉ tính nguồn đã ký", "24 giây/10 câu/5 giây", nhãn "Một con số/Bảng so sánh".
2. Thẻ trạng thái "Cần làm rõ": thiết kế có hai nút trả lời nhanh, bản dựng chỉ có dòng "Gõ câu trả lời ở ô bên dưới" (ô nhập được focus).
3. Thẻ "Không có dòng nào phù hợp" kèm nút "Sao chép SQL" và hàng "Gợi ý tiếp"; thiết kế chỉ có liên kết "Xem câu SQL đã chạy". Hợp lý nhưng khác.

5. Khối SQL dùng font monospace hệ thống thay JetBrains Mono (theo docs/06).
6. Biểu đồ cột không có tiêu đề trục; bản demo hiển thị nhãn giá trị ở cuối cột (không có trong ảnh thiết kế vì thiết kế không có biểu đồ thật).
7. **Bảng 8 màu `--series-1..8` (cần user chốt)**: `#0E5A4B, #B45309, #2F7D9A, #7A5C9E, #6B7A1E, #B0405A, #5B6862, #3B6EA5`. Tương phản trên nền trắng tôi tính: 8,13 / 5,02 / 4,65 / 5,45 / 4,74 / 5,63 / 5,83 / 5,30 (đều >=4,5). Lưu ý: (a) bảng này là đề xuất của docs/06, **không có trong thiết kế gốc**; (b) `series-7` trùng đúng màu chữ phụ `--muted` (xám) nên trông như "không có dữ liệu"; (c) `series-3` (xanh ngọc) và `series-8` (xanh dương) gần nhau, dễ nhầm với người mù màu; (d) `series-2` cam cũng là màu nhấn cột lớn nhất, nên ở pie/grouped_bar màu cam không còn mang nghĩa "lớn nhất". Pie demo (5 lát) nhìn rõ và dễ đọc.

## 5. Việc còn chờ user

- Chốt bảng 8 màu (mục 4.7) và quyết định có muốn thêm lại 2 nút trả lời nhanh cho "Cần làm rõ" không (cần backend trả gợi ý).
- Chạy thử với Groq/DB thật; thử Safari/iOS, Firefox, bộ gõ Telex/VNI thật, trình đọc màn hình, axe-core (tôi chưa kiểm chứng các mục này).
- Quyết định MINOR-2 (loại `frontend/e2e` khỏi image) và MINOR-3 (header chống nhúng khung).
- Nếu muốn ảnh trong `docs/screenshots/` làm tài liệu: lưu ý ảnh chart/bảng dùng số liệu mô phỏng, không phải dữ liệu thật. Ảnh của tôi nằm ở scratchpad, không commit.
