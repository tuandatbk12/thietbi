-- ════════════════════════════════════════════════════════════════
-- chat_history — Log mọi câu hỏi/trả lời của AI chatbot
-- ════════════════════════════════════════════════════════════════

create table if not exists public.chat_history (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,
  question        text not null,
  answer          text,
  tool_calls      jsonb,
  input_tokens    int,
  output_tokens   int,
  duration_ms     int,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists ix_chat_history_user 
  on public.chat_history(user_id);
create index if not exists ix_chat_history_created 
  on public.chat_history(created_at desc);

alter table public.chat_history enable row level security;

drop policy if exists "admin_view_chats" on public.chat_history;
create policy "admin_view_chats"
  on public.chat_history for select
  using (
    exists (
      select 1 from public.evn_user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- View thống kê 24h
create or replace view public.chat_stats_24h as
select
  date_trunc('hour', created_at) as hour,
  count(*) as total_questions,
  count(*) filter (where error is not null) as errors,
  sum(input_tokens) as total_input_tokens,
  sum(output_tokens) as total_output_tokens,
  avg(duration_ms)::int as avg_duration_ms
from public.chat_history
where created_at > now() - interval '24 hours'
group by date_trunc('hour', created_at)
order by hour desc;
