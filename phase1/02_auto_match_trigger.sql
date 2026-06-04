-- 
-- V79: Auto-match trigger
-- Tự động gọi check_bbtn_match() sau khi insert record mới
--  Không cần bấm "Đối chiếu DB" thủ công
-- 

CREATE OR REPLACE FUNCTION public.tr_auto_check_bbtn_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Gọi check_bbtn_match. Nếu lỗi  log warning nhưng không fail insert
  BEGIN
    PERFORM public.check_bbtn_match(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Auto-match failed for bbtn id %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_check_bbtn_match ON public.bbtn_records;

CREATE TRIGGER trg_auto_check_bbtn_match
  AFTER INSERT ON public.bbtn_records
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_auto_check_bbtn_match();

COMMENT ON TRIGGER trg_auto_check_bbtn_match ON public.bbtn_records
  IS 'V79: Tự đối chiếu sau insert. Disable: ALTER TABLE bbtn_records DISABLE TRIGGER trg_auto_check_bbtn_match;';

-- Verify
SELECT 'Trigger created' AS status, tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_auto_check_bbtn_match';
