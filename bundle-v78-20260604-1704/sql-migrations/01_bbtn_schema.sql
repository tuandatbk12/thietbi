-- ════════════════════════════════════════════════════════════════
-- BBTN OCR — Phase 1: SQL Schema
--
-- Tạo:
--   1. Bảng `bbtn_records` lưu kết quả OCR
--   2. Bảng `bbtn_alerts` lưu cảnh báo "BBTN chưa khớp DB"
--   3. Storage bucket `bbtn-files` cho file gốc
--   4. RLS: chỉ admin INSERT/UPDATE/DELETE, mọi user authenticated SELECT
--   5. Function check_bbtn_alert() tạo cảnh báo tự động
--
-- ⚠️ SAFE: KHÔNG đụng vào bảng/table cũ
-- ⚠️ SAFE: KHÔNG REVOKE quyền, KHÔNG đổi RLS bảng khác
--
-- Chạy: https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/sql/new
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. Bảng bbtn_records
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbtn_records (
  id              bigserial PRIMARY KEY,

  -- Thông tin file
  file_url        text NOT NULL,           -- Supabase Storage URL
  file_name       text NOT NULL,           -- tên file gốc
  file_size       int,                     -- bytes
  file_type       text,                    -- 'application/pdf', 'image/jpeg', ...

  -- 9 fields OCR (từ BBTN)
  tram            text,                    -- Trạm (vị trí lắp đặt)
  ten_thiet_bi    text,                    -- Tên thiết bị / Kiểu
  kieu            text,                    -- Kiểu cụ thể (GL312F1/4031P)
  so_che_tao      text,                    -- Serial number
  hang_san_xuat   text,                    -- GE, ABB, Siemens, ...
  nuoc_san_xuat   text,                    -- India, Germany, ...
  nam_san_xuat    int,                     -- 2025
  dien_ap         text,                    -- "145 kV"
  dong_dien       text,                    -- "3150 A"
  dong_cat        text,                    -- "40 kA" (dòng cắt định mức)
  ngay_kiem_dinh  date,                    -- 2025-05-24
  dang_kiem_dinh  text,                    -- 'Lần đầu' / 'Định kỳ' / 'Đột xuất'
  dieu_kien_mt    text,                    -- Điều kiện môi trường
  phuong_phap     text,                    -- Phương pháp thử
  don_vi_dat_lam  text,                    -- Đơn vị đặt làm
  vi_tri_lap_dat  text,                    -- Vị trí lắp đặt chi tiết

  -- Metadata
  ocr_raw         jsonb,                   -- Dữ liệu raw từ Gemini (debug)
  ocr_confidence  real,                    -- 0.0 - 1.0
  ocr_provider    text DEFAULT 'gemini',   -- 'gemini', 'manual', 'tesseract'

  -- Match status
  match_status    text DEFAULT 'pending',
  -- 'pending' = chưa check
  -- 'matched' = match được với CongTacThiNghiem (cùng trạm + tên + ngày)
  -- 'not_in_db' = BBTN có nhưng DB chưa ghi nhận (CẢNH BÁO)
  -- 'manual_review' = cần admin xem lại

  matched_tn_id   bigint,                  -- ID trong CongTacThiNghiem nếu matched

  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_email   text,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bbtn_dang_check CHECK (
    dang_kiem_dinh IS NULL OR dang_kiem_dinh IN ('Lần đầu', 'Định kỳ', 'Đột xuất', 'Sửa chữa', 'Khác')
  ),
  CONSTRAINT bbtn_match_check CHECK (
    match_status IN ('pending', 'matched', 'not_in_db', 'manual_review')
  )
);

COMMENT ON TABLE public.bbtn_records IS 'Biên Bản Thí Nghiệm - kết quả OCR từ file Word/PDF/ảnh';

-- Indexes tăng tốc query
CREATE INDEX IF NOT EXISTS idx_bbtn_tram        ON public.bbtn_records(tram);
CREATE INDEX IF NOT EXISTS idx_bbtn_ten         ON public.bbtn_records(ten_thiet_bi);
CREATE INDEX IF NOT EXISTS idx_bbtn_serial      ON public.bbtn_records(so_che_tao);
CREATE INDEX IF NOT EXISTS idx_bbtn_ngay        ON public.bbtn_records(ngay_kiem_dinh DESC);
CREATE INDEX IF NOT EXISTS idx_bbtn_status      ON public.bbtn_records(match_status);
CREATE INDEX IF NOT EXISTS idx_bbtn_created     ON public.bbtn_records(created_at DESC);

