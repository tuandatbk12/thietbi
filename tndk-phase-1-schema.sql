-- ════════════════════════════════════════════════════════════════
-- MODULE TNĐK — Phase 1: SQL Schema
--
-- Workflow:
--   - User thường: tạo + edit/delete RECORD CỦA MÌNH
--   - Admin: xem TẤT CẢ + delete bất kỳ
--   - Ảnh upload vào Supabase Storage bucket 'tndk-photos'
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1. Table: tndk_records (công tác TNĐK)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tndk_records (
  id              bigserial PRIMARY KEY,
  tram            text NOT NULL,                       -- "E1.1", "E1.24"...
  ngay_tn         date NOT NULL,                       -- ngày thí nghiệm
  ghi_chu         text,                                -- mô tả thêm
  uploaded_by     uuid REFERENCES auth.users(id),
  uploaded_email  text,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

-- Indexes hay dùng
CREATE INDEX IF NOT EXISTS idx_tndk_tram ON tndk_records(tram);
CREATE INDEX IF NOT EXISTS idx_tndk_ngay_tn ON tndk_records(ngay_tn DESC);
CREATE INDEX IF NOT EXISTS idx_tndk_uploader ON tndk_records(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_tndk_thang ON tndk_records(date_trunc('month', ngay_tn));

COMMENT ON TABLE tndk_records IS 'Công tác TNĐK — mỗi record 1 lần thí nghiệm tại 1 trạm';

-- ────────────────────────────────────────────────────────────
-- 2. Table: tndk_photos (ảnh BB — nhiều ảnh/record)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tndk_photos (
  id              bigserial PRIMARY KEY,
  record_id       bigint NOT NULL REFERENCES tndk_records(id) ON DELETE CASCADE,
  photo_url       text NOT NULL,                       -- public URL (signed)
  photo_path      text NOT NULL,                       -- internal path trong bucket
  file_name       text,
  file_size       bigint,
  mime_type       text,
  uploaded_at     timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tndk_photos_record ON tndk_photos(record_id);

COMMENT ON TABLE tndk_photos IS 'Ảnh BB xác nhận cho công tác TNĐK';

-- ────────────────────────────────────────────────────────────
-- 3. Auto-update updated_at trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_tndk_records()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_tndk ON tndk_records;
CREATE TRIGGER trg_touch_tndk
BEFORE UPDATE ON tndk_records
FOR EACH ROW EXECUTE FUNCTION touch_tndk_records();

-- ────────────────────────────────────────────────────────────
-- 4. RLS — tndk_records
-- ────────────────────────────────────────────────────────────
ALTER TABLE tndk_records ENABLE ROW LEVEL SECURITY;

-- Helper: check admin
-- (Có thể đã tồn tại từ migration trước, IF NOT EXISTS skip)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role text;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email = 'admin@example.com' THEN
    RETURN true;
  END IF;
  
  SELECT role INTO v_role FROM evn_user_profiles WHERE id = auth.uid();
  RETURN v_role = 'admin';
END $$;

-- SELECT: tất cả authenticated user đều xem được (user lẫn admin)
DROP POLICY IF EXISTS tndk_select ON tndk_records;
CREATE POLICY tndk_select ON tndk_records
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: tất cả authenticated user (admin + user) đều tạo được
DROP POLICY IF EXISTS tndk_insert ON tndk_records;
CREATE POLICY tndk_insert ON tndk_records
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Tự động set uploaded_by = mình
    uploaded_by = auth.uid()
  );

-- UPDATE: chỉ owner hoặc admin
DROP POLICY IF EXISTS tndk_update ON tndk_records;
CREATE POLICY tndk_update ON tndk_records
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR is_admin())
  WITH CHECK (uploaded_by = auth.uid() OR is_admin());

-- DELETE: chỉ owner hoặc admin
DROP POLICY IF EXISTS tndk_delete ON tndk_records;
CREATE POLICY tndk_delete ON tndk_records
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR is_admin());

-- Service role có full access (Edge Functions)
DROP POLICY IF EXISTS tndk_service_all ON tndk_records;
CREATE POLICY tndk_service_all ON tndk_records
  FOR ALL TO service_role
  USING (true);

-- ────────────────────────────────────────────────────────────
-- 5. RLS — tndk_photos (cùng quyền với records cha)
-- ────────────────────────────────────────────────────────────
ALTER TABLE tndk_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tndk_photos_select ON tndk_photos;
CREATE POLICY tndk_photos_select ON tndk_photos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS tndk_photos_insert ON tndk_photos;
CREATE POLICY tndk_photos_insert ON tndk_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Photo thuộc record của mình (hoặc admin)
    EXISTS (
      SELECT 1 FROM tndk_records 
      WHERE id = record_id 
        AND (uploaded_by = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS tndk_photos_delete ON tndk_photos;
CREATE POLICY tndk_photos_delete ON tndk_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tndk_records 
      WHERE id = record_id 
        AND (uploaded_by = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS tndk_photos_service_all ON tndk_photos;
CREATE POLICY tndk_photos_service_all ON tndk_photos
  FOR ALL TO service_role
  USING (true);

-- ────────────────────────────────────────────────────────────
-- 6. View: tram_options (dropdown source)
--    DISTINCT Tram từ TongHopThietBi
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tram_options AS
SELECT DISTINCT "Tram" as tram
FROM "TongHopThietBi"
WHERE "Tram" IS NOT NULL AND "Tram" != ''
ORDER BY "Tram";

-- ────────────────────────────────────────────────────────────
-- 7. View: tndk_records_with_photos (combine cho UI)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tndk_records_full AS
SELECT 
  r.id,
  r.tram,
  r.ngay_tn,
  r.ghi_chu,
  r.uploaded_by,
  r.uploaded_email,
  r.created_at,
  r.updated_at,
  -- Aggregate photos thành JSON array
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'id', p.id,
        'url', p.photo_url,
        'path', p.photo_path,
        'name', p.file_name,
        'size', p.file_size
      ) ORDER BY p.uploaded_at
    ) FROM tndk_photos p WHERE p.record_id = r.id),
    '[]'::json
  ) as photos,
  -- Photo count
  (SELECT count(*) FROM tndk_photos WHERE record_id = r.id) as photo_count
FROM tndk_records r;

-- ────────────────────────────────────────────────────────────
-- 8. View: tndk_monthly_stats (báo cáo tháng)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tndk_monthly_stats AS
SELECT 
  date_trunc('month', ngay_tn) as thang,
  count(*) as so_lan_tn,
  count(DISTINCT tram) as so_tram,
  count(DISTINCT uploaded_by) as so_nguoi_thuc_hien,
  (SELECT count(*) FROM tndk_photos p 
   JOIN tndk_records r ON p.record_id = r.id 
   WHERE date_trunc('month', r.ngay_tn) = date_trunc('month', tndk_records.ngay_tn)
  ) as tong_so_anh
FROM tndk_records
GROUP BY date_trunc('month', ngay_tn)
ORDER BY thang DESC;

-- ────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────
SELECT 'tndk_records created' as status, count(*) as rows FROM tndk_records
UNION ALL
SELECT 'tndk_photos created', count(*) FROM tndk_photos
UNION ALL  
SELECT 'tram_options', count(*) FROM tram_options;

-- Test view
SELECT * FROM tndk_monthly_stats LIMIT 5;
