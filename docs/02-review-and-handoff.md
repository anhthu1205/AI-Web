# Review của Tech Lead (Agent 2) và Handoff cho DEV

Quyết định: **APPROVED WITH CHANGES**

Hướng đi của Agent 1 đúng: FastAPI + HTML/JS thuần + Chart.js, view phẳng, role chỉ đọc, `sql_guard` bằng sqlglot, chart chỉ vẽ khi user yêu cầu. Nhưng kiểm tra dữ liệu thật cho thấy 3 giả định sai. Nếu làm theo plan nguyên văn, view sẽ trả sai kết quả mà không báo lỗi.

---

## (a) Kết quả kiểm tra dữ liệu thật (`public.sales`, chỉ SELECT)

### Tổng quan
- 1800 dòng. `ma_giao_dich` unique 1800. `ma_khach_hang` unique 1800 (không lặp khách). `ma_nv` 80, `ma_du_an` 12, `team` 20 (mỗi team đúng 90 dòng), `ma_llbh` 2 (STDA, CHS, mỗi loại 900), `ma_san_pham_bds` 1731 (một số mã sản phẩm xuất hiện nhiều lần, nên không dùng nó làm PK).
- Chuỗi rác (`'null'`, `'N/A'`, `''`, khoảng trắng đầu/cuối): **0** ở mọi cột đã quét. Chỉ có NULL thật.
- RLS trên `public.sales` đang BẬT, nhưng `anon` và `authenticated` vẫn có quyền SELECT ở mức table-grant. Dev phải xem `pg_policies` (xem mục d).

### Phát hiện 1: cột ngày/giờ KHÔNG đồng nhất, regex đơn của plan sẽ sai
Tất cả `ngay_*` và `cap_nhat_luc` là hỗn hợp 3 định dạng:

| Cột | dd/mm/yyyy | `yyyy-mm-dd hh:mm:ss` | Số serial Excel (5 chữ số) | NULL |
|---|---|---|---|---|
| ngay_tao_lead | 900 | 900 | 0 | 0 |
| ngay_lien_he_cuoi | 900 | 900 | 0 | 0 |
| ngay_hen_xem | 0 | 372 | 344 | 1084 |
| ngay_dat_coc | 0 | 113 | 115 | 1572 |
| ngay_ky_hd | 0 | 54 | 39 | 1707 |
| cap_nhat_luc | 900 dạng `dd/mm/yyyy h:mm:ss` (752 giờ 2 chữ số, 148 giờ 1 chữ số) | 900 | 0 | 0 |

- `dd/mm/yyyy` đã xác nhận là **ngày/tháng** (458 dòng có ngày > 12 ở vị trí đầu, 0 dòng nghi mm/dd).
- Serial Excel quy đổi bằng `DATE '1899-12-30' + n`. Sau khi quy đổi, ngày hợp lý: `ky >= coc`, `coc >= tao`, `hen >= tao`, `lien_he_cuoi >= tao` đều **0 vi phạm**. Nếu so sánh chuỗi thô sẽ ra 313 dòng sai.
- Sau chuẩn hóa: `ngay_tao_lead` 2026-01-01..2026-10-17, `cap_nhat_luc` 2026-01-03..2026-10-23.
- Ngày tương lai (> 2026-11-08): `ngay_hen_xem` 5 dòng (lịch hẹn, hợp lý), `ngay_dat_coc` 6 dòng, `ngay_ky_hd` 2 dòng (bất thường, đã ký mà ngày ở tương lai; tối đa ngày ký 2026-12-01, cọc 2026-12-08). `tao`, `lien_he_cuoi`, `cap_nhat_luc` không có ngày tương lai.

### Phát hiện 2: `ten_nv` và `ten_du_an` KHÔNG trùng với bản `nhan_vien__*`/`du_an__*`
- `team` = `nhan_vien__team`: **0 dòng khác** (trùng 100%, bỏ được).
- `ten_nv` khác `nhan_vien__ten_nv` ở **1710/1800 dòng**; `ten_du_an` khác `du_an__ten_du_an` ở **1710/1800 dòng**. Lý do: bản gốc `ten_nv`/`ten_du_an` bị NULL ở phần lớn dòng, còn bản `nhan_vien__ten_nv` và `du_an__ten_du_an` đầy đủ.
- Kết luận: dùng `nhan_vien__ten_nv` và `du_an__ten_du_an` làm nguồn. Bỏ bản `ten_nv`, `ten_du_an` (thiếu). Verify "trùng" của plan sẽ thất bại nếu so ngược lại.
- Mỗi `ma_nv` ứng đúng một tên (80 mã), mỗi `ma_du_an` ứng đúng một tên (12 mã). Tiền tố `ma_nv` luôn khớp `team` (0 lệch).

