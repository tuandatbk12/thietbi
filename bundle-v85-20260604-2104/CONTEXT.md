# EVN Hà Nội Dashboard — CONTEXT (cập nhật v85)

## Hệ thống
- Dashboard: https://thietbi.vercel.app/ (Vercel auto-deploy)
- Local: /c/Users/admin/Documents/thietbi
- Supabase ref: xqqmfmljwycpehfyknoy
- Admin: admin@example.com / EvnAdmin@2026
- Gemini: gemini-2.5-flash

## NAS / Cloudflare
- Tunnel `evn-nas-webdav-v2` → nas.dulieuvanhanh.pro.vn
- cloudflared Docker container "cloudflared-nas" trên NAS (HOST network)
- ⭐ Tunnel Service URL = http://localhost:5005 (MIỄN NHIỄM đổi IP NAS)

## Tính năng (v66-v85, admin-only)
### OCR
1. OCR per-file PDF (_bbtnOcrFromNas)
2. OCR tất cả PDF folder (_bbtnBulkOcrFolder V66, line 16712+) - filter -TN- + filter dup
3. OCR thư mục đã chọn (_bbtnOcrSelectedFolders V68) - filter -TN- + filter dup

### Quản lý records BBTN OCR
4. Xóa record đơn (_bbtnMgmtDeleteRecord V70)
5. Đối chiếu DB tự động (V79 SQL trigger trg_auto_check_bbtn_match)
6. Đối chiếu DB thủ công (RPC check_bbtn_match, V72)
7. Xem file BBTN cả URL Storage và path NAS qua blob URL (V78)
8. Bulk delete records (V82): checkbox + nút "Xóa N đã chọn"
9. Tìm trùng lặp + xóa hàng loạt (V83): group file_url+so_che_tao+ten_thiet_bi

### Phòng duplicate (V80)
- Per-file: wrap _bbtnOcrFromNas → confirm nếu file_url đã có records
- Bulk: filter file đã OCR trước, confirm "X mới, Y skip"
- OCR đã chọn: same filter logic
- Helper: window._v80CheckDupe(filePath) / _v80CheckDupeBulk(filePaths[])

### Export Excel
10. Panel detail (V81): nút "📊 Excel" header panel - export rows hierarchical

### Phân quyền
- V71 admin-only: guard hàm + ẩn nút Xóa/Bulk delete/Find dup nếu role !== 'admin'

### Auto-deploy local (V85 pre-commit hook)
- .git/hooks/pre-commit chạy mỗi commit:
  1. node --check app.js sw.js → fail commit nếu syntax error
  2. App.js thay đổi → auto bump cache version sw.js (timestamp suffix)
  3. git add sw.js
- Hook chỉ local (không sync git). Để chia sẻ: copy sang .githooks/ + git config core.hooksPath .githooks

## File naming convention (V77d filter)
- `XX.XXXXX-TN-...pdf` = Biên bản Thí nghiệm ← OCR
- `XX.XXXXX-KD-...pdf` = Kiểm định ← SKIP
- `XX.XXXXX-GCNKD-...pdf` = Giấy chứng nhận KĐ ← SKIP
- Filter: f.name.split('-')[1] === 'TN'

## Edge Function (deployed)
- bbtn-ocr-extract: prompt v73→v75→v76 (deployed)
  - V73: CSV ten_thiet_bi theo vị trí
  - V75: cấm đọc serial từ bảng đo MΩ/μA/kV
  - V76: CSV serial trống → CHỈ 1 record (không tách 3 pha)
- nas-health-check: public endpoint, KHÔNG dùng (V84 widget đã bỏ)
- bbtn-download: stream file NAS qua tunnel
- Backups: index.ts.before-v73/v74/v75/v76.bak
- Deploy: supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy --no-verify-jwt

## SQL Triggers
- check_bbtn_match(p_bbtn_id bigint): match Tram+Ten_thiet_bi+ngay_kiem_dinh với CongTacThiNghiem
- trg_auto_check_bbtn_match (V79): AFTER INSERT ON bbtn_records → tự gọi check_bbtn_match(NEW.id)
- File: phase1/01_bbtn_schema.sql, phase1/02_auto_match_trigger.sql

## DB bbtn_records
id, file_url, file_name, file_size, file_type, tram, ten_thiet_bi, kieu, so_che_tao,
hang_san_xuat, nuoc_san_xuat, nam_san_xuat, dien_ap, dong_dien, dong_cat, ngay_kiem_dinh,
dang_kiem_dinh, dieu_kien_mt, phuong_phap, don_vi_dat_lam, vi_tri_lap_dat, ocr_raw,
ocr_confidence, ocr_provider, match_status, matched_tn_id, created_at, created_by,
created_email, updated_at, loai_thiet_bi, sfra, tiet_dien, file_source

