-- ════════════════════════════════════════════════════════════════
-- PRE-FLIGHT CHECK trước khi chạy 01_bbtn_schema.sql
--
-- Mục đích: verify schema CongTacThiNghiem có đúng cột không
-- để function check_bbtn_match() hoạt động đúng
-- ════════════════════════════════════════════════════════════════

-- Liệt kê các cột của CongTacThiNghiem
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'CongTacThiNghiem'
ORDER BY ordinal_position;

-- Mong đợi thấy các cột:
--   Tram (text)
--   Ten_thiet_bi (text)
--   Thoi_gian_thi_nghiem_truoc (date hoặc timestamp)
--   So_che_tao (text) — optional

-- Kiểm tra số rows hiện tại
SELECT count(*) AS total_records FROM public."CongTacThiNghiem";

-- Sample 3 rows để hiểu format
SELECT
  "Tram",
  "Ten_thiet_bi",
  "Thoi_gian_thi_nghiem_truoc",
  "Thoi_gian_thi_nghiem_tiep_theo"
FROM public."CongTacThiNghiem"
LIMIT 3;