### Phát hiện 3: pipeline và các cột liên quan
16 giá trị `trang_thai_pipeline`, mapping của Agent 1 phủ đủ (0 giá trị chưa map). Số dòng:
Lead mới 122, Mới 118, Đã liên hệ 285, Đang tư vấn 327, Hẹn xem 122, Hẹn tham quan 86, Đã xem 76, Đã tham quan 99, Đàm phán 81, Đang thương lượng 74, Đặt cọc 135, Ký HĐ 54, Đã ký hợp đồng 39, Không nhu cầu 75, Không phù hợp 65, Mất liên lạc 42.

- Các cặp đồng nghĩa mà Agent 1 gom có `xac_suat_chot` **giống hệt nhau** (vd Hẹn xem/Hẹn tham quan = 40, Đã xem/Đã tham quan = 55, Đàm phán/Đang thương lượng = 70, Lead mới/Mới = 5, Ký HĐ/Đã ký hợp đồng = 100). Việc gom là đúng.
- `xac_suat_chot` theo giai đoạn: 5, 12, 25, 40, 55, 70, 85 (Đặt cọc), 100 (đã ký), 0 (thất bại). Đây là giá trị cố định theo giai đoạn, không phải xác suất riêng từng dòng.
- `ngay_ky_hd` có giá trị **đúng** ở 93 dòng = đúng 93 dòng `Ký HĐ`/`Đã ký hợp đồng`. `ngay_dat_coc`/`tien_coc_vnd` có giá trị **đúng** ở 228 dòng = 135 Đặt cọc + 93 đã ký. Không có dòng mâu thuẫn trạng thái, nên rủi ro "có ngày ký mà trạng thái chưa ký" của Agent 1 **không xảy ra** trong dữ liệu này.
- `gia_tri_giao_dich_vnd` và `hoa_hong_du_kien_vnd` chỉ không NULL ở 93 dòng đã ký. **Đặt cọc có tiền cọc nhưng `gia_tri_giao_dich_vnd` là NULL.**
- Tổng `gia_tri_giao_dich_vnd` = 1.556.003.395.101 VND (~1.556 tỷ). Tổng hoa hồng = 24.504.229.256 VND. 17/93 giao dịch có giá trị giao dịch > giá chào (bình thường, không phải lỗi).

### Phát hiện 4: định dạng số
- Tiền (`gia_chao`, `ngan_sach`, `tien_coc`, `gia_tri_giao_dich`, `hoa_hong`) và `xac_suat_chot`: **0 dòng** vi phạm `^[0-9]+$`. Cast bigint/smallint an toàn. `gia_chao` 1,54 tỷ..61,45 tỷ; `ngan_sach` 1,48 tỷ..75,45 tỷ; `tien_coc` tối đa 200 triệu; `gia_tri` tối đa 52,13 tỷ.
- `dien_tich_m2`: toàn bộ khớp `^[0-9]+([.,][0-9]+)?$`. **1665 dòng dùng dấu phẩy, 0 dòng dùng dấu chấm** (135 dòng là số nguyên). Không có dạng `1.234,5`, không có chữ. Phạm vi 38,4..349,8 m2. Chỉ cần `replace(',', '.')`.

### Phát hiện 5: cardinality (quyết định liệt kê vào prompt)
| Cột | Distinct | Quyết định |
|---|---|---|
| nguon_lead | 9 | liệt kê hết |
| loai_san_pham | 7 | liệt kê hết (Shophouse, Căn hộ, Biệt thự, Nhà phố, Penthouse, Liền kề, Duplex) |
| nhu_cau | 4 | liệt kê hết (Đầu tư, Mua cho người thân, Cho thuê, Mua ở) |
| trang_thai (chuẩn) | 8 | liệt kê hết |
| ma_llbh | 2 | liệt kê hết (STDA, CHS) |
| team | 20 | liệt kê hết (C1..C10, S1..S10) |
| khu_vuc | 8 | liệt kê hết |
| tinh_tp | 5 | liệt kê hết (Hà Nội, Hưng Yên, TP Hồ Chí Minh, An Giang, Đồng Nai) |
| chu_dau_tu | 7 | liệt kê hết |
| loai_hinh_du_an | 5 | liệt kê hết |
| ten_du_an | 12 | liệt kê hết |
| ma_nv / ten_nv | 80 / 80 | KHÔNG liệt kê; gợi ý dùng `ILIKE` trên `ten_nv` |
| loai_bds_du_an | 9 chuỗi nhiều giá trị ngăn bằng `;` | ghi chú dùng `ILIKE '%Căn hộ%'` |