## Edge Function I/O
- INPUT: { file_base64, mime_type, file_name }
- OUTPUT: { success, items:[...], item_count, fields, ... }
- ⚠️ od.items (KHÔNG phải thiet_bi). Field item = DB column.

## App.js IIFE Locations (CRITICAL cho patches)
- V60 _bbtnBulkOcrFolder line 15396 (DEAD CODE, đã override)
- V61 wrapper line 15734 (DEAD CODE)
- **V66 _bbtnBulkOcrFolder line 16712 (ACTIVE)** - patch ở đây
- V68 IIFE line ~16920 (per-file + OCR đã chọn)
- _lytShowDetailPanel line 3890 (panel detail rendering)
- _bbtnMgmtRenderPage line 13052
- _bbtnMgmtOpenFile line 13528 (cũ - V78 override)

## Helper Functions (window scope)
- _v80CheckDupe(filePath) → array of existing records
- _v80CheckDupeBulk(filePaths[]) → Set of existing file_urls
- _v82Selected (Set), _v82ToggleRow, _v82ToggleAll, _v82BulkDelete
- _v83FindDuplicates, _v83DeleteDuplicates
- _exportLytPanelExcel(title, items, mbaSection) - dùng XLSX CDN
- _lytPanelLastItems / _lytPanelLastMba / _lytPanelLastTitle (state lưu khi panel mở)

## Git commits chính (v66→v85)
- 64e7ed3(v66): Bulk OCR self-contained
- 7a9d51e(v67): Banner scan + retry 504
- c065d26(v68): Per-file OCR fix
- 7f2fa70: Restore sw.js
- 5af3c3c(v69) → 59b40d0(v70) → da788ff(v71) → c164953(v71c)
- 2ed2af0(v72): Đối chiếu DB
- 73aa196(v77d): Filter -TN- vào V66
- f8c802c(v78): View NAS file
- b5b299f(v79 SQL): Auto-match trigger
- eeed116(v80): Phòng dup per-file
- 3c04aed(v80b): Phòng dup bulk
- 5f4f16e(v80c): Phòng dup OCR đã chọn
- 3e28491(v81) → 9339de0(v81b) → f524007(v81c): Export Excel panel
- 52594a9(v82): Bulk delete
- 7d288d3(v83): Tìm trùng lặp
- 2f0041d(v84) → 08322af(v84b) → 1ed07de(v84c) → 09e8800: Health widget (đã revert)
- V85 pre-commit hook (local, không git)

## Bài học session quan trọng
1. **3 versions chồng nhau** _bbtnBulkOcrFolder (V60/V61/V66) - patch phải nhắm V66 (ACTIVE)
2. **AI hallucination**: Gemini bịa serial từ bảng đo / 3 records từ 1 CSV - cần prompt CẤM TUYỆT ĐỐI
3. **HTML attribute với inline JS**: title chứa `<` `>` `"` `'` đều có thể break - dùng window state
4. **File name convention**: filter mạnh hơn content filter (`-TN-` split check)
5. **Override function ở scope window**: fix code cũ không cần sửa nguồn
6. **Patch line-based**: an toàn hơn pattern matching trên Windows (CRLF + ký tự đặc biệt)
7. **CSV 3 pha thật ≠ duplicate**: cùng file_url nhưng KHÁC so_che_tao (logic V83 group đúng)
8. **Cloudflare localhost trick**: cloudflared cùng host với service → http://localhost:5005 miễn nhiễm IP
9. **Verify Edge Function output schema TRƯỚC khi viết insert** (od.items, file_url - không phải thiet_bi/file_path)
10. **sw.js greedy sed phá**: dùng Python regex, luôn node --check sau sửa
11. **Database trigger > frontend logic**: V79 auto-match triệt để hơn bấm nút thủ công
12. **Prefer:return=minimal**: DevTools báo "Fetch failed loading" nhưng resp.ok=true (false negative)

## TODO Backlog (Sprint 2/3/4)
**Sprint 2:**
- Audit log + activity feed (E, ⭐⭐⭐⭐⭐)
- Dashboard widget cảnh báo BBTN chưa khớp (F, ⭐⭐⭐)

**Sprint 3:**
- Re-OCR record cụ thể (G, ⭐⭐⭐)
- Search advanced trong Quản lý BBTN OCR (H, ⭐⭐⭐)
- Auto backup DB cron via GitHub Actions (I, ⭐⭐⭐)

**Sprint 4 (long-term):**
- Test prompt Gemini golden dataset (J, ⭐⭐)
- Mobile responsive (K)
- Sync NAS ↔ DB cron (L)
- Notification email (M)
- OCR PDF khác BBTN (N)

**Misc:**
- Cleanup V60/V61 dead code (~600-900 dòng, rủi ro cao)
- Consider DB UNIQUE constraint (cẩn thận CSV 3 pha)
