# 07 – Báo cáo DEV frontend (UI hướng A)

Người viết: Agent 3 (Senior Frontend Dev). Phạm vi: chỉ `frontend/`, `docs/`, và 1 đoạn lệnh e2e trong `README.md` (theo D8). Không sửa `backend/`.

## 1. Đã làm theo D1..D8

| Bước | Nội dung | Nơi |
|---|---|---|
| D1 | `tokens.css` (mọi mã màu), `base.css`, bỏ chế độ tối, font Be Vietnam Pro tự lưu (12 file woff2 + `fonts.css` + `OFL.txt`), CSP meta, `dom.js` (`el`, `icon`), `format.js` | `frontend/css`, `frontend/fonts`, `frontend/js` |
| D2 | Trang chủ (hero, ô nhập, thẻ "Thử hỏi" từ `/api/examples`, câu về khách hàng), thanh bên 272px, `getHealth` + huy hiệu chỉ đọc/demo, bỏ "1.793" và "08/11/2026" | `index.html`, `layout.css`, `main.js`, `api.js` |
| D3 | Máy trạng thái home<->thread, bong bóng + thẻ theo thời gian, "Câu hỏi mới" xóa history gửi BE và hủy Chart, validate, Enter bỏ qua `isComposing`, timeout 45s, loading mô phỏng (`loading.js`) | `main.js`, `loading.js`, `api.js` |
| D4 | Tab ARIA (roving tabindex, ←/→/Home/End), bảng, khối SQL tô từ khóa bằng `createElement`, Sao chép SQL (có fallback), Tải CSV (BOM, chống injection) | `results.js`, `table.js`, `csv.js` |
| D5 | Chart.js theo mục 5.2: cột lớn nhất `#B45309`, còn lại `#0E5A4B`, nhãn giá trị bằng plugin inline, 7 loại biểu đồ, `role=img`+`aria-label`, cắt nhãn mobile 16 ký tự, `destroy` | `chart.js` |
| D6 | Lịch sử localStorage (`t2s.history.v1`, 20 mục, chỉ lưu câu hỏi, bỏ câu có >=9 chữ số/`@`), ngăn kéo mobile bằng `<dialog>` | `history.js`, `main.js` |
| D7 | 6 trạng thái (`states.js`), đếm lùi 429 ước lượng (ưu tiên `Retry-After` nếu có), gợi ý tiếp bằng quy tắc client (`followups.js`), dialog cấu trúc dữ liệu (`schema-dialog.js`) | |
| D8 | `e2e/ui.js` (12 nhóm + kiểm tĩnh D1), cập nhật `e2e/smoke.js` (đổi selector, giữ nguyên ý nghĩa), README, ảnh chụp | |

Thư mục `frontend/css/style.css` cũ đã xóa (không còn hai hệ màu).

## 2. Kết quả test (chạy thật)

- `pytest` backend: **136 passed**; `ruff check` và `ruff format --check`: sạch.
- `node frontend/e2e/smoke.js`: **12/12 PASS** (đổi selector: `details pre` -> tab SQL, `#status .banner.info` -> thẻ trạng thái).
- `node frontend/e2e/ui.js`: **190 PASS, 0 FAIL** (server `DEMO_MODE=true RATE_LIMIT=1000/minute`, Chromium của Playwright, qua HTTP). Gồm 12 nhóm của docs/06 mục 7 + kiểm tĩnh D1 (không `innerHTML`/tương đương, không hex ngoài `tokens.css`, có CSP, không style/script inline).
- Mobile 390px: không cuộn ngang ở trang chủ, bảng, hbar, pie, 6 trạng thái, ngăn kéo; textarea 16px; nút/tab/chip/mục lịch sử >= 44px.
- Một số kịch bản dùng `page.route` giả lập `/api/query` (lỗi, chart từng loại, XSS), theo đúng yêu cầu tài liệu; phần còn lại chạy qua backend DEMO thật.

Chưa kiểm chứng: Groq/DB thật; Safari/iOS và Firefox (chỉ Chromium); bộ gõ IME thật (chỉ giả lập `isComposing`); axe-core; trình đọc màn hình thật; hành vi clipboard ở HTTP không an toàn (chỉ chạy nhánh secure-context, nhánh `execCommand` chưa chạy riêng). Từng commit D1..D8 không được chạy lại toàn bộ test riêng lẻ; chỉ trạng thái cuối được kiểm.