Lưu ý dữ liệu: Phú Quốc nằm ở `tinh_tp = 'An Giang'` (sau sáp nhập tỉnh). Khi user hỏi "Phú Quốc" thì lọc theo `khu_vuc ILIKE '%Phú Quốc%'`, không phải `tinh_tp`. Prompt cần ghi chú này. `khu_vuc` có giá trị gộp như "Văn Giang / Văn Lâm", "An Thới, Phú Quốc", nên dùng `ILIKE`.

---

## (b) Đánh giá phương án

### Duyệt (giữ nguyên)
- Kiến trúc FE/BE tách bạch, không Streamlit, đúng đề bài. Python + FastAPI + Supabase + Groq free.
- Không ALTER `public.sales`. Schema `analytics` + view phẳng + `DROP SCHEMA ... CASCADE` để rollback.
- Role `app_readonly`, transaction READ ONLY, timeout 5s, `sql_guard` sqlglot, LIMIT bắt buộc, kết quả không đưa lại vào LLM, `textContent` ở FE.
- Một view phẳng, không JOIN cho LLM.
- Dùng Session Pooler cho DB (xem lưu ý d).
- Chart chỉ khi user yêu cầu, quy tắc chart_rules ở server, Chart.js vendor.
- Eval execution accuracy, mapping trạng thái 8 nhóm.

### Không duyệt / phải sửa
1. **Ép kiểu ngày (mục 2 plan) sai.** Regex "một định dạng" làm ~50% dòng thành NULL hoặc lỗi. Phải dùng hàm parse 3 định dạng (xem mục d, M2). Plan thiếu hẳn việc này.
2. **Cột trùng:** bỏ `team`, `ten_nv`, `ten_du_an`, `nhan_vien__team`/`nhan_vien__ten_nv`/`du_an__ten_du_an` theo cách sai. Sửa: **giữ `team`, `ma_nv`, `nhan_vien__ten_nv → ten_nv`, `du_an__ten_du_an → ten_du_an`**; bỏ các cột gốc `ten_nv`, `ten_du_an`, `nhan_vien__team`.
3. **`verify.sql`:** mục "non-null mỗi cột raw = view" phải đổi tên-cột đúng theo ánh xạ trên, và với ngày phải kiểm "view không NULL ở dòng raw có giá trị" (bắt lỗi parse), thay vì so chuỗi thô.
4. **Eval:** câu "khách ngân sách >5 tỷ" khớp 1458/1800 dòng nên không phân biệt được đúng sai. Đổi thành ngưỡng 30 tỷ. Các câu có "30 ngày qua" phải tính theo `REFERENCE_DATE = 2026-11-08`; lưu ý tại thời điểm đó `ngay_tao_lead` tối đa 2026-10-17 nên "lead 30 ngày qua" = từ 2026-10-09, kết quả nhỏ nhưng khác 0.
5. **`generate_series` bị cấm là hợp lý, nhưng danh sách hàm cho phép phải gồm `date_trunc`, `to_char`, `extract`, `coalesce`, `nullif`, `round`, `count/sum/avg/min/max`, `percentile_cont`, `lower`, `unaccent` (nếu có; không có thì bỏ)**. Dev kiểm thực tế bằng test.
6. **Over-engineering cần cắt:** (i) fallback sang `llama-3.1-8b-instant` khi 429 — giữ nhưng chỉ là cấu hình env, không viết thêm logic phức tạp; (ii) `slowapi` giữ (rẻ); (iii) GitHub Actions + pre-commit: giữ bản tối giản (ruff + pytest), bỏ black nếu ruff format đủ; (iv) HF Spaces dự phòng: chỉ nêu trong README, không làm; (v) `history` 3 lượt: giữ nhưng là việc cuối của M4/M5, không chặn nghiệm thu.
7. **Groq:** tên model `llama-3.3-70b-versatile` và `llama-3.1-8b-instant` là tên tôi biết, **cần Dev xác minh** còn hiệu lực bằng `GET https://api.groq.com/openai/v1/models` với key thật vào đầu M4. Rate limit free tier (RPM/TPM/RPD) **cần Dev xác minh** tại console Groq, không hardcode giả định. Nếu model bị gỡ, chọn model thay trong cùng danh sách và cập nhật `.env.example`.
8. **`response_format=json_object`:** cần Dev xác minh model được chọn hỗ trợ. Nếu không, bắt buộc parse JSON bằng cách tách khối `{...}` có kiểm tra bằng Pydantic, và retry 1 lần.