-- Composite index cho query match: (Trạm + Tên + Ngày)
CREATE INDEX IF NOT EXISTS idx_bbtn_match_key
  ON public.bbtn_records(tram, ten_thiet_bi, ngay_kiem_dinh);

-- ─────────────────────────────────────────────────────────
-- 2. Bảng bbtn_alerts — cảnh báo BBTN chưa khớp DB
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbtn_alerts (
  id            bigserial PRIMARY KEY,
  bbtn_id       bigint NOT NULL REFERENCES public.bbtn_records(id) ON DELETE CASCADE,
  alert_type    text NOT NULL,
  -- 'not_in_db' = BBTN có nhưng DB chưa ghi nhận
  -- 'duplicate' = BBTN bị OCR 2 lần
  -- 'date_mismatch' = ngày trong BBTN khác ngày trong DB
  -- 'serial_mismatch' = serial trong BBTN khác serial trong DB
  message       text NOT NULL,
  severity      text NOT NULL DEFAULT 'warning',
  -- 'info' / 'warning' / 'error'
  resolved      boolean NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bbtn_alert_severity_check CHECK (severity IN ('info', 'warning', 'error')),
  CONSTRAINT bbtn_alert_type_check CHECK (alert_type IN (
    'not_in_db', 'duplicate', 'date_mismatch', 'serial_mismatch', 'missing_field', 'other'
  ))
);

CREATE INDEX IF NOT EXISTS idx_bbtn_alerts_unresolved
  ON public.bbtn_alerts(resolved, created_at DESC) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_bbtn_alerts_bbtn
  ON public.bbtn_alerts(bbtn_id);

-- ─────────────────────────────────────────────────────────
-- 3. Function check_bbtn_match() — gọi sau insert bbtn_records
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_bbtn_match(p_bbtn_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bbtn       record;
  v_match_id   bigint;
  v_alert_msg  text;
  v_status     text;
BEGIN
  -- Lấy thông tin BBTN vừa insert
  SELECT * INTO v_bbtn FROM public.bbtn_records WHERE id = p_bbtn_id;
  IF v_bbtn IS NULL THEN
    RAISE EXCEPTION 'BBTN id % not found', p_bbtn_id;
  END IF;

  -- Validate fields cần thiết
  IF v_bbtn.tram IS NULL OR v_bbtn.ten_thiet_bi IS NULL OR v_bbtn.ngay_kiem_dinh IS NULL THEN
    INSERT INTO public.bbtn_alerts (bbtn_id, alert_type, severity, message)
    VALUES (p_bbtn_id, 'missing_field', 'warning',
            'BBTN thiếu thông tin: ' ||
            CASE WHEN v_bbtn.tram IS NULL THEN 'Trạm, ' ELSE '' END ||
            CASE WHEN v_bbtn.ten_thiet_bi IS NULL THEN 'Tên TB, ' ELSE '' END ||
            CASE WHEN v_bbtn.ngay_kiem_dinh IS NULL THEN 'Ngày KĐ' ELSE '' END);

    UPDATE public.bbtn_records SET match_status = 'manual_review' WHERE id = p_bbtn_id;
    RETURN 'manual_review';
  END IF;

  -- Tìm match trong CongTacThiNghiem theo (Trạm + Tên TB + Ngày)
  -- LƯU Ý: tên cột trong CongTacThiNghiem có thể khác, sẽ verify ở Phase 2
  SELECT id INTO v_match_id
  FROM public."CongTacThiNghiem"
  WHERE
    LOWER(TRIM("Tram")) = LOWER(TRIM(v_bbtn.tram))
    AND LOWER(TRIM("Ten_thiet_bi")) = LOWER(TRIM(v_bbtn.ten_thiet_bi))
    AND "Thoi_gian_thi_nghiem_truoc"::date = v_bbtn.ngay_kiem_dinh
  LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    -- ✅ Matched
    v_status := 'matched';
    UPDATE public.bbtn_records
    SET match_status = 'matched', matched_tn_id = v_match_id, updated_at = now()
    WHERE id = p_bbtn_id;
  ELSE
    -- ❌ Không tìm thấy — TẠO CẢNH BÁO
    v_status := 'not_in_db';
    UPDATE public.bbtn_records
    SET match_status = 'not_in_db', updated_at = now()
    WHERE id = p_bbtn_id;

    v_alert_msg := format(
      'BBTN ngày %s cho thiết bị "%s" tại trạm "%s" CHƯA được ghi nhận trong CongTacThiNghiem. Cần kiểm tra và cập nhật.',
      to_char(v_bbtn.ngay_kiem_dinh, 'DD/MM/YYYY'),
      v_bbtn.ten_thiet_bi,
      v_bbtn.tram
    );

    INSERT INTO public.bbtn_alerts (bbtn_id, alert_type, severity, message)
    VALUES (p_bbtn_id, 'not_in_db', 'warning', v_alert_msg);
  END IF;

  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_bbtn_match(bigint) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 4. View tóm tắt cho dashboard widget
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.bbtn_unresolved_alerts AS
SELECT
  a.id          AS alert_id,
  a.bbtn_id,
  a.alert_type,
  a.severity,
  a.message,
  a.created_at  AS alert_created_at,
  b.tram,
  b.ten_thiet_bi,
  b.so_che_tao,
  b.ngay_kiem_dinh,
  b.file_name,
  b.file_url,
  b.created_email
FROM public.bbtn_alerts a
JOIN public.bbtn_records b ON b.id = a.bbtn_id
WHERE NOT a.resolved
ORDER BY a.created_at DESC;

GRANT SELECT ON public.bbtn_unresolved_alerts TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 5. RLS — chỉ admin INSERT/UPDATE/DELETE, ai cũng SELECT
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.bbtn_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbtn_alerts  ENABLE ROW LEVEL SECURITY;

-- bbtn_records policies
DROP POLICY IF EXISTS "bbtn_select_auth"   ON public.bbtn_records;
DROP POLICY IF EXISTS "bbtn_insert_admin"  ON public.bbtn_records;
DROP POLICY IF EXISTS "bbtn_update_admin"  ON public.bbtn_records;
DROP POLICY IF EXISTS "bbtn_delete_admin"  ON public.bbtn_records;

CREATE POLICY "bbtn_select_auth" ON public.bbtn_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bbtn_insert_admin" ON public.bbtn_records
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  ));

