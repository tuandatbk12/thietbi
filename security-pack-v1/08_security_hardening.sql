-- ════════════════════════════════════════════════════════════════
-- 08_security_hardening.sql
--
-- HARDENING bảo mật EVN Dashboard
-- 1. Audit log (ai làm gì khi nào)
-- 2. RLS chặt cho TongHopThietBi + CongTacThiNghiem (chỉ admin INSERT/UPDATE/DELETE)
-- 3. Block các bảng nội bộ với role=anon
-- 4. Function log_access() để frontend ghi action
--
-- Chạy trong Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/sql/new
--
-- ⚠️ AN TOÀN: chỉ THẮT CHẶT, không drop data, không break user thật
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- PHẦN 1: AUDIT LOG TABLE
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.access_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  action      text NOT NULL,           -- 'login', 'export_csv', 'view_serial', 'modify_data', ...
  resource    text,                    -- 'TongHopThietBi', 'BBTN/E1.1/T1.pdf', ...
  details     jsonb,                   -- thêm context (count, filter, ...)
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.access_log IS 'Audit log: mọi hành động trên dashboard';

CREATE INDEX IF NOT EXISTS idx_access_log_user
  ON public.access_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_log_action
  ON public.access_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_log_created
  ON public.access_log(created_at DESC);

-- RLS: ai cũng có thể INSERT log của mình, chỉ admin xem được
ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_log_insert_self" ON public.access_log;
CREATE POLICY "access_log_insert_self" ON public.access_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "access_log_select_admin" ON public.access_log;
CREATE POLICY "access_log_select_admin" ON public.access_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─────────────────────────────────────────────────────────
-- PHẦN 2: RLS THẮT CHẶT cho bảng dữ liệu chính
-- ─────────────────────────────────────────────────────────

-- TongHopThietBi: authenticated mới được SELECT, chỉ admin INSERT/UPDATE/DELETE
ALTER TABLE public."TongHopThietBi" ENABLE ROW LEVEL SECURITY;

-- DROP cũ nếu có (idempotent)
DROP POLICY IF EXISTS "Allow anon read" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "Public read" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "Enable read access for all users" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "thietbi_select_auth" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "thietbi_insert_admin" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "thietbi_update_admin" ON public."TongHopThietBi";
DROP POLICY IF EXISTS "thietbi_delete_admin" ON public."TongHopThietBi";

-- SELECT: chỉ user đã login (KHÔNG cho anon)
CREATE POLICY "thietbi_select_auth" ON public."TongHopThietBi"
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: chỉ admin
CREATE POLICY "thietbi_insert_admin" ON public."TongHopThietBi"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "thietbi_update_admin" ON public."TongHopThietBi"
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "thietbi_delete_admin" ON public."TongHopThietBi"
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─────────────────────────────────────────────────────────
-- CongTacThiNghiem: tương tự
-- ─────────────────────────────────────────────────────────
ALTER TABLE public."CongTacThiNghiem" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "Public read" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "Enable read access for all users" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "congtactn_select_auth" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "congtactn_insert_admin" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "congtactn_update_admin" ON public."CongTacThiNghiem";
DROP POLICY IF EXISTS "congtactn_delete_admin" ON public."CongTacThiNghiem";

CREATE POLICY "congtactn_select_auth" ON public."CongTacThiNghiem"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "congtactn_insert_admin" ON public."CongTacThiNghiem"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "congtactn_update_admin" ON public."CongTacThiNghiem"
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "congtactn_delete_admin" ON public."CongTacThiNghiem"
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─────────────────────────────────────────────────────────
-- evn_user_profiles: chỉ xem profile của mình + admin xem tất cả
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.evn_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.evn_user_profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.evn_user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.evn_user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.evn_user_profiles;
CREATE POLICY "profiles_update_admin" ON public.evn_user_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evn_user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─────────────────────────────────────────────────────────
-- PHẦN 3: HELPER FUNCTION - frontend gọi để log action
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action text,
  p_resource text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id bigint;
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.access_log (user_id, user_email, action, resource, details)
  VALUES (v_user_id, v_email, p_action, p_resource, p_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_user_action TO authenticated;

-- ─────────────────────────────────────────────────────────
-- PHẦN 4: VIEW thống kê audit log (cho admin dashboard)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.audit_summary AS
SELECT
  date_trunc('day', created_at)::date AS day,
  user_email,
  action,
  count(*) AS count
FROM public.access_log
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

GRANT SELECT ON public.audit_summary TO authenticated;

-- ─────────────────────────────────────────────────────────
-- PHẦN 5: REVOKE quyền nguy hiểm cho role anon
-- ─────────────────────────────────────────────────────────

-- Anon (chưa login) KHÔNG được làm gì cả với data
REVOKE ALL ON public."TongHopThietBi" FROM anon;
REVOKE ALL ON public."CongTacThiNghiem" FROM anon;
REVOKE ALL ON public.evn_user_profiles FROM anon;
REVOKE ALL ON public.access_log FROM anon;
REVOKE ALL ON public.data_versions FROM anon;
REVOKE ALL ON public.csv_imports_log FROM anon;

-- ─────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  policies_count int;
  rls_enabled int;
BEGIN
  SELECT count(*) INTO policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('TongHopThietBi', 'CongTacThiNghiem', 'evn_user_profiles', 'access_log');

  SELECT count(*) INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relname IN ('TongHopThietBi', 'CongTacThiNghiem', 'evn_user_profiles', 'access_log')
  AND c.relrowsecurity = true;

  RAISE NOTICE '✅ Bảo mật: % RLS policies, % bảng đã enable RLS', policies_count, rls_enabled;

  IF rls_enabled < 4 THEN
    RAISE WARNING 'Có bảng chưa enable RLS — kiểm tra lại';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────
-- Test sau khi chạy:
-- 1. Login user thường → mở Dashboard → vẫn xem được data (OK)
-- 2. Login user thường → thử INSERT vào TongHopThietBi → bị REJECT (OK)
-- 3. Logout → Anon Key fetch /rest/v1/TongHopThietBi → trả 401 (OK)
-- 4. Admin xem audit_summary → thấy log mới nhất (OK)