---

## (c) Quyết định chốt cho các câu hỏi mở (mục 9 của plan)

Đây là các **giả định, cần user xác nhận**; Dev vẫn làm theo mặc định bên dưới, đổi sau chỉ là sửa prompt + view.

| # | Câu hỏi | Chốt mặc định | Ghi chú |
|---|---|---|---|
| 1 | GROQ_API_KEY | Qua biến môi trường / `.env` local, không vào repo | User cung cấp (mục e) |
| 2 | Tạo schema `analytics` + role `app_readonly` trên project `kxebriimlhwenbzfkekd` | Đồng ý, nhưng **mật khẩu do user đặt**, migration dùng placeholder | **Cần user xác nhận**. Hiện chưa có schema/role (đã kiểm tra) |
| 3 | Ngày 2026 hợp lệ, hôm nay 2026-11-08 | Chấp nhận. `REFERENCE_DATE=2026-11-08` | Dữ liệu tạo lead 2026-01-01..2026-10-17 nên khớp |
| 4 | Định nghĩa doanh thu / tỷ lệ chốt | **Doanh thu = `SUM(gia_tri_giao_dich_vnd)` chỉ cho `trang_thai = 'Ký HĐ'`** (cột này NULL ở mọi trạng thái khác nên tự đúng). **Tiền cọc** là chỉ tiêu riêng (`tien_coc_vnd`), không tính là doanh thu. **Tỷ lệ chốt = số `Ký HĐ` / tổng số lead trong nhóm** (mẫu số là mọi dòng, kể cả Thất bại). Prompt phải ghi rõ định nghĩa và `explanation` phải nhắc lại định nghĩa đã dùng | **Cần user xác nhận** |
| 5 | Gom trạng thái theo mapping | Đồng ý (đã xác nhận xac_suat trùng nhau giữa các cặp) | Giữ cột `trang_thai_goc` để truy ngược |
| 6 | PII | **Ẩn**: `ho_ten_khach_hang, sdt_khach_hang, email_khach_hang, nhan_vien__mail, ghi_chu_cham_soc, llbh__ghi_chu` không vào view. Hỏi về PII thì từ chối | **Cần user xác nhận**. Giữ `ma_khach_hang` (mã, không phải PII trực tiếp) |
| 7 | Nơi deploy | Render (Docker, free) | Cold start phải ghi trong README |

Bổ sung: `ngay_ky_hd` có 2 dòng nằm sau 2026-11-08 (và 6 dòng cọc). **Chốt: giữ nguyên, không lọc, không sửa dữ liệu**; chỉ ghi chú trong prompt rằng dữ liệu có vài ngày sau ngày tham chiếu. Báo user là bất thường dữ liệu.

---

## (d) HANDOFF cho DEV

### Quy tắc chung (KHÔNG được làm)
- KHÔNG commit `GROQ_API_KEY`, `DATABASE_URL`, mật khẩu, `.env`. Chạy `.env` vào `.gitignore` ngay M1. Dùng `run_secret_scanning` trước khi push.
- KHÔNG dùng `service_role` key, KHÔNG dùng mật khẩu role `postgres` trong ứng dụng.
- KHÔNG ALTER/UPDATE/DELETE/TRUNCATE/DROP `public.sales`. Chỉ tạo đối tượng trong schema `analytics`.
- KHÔNG đưa kết quả truy vấn hay PII vào prompt LLM. KHÔNG log key/connection string.
- KHÔNG cấp quyền của `app_readonly` trên `public`. KHÔNG expose `analytics` qua PostgREST (không thêm vào "Exposed schemas").
- KHÔNG gọi Groq thật trong CI/unit test (dùng mock). KHÔNG dùng `eval()`/`innerHTML` với dữ liệu server ở FE.
- Mọi thao tác trên DB trong dự án: DDL qua `apply_migration` + lưu file trong `db/migrations/`; phần khác chỉ SELECT.

### Thứ tự và việc theo milestone

