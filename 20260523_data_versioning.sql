-- ════════════════════════════════════════════════════════════════
-- DATA VERSIONING SYSTEM — TongHopThietBi + CongTacThiNghiem
--
-- Mục tiêu:
--   1. Mỗi lần upload CSV mới = tạo 1 version mới
--   2. Lưu snapshot data CŨ vào bảng _history TRƯỚC khi REPLACE
--   3. Giữ 12 snapshot gần nhất (auto xóa cái 13+)
--   4. Tra cứu lịch sử qua view + helper functions
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1. data_versions — metadata mọi lần replace
-- ────────────────────────────────────────────────────────────
create table if not exists public.data_versions (
  id              bigserial primary key,
  table_name      text not null,                   -- 'TongHopThietBi' or 'CongTacThiNghiem'
  version_number  int not null,                    -- 1, 2, 3, ... (tự tăng per table)
  row_count       int,                              -- số rows trong snapshot
  uploaded_by     uuid references auth.users(id),
  uploaded_email  text,
  note            text,                              -- mô tả: "Upload Q1 2026", "Sửa lỗi sai mã trạm"
  csv_file_name   text,                              -- tên file CSV gốc
  csv_size_bytes  bigint,
  created_at      timestamptz not null default now(),
  
  unique(table_name, version_number)
);

create index if not exists ix_data_versions_table_time 
  on public.data_versions(table_name, created_at desc);

comment on table public.data_versions is 
  'Metadata của mỗi lần replace bảng. Mỗi row = 1 snapshot version đã được lưu trong bảng _history.';

-- ────────────────────────────────────────────────────────────
-- 2. TongHopThietBi_history — lưu mọi snapshot
-- ────────────────────────────────────────────────────────────
create table if not exists public."TongHopThietBi_history" (
  history_id      bigserial primary key,
  version_id      bigint not null references public.data_versions(id) on delete cascade,
  archived_at     timestamptz not null default now(),
  
  -- Copy MỌI cột của TongHopThietBi (snapshot exactly as-is)
  "Id"            int,
  "Tram"          text,
  "Ngan_thiet_bi" text,
  "Ten_thiet_bi"  text,
  "Phan_loai_thiet_bi" text,
  "Cap_dien_ap"   text,
  "So_luong"      text,
  "Don_vi_tinh"   text,
  "Ly_lich"       text,
  "Hang_san_xuat" text,
  "Kieu"          text,
  "Thong_so"      text,
  "Dien_ap"       text,
  "Cong_suat"     text,
  "Nam_san_xuat"  text,
  "Nam_van_hanh"  text,
  "Serial"        text,
  "Doi"           text,
  "Chung_loai_DCL" text,
  "Loai_ngan_lo"  text
);

create index if not exists ix_thietbi_history_version 
  on public."TongHopThietBi_history"(version_id);
create index if not exists ix_thietbi_history_tram 
  on public."TongHopThietBi_history"("Tram");
create index if not exists ix_thietbi_history_serial 
  on public."TongHopThietBi_history"("Serial") where "Serial" is not null and "Serial" != '';

-- ────────────────────────────────────────────────────────────
-- 3. CongTacThiNghiem_history
-- ────────────────────────────────────────────────────────────
-- LƯU Ý: cấu trúc chính xác sẽ được tạo từ structure của bảng CongTacThiNghiem hiện tại
-- Function sau sẽ tự handle dynamic columns

-- Tạo bảng history dynamic từ cấu trúc CongTacThiNghiem hiện tại
do $$
declare
  col_list text;
  v_sql text;
