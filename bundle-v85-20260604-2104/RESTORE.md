# HUONG DAN PHUC HOI EVN Dashboard (v85)

## 1. Frontend (app.js, sw.js, index.html, styles.css)
- Copy vao repo: /c/Users/admin/Documents/thietbi/
- git add . && git commit -m "restore from bundle v85" && git push
- Vercel auto-deploy

## 2. Edge Functions (Supabase)
cd repo
cp -r edge-functions/* supabase/functions/
supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy bbtn-download --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy bbtn-list --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy nas-health-check --project-ref xqqmfmljwycpehfyknoy

## 3. SQL Schema + Triggers (chay trong Supabase SQL Editor)
- Schema co ban: sql-migrations/01_bbtn_schema.sql
- V79 trigger auto-match (QUAN TRONG): sql-migrations/02_auto_match_trigger.sql

## 4. Pre-commit hook v85 (local only)
cp git-hooks/pre-commit /c/Users/admin/Documents/thietbi/.git/hooks/
chmod +x .git/hooks/pre-commit
# Verify: chinh sua app.js -> git commit -> hook auto bump cache sw.js

## 5. Cau hinh ngoai git (CAN CO RIENG)
- Cloudflare Tunnel: nas.dulieuvanhanh.pro.vn -> http://localhost:5005 (HOST network)
- NAS Synology: cloudflared Docker container "cloudflared-nas"
- Supabase secrets: GEMINI_API_KEY (Project Settings -> Edge Functions)
- Admin account: admin@example.com / EvnAdmin@2026

## 6. Verify he thong sau restore
- Login admin -> Quan ly BBTN OCR -> bang co data
- OCR thu 1 file (per-file) -> modal preview ra dung
- Xem file NAS -> tab moi mo PDF (V78)
- Auto-match: record moi KHONG con "Pending" (V79 trigger)
- Phong dup: OCR lai file -> canh bao (V80)
- Bulk delete: tick checkbox + nut Xoa N (V82)
- Find duplicates: nut Tim trung lap -> modal review (V83)
- Export Excel: panel detail -> nut Excel (V81)

Xem CONTEXT.md cho chi tiet technical.