**M1: Khung dự án.** Cấu trúc thư mục theo mục 1 plan, FastAPI + `/health` (chưa cần DB), `config.py` (pydantic-settings đọc env), `requirements*.txt`, `.gitignore` (có `.env`), `.env.example`, ruff + pytest, CI tối giản.
Nghiệm thu: `uvicorn` chạy, `/health` 200, ruff + pytest xanh, `git grep -i "gsk_\|postgresql://.*:.*@"` không ra gì.

**M2: Migration dữ liệu.**
- `001_clean_view.sql`: schema `analytics`, bảng `pipeline_status_map`, view `sales_clean`.
  - Dùng hàm parse chung (tạo trong schema `analytics`, IMMUTABLE, trả NULL khi lỗi thay vì ném lỗi):
    - `parse_vn_date(text)`: `^\d{5}$` -> `DATE '1899-12-30' + n`; `^\d{4}-\d{2}-\d{2}` -> `left(v,10)::date`; `^\d{2}/\d{2}/\d{4}` -> `to_date(left(v,10),'DD/MM/YYYY')`; còn lại NULL.
    - `parse_vn_ts(text)`: `^\d{4}-` -> `::timestamp`; `^\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}` -> `to_timestamp(v,'DD/MM/YYYY HH24:MI:SS')` (chấp nhận giờ 1 chữ số); còn lại NULL.
  - `dien_tich_m2`: `replace(v, ',', '.')::numeric(10,2)`, bọc `CASE WHEN v ~ '^[0-9]+([.,][0-9]+)?$'`.
  - Tiền / `xac_suat_chot`: `CASE WHEN v ~ '^[0-9]+$' THEN v::bigint END`.
  - Cột giữ: `ma_giao_dich, ma_khach_hang, nguon_lead, ngay_tao_lead, ngay_lien_he_cuoi, team, ma_llbh, ma_nv, ten_nv (từ nhan_vien__ten_nv), ma_du_an, ten_du_an (từ du_an__ten_du_an), ma_san_pham_bds, loai_san_pham, dien_tich_m2, gia_chao_vnd, ngan_sach_kh_vnd, nhu_cau, trang_thai, trang_thai_goc, thu_tu_pipeline, da_ky_hd, xac_suat_chot, ngay_hen_xem, ngay_dat_coc, tien_coc_vnd, ngay_ky_hd, gia_tri_giao_dich_vnd, hoa_hong_du_kien_vnd, cap_nhat_luc` và các cột dự án đã đổi tên (`khu_vuc, tinh_tp, chu_dau_tu, loai_hinh_du_an, loai_bds_du_an`).
  - Mapping trạng thái đúng như bảng của Agent 1 (8 nhóm). Thêm `da_ky_hd = (trang_thai = 'Ký HĐ')`.
  - Thêm `COMMENT ON COLUMN` tiếng Việt cho mỗi cột (đơn vị, nghĩa); `/api/schema` và prompt có thể lấy từ đây.
- `002_readonly_role.sql`: `CREATE ROLE app_readonly LOGIN PASSWORD :'placeholder'` (không ghi mật khẩu thật vào file), `GRANT USAGE ON SCHEMA analytics`, `GRANT SELECT ON analytics.sales_clean`, `REVOKE ALL ON SCHEMA public` và `ON ALL TABLES IN SCHEMA public`, `ALTER ROLE ... SET statement_timeout='5s', default_transaction_read_only=on, search_path=analytics`, `CONNECTION LIMIT 10`. Lưu ý view `sales_clean` đọc `public.sales`: view phải do owner có quyền đọc (security definer mặc định), `app_readonly` không cần quyền trực tiếp trên `public.sales`. Xác minh điều này bằng test bị từ chối.
- Chạy `get_advisors` (security) sau migration và đọc `pg_policies` trên `public.sales`: nếu `anon` đọc được dữ liệu PII qua PostgREST thì **báo user ngay** (không tự sửa policy khi chưa được phép).
- `999_rollback.sql`, `verify.sql`.
Nghiệm thu `verify.sql`: view = 1800 dòng; `ma_giao_dich` distinct 1800; 0 `trang_thai` NULL; **không có cột ngày nào NULL ở dòng raw có giá trị** (`ngay_tao_lead`, `ngay_lien_he_cuoi`, `cap_nhat_luc` 0 NULL; `ngay_hen_xem` 716 không NULL; `ngay_dat_coc` 228; `ngay_ky_hd` 93); `da_ky_hd` = 93; `SUM(gia_tri_giao_dich_vnd) = 1556003395101`; `SUM(hoa_hong_du_kien_vnd) = 24504229256`; `dien_tich_m2` min 38.4, max 349.8; role `app_readonly` SELECT `public.sales` bị từ chối, INSERT vào view bị từ chối.

