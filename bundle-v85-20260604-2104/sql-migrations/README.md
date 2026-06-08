# BBTN OCR — Phase 1: Database Schema

**Mục đích**: Tạo cấu trúc DB lưu BBTN OCR + cảnh báo "BBTN chưa khớp"

**Time**: 5 phút (chỉ chạy SQL, không đụng code)

---

## 📋 Cấu trúc tạo ra

### 1. Bảng `bbtn_records`
Lưu mỗi BBTN OCR là 1 record với 20+ trường:
- File: `file_url`, `file_name`, `file_size`
- 9 trường OCR: tram, ten_thiet_bi, kieu, so_che_tao, hang_san_xuat, ngay_kiem_dinh, dien_ap, dong_dien, dang_kiem_dinh, ...
- Metadata: `ocr_raw` (JSON debug), `ocr_confidence`, `ocr_provider`
- Match: `match_status` ('matched' / 'not_in_db' / 'manual_review')
- Audit: `created_at`, `created_by`, `created_email`

### 2. Bảng `bbtn_alerts`
Cảnh báo khi BBTN chưa khớp DB:
- `alert_type`: 'not_in_db', 'duplicate', 'date_mismatch', 'missing_field'
- `severity`: 'info', 'warning', 'error'
- `resolved`, `resolved_at`, `resolved_by`

### 3. Function `check_bbtn_match(p_bbtn_id)`
Sau khi insert vào `bbtn_records`, gọi hàm này để:
- Tìm match trong `CongTacThiNghiem` theo `(Tram + Ten_thiet_bi + Ngay)`
- Nếu match → set `match_status = 'matched'`
- Nếu KHÔNG match → set `match_status = 'not_in_db'` + tạo alert

### 4. View `bbtn_unresolved_alerts`
Danh sách alerts chưa resolve để dashboard hiển thị badge đỏ.

### 5. Storage bucket `bbtn-files`
Lưu file gốc BBTN (Word/PDF/ảnh). Max 20MB/file. KHÔNG public.

### 6. RLS policies
- **SELECT**: mọi user authenticated
- **INSERT / UPDATE / DELETE**: chỉ admin (`role='admin' AND active=true`)

---

## 🚀 Cách chạy

### Bước 1: Pre-flight check (1 phút)

Mở https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/sql/new

Paste + Run nội dung `00_preflight_check.sql` → xem output.

**Verify cần thấy**:
- Cột `Tram`, `Ten_thiet_bi`, `Thoi_gian_thi_nghiem_truoc` tồn tại trong `CongTacThiNghiem`
- Total records > 0
- Sample 3 rows có dữ liệu hợp lý

Nếu tên cột khác → báo cho mình để sửa SQL trước khi chạy.

### Bước 2: Run schema (2 phút)

Paste + Run nội dung `01_bbtn_schema.sql`.

**Output mong đợi**:
```
NOTICE: ✅ bbtn_records: 27 cột
NOTICE: ✅ bbtn_alerts: 9 cột
NOTICE: ✅ Storage bucket bbtn-files: OK
NOTICE: ✅ RLS policies: 6

| status                       |
| ---------------------------- |
| Phase 1: BBTN schema ready   |
```

### Bước 3: Quick test (2 phút)

Test insert 1 BBTN giả + check trigger function:

```sql
-- Login admin trước (Supabase auto khi mở SQL Editor với role authenticated)

-- 1. Insert thử
INSERT INTO public.bbtn_records (
  file_url, file_name,
  tram, ten_thiet_bi, ngay_kiem_dinh,
  kieu, so_che_tao, hang_san_xuat, nam_san_xuat,
  dien_ap, dong_dien,
  dang_kiem_dinh,
  vi_tri_lap_dat,
  created_email
) VALUES (
  'https://example.com/test.pdf', 'test_bbtn.pdf',
  'E1.1', 'Máy cắt 131', '2025-05-24',
  'GL312F1/4031P', '327100800040017', 'GE', 2025,
  '145 kV', '3150 A',
  'Lần đầu',
  'MC 131 TBA E1.1 Đông Anh',
  'admin@example.com'
) RETURNING id;

-- 2. Gọi check match (sẽ tự động tạo alert nếu không tìm thấy trong CongTacThiNghiem)
-- Thay <ID> bằng id từ INSERT trên
SELECT public.check_bbtn_match(<ID>);

-- 3. Xem kết quả
SELECT id, tram, ten_thiet_bi, match_status FROM public.bbtn_records WHERE id = <ID>;
SELECT alert_type, severity, message FROM public.bbtn_alerts WHERE bbtn_id = <ID>;

-- 4. Xem unresolved alerts (cho dashboard widget)
SELECT * FROM public.bbtn_unresolved_alerts LIMIT 5;

-- 5. Cleanup test data
DELETE FROM public.bbtn_records WHERE id = <ID>;
```

---

## ✅ Verify Phase 1 hoàn thành

Sau khi chạy SQL, check:

```sql
-- Verify bảng + bucket
SELECT count(*) FROM public.bbtn_records;       -- 0 (chưa có data)
SELECT count(*) FROM public.bbtn_alerts;        -- 0
SELECT id FROM storage.buckets WHERE id = 'bbtn-files';  -- 1 row

-- Verify RLS hoạt động (login user thường)
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.bbtn_records;  -- OK (SELECT được)
RESET ROLE;
```

---

## 🚨 Rollback nếu cần

```sql
DROP VIEW IF EXISTS public.bbtn_unresolved_alerts;
DROP FUNCTION IF EXISTS public.check_bbtn_match(bigint);
DROP TABLE IF EXISTS public.bbtn_alerts CASCADE;
DROP TABLE IF EXISTS public.bbtn_records CASCADE;
DELETE FROM storage.buckets WHERE id = 'bbtn-files';
```

---

## 📋 Sau khi Phase 1 OK → Phase 2

Phase 2: Edge Function `bbtn-ocr-extract` gọi Gemini Vision để OCR file.

**KHÔNG làm gì với code app.js / Vercel trong Phase 1.**

Phase 1 chỉ là setup DB. Bạn vẫn dùng dashboard bình thường.