begin
  -- Kiểm tra nếu bảng đã tồn tại thì skip
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='CongTacThiNghiem_history'
  ) then
    raise notice 'Bảng CongTacThiNghiem_history đã tồn tại, skip';
    return;
  end if;
  
  -- Kiểm tra bảng gốc có không
  if not exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='CongTacThiNghiem'
  ) then
    raise notice 'CongTacThiNghiem chưa tồn tại — skip tạo history';
    return;
  end if;
  
  -- Build column list từ bảng gốc
  select string_agg(format('%I %s', column_name, 
    case data_type 
      when 'character varying' then 'text'
      when 'integer' then 'int'
      when 'bigint' then 'bigint'
      when 'boolean' then 'boolean'
      when 'timestamp with time zone' then 'timestamptz'
      when 'timestamp without time zone' then 'timestamp'
      when 'date' then 'date'
      when 'numeric' then 'numeric'
      when 'jsonb' then 'jsonb'
      else 'text'
    end
  ), ', ' order by ordinal_position)
  into col_list
  from information_schema.columns
  where table_schema='public' and table_name='CongTacThiNghiem';
  
  -- Tạo bảng
  v_sql := format($f$
    create table public."CongTacThiNghiem_history" (
      history_id bigserial primary key,
      version_id bigint not null references public.data_versions(id) on delete cascade,
      archived_at timestamptz not null default now(),
      %s
    )
  $f$, col_list);
  
  execute v_sql;
  
  -- Index version
  execute 'create index ix_ctn_history_version on public."CongTacThiNghiem_history"(version_id)';
  
  raise notice 'Đã tạo bảng CongTacThiNghiem_history với % cột', (select count(*) from information_schema.columns where table_schema='public' and table_name='CongTacThiNghiem');
end $$;

-- ────────────────────────────────────────────────────────────
-- 4. csv_imports_log — audit upload (ai, khi nào, file gì)
-- ────────────────────────────────────────────────────────────
create table if not exists public.csv_imports_log (
  id              bigserial primary key,
  table_name      text not null,
  uploaded_by     uuid references auth.users(id),
  uploaded_email  text,
  file_name       text,
  file_size_bytes bigint,
  row_count       int,
  status          text not null,    -- 'success' | 'failed' | 'rolled_back'
  error_message   text,
  version_id      bigint references public.data_versions(id),  -- null nếu fail
  duration_ms     int,
  created_at      timestamptz not null default now()
);

create index if not exists ix_csv_imports_table_time 
  on public.csv_imports_log(table_name, created_at desc);

-- ────────────────────────────────────────────────────────────
-- 5. FUNCTION: archive_and_replace_thietbi(jsonb, note)
-- 
-- Workflow:
--   1. Tạo version mới (version N+1)
--   2. Copy current TongHopThietBi → _history với version_id mới
--   3. TRUNCATE TongHopThietBi
--   4. Insert data mới từ p_new_data (jsonb array)
--   5. Cleanup: xóa version 13+ (giữ 12 mới nhất)
--   6. Log vào csv_imports_log
-- ────────────────────────────────────────────────────────────
create or replace function public.archive_and_replace_thietbi(
  p_new_data      jsonb,           -- mảng [{col1: val, col2: val}, ...]
  p_note          text default null,
  p_csv_file_name text default null,
  p_csv_size      bigint default null,
  p_uploaded_by   uuid default null,
  p_uploaded_email text default null
)
returns table (
  new_version_id  bigint,
  archived_rows   int,
  inserted_rows   int,
  pruned_versions int
)
language plpgsql
security definer
as $$
declare
  v_old_count       int;
  v_new_count       int;
  v_next_version    int;
  v_new_version_id  bigint;
  v_pruned          int := 0;
  v_t0              timestamptz := clock_timestamp();
