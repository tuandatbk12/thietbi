# EVN Hà Nội Dashboard — CONTEXT (cập nhật v102)

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


═══════════════════════════════════════════════════════════
## CẬP NHẬT v86 → v100 (Sprint OCR Refactor + Visibility)
═══════════════════════════════════════════════════════════

### Tính năng mới (v86-v88)
- v86: Widget cảnh báo BBTN chưa khớp DB (gắn vào menu #bbtnAlertsMenu)
- v87: Search advanced - dropdown Năm SX + Hãng SX, search rộng file_name+hang_san_xuat
- v88: Auto-backup DB GitHub Actions (CN 2h sáng VN, cron '0 19 * * 6')
  - .github/workflows/backup-db.yml + .github/scripts/backup_db.py
  - Backup 5 bảng: bbtn_records, bbtn_alerts, CongTacThiNghiem, TongHopThietBi, nas_health_log
  - ⚠️ PENDING: setup GitHub Secrets SUPABASE_URL + SUPABASE_ANON_KEY

### Sprint OCR Pipeline Refactor (v89-v100) - QUAN TRỌNG
Vấn đề gốc: file lớn crash browser, timeout, OOM, Gemini 503, Chrome chặn confirm.

**v89 - Stream qua Edge Function**
- Browser KHÔNG load file vào RAM. Gửi {nas_path} → Edge Function tự fetch NAS + xử lý
- Edge Function: input {nas_path?, file_base64?, mime_type, file_name, file_size_bytes?, fileSizeBytes?}
- Backup: index.ts.before-v89.bak

**v90-92 - Helper architecture (window scope)**
- _v90OcrFetch(nasPath, fileName, sizeBytes): ALL-IN-ONE - timeout động + retry + classify + trả JSON
- _v90Toast(type, title, detail): toast độc lập, KHÔNG phụ thuộc #changeNotifArea
- _v90ToastHistory + _v90ShowHistory(): lịch sử 50 toast
- _ocrOne mỏng: chỉ delegate _v90OcrFetch (bỏ download blob/base64 dead code)
- Payload có file_size_bytes (snake) + fileSizeBytes (camel)

**v93 - Toast persistent**
- Stack dọc #v90ToastStack, auto-dismiss error 15s/info 8s/success 5s
- Hover dừng timer, nút ✕ đóng ngay
- V86 retry init Supabase mỗi 30s nếu chưa init (max 60s)

**v94-95 - Token + Heartbeat**
- Timeout động: <15MB→150s, 15-30MB→180s, >30MB→240s
- Retry timeout+network (2 lần), r=null trong catch (classify đúng lỗi cuối)
- Fresh token (let freshToken) TRƯỚC mỗi insert DB (JWT 1h expire khi bulk lâu)
- Heartbeat đếm giây SAU check >200MB (tránh leak), clear trong finally (_v95hb)
- Skip >200MB: KHÔNG done++ (V66), KHÔNG continue (V68) - tránh double count

**v96 - Per-file heartbeat**
- _v96StartPerFileProgress/_v96StopPerFileProgress: toast đếm giây cho per-file OCR

**v97 - Fix OOM HTTP 546 (Edge Function)**
- File >10MB: upload bytes THẲNG lên Gemini File API (KHÔNG encode base64)
- uploadBytesToGeminiFileAPI(bytes) thay uploadToGeminiFileAPI(base64)
- RAM giảm từ ~292MB (3 copy) xuống ~80MB. Backup: index.ts.before-v97.bak

**v98 - Fix constraint 23514**
- _v98NormDangKD(): normalize dang_kiem_dinh về 5 giá trị hợp lệ
- "CBM", "Kiểm tra chất lượng", lạ → "Khác". Constraint bbtn_dang_check: Lần đầu|Định kỳ|Đột xuất|Sửa chữa|Khác|NULL

**v99 - Fix HTTP 546 do Gemini 503 (Edge Function)**
- MAX_RETRIES 6→3, backoff nhẹ 2/3/4s (trước 2/4/6/8/10/12=42s vượt 60s → shutdown)
- Hết retry vẫn 503/429 → trả JSON lỗi rõ ràng (HTTP 503) thay vì để shutdown→546
- Backup: index.ts.before-v99.bak

**v100 - Fix Chrome chặn confirm()**
- _v100Confirm(message, title): modal HTML Promise-based, Chrome KHÔNG chặn được
- Thay 4 confirm START: V66 bulk, V68 selected, V80 _v80Ask, V80c _v80cAsk
- Lý do: confirm() native bị Chrome chặn khi tab inactive → trả false → bulk không chạy

### Helper Functions mới (window scope)
- _v90OcrFetch, _v90Toast, _v90ToastHistory, _v90ShowHistory (v90/93)
- _v96StartPerFileProgress, _v96StopPerFileProgress (v96)
- _v98NormDangKD (v98)
- _v100Confirm (v100)

### Edge Function bbtn-ocr-extract (post-v99)
- INLINE_RAW_LIMIT 10MB: <10MB inline base64, >10MB upload bytes thẳng (FILE_API)
- MAX_RETRIES=3, backoff 2/3/4s, trả 503 rõ ràng
- Log phases: [OCR-V97] Fetched/INLINE/LARGE, [File API] Uploading, [Gemini] 503/429 retry

### Tech Lessons mới
- Chrome chặn confirm()/alert() khi tab inactive → dùng modal HTML
- Gemini free tier hay 503 + rate limit 15 RPM → retry phải ngắn (free tier 60s wall-clock)
- OOM 546 do encode base64 (×1.33) + giữ nhiều copy → upload bytes thẳng
- Edge Function 60s timeout: retry backoff dài (42s) → shutdown. Phải giới hạn tổng wait
- Constraint CHECK: OCR data tự do (CBM...) cần normalize trước insert
- Line-based patch an toàn hơn string match khi có dòng trống/CRLF/Unicode

### Commit log v86-v100
- a7a455e v87, 1ed4a83 v88, ef73877 v89, aa47a3e v89b
- 4216a1f v90, a59b0bc v91, 12c8d0b v92, 1397fbf v93
- 831a482 v94, b55ac96 v95, afe21fe v96, ee98433 v97
- 2d51ddf v98, 3e0a476 v99, dfade32 v100
- (v86: add4151 + c20a64c)

### PENDING
- Setup GitHub Secrets v88 (SUPABASE_URL, SUPABASE_ANON_KEY)
- Throttle bulk nếu OCR folder rất lớn (50-100+ file) gặp nhiều 503
- Mobile responsive (Việc K - chưa làm)


═══════════════════════════════════════════════════════════
## CẬP NHẬT v101-v102 (Throttle + Root cause 502/429)
═══════════════════════════════════════════════════════════

### ⭐ CHẨN ĐOÁN QUAN TRỌNG: "502 hàng loạt khi bulk" = Gemini HẾT QUOTA (429)
- Triệu chứng: bulk folder lớn (90 file) -> đa số fail "🚪 Gateway timeout (HTTP 502)"
- Server log thật: "[Gemini] 429 quota, wait 10s (retry 3/3)" + "Het 3 retry van 429" + "shutdown"
- GỐC RỄ: Gemini free tier gemini-2.5-flash giới hạn 15 RPM + **1,500 requests/NGÀY (RPD)**
  - OCR nhiều lần test -> cạn 1,500/ngày -> mọi request 429
  - Edge Function retry 429 (3×10s=30s) -> gần hết 60s -> shutdown -> client nhận 502
- ⚠️ Throttle/retry CLIENT (v101) KHÔNG cứu được khi quota NGÀY đã cạn
- GIẢI PHÁP THẬT:
  1. Đợi quota reset: nửa đêm giờ Thái Bình Dương ≈ 14-15h chiều VN
  2. Bật billing Gemini (pay-as-you-go): ~$0.10/1triệu token input, OCR 200 file/ngày ≈ vài nghìn đồng. Hết giới hạn RPD
  3. Chia nhỏ <1,500 file/ngày (thực tế <200)
- Cách xem quota: https://aistudio.google.com/app/apikey hoặc Google Cloud Console > Generative Language API > Quotas

### v101 - Throttle + retry 5xx
- V66 + V68 throttle: 1s -> 4s giữa file (đúng cho RPM 15/phút, KHÔNG cứu RPD)
- _v90OcrFetch retry HTTP 5xx: 2 -> 3 lần, backoff 8s/15s (MAX_ATTEMPT=3); timeout/network giữ 2 lần

### v102 - Fix bug slice + 429 fail nhanh
- BUG: line 384 "text.slice is not a function" - Gemini đôi khi trả parts[0].text KHÔNG phải string
  - Fix: ép text về string (typeof check) trước khi dùng. String(text).slice() phòng thủ
- 429 retry: wait cap 10s -> 5s (retry lâu vô ích khi quota cạn, fail nhanh để báo rõ)
- Backup: index.ts.before-v102.bak

### Edge Function quota behavior (post-v102)
- 503 (overload tạm) vs 429 (hết quota) vs 502 (gateway/shutdown)
- MAX_RETRIES=3, 503 backoff 2/3/4s, 429 backoff cap 5s
- Hết retry -> trả 503 JSON rõ ràng

### Commit v101-v102
- 2b8334c v101 (throttle 4s + retry 5xx 3 lan)
- 6e1a021 v102 (fix slice + 429 nhanh)

### Tech Lesson mới
- "502 hàng loạt" khi bulk thường = Gemini 429 quota cạn, KHÔNG phải lỗi code/Supabase
- LUÔN xem SERVER log (Supabase Dashboard) không chỉ browser console - phân biệt request có tới function không
- Gemini response parts[0].text không đảm bảo là string -> luôn guard typeof trước .slice/.replace
