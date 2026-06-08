# HƯỚNG DẪN PHỤC HỒI EVN Dashboard

## 1. Frontend (app.js, sw.js, index.html, styles.css)
- Copy vào repo: `/c/Users/admin/Documents/thietbi/`
- `git add . && git commit -m "restore from bundle v78" && git push`
- Vercel auto-deploy

## 2. Edge Functions (Supabase)
```bash
# Trong repo
cp -r edge-functions/* supabase/functions/
supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy bbtn-download --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy bbtn-list --project-ref xqqmfmljwycpehfyknoy
# Deploy các function khác nếu cần
```

## 3. SQL Schema (nếu DB cần reset)
- Chạy file `sql-migrations/01_bbtn_schema.sql` trong Supabase SQL Editor
- Bao gồm: bảng bbtn_records, bbtn_alerts, hàm check_bbtn_match()

## 4. Cấu hình ngoài git
- **Cloudflare Tunnel**: route nas.dulieuvanhanh.pro.vn → http://localhost:5005 (host mode)
- **NAS Synology**: cloudflared Docker container HOST network
- **Supabase secrets**: GEMINI_API_KEY (Project Settings → Edge Functions)
- **Admin account**: admin@example.com / EvnAdmin@2026

## 5. Verify
- Truy cập https://thietbi.vercel.app/
- Login admin → kiểm tra Quản lý BBTN OCR có data
- OCR thử 1 file → xem modal preview ra đúng
- Xem file NAS → tab mới mở PDF

Xem CONTEXT.md để biết chi tiết mapping, bài học, và cấu trúc.
