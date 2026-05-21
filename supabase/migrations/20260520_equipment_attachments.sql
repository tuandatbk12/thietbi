-- ════════════════════════════════════════════════════════════════
-- Bảng metadata cho file đính kèm thiết bị (ảnh + tài liệu)
-- Lưu metadata; file thực nằm trên NAS WebDAV (cột nas_path).
-- ════════════════════════════════════════════════════════════════
create table if not exists public.equipment_attachments (
  id                 bigserial primary key,
  asset_key          text       not null,           -- key gộp (tram + cap + ngan + loai) để query nhanh
  tram               text,
  cap_dien_ap        text,
  loai_thiet_bi      text,
  ten_thiet_bi       text,
  ngan_thiet_bi      text,
  file_name          text       not null,           -- tên file gốc do user chọn
  nas_path           text       not null,           -- đường dẫn tuyệt đối trên NAS, vd: /TNDK/E1_1/1700000000_anh1.jpg
  mime_type          text,
  file_size          integer,
  file_type          text       not null default 'document', -- 'image' | 'document'
  note               text,
  uploaded_by_id     uuid       references auth.users(id) on delete set null,
  uploaded_by_email  text,
  active             boolean    not null default true,
  created_at         timestamptz not null default now()
);

create index if not exists idx_equipment_attachments_asset_key on public.equipment_attachments(asset_key) where active;
create index if not exists idx_equipment_attachments_tram      on public.equipment_attachments(tram)      where active;
create index if not exists idx_equipment_attachments_created   on public.equipment_attachments(created_at desc);

-- Row Level Security: ai cũng đọc, chỉ user đăng nhập mới ghi/cập nhật.
-- Vì Edge Function dùng service_role bypass RLS nên đây chỉ áp dụng cho query trực tiếp
-- từ frontend (vd: _assetLoadGallery lọc theo asset_key).
alter table public.equipment_attachments enable row level security;

drop policy if exists "select_all_attachments" on public.equipment_attachments;
create policy "select_all_attachments"
  on public.equipment_attachments for select
  using (true);

drop policy if exists "update_own_attachments" on public.equipment_attachments;
create policy "update_own_attachments"
  on public.equipment_attachments for update
  using (
    -- admin sửa được mọi file; user thường chỉ sửa file của mình
    (auth.jwt() ->> 'role') = 'admin'
    or uploaded_by_id = auth.uid()
  );

-- Insert/Delete do Edge Function (service_role) thực hiện.