## 3. Ảnh chụp (`docs/screenshots/`, từ DEMO_MODE; nội dung truy vấn trong ảnh là dữ liệu giả lập)

`ui-desktop-home.png`, `ui-desktop-chart.png`, `ui-desktop-table.png`, `ui-desktop-sql.png`, `ui-desktop-schema.png`, `ui-desktop-demo-badge.png`, `ui-desktop-chart-{bar,hbar}.png`, `ui-state-{scope,clarify,empty,rate,error}.png`, `ui-mobile-{home,chart,table,hbar,pie,drawer}.png`, `ui-mobile-state-*.png`; smoke ghi đè `desktop-bar.png`, `desktop-multi.png`, `mobile-pie.png`. Ảnh chart/bảng dùng dữ liệu mock có số liệu mô phỏng (giống thiết kế), không phải dữ liệu thật; `desktop-multi.png` là ảnh fullPage nên dock dính hiện lệch giữa trang (chỉ là đặc điểm chụp).

## 4. Bảng màu 8 màu biểu đồ nhiều chuỗi (cần user xem lại)

`#0E5A4B, #B45309, #2F7D9A, #7A5C9E, #6B7A1E, #B0405A, #5B6862, #3B6EA5` (token `--series-1..8` trong `tokens.css`), dùng cho grouped_bar, line nhiều chuỗi, pie/doughnut.

## 5. Khác thiết kế gốc / tài liệu và lý do

- Font: chỉ Be Vietnam Pro tự lưu; khối SQL dùng `ui-monospace` stack (bỏ JetBrains Mono, theo doc 06). Tải font được (không phải fallback).
- Bỏ số liệu không có trong API, cột "Tỷ trọng", "Tổng 1.793", nút trả lời nhanh của "Hỏi lại", chip "Chỉ tính nguồn đã ký", nhãn "Một con số/Bảng so sánh" (đổi thành "Có biểu đồ"/"Bảng kết quả" theo quy tắc client), chữ "24 giây/10 câu/5 giây".
- Viền ô nhập `#8A8574`; textarea 16px; focus ring; nút `<button>` thay `<a href="#">`.
- Trục biểu đồ: không hiện tiêu đề trục cho cột/cột ngang (tên cột DB là chữ kỹ thuật, tiêu đề thẻ đã đủ); chỉ line/grouped_bar hiện đơn vị trục giá trị.
- Badge "Chỉ đọc" chỉ hiện ở màn hình hội thoại (ở trang chủ, chế độ thật, chỉ có câu "Hệ thống chỉ đọc" cuối trang và "Kết nối chỉ đọc" ở thanh bên, như thiết kế Empty); badge demo hiện ở mọi màn hình kể cả mobile. Mobile ẩn badge "Chỉ đọc" (thiết kế Mobile không có).
- Bấm mục lịch sử: bắt đầu hội thoại mới (xóa luồng cũ); mục đã xem trong phiên hiện lại ngay không gọi API; mục chưa có thì hỏi lại với `history=[]`.
- Khi bị 429: câu hỏi được trả về ô nhập để bấm lại sau khi mở khóa.
- Focus sau khi có kết quả giữ ở ô nhập, thông báo "Đã có kết quả: N dòng" qua `role=status` (chọn phương án nhất quán trong 5.7).
- Nội dung thread rộng 1040px (không tính lề), cùng độ rộng ô nhập.
- Sửa README (ngoài `frontend/`, `docs/`) chỉ để ghi lệnh e2e theo D8.

## 6. Việc còn mở

- Dữ liệu DEMO không sắp xếp giảm dần (cột lớn nhất ở giữa); chỉ ảnh hưởng demo.
- Đồng bộ lịch sử giữa tab (P3), "Đổi dạng biểu đồ" (P2) chưa làm.
- Bảng trên mobile cuộn ngang trong khung; ô văn bản dài bị xuống nhiều dòng (có thể cân nhắc `nowrap`).
- Đề xuất BE tùy chọn (header `Retry-After`; `row_count/as_of` trong `/api/schema`) chưa làm; FE đã sẵn sàng đọc `Retry-After` nếu có.
- Nên chạy thêm trên Safari/iOS thật và với dữ liệu Groq/DB thật.