**M3: `sql_guard` + `executor`.** Như plan, cộng whitelist hàm đã nêu. Test bắt buộc: DROP, nhiều câu lệnh, `pg_sleep`, bảng ngoài whitelist, comment, `SELECT INTO`, CTE chứa DML, truy cập `public.sales`, `information_schema`, `pg_catalog`, `generate_series`, LIMIT clamp, timeout thật (query chậm vào 504 `DB_TIMEOUT`).
Nghiệm thu: tất cả test chặn pass; kết nối thật bằng `app_readonly` qua Session Pooler chạy được `SELECT count(*)`.

**M4: Prompt + LLM + endpoints.**
- Trước tiên xác minh model Groq và `json_object` (mục b.7, b.8).
- Prompt gồm: schema + COMMENT, danh sách giá trị phân loại (mục a.5), định nghĩa doanh thu/tỷ lệ chốt (mục c.4), ghi chú Phú Quốc/An Giang, ghi chú `loai_bds_du_an` dùng `ILIKE`, `REFERENCE_DATE`, quy tắc từ chối, few-shot (6 câu, tách khỏi bộ eval).
- `chart_intent` bằng regex (có/không dấu) như plan, ép `chart=null` khi không yêu cầu.
Nghiệm thu: Groq thật trả JSON đúng schema; retry đúng 1 lần; eval >= 85% trên 20 câu (đã sửa câu >5 tỷ thành >30 tỷ) + 2 câu từ chối đúng (xóa bảng; xin SĐT khách). Lưu kết quả eval vào `docs/` hoặc README. Nếu dưới 85%, phân tích lỗi trước khi tinh chỉnh prompt.

**M5: Frontend.** Ô nhập, bảng, hiển thị SQL + giải thích, Chart.js, lịch sử hội thoại, trạng thái loading/lỗi, ví dụ gợi ý từ `/api/examples`. Định dạng số `vi-VN`.
Nghiệm thu: demo 5 câu E2E; chart chỉ hiện khi user yêu cầu; chèn `<img onerror>` vào kết quả không chạy script (dùng `textContent`).

**M6: Deploy + README.** Dockerfile non-root, Render, rate limit 10/phút, CORS theo env, README có hướng dẫn chạy, sơ đồ kiến trúc, kết quả eval, các định nghĩa nghiệp vụ và giả định.
Nghiệm thu: URL công khai chạy; vượt rate limit trả 429; không có secret trong repo/log.

### Thứ tự thực hiện
M1 -> M2 (cần user cấp quyền + mật khẩu role) -> M3 -> M4 (cần GROQ_API_KEY) -> M5 -> M6. M3 có thể làm song song M2 vì test unit không cần DB thật.

---

## (e) Việc cần user cung cấp / xác nhận

| Thứ cần | Dùng cho | Cách cung cấp an toàn |
|---|---|---|
| `GROQ_API_KEY` (tạo ở console.groq.com) | M4 | Đặt vào file `.env` local (đã gitignore) hoặc biến môi trường của session/dashboard Render. Không dán vào chat/commit/issue. |
| Mật khẩu role `app_readonly` | M2, M3, M6 | User tự đặt chuỗi mạnh. Dev chạy migration với placeholder; user tự chạy `ALTER ROLE app_readonly PASSWORD '...'` trong SQL Editor của Supabase, rồi tự điền vào `DATABASE_URL` trong `.env` / dashboard Render. |
| `DATABASE_URL` dạng Session Pooler | M3+ | Lấy ở Supabase Dashboard > Connect (user `app_readonly.kxebriimlhwenbzfkekd`, port 5432). Cùng cách cung cấp như trên. |
| Xác nhận quyền tạo schema `analytics`, role, view trên project `kxebriimlhwenbzfkekd` | M2 | Trả lời trực tiếp trong chat. |
| Xác nhận định nghĩa doanh thu / tỷ lệ chốt, ẩn PII, gom trạng thái, deploy Render | Mục (c) | Trả lời trong chat; nếu đổi thì Dev chỉnh prompt + view. |
| Tài khoản Render (hoặc nơi deploy khác) | M6 | User tự tạo, kết nối repo GitHub, đặt secret trong dashboard. |
| Biết về bất thường dữ liệu: 2 hợp đồng ký và 6 cọc có ngày sau 2026-11-08; policy `anon` trên `public.sales` | Thông tin | Chỉ để user biết và quyết định, Dev không tự sửa. |