CREATE POLICY "bbtn_update_admin" ON public.bbtn_records
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  ));

CREATE POLICY "bbtn_delete_admin" ON public.bbtn_records
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  ));

-- bbtn_alerts policies
DROP POLICY IF EXISTS "bbtn_alerts_select_auth"   ON public.bbtn_alerts;
DROP POLICY IF EXISTS "bbtn_alerts_update_admin"  ON public.bbtn_alerts;

CREATE POLICY "bbtn_alerts_select_auth" ON public.bbtn_alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bbtn_alerts_update_admin" ON public.bbtn_alerts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  ));

-- GRANT cần thiết
GRANT SELECT ON public.bbtn_records TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bbtn_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bbtn_alerts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bbtn_records_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bbtn_alerts_id_seq TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 6. Storage bucket bbtn-files
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bbtn-files',
  'bbtn-files',
  false,           -- KHÔNG public — chỉ authenticated access
  20971520,        -- 20 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: chỉ admin upload/delete, authenticated user xem được
DROP POLICY IF EXISTS "bbtn_files_select_auth"  ON storage.objects;
DROP POLICY IF EXISTS "bbtn_files_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "bbtn_files_delete_admin" ON storage.objects;

CREATE POLICY "bbtn_files_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bbtn-files');

CREATE POLICY "bbtn_files_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bbtn-files'
    AND EXISTS (
      SELECT 1 FROM public.evn_user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND active = true
    )
  );

CREATE POLICY "bbtn_files_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bbtn-files'
    AND EXISTS (
      SELECT 1 FROM public.evn_user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND active = true
    )
  );

-- ─────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  records_count int;
  alerts_count  int;
  bucket_exists boolean;
  policies_count int;
BEGIN
  SELECT count(*) INTO records_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bbtn_records';
  SELECT count(*) INTO alerts_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bbtn_alerts';
  SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'bbtn-files') INTO bucket_exists;
  SELECT count(*) INTO policies_count FROM pg_policies
    WHERE tablename IN ('bbtn_records', 'bbtn_alerts');

  RAISE NOTICE '✅ bbtn_records: % cột', records_count;
  RAISE NOTICE '✅ bbtn_alerts: % cột', alerts_count;
  RAISE NOTICE '✅ Storage bucket bbtn-files: %', CASE WHEN bucket_exists THEN 'OK' ELSE 'FAIL' END;
  RAISE NOTICE '✅ RLS policies: %', policies_count;
END $$;

SELECT 'Phase 1: BBTN schema ready' AS status;
