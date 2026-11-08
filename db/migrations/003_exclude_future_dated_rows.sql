-- 003: loại các dòng có ngày đặt cọc / ký HĐ sau ngày chốt dữ liệu (2026-11-08).
-- User xác nhận đây là lỗi nhập liệu: 6 dòng cọc + 2 dòng ký HĐ trùng 1 dòng = 7 dòng.
-- Chỉ đổi VIEW; public.sales giữ nguyên. Hoàn tác: chạy lại câu CREATE OR REPLACE VIEW trong 001.
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
LEFT JOIN analytics.pipeline_status_map m ON m.trang_thai_goc = s.trang_thai_pipeline
WHERE NOT (
  COALESCE(analytics.parse_vn_date(s.ngay_dat_coc) > DATE '2026-11-08', false)
  OR COALESCE(analytics.parse_vn_date(s.ngay_ky_hd) > DATE '2026-11-08', false)
);

COMMENT ON VIEW analytics.sales_clean IS 'Mỗi dòng là một lead/giao dịch bất động sản (1793 dòng; đã loại 7 dòng lỗi nhập liệu có ngày cọc/ký HĐ sau 2026-11-08). Đã chuẩn hóa kiểu dữ liệu, đã loại thông tin cá nhân.';
