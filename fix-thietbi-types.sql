-- ════════════════════════════════════════════════════════════════
-- FIX: archive_and_replace_thietbi — Cast đúng type cho 7 cột số
--
-- Schema thực:
--   Id, Cong_suat            → bigint
--   Cap_dien_ap, So_luong, Nam_san_xuat, Nam_van_hanh, Chung_loai_DCL → numeric
--   Còn lại                  → text
-- ════════════════════════════════════════════════════════════════

create or replace function public.archive_and_replace_thietbi(
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
  v_t0              timestamptz := clock_timestamp();
begin
  select count(*) into v_old_count from public."TongHopThietBi";
  
  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.data_versions
  where table_name = 'TongHopThietBi';
  
  insert into public.data_versions (
    table_name, version_number, row_count, 
    uploaded_by, uploaded_email, note, csv_file_name, csv_size_bytes
  ) values (
    'TongHopThietBi', v_next_version, v_old_count,
    p_uploaded_by, p_uploaded_email, p_note, p_csv_file_name, p_csv_size
  )
  returning id into v_new_version_id;
  
  -- Archive current → history (cast giống bảng gốc nhưng history bảng tất cả là text — OK)
  -- Lưu ý: history table có cùng schema với main table về cột data, có thêm history_id, version_id, archived_at
  insert into public."TongHopThietBi_history" (
    version_id,
    "Id", "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap", "So_luong", "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat", "Nam_san_xuat",
    "Nam_van_hanh", "Serial", "Doi", "Chung_loai_DCL", "Loai_ngan_lo"
  )
  select
    v_new_version_id,
    "Id"::text, "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap"::text, "So_luong"::text, "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat"::text, "Nam_san_xuat"::text,
    "Nam_van_hanh"::text, "Serial", "Doi", "Chung_loai_DCL"::text, "Loai_ngan_lo"
  from public."TongHopThietBi";
  
  -- TRUNCATE
  truncate public."TongHopThietBi";
  
  -- ⭐ INSERT MỚI — cast TYPES ĐÚNG cho từng cột
  insert into public."TongHopThietBi" (
    "Id", "Tram", "Ngan_thiet_bi", "Ten_thiet_bi", "Phan_loai_thiet_bi",
    "Cap_dien_ap", "So_luong", "Don_vi_tinh", "Ly_lich", "Hang_san_xuat",
    "Kieu", "Thong_so", "Dien_ap", "Cong_suat", "Nam_san_xuat",
    "Nam_van_hanh", "Serial", "Doi", "Chung_loai_DCL", "Loai_ngan_lo"
  )
  select
    nullif(r->>'Id', '')::bigint,                  -- bigint
    r->>'Tram',                                     -- text
    r->>'Ngan_thiet_bi',                            -- text
    r->>'Ten_thiet_bi',                             -- text
    r->>'Phan_loai_thiet_bi',                       -- text
    nullif(r->>'Cap_dien_ap', '')::numeric,         -- numeric ⭐
    nullif(r->>'So_luong', '')::numeric,            -- numeric ⭐
    r->>'Don_vi_tinh',                              -- text
    r->>'Ly_lich',                                  -- text
    r->>'Hang_san_xuat',                            -- text
    r->>'Kieu',                                     -- text
    r->>'Thong_so',                                 -- text
    r->>'Dien_ap',                                  -- text
    nullif(r->>'Cong_suat', '')::bigint,            -- bigint ⭐
    nullif(r->>'Nam_san_xuat', '')::numeric,        -- numeric ⭐
    nullif(r->>'Nam_van_hanh', '')::numeric,        -- numeric ⭐
    r->>'Serial',                                   -- text
    r->>'Doi',                                      -- text
    nullif(r->>'Chung_loai_DCL', '')::numeric,      -- numeric ⭐
    r->>'Loai_ngan_lo'                              -- text
  from jsonb_array_elements(p_new_data) r;
  
  select count(*) into v_new_count from public."TongHopThietBi";
  
  -- Cleanup old versions (giữ 12 mới nhất)
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
  
  -- Audit log
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
