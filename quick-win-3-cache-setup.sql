-- ════════════════════════════════════════════════════════════════
-- QUICK WIN #3 — AI Query Cache
--
-- Mục đích: Cache câu trả lời AI để giảm 70% Gemini cost
-- - TTL: 24 giờ
-- - Invalidate: khi upload CSV mới (trừ history queries)
-- - Hash question để match câu hỏi tương tự
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1. Cache table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_cache (
  id              bigserial PRIMARY KEY,
  question_hash   text UNIQUE NOT NULL,
  question        text NOT NULL,
  answer          text NOT NULL,
  tool_calls      jsonb DEFAULT '[]'::jsonb,
  cached_at       timestamp DEFAULT now(),
  expires_at      timestamp DEFAULT (now() + interval '24 hours'),
  hit_count       int DEFAULT 0,
  last_hit_at     timestamp,
  references_history boolean DEFAULT false  -- true nếu query về version history
);

CREATE INDEX IF NOT EXISTS idx_cache_hash 
  ON chat_cache(question_hash);

CREATE INDEX IF NOT EXISTS idx_cache_expires 
  ON chat_cache(expires_at) 
  WHERE expires_at > now();

CREATE INDEX IF NOT EXISTS idx_cache_history 
  ON chat_cache(references_history);

COMMENT ON TABLE chat_cache IS 
  'AI query cache — giảm Gemini API cost. TTL 24h, auto-invalidate khi upload CSV mới.';

-- ────────────────────────────────────────────────────────────
-- 2. RLS: chỉ admin xem được
-- ────────────────────────────────────────────────────────────
ALTER TABLE chat_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_select_cache ON chat_cache
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evn_user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@example.com'
  );

CREATE POLICY admin_all_cache ON chat_cache
  FOR ALL TO service_role
  USING (true);

-- ────────────────────────────────────────────────────────────
-- 3. Function: lookup cache
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lookup_chat_cache(p_hash text)
RETURNS table(
  answer text,
  tool_calls jsonb,
  cached_at timestamp,
  hit_count int
)
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- Update hit counter atomically
  UPDATE chat_cache 
  SET hit_count = hit_count + 1,
      last_hit_at = now()
  WHERE question_hash = p_hash 
    AND expires_at > now()
  RETURNING chat_cache.answer, chat_cache.tool_calls, chat_cache.cached_at, chat_cache.hit_count
  INTO answer, tool_calls, cached_at, hit_count;
  
  IF FOUND THEN
    RETURN NEXT;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Function: save to cache
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_chat_cache(
  p_hash text,
  p_question text,
  p_answer text,
  p_tool_calls jsonb,
  p_references_history boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO chat_cache (
    question_hash, question, answer, tool_calls, 
    references_history,
    expires_at
  ) VALUES (
    p_hash, p_question, p_answer, p_tool_calls,
    p_references_history,
    -- Cache history queries longer (vì data không đổi)
    CASE WHEN p_references_history 
         THEN now() + interval '7 days'
         ELSE now() + interval '24 hours'
    END
  )
  ON CONFLICT (question_hash) 
  DO UPDATE SET
    answer = EXCLUDED.answer,
    tool_calls = EXCLUDED.tool_calls,
    cached_at = now(),
    expires_at = EXCLUDED.expires_at,
    hit_count = 0
  RETURNING id INTO v_id;
  
  RETURN v_id;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. Trigger: auto-invalidate live queries khi upload CSV mới
--    Giữ lại history queries (không bị ảnh hưởng bởi data mới)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invalidate_cache_on_upload()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Xóa cache cho live queries (không refer đến history)
  DELETE FROM chat_cache 
  WHERE NOT references_history
    AND cached_at < now() - interval '1 minute';  -- buffer 1 phút
  
  RAISE NOTICE 'Cache invalidated after upload to %', NEW.table_name;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invalidate_cache ON data_versions;
CREATE TRIGGER trg_invalidate_cache
AFTER INSERT ON data_versions
FOR EACH ROW EXECUTE FUNCTION invalidate_cache_on_upload();

-- ────────────────────────────────────────────────────────────
-- 6. View: cache stats (admin xem được)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW chat_cache_stats AS
SELECT 
  count(*) as total_entries,
  count(*) FILTER (WHERE expires_at > now()) as active_entries,
  count(*) FILTER (WHERE references_history) as history_entries,
  sum(hit_count) as total_hits,
  round(avg(hit_count)::numeric, 1) as avg_hits_per_entry,
  pg_size_pretty(pg_total_relation_size('chat_cache')) as table_size,
  -- Cost saved estimate (Gemini 2.0 Flash: ~10đ/query)
  sum(hit_count) * 10 as estimated_vnd_saved
FROM chat_cache;

-- ────────────────────────────────────────────────────────────
-- 7. Cleanup function (cron-able)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM chat_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────
SELECT 'chat_cache table created' as status, count(*) as rows FROM chat_cache;
SELECT * FROM chat_cache_stats;
