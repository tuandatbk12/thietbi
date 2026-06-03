# EVN Hà Nội Dashboard — CONTEXT (cập nhật v71c)

## Hệ thống
- Dashboard: https://thietbi.vercel.app/ (Vercel auto-deploy từ GitHub tuandatbk12/thietbi main)
- Local repo: /c/Users/admin/Documents/thietbi (Windows + Git Bash)
- Supabase ref: xqqmfmljwycpehfyknoy (Free tier, Edge Function timeout 60s)
- Admin: admin@example.com / EvnAdmin@2026
- Gemini model: gemini-2.5-flash (GEMINI_API_KEY trong Supabase secrets)

## NAS / Cloudflare (QUAN TRỌNG)
- NAS Synology qua Cloudflare Tunnel "evn-nas-webdav-v2"
- Public hostname: nas.dulieuvanhanh.pro.vn
- WebDAV port: 5005 (HTTP)
- cloudflared = Docker container "cloudflared-nas" trên NAS (HOST network mode)
- ⭐ Tunnel Service URL = http://localhost:5005 (KHÔNG dùng IP — vì localhost = chính NAS,
  IP đổi bao nhiêu lần cũng không ảnh hưởng. ĐÃ FIX vĩnh viễn lỗi 502 do đổi IP)
- NAS IP hiện tại: 192.168.1.7 (DHCP) — KHÔNG còn quan trọng vì tunnel dùng localhost

## DB bbtn_records — COLUMN THẬT (verify)
id, file_url, file_name, file_size, file_type, tram, ten_thiet_bi, kieu, so_che_tao,
hang_san_xuat, nuoc_san_xuat, nam_san_xuat, dien_ap, dong_dien, dong_cat, ngay_kiem_dinh,
dang_kiem_dinh, dieu_kien_mt, phuong_phap, don_vi_dat_lam, vi_tri_lap_dat, ocr_raw,
ocr_confidence, ocr_provider, match_status, matched_tn_id, created_at, created_by,
created_email, updated_at, loai_thiet_bi, sfra, tiet_dien, file_source
- ⚠️ Column file_url (KHÔNG phải file_path). file_source = 'nas'|'storage'.

## Edge Function bbtn-ocr-extract — I/O
- INPUT: { file_base64, mime_type, file_name } (snake_case)
- OUTPUT: { success, items:[...], item_count, fields, avg_confidence, ... }
- ⚠️ Array là od.items (KHÔNG phải thiet_bi). Field item names = DB columns (no mapping).
- Limit 50MB/file → 504 nếu Gemini quá tải (đã có retry 8s).

## OCR-from-NAS — MAPPING ĐÚNG (bài học lớn session này)
od.items → map nguyên field: tram, loai_thiet_bi, ten_thiet_bi, kieu, so_che_tao,
hang_san_xuat, nuoc_san_xuat, nam_san_xuat, dien_ap, dong_dien, ngay_kiem_dinh,
dang_kiem_dinh, vi_tri_lap_dat, sfra, tiet_dien + file_url (=NAS path), file_name, file_source:'nas'

## Tính năng OCR (v66-v71c) — TẤT CẢ admin-only
1. OCR per-file: nút "OCR" trên mỗi file PDF (_bbtnOcrFromNas → _showNasOcrPreviewV68 → _bbtnSaveNasOcrResultV68)
2. OCR tất cả PDF: nút "⚡ OCR tất cả PDF" (_bbtnBulkOcrFolder v66) — banner scan + progress + summary
3. OCR thư mục đã chọn: tick checkbox folder → nút "⚡ OCR đã chọn" (_bbtnOcrSelectedFolders v68)
4. Xóa record: nút 🗑️ trong Quản lý BBTN OCR (_bbtnMgmtDeleteRecord v70)
- Phân quyền v71: _guard() chặn hàm + ẩn nút nếu _authGetSession()?.role !== 'admin'

## CACHE BUMP — DÙNG PYTHON (KHÔNG dùng sed greedy!)
python3 -c "import re; c=open('sw.js',encoding='utf-8').read(); c=re.sub(r\"'evn-v[0-9]+[^']*'\",\"'evn-vXX-name'\",c); open('sw.js','w',encoding='utf-8').write(c)"
- ⚠️ sed pattern 'evn-v[0-9.]*-[^']*' KHÔNG quote → greedy → PHÁ HỦY sw.js (đã từng hỏng,
  phải restore từ git). LUÔN node --check sw.js sau bump.

## Git commits session (v66→v71c)
64e7ed3(v66 bulk final) → 7a9d51e(v67 banner+retry) → c065d26(v68 perfile+selected) →
7f2fa70(restore sw.js) → 5af3c3c(v69 checkbox) → 59b40d0(v70 delete) →
da788ff(v71 permission) → c164953(v71c hide delete) — HEAD

## Backup files (local)
app.js.before-v66/v67/v68/v69/v70/v71/v71c.bak

## Bài học kỹ thuật session này
1. Override JS function KHÔNG ảnh hưởng closure đã capture → dùng self-contained replacement.
2. HTTP 530 = Cloudflare/tunnel down; 502 = tunnel OK nhưng backend (WebDAV/IP) sai.
   → Dùng localhost trong tunnel route (cloudflared cùng host) = miễn nhiễm đổi IP.
3. Verify Edge Function output + DB column TRƯỚC khi viết insert (od.items, file_url).
4. sed greedy phá file → dùng Python regex cho sửa cache.
5. Test logic trên Console TRƯỚC khi commit (đỡ phải push thử nhiều lần).
6. Supabase insert Prefer:return=minimal → DevTools báo "Fetch failed loading" nhưng ok=true.

## TODO còn lại
- (Optional) Sửa prompt Gemini đặt ten_thiet_bi đẹp hơn cho file Chống Sét Van (CSV)
- (Optional) Tính năng đối chiếu OCR ↔ DB gốc để chuyển match_status pending→matched
