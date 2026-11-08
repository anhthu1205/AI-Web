-- verify.sql: chỉ SELECT. Mỗi dòng là một phép kiểm; cột ok phải là true hết.
WITH c AS (
  SELECT
    (SELECT count(*) FROM public.sales)                                   AS raw_n,
    (SELECT count(*) FROM analytics.sales_clean)                          AS view_n,
    (SELECT count(DISTINCT ma_giao_dich) FROM analytics.sales_clean)      AS view_pk,
    (SELECT count(*) FROM analytics.sales_clean WHERE trang_thai IS NULL) AS unmapped,
    (SELECT count(*) FROM analytics.sales_clean WHERE da_ky_hd)           AS signed,
    (SELECT sum(gia_tri_giao_dich_vnd) FROM analytics.sales_clean)        AS sum_gtgd,
    (SELECT sum(hoa_hong_du_kien_vnd) FROM analytics.sales_clean)         AS sum_hh,
    (SELECT min(dien_tich_m2) FROM analytics.sales_clean)                 AS dt_min,
    (SELECT max(dien_tich_m2) FROM analytics.sales_clean)                 AS dt_max,
    (SELECT count(*) FROM public.sales s JOIN analytics.sales_clean v USING (ma_giao_dich)
      WHERE s.team IS DISTINCT FROM v.team
         OR s.nhan_vien__ten_nv IS DISTINCT FROM v.ten_nv
         OR s.du_an__ten_du_an IS DISTINCT FROM v.ten_du_an
         OR s.nhan_vien__team IS DISTINCT FROM v.team)                    AS dup_diff
), nn AS (
  -- Số dòng raw có giá trị nhưng view bị NULL (bắt lỗi parse/ép kiểu). Phải bằng 0.
  SELECT
    count(*) FILTER (WHERE s.ngay_tao_lead IS NOT NULL AND v.ngay_tao_lead IS NULL)         AS tao,
    count(*) FILTER (WHERE s.ngay_lien_he_cuoi IS NOT NULL AND v.ngay_lien_he_cuoi IS NULL) AS lhc,
    count(*) FILTER (WHERE s.ngay_hen_xem IS NOT NULL AND v.ngay_hen_xem IS NULL)           AS hen,
    count(*) FILTER (WHERE s.ngay_dat_coc IS NOT NULL AND v.ngay_dat_coc IS NULL)           AS coc,
    count(*) FILTER (WHERE s.ngay_ky_hd IS NOT NULL AND v.ngay_ky_hd IS NULL)               AS ky,
    count(*) FILTER (WHERE s.cap_nhat_luc IS NOT NULL AND v.cap_nhat_luc IS NULL)           AS cn,
    count(*) FILTER (WHERE s.dien_tich_m2 IS NOT NULL AND v.dien_tich_m2 IS NULL)           AS dt,
    count(*) FILTER (WHERE s.gia_chao_vnd IS NOT NULL AND v.gia_chao_vnd IS NULL)           AS gc,
    count(*) FILTER (WHERE s.ngan_sach_kh_vnd IS NOT NULL AND v.ngan_sach_kh_vnd IS NULL)   AS ns,
    count(*) FILTER (WHERE s.tien_coc_vnd IS NOT NULL AND v.tien_coc_vnd IS NULL)           AS tc,
    count(*) FILTER (WHERE s.gia_tri_giao_dich_vnd IS NOT NULL AND v.gia_tri_giao_dich_vnd IS NULL) AS gt,
    count(*) FILTER (WHERE s.hoa_hong_du_kien_vnd IS NOT NULL AND v.hoa_hong_du_kien_vnd IS NULL)   AS hh,
    count(*) FILTER (WHERE s.xac_suat_chot IS NOT NULL AND v.xac_suat_chot IS NULL)         AS xs
  FROM public.sales s JOIN analytics.sales_clean v USING (ma_giao_dich)
), d AS (
  SELECT
    count(ngay_hen_xem) AS hen, count(ngay_dat_coc) AS coc, count(ngay_ky_hd) AS ky,
    min(ngay_tao_lead) AS tao_min, max(ngay_tao_lead) AS tao_max,
    count(*) FILTER (WHERE ngay_ky_hd < ngay_dat_coc OR ngay_dat_coc < ngay_tao_lead
                        OR ngay_hen_xem < ngay_tao_lead OR ngay_lien_he_cuoi < ngay_tao_lead) AS order_bad
  FROM analytics.sales_clean
)
SELECT * FROM (
  SELECT 'view = raw = 1800' AS kiem_tra, '1800' AS ky_vong, view_n::text AS thuc_te, (view_n = 1800 AND raw_n = 1800) AS ok FROM c
  UNION ALL SELECT 'ma_giao_dich distinct', '1800', view_pk::text, view_pk = 1800 FROM c
  UNION ALL SELECT 'trang_thai NULL (chưa map)', '0', unmapped::text, unmapped = 0 FROM c
  UNION ALL SELECT 'da_ky_hd', '93', signed::text, signed = 93 FROM c
  UNION ALL SELECT 'SUM gia_tri_giao_dich_vnd', '1556003395101', sum_gtgd::text, sum_gtgd = 1556003395101 FROM c
  UNION ALL SELECT 'SUM hoa_hong_du_kien_vnd', '24504229256', sum_hh::text, sum_hh = 24504229256 FROM c
  UNION ALL SELECT 'dien_tich min', '38.40', dt_min::text, dt_min = 38.4 FROM c
  UNION ALL SELECT 'dien_tich max', '349.80', dt_max::text, dt_max = 349.8 FROM c
  UNION ALL SELECT 'cột trùng (team/ten_nv/ten_du_an) khác nhau', '0', dup_diff::text, dup_diff = 0 FROM c
  UNION ALL SELECT 'raw có giá trị nhưng view NULL (tất cả cột)', '0',
         (tao+lhc+hen+coc+ky+cn+dt+gc+ns+tc+gt+hh+xs)::text,
         (tao+lhc+hen+coc+ky+cn+dt+gc+ns+tc+gt+hh+xs) = 0 FROM nn
  UNION ALL SELECT 'ngay_hen_xem không NULL', '716', hen::text, hen = 716 FROM d
  UNION ALL SELECT 'ngay_dat_coc không NULL', '228', coc::text, coc = 228 FROM d
  UNION ALL SELECT 'ngay_ky_hd không NULL', '93', ky::text, ky = 93 FROM d
  UNION ALL SELECT 'ngay_tao_lead min', '2026-01-01', tao_min::text, tao_min = DATE '2026-01-01' FROM d
  UNION ALL SELECT 'ngay_tao_lead max', '2026-10-17', tao_max::text, tao_max = DATE '2026-10-17' FROM d
  UNION ALL SELECT 'thứ tự ngày (ký>=cọc>=tạo, hẹn>=tạo, liên hệ>=tạo) vi phạm', '0', order_bad::text, order_bad = 0 FROM d
) t;

-- Kiểm tra quyền (chạy bằng quyền admin, mô phỏng role). Xem docs/03-dev-report.md.
-- SET ROLE app_readonly; SELECT count(*) FROM analytics.sales_clean;   -- phải chạy được
-- SET ROLE app_readonly; SELECT count(*) FROM public.sales;            -- phải bị từ chối
-- SET ROLE app_readonly; INSERT INTO analytics.sales_clean (ma_giao_dich) VALUES ('x'); -- phải bị từ chối
