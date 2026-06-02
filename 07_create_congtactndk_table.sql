-- ════════════════════════════════════════════════════════════════
-- Migration 07: Tạo bảng CongTacTNDK (Báo cáo, theo dõi kết quả TN thực địa)
--
-- Chạy trong Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/sql/new
--
-- Mục đích:
--   - Lưu các bản ghi "Công tác TNĐK" / "Báo cáo kết quả TN thực địa"
--   - Mỗi bản ghi gắn với 1 trạm, ngày TN, ghi chú, người thực hiện
--   - Ảnh Biên Bản (BB) lưu URL trong cột photos (jsonb array)
--
-- Bước 2 (sau khi chạy SQL này): Tạo Storage bucket thủ công trong Dashboard:
--   https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/storage/buckets
--   → New bucket → Name: congtactndk-photos → Public: ON → Save
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 1. Tạo bảng chính CongTacTNDK
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."CongTacTNDK" (
  id          bigserial PRIMARY KEY,
  tram        text      NOT NULL,
  ngay_tn     date      NOT NULL,
  ghi_chu     text,
  nguoi_th    text,                      -- email người thực hiện
  photos      jsonb     NOT NULL DEFAULT '[]'::jsonb,
  -- photos format: [{"url": "https://...", "name": "anh1.jpg"}, ...]
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."CongTacTNDK"
  IS 'Báo cáo, theo dõi kết quả thực hiện (Công tác TNĐK thực địa)';
COMMENT ON COLUMN public."CongTacTNDK".photos
  IS 'Array JSON: [{"url":"https://...","name":"anh.jpg"}, ...]';

-- ─────────────────────────────────────
-- 2. Index tìm kiếm nhanh
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_congtactndk_tram
  ON public."CongTacTNDK"(tram);

CREATE INDEX IF NOT EXISTS idx_congtactndk_ngay
  ON public."CongTacTNDK"(ngay_tn DESC);

CREATE INDEX IF NOT EXISTS idx_congtactndk_created_by
  ON public."CongTacTNDK"(created_by);

-- Index trên tháng để filter tháng nhanh
CREATE INDEX IF NOT EXISTS idx_congtactndk_month
  ON public."CongTacTNDK"(date_trunc('month', ngay_tn));

-- ─────────────────────────────────────
-- 3. Trigger auto-update updated_at
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_congtactndk_updated_at ON public."CongTacTNDK";
CREATE TRIGGER trg_congtactndk_updated_at
  BEFORE UPDATE ON public."CongTacTNDK"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────
-- 4. Enable RLS
-- ─────────────────────────────────────
ALTER TABLE public."CongTacTNDK" ENABLE ROW LEVEL SECURITY;

-- Mọi user đã đăng nhập có thể xem tất cả
DROP POLICY IF EXISTS "congtactndk_select_auth" ON public."CongTacTNDK";
CREATE POLICY "congtactndk_select_auth"
  ON public."CongTacTNDK" FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: mọi user đăng nhập (gắn created_by tự động)
DROP POLICY IF EXISTS "congtactndk_insert_auth" ON public."CongTacTNDK";
CREATE POLICY "congtactndk_insert_auth"
  ON public."CongTacTNDK" FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: chỉ người tạo hoặc admin
DROP POLICY IF EXISTS "congtactndk_update_own" ON public."CongTacTNDK";
CREATE POLICY "congtactndk_update_own"
  ON public."CongTacTNDK" FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.evn_user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: chỉ người tạo hoặc admin
DROP POLICY IF EXISTS "congtactndk_delete_own" ON public."CongTacTNDK";
CREATE POLICY "congtactndk_delete_own"
  ON public."CongTacTNDK" FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.evn_user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────
-- 5. Storage bucket policies (SQL approach)
--    Nếu bucket đã tạo qua Dashboard, chạy phần này để set policies
-- ─────────────────────────────────────

-- Cho phép authenticated users upload ảnh vào bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'congtactndk-photos',
  'congtactndk-photos',
  true,        -- public: ai cũng xem được URL (dùng để hiển thị ảnh)
  10485760,    -- 10 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: authenticated users có thể upload
DROP POLICY IF EXISTS "congtactndk_photos_insert" ON storage.objects;
CREATE POLICY "congtactndk_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'congtactndk-photos');

-- Storage RLS: ai cũng xem được (bucket public)
DROP POLICY IF EXISTS "congtactndk_photos_select" ON storage.objects;
CREATE POLICY "congtactndk_photos_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'congtactndk-photos');

-- Storage RLS: chỉ người upload hoặc admin mới xóa được
DROP POLICY IF EXISTS "congtactndk_photos_delete" ON storage.objects;
CREATE POLICY "congtactndk_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'congtactndk-photos'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.evn_user_profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ─────────────────────────────────────
-- 6. Verify
-- ─────────────────────────────────────
DO $$
DECLARE
  col_count int;
  policy_count int;
BEGIN
  SELECT count(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'CongTacTNDK';

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'CongTacTNDK';

  RAISE NOTICE '✅ CongTacTNDK: % cột, % RLS policies', col_count, policy_count;

  IF col_count < 8 THEN
    RAISE EXCEPTION '❌ Thiếu cột — kiểm tra lại CREATE TABLE';
  END IF;
END $$;

-- ─────────────────────────────────────
-- DONE
-- Bước tiếp theo:
--   1. Vào Storage > Buckets > congtactndk-photos → đảm bảo Public = ON
--   2. Chạy fix-congtactndk-nav-v1.sh trong thư mục thietbi/ (git repo)
--   3. Bump sw.js cache version → commit + push
-- ─────────────────────────────────────
