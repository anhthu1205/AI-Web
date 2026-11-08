-- 001: schema analytics, hàm parse, bảng mapping trạng thái và view phẳng sales_clean.
-- Không đụng vào public.sales (chỉ SELECT). Rollback: 999_rollback.sql.

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;

-- Parse ngày: dd/mm/yyyy | yyyy-mm-dd[ hh:mm:ss] | số serial Excel (5 chữ số). Lỗi -> NULL.
CREATE OR REPLACE FUNCTION analytics.parse_vn_date(v text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE m text[];
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  v := btrim(v);
  IF v ~ '^\d{5}$' THEN
    RETURN DATE '1899-12-30' + v::int;
  END IF;
  m := regexp_match(v, '^(\d{4})-(\d{2})-(\d{2})');
  IF m IS NOT NULL THEN
    RETURN make_date(m[1]::int, m[2]::int, m[3]::int);
  END IF;
  m := regexp_match(v, '^(\d{1,2})/(\d{1,2})/(\d{4})');
  IF m IS NOT NULL THEN
    RETURN make_date(m[3]::int, m[2]::int, m[1]::int);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- Parse thời điểm: yyyy-mm-dd hh:mm:ss | dd/mm/yyyy h:mm:ss (giờ 1 hoặc 2 chữ số). Lỗi -> NULL.
CREATE OR REPLACE FUNCTION analytics.parse_vn_ts(v text) RETURNS timestamp
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE m text[];
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  v := btrim(v);
  m := regexp_match(v, '^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2}):(\d{2})');
  IF m IS NOT NULL THEN
    RETURN make_timestamp(m[1]::int, m[2]::int, m[3]::int, m[4]::int, m[5]::int, m[6]::int);
  END IF;
  m := regexp_match(v, '^(\d{1,2})/(\d{1,2})/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})');
  IF m IS NOT NULL THEN
    RETURN make_timestamp(m[3]::int, m[2]::int, m[1]::int, m[4]::int, m[5]::int, m[6]::int);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- Gom 16 trạng thái gốc về 8 nhóm theo thứ tự pipeline.
CREATE TABLE IF NOT EXISTS analytics.pipeline_status_map (
  trang_thai_goc text PRIMARY KEY,
  trang_thai     text     NOT NULL,
  thu_tu         smallint NOT NULL
);
INSERT INTO analytics.pipeline_status_map (trang_thai_goc, trang_thai, thu_tu) VALUES
  ('Lead mới', 'Mới', 1), ('Mới', 'Mới', 1),
  ('Đã liên hệ', 'Đang tư vấn', 2), ('Đang tư vấn', 'Đang tư vấn', 2),
  ('Hẹn xem', 'Hẹn xem', 3), ('Hẹn tham quan', 'Hẹn xem', 3),
  ('Đã xem', 'Đã xem', 4), ('Đã tham quan', 'Đã xem', 4),
  ('Đàm phán', 'Đàm phán', 5), ('Đang thương lượng', 'Đàm phán', 5),
  ('Đặt cọc', 'Đặt cọc', 6),
  ('Ký HĐ', 'Ký HĐ', 7), ('Đã ký hợp đồng', 'Ký HĐ', 7),
  ('Không nhu cầu', 'Thất bại', 8), ('Không phù hợp', 'Thất bại', 8),
  ('Mất liên lạc', 'Thất bại', 8)
ON CONFLICT (trang_thai_goc) DO NOTHING;

CREATE OR REPLACE VIEW analytics.sales_clean AS
SELECT
  s.ma_giao_dich,
  s.ma_khach_hang,
  s.nguon_lead,
  analytics.parse_vn_date(s.ngay_tao_lead)      AS ngay_tao_lead,
  analytics.parse_vn_date(s.ngay_lien_he_cuoi)  AS ngay_lien_he_cuoi,
  s.team,
  s.ma_llbh,
  s.ma_nv,
  s.nhan_vien__ten_nv                           AS ten_nv,
  s.ma_du_an,
  s.du_an__ten_du_an                            AS ten_du_an,
  s.du_an__khu_vuc                              AS khu_vuc,
  s.du_an__tinh_tp                              AS tinh_tp,
  s.du_an__chu_dau_tu_don_vi_phat_trien         AS chu_dau_tu,
  s.du_an__loai_hinh_du_an                      AS loai_hinh_du_an,
  s.du_an__loai_bds                             AS loai_bds_du_an,
  s.ma_san_pham_bds,
  s.loai_san_pham,
  CASE WHEN s.dien_tich_m2 ~ '^[0-9]+([.,][0-9]+)?$'
       THEN replace(s.dien_tich_m2, ',', '.')::numeric(10,2) END AS dien_tich_m2,
  CASE WHEN s.gia_chao_vnd ~ '^[0-9]+$' THEN s.gia_chao_vnd::bigint END         AS gia_chao_vnd,
  CASE WHEN s.ngan_sach_kh_vnd ~ '^[0-9]+$' THEN s.ngan_sach_kh_vnd::bigint END AS ngan_sach_kh_vnd,
  s.nhu_cau,
  m.trang_thai                                  AS trang_thai,
  s.trang_thai_pipeline                         AS trang_thai_goc,
  m.thu_tu                                      AS thu_tu_pipeline,
  (m.trang_thai = 'Ký HĐ')                      AS da_ky_hd,
  CASE WHEN s.xac_suat_chot ~ '^[0-9]+$' THEN s.xac_suat_chot::smallint END     AS xac_suat_chot,
  analytics.parse_vn_date(s.ngay_hen_xem)       AS ngay_hen_xem,
  analytics.parse_vn_date(s.ngay_dat_coc)       AS ngay_dat_coc,
  CASE WHEN s.tien_coc_vnd ~ '^[0-9]+$' THEN s.tien_coc_vnd::bigint END         AS tien_coc_vnd,
  analytics.parse_vn_date(s.ngay_ky_hd)         AS ngay_ky_hd,
  CASE WHEN s.gia_tri_giao_dich_vnd ~ '^[0-9]+$' THEN s.gia_tri_giao_dich_vnd::bigint END AS gia_tri_giao_dich_vnd,
  CASE WHEN s.hoa_hong_du_kien_vnd ~ '^[0-9]+$' THEN s.hoa_hong_du_kien_vnd::bigint END   AS hoa_hong_du_kien_vnd,
  analytics.parse_vn_ts(s.cap_nhat_luc)         AS cap_nhat_luc
FROM public.sales s
LEFT JOIN analytics.pipeline_status_map m ON m.trang_thai_goc = s.trang_thai_pipeline;

COMMENT ON VIEW analytics.sales_clean IS 'Mỗi dòng là một lead/giao dịch bất động sản (1800 dòng). Đã chuẩn hóa kiểu dữ liệu, đã loại thông tin cá nhân.';
COMMENT ON COLUMN analytics.sales_clean.ma_giao_dich IS 'Mã giao dịch (khóa chính, duy nhất)';
COMMENT ON COLUMN analytics.sales_clean.ma_khach_hang IS 'Mã khách hàng (mỗi khách một dòng)';
COMMENT ON COLUMN analytics.sales_clean.nguon_lead IS 'Nguồn lead (kênh marketing)';
COMMENT ON COLUMN analytics.sales_clean.ngay_tao_lead IS 'Ngày tạo lead (date)';
COMMENT ON COLUMN analytics.sales_clean.ngay_lien_he_cuoi IS 'Ngày liên hệ khách gần nhất (date)';
COMMENT ON COLUMN analytics.sales_clean.team IS 'Team bán hàng: C1..C10, S1..S10';
COMMENT ON COLUMN analytics.sales_clean.ma_llbh IS 'Mã loại liên hệ bán hàng: STDA hoặc CHS';
COMMENT ON COLUMN analytics.sales_clean.ma_nv IS 'Mã nhân viên kinh doanh (80 người)';
COMMENT ON COLUMN analytics.sales_clean.ten_nv IS 'Tên nhân viên kinh doanh';
COMMENT ON COLUMN analytics.sales_clean.ma_du_an IS 'Mã dự án (12 dự án)';
COMMENT ON COLUMN analytics.sales_clean.ten_du_an IS 'Tên dự án';
COMMENT ON COLUMN analytics.sales_clean.khu_vuc IS 'Khu vực của dự án (có thể gộp nhiều địa danh, dùng ILIKE)';
COMMENT ON COLUMN analytics.sales_clean.tinh_tp IS 'Tỉnh/thành của dự án (Phú Quốc thuộc An Giang)';
COMMENT ON COLUMN analytics.sales_clean.chu_dau_tu IS 'Chủ đầu tư / đơn vị phát triển dự án';
COMMENT ON COLUMN analytics.sales_clean.loai_hinh_du_an IS 'Loại hình dự án';
COMMENT ON COLUMN analytics.sales_clean.loai_bds_du_an IS 'Các loại BĐS của dự án, ngăn cách bằng dấu chấm phẩy (dùng ILIKE)';
COMMENT ON COLUMN analytics.sales_clean.ma_san_pham_bds IS 'Mã sản phẩm BĐS (có thể lặp giữa các dòng)';
COMMENT ON COLUMN analytics.sales_clean.loai_san_pham IS 'Loại sản phẩm BĐS: Căn hộ, Biệt thự, Nhà phố, Shophouse, Penthouse, Liền kề, Duplex';
COMMENT ON COLUMN analytics.sales_clean.dien_tich_m2 IS 'Diện tích (m2)';
COMMENT ON COLUMN analytics.sales_clean.gia_chao_vnd IS 'Giá chào bán (VND)';
COMMENT ON COLUMN analytics.sales_clean.ngan_sach_kh_vnd IS 'Ngân sách khách hàng (VND)';
COMMENT ON COLUMN analytics.sales_clean.nhu_cau IS 'Nhu cầu: Đầu tư, Mua ở, Cho thuê, Mua cho người thân';
COMMENT ON COLUMN analytics.sales_clean.trang_thai IS 'Trạng thái pipeline đã gom (8 nhóm): Mới, Đang tư vấn, Hẹn xem, Đã xem, Đàm phán, Đặt cọc, Ký HĐ, Thất bại';
COMMENT ON COLUMN analytics.sales_clean.trang_thai_goc IS 'Trạng thái gốc trước khi gom (16 giá trị)';
COMMENT ON COLUMN analytics.sales_clean.thu_tu_pipeline IS 'Thứ tự giai đoạn 1..8';
COMMENT ON COLUMN analytics.sales_clean.da_ky_hd IS 'true nếu trang_thai = Ký HĐ';
COMMENT ON COLUMN analytics.sales_clean.xac_suat_chot IS 'Xác suất chốt (%), giá trị cố định theo giai đoạn';
COMMENT ON COLUMN analytics.sales_clean.ngay_hen_xem IS 'Ngày hẹn xem nhà (có thể ở tương lai)';
COMMENT ON COLUMN analytics.sales_clean.ngay_dat_coc IS 'Ngày đặt cọc (chỉ có ở trạng thái Đặt cọc và Ký HĐ)';
COMMENT ON COLUMN analytics.sales_clean.tien_coc_vnd IS 'Tiền đặt cọc (VND), không phải doanh thu';
COMMENT ON COLUMN analytics.sales_clean.ngay_ky_hd IS 'Ngày ký hợp đồng (chỉ có ở trạng thái Ký HĐ)';
COMMENT ON COLUMN analytics.sales_clean.gia_tri_giao_dich_vnd IS 'Giá trị giao dịch (VND); chỉ có ở trạng thái Ký HĐ, dùng tính doanh thu';
COMMENT ON COLUMN analytics.sales_clean.hoa_hong_du_kien_vnd IS 'Hoa hồng dự kiến (VND); chỉ có ở trạng thái Ký HĐ';
COMMENT ON COLUMN analytics.sales_clean.cap_nhat_luc IS 'Thời điểm cập nhật bản ghi (timestamp)';
