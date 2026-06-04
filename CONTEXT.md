# EVN Hà Nội Dashboard — CONTEXT (cập nhật v77d)

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

## Tính năng (v66-v77d, admin-only)
1. OCR per-file PDF (_bbtnOcrFromNas → V68 preview/save)
2. OCR tất cả PDF folder (_bbtnBulkOcrFolder V66, line 16712) - FILTER -TN-
3. OCR thư mục đã chọn (_bbtnOcrSelectedFolders V68) - FILTER -TN-
4. Xóa record (_bbtnMgmtDeleteRecord V70)
5. Đối chiếu DB (RPC check_bbtn_match, V72)
- V71 phân quyền: guard hàm + ẩn nút nếu role !== 'admin'

## File naming convention (V77d filter)
- `XX.XXXXX-TN-...pdf` = Biên bản Thí nghiệm ← OCR
- `XX.XXXXX-KD-...pdf` = Kiểm định ← SKIP
- `XX.XXXXX-GCNKD-...pdf` = Giấy chứng nhận KĐ ← SKIP
- Filter: f.name.split('-')[1] === 'TN'

## Edge Function (deployed)
- bbtn-ocr-extract: prompt v73→v75→v76
  - V73: CSV ten_thiet_bi theo vị trí ("CSV 4T2" thay vì "CSV [serial]")
  - V75: cấm đọc serial từ bảng đo (MΩ/μA/kV)
  - V76: CSV serial trống → CHỈ 1 record (không tách 3 pha)
- Backup: index.ts.before-v73/v74/v75/v76.bak
- Deploy: `supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy --no-verify-jwt`

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

## Git commits chính (v66→v77d)
64e7ed3(v66)→7a9d51e(v67)→c065d26(v68)→7f2fa70(sw.js)→5af3c3c(v69)→
59b40d0(v70)→da788ff(v71)→c164953(v71c)→9a92985(CONTEXT)→2ed2af0(v72)→
4278db1(v77 v68 filter)→e9f174d(v77b)→31ea250(v77c)→73aa196(v77d V66 filter) — HEAD
Edge: V73/V75/V76 deployed (không git)

## Bài học session
1. Có 3 phiên bản _bbtnBulkOcrFolder (V60/V61/V66). V66 thắng (override cuối).
   → Patch phải nhắm V66 (line 16712+), không phải V60 cũ.
2. Python heredoc + multiline string trên Windows có thể fail match → dùng readlines() + line-based insert.
3. AI hallucination: prompt cần CẤM rõ ràng, không chỉ "khuyến nghị". 
   VD: "TUYỆT ĐỐI KHÔNG đọc số từ bảng đo", "TRỐNG → null, KHÔNG bịa".
4. CSV (Chống sét van) prompt: phải nói rõ "CHỈ 3 records khi có 3 serial khác nhau".
5. File name convention làm filter mạnh hơn so với content filter.

## TODO
- (Future) Audit data cũ có thể có serial bịa từ bảng đo
- (Future) Tính năng phòng duplicate (check file_url trước khi OCR)