begin
  -- 1. Đếm số rows hiện tại
  select count(*) into v_old_count from public."TongHopThietBi";
  
  -- 2. Lấy version number tiếp theo
  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.data_versions
  where table_name = 'TongHopThietBi';
  
  -- 3. Insert metadata
  insert into public.data_versions (
    table_name, version_number, row_count, 
    uploaded_by, uploaded_email, note, csv_file_name, csv_size_bytes
  ) values (
    'TongHopThietBi', v_next_version, v_old_count,
    p_uploaded_by, p_uploaded_email, p_note, p_csv_file_name, p_csv_size
  )
  returning id into v_new_version_id;
  
  -- 4. Archive: COPY current rows → _history
  insert into public."TongHopThietBi_history" (
    version_id,
    "Id", "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap", "So_luong", "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat", "Nam_san_xuat",
    "Nam_van_hanh", "Serial", "Doi", "Chung_loai_DCL", "Loai_ngan_lo"
  )
  select
    v_new_version_id,
    "Id", "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap", "So_luong", "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat", "Nam_san_xuat",
    "Nam_van_hanh", "Serial", "Doi", "Chung_loai_DCL", "Loai_ngan_lo"
  from public."TongHopThietBi";
  
  -- 5. TRUNCATE bảng chính
  truncate public."TongHopThietBi";
  
  -- 6. Insert data MỚI từ jsonb
  insert into public."TongHopThietBi" (
    "Id", "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap", "So_luong", "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat", "Nam_san_xuat",
    "Nam_van_hanh", "Serial", "Doi", "Chung_loai_DCL", "Loai_ngan_lo"
  )
  select
    nullif(r->>'Id', '')::int,
    r->>'Tram',
    r->>'Ngan_thiet_bi',
    r->>'Ten_thiet_bi',
    r->>'Phan_loai_thiet_bi',
    r->>'Cap_dien_ap',
    r->>'So_luong',
    r->>'Don_vi_tinh',
    r->>'Ly_lich',
    r->>'Hang_san_xuat',
    r->>'Kieu',
    r->>'Thong_so',
    r->>'Dien_ap',
    r->>'Cong_suat',
    r->>'Nam_san_xuat',
    r->>'Nam_van_hanh',
    r->>'Serial',
    r->>'Doi',
    r->>'Chung_loai_DCL',
    r->>'Loai_ngan_lo'
  from jsonb_array_elements(p_new_data) r;
  
  -- 7. Update row_count thật trong metadata
  select count(*) into v_new_count from public."TongHopThietBi";
  
  -- 8. CLEANUP: xóa version cũ (giữ 12 mới nhất)
  -- Khi xóa version, ON DELETE CASCADE sẽ xóa rows trong _history luôn
  with old_versions as (
    select id 
    from public.data_versions
    where table_name = 'TongHopThietBi'
    order by version_number desc
    offset 12
  )
  delete from public.data_versions 
  where id in (select id from old_versions);
  
  get diagnostics v_pruned = row_count;
  
  -- 9. Audit log
  insert into public.csv_imports_log (
    table_name, uploaded_by, uploaded_email,
    file_name, file_size_bytes, row_count,
    status, version_id, duration_ms
  ) values (
    'TongHopThietBi', p_uploaded_by, p_uploaded_email,
    p_csv_file_name, p_csv_size, v_new_count,
    'success', v_new_version_id,
    extract(epoch from (clock_timestamp() - v_t0)) * 1000
  );
  
  return query select v_new_version_id, v_old_count, v_new_count, v_pruned;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. FUNCTION: archive_and_replace_congtactn(jsonb, note, ...)
-- Dùng dynamic SQL vì schema có thể khác
-- ────────────────────────────────────────────────────────────
create or replace function public.archive_and_replace_congtactn(
  p_new_data      jsonb,
  p_note          text default null,
  p_csv_file_name text default null,
  p_csv_size      bigint default null,
  p_uploaded_by   uuid default null,
  p_uploaded_email text default null
)
returns table (
  new_version_id  bigint,
  archived_rows   int,
  inserted_rows   int,
  pruned_versions int
)
language plpgsql
security definer
as $$
declare
  v_old_count       int;
  v_new_count       int;
  v_next_version    int;
  v_new_version_id  bigint;
  v_pruned          int := 0;
  v_cols            text;
  v_cols_select     text;
  v_cols_insert     text;
  v_t0              timestamptz := clock_timestamp();
