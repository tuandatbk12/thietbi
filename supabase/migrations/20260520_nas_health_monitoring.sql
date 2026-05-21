-- ════════════════════════════════════════════════════════════════
-- NAS Health Monitoring — Reference Schema
--
-- ⚠️  Bạn đã có nas_health_log + nas_health_summary trên Supabase.
-- File này CHỈ là tham chiếu để code nas-health-check insert đúng cột.
-- Nếu schema thực tế khác → sửa lại các tên cột trong Edge Function
-- (nas-health-check/index.ts → function writeHealthLog).
--
-- Để kiểm tra schema thực tế của bạn, chạy:
--   \d public.nas_health_log
-- hoặc:
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'nas_health_log'
--   order by ordinal_position;
-- ════════════════════════════════════════════════════════════════

-- Log table (1 row mỗi lần health check)
create table if not exists public.nas_health_log (
  id              bigserial primary key,
  status          text        not null,            -- 'ok'|'timeout'|'auth_failed'|'unreachable'|'partial'|'error'
  detail          text,                            -- mô tả human-readable
  latency_ms      integer,
  nas_reachable   boolean,
  nas_auth        boolean,
  bbtn_ok         boolean,
  asset_ok        boolean,
  checked_at      timestamptz not null default now()
);

create index if not exists idx_nas_health_log_checked_at on public.nas_health_log(checked_at desc);
create index if not exists idx_nas_health_log_status     on public.nas_health_log(status);

-- View aggregate 24h
create or replace view public.nas_health_summary as
with recent as (
  select * from public.nas_health_log
  where checked_at > now() - interval '24 hours'
),
latest as (
  select status, detail, checked_at
  from public.nas_health_log
  order by checked_at desc
  limit 1
)
select
  (select status     from latest) as latest_status,
  (select detail     from latest) as latest_detail,
  (select checked_at from latest) as last_checked,
  (select count(*)   from recent where status = 'ok')  as ok_24h,
  (select count(*)   from recent where status <> 'ok') as fail_24h,
  case
    when (select count(*) from recent) = 0 then null
    else round(
      100.0 * (select count(*) from recent where status = 'ok')
            / nullif((select count(*) from recent), 0),
      2
    )
  end as uptime_pct_24h;

-- Cron job tự động ping mỗi phút (tùy chọn — dùng pg_cron extension)
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'nas-health-every-minute',
--   '* * * * *',
--   $$
--     select net.http_get(
--       url := 'https://xqqmfmljwycpehfyknoy.supabase.co/functions/v1/nas-health-check',
--       headers := jsonb_build_object('apikey', current_setting('app.anon_key', true))
--     );
--   $$
-- );

-- RLS — admin xem được hết, user thường chỉ xem summary
alter table public.nas_health_log enable row level security;

drop policy if exists "admin_view_health_log" on public.nas_health_log;
create policy "admin_view_health_log"
  on public.nas_health_log for select
  using ((auth.jwt() ->> 'role') = 'admin');

-- Insert do Edge Function (service_role) làm — bypass RLS, không cần policy insert.