begin
  -- Check bảng tồn tại
  if not exists (select 1 from information_schema.tables 
                 where table_schema='public' and table_name='CongTacThiNghiem') then
    raise exception 'Bảng CongTacThiNghiem chưa tồn tại';
  end if;
  
  -- Đếm rows hiện tại
  execute 'select count(*) from public."CongTacThiNghiem"' into v_old_count;
  
  -- Version mới
  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.data_versions
  where table_name = 'CongTacThiNghiem';
  
  -- Insert metadata
  insert into public.data_versions (
    table_name, version_number, row_count, 
    uploaded_by, uploaded_email, note, csv_file_name, csv_size_bytes
  ) values (
    'CongTacThiNghiem', v_next_version, v_old_count,
    p_uploaded_by, p_uploaded_email, p_note, p_csv_file_name, p_csv_size
  )
  returning id into v_new_version_id;
  
  -- Build column list (dynamic)
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema='public' and table_name='CongTacThiNghiem';
  
  -- Archive: copy current → _history
  execute format(
    'insert into public."CongTacThiNghiem_history" (version_id, %s)
     select %L::bigint, %s from public."CongTacThiNghiem"',
    v_cols, v_new_version_id, v_cols
  );
  
  -- TRUNCATE
  execute 'truncate public."CongTacThiNghiem"';
  
  -- Insert MỚI từ jsonb
  -- Build SELECT từng cột dạng r->>'col_name' (mọi cột parse as text)
  select string_agg(
    format('(r->>%L)', column_name), 
    ', ' 
    order by ordinal_position
  )
  into v_cols_select
  from information_schema.columns
  where table_schema='public' and table_name='CongTacThiNghiem';
  
  execute format(
    'insert into public."CongTacThiNghiem" (%s)
     select %s from jsonb_array_elements(%L::jsonb) r',
    v_cols, v_cols_select, p_new_data
  );
  
  execute 'select count(*) from public."CongTacThiNghiem"' into v_new_count;
  
  -- Cleanup old versions (giữ 12)
  with old_versions as (
    select id 
    from public.data_versions
    where table_name = 'CongTacThiNghiem'
    order by version_number desc
    offset 12
  )
  delete from public.data_versions 
  where id in (select id from old_versions);
  
  get diagnostics v_pruned = row_count;
  
  insert into public.csv_imports_log (
    table_name, uploaded_by, uploaded_email,
    file_name, file_size_bytes, row_count,
    status, version_id, duration_ms
  ) values (
    'CongTacThiNghiem', p_uploaded_by, p_uploaded_email,
    p_csv_file_name, p_csv_size, v_new_count,
    'success', v_new_version_id,
    extract(epoch from (clock_timestamp() - v_t0)) * 1000
  );
  
  return query select v_new_version_id, v_old_count, v_new_count, v_pruned;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. VIEW: list_versions — quick browse
-- ────────────────────────────────────────────────────────────
create or replace view public.data_versions_overview as
select
  v.id as version_id,
  v.table_name,
  v.version_number,
  v.row_count,
  v.note,
  v.csv_file_name,
  pg_size_pretty(v.csv_size_bytes) as csv_size,
  v.uploaded_email,
  to_char(v.created_at, 'DD/MM/YYYY HH24:MI') as uploaded_at,
  age(now(), v.created_at) as age
from public.data_versions v
order by v.created_at desc;

-- ────────────────────────────────────────────────────────────
-- 8. RLS: chỉ admin xem history + replace
-- ────────────────────────────────────────────────────────────
alter table public.data_versions enable row level security;
alter table public."TongHopThietBi_history" enable row level security;
alter table public.csv_imports_log enable row level security;

-- Admin có thể xem tất cả
drop policy if exists "admin_read_versions" on public.data_versions;
create policy "admin_read_versions" on public.data_versions
  for select using (
    exists (
      select 1 from public.evn_user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "admin_read_history" on public."TongHopThietBi_history";
create policy "admin_read_history" on public."TongHopThietBi_history"
  for select using (
    exists (
      select 1 from public.evn_user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "admin_read_imports" on public.csv_imports_log;
create policy "admin_read_imports" on public.csv_imports_log
  for select using (
    exists (
      select 1 from public.evn_user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 9. SAMPLE QUERIES (tham khảo)
-- ────────────────────────────────────────────────────────────

-- a. Liệt kê các version hiện có
-- select * from data_versions_overview;

-- b. So sánh version cũ với hiện tại
/*
with v_old as (
  select * from "TongHopThietBi_history" 
  where version_id = (select id from data_versions where table_name='TongHopThietBi' order by version_number desc offset 1 limit 1)
),
v_new as (select * from "TongHopThietBi")
select 
  (select count(*) from v_old) as old_count,
  (select count(*) from v_new) as new_count;
*/

-- c. Tìm thiết bị từng tồn tại trong quá khứ
/*
select dv.version_number, dv.note, dv.created_at, h.*
from "TongHopThietBi_history" h
join data_versions dv on dv.id = h.version_id
where h."Serial" = 'VN00068'
order by dv.version_number desc;
*/

-- d. Xem log upload gần đây
/*
select created_at, table_name, uploaded_email, status, row_count, duration_ms || 'ms' as dur
from csv_imports_log
order by created_at desc
limit 20;
*/
