# 🔧 HƯỚNG DẪN CÀI LẠI DỰ ÁN EVN Dashboard

> Mục đích: dựng lại toàn bộ dự án từ đầu khi đổi máy / mất máy / cần deploy mới.
> Cập nhật: v106

---

## 1. TỔNG QUAN HỆ THỐNG

Dự án gồm 4 thành phần độc lập, kết nối với nhau:

```
[Browser: app.js + index.html]  ← giao diện, chạy trên Vercel
        │
        ├──→ [Supabase]  ← Database (Postgres) + Auth + Edge Functions
        │         └─ Edge Function "bbtn-ocr-extract" gọi Gemini OCR
        │
        ├──→ [NAS Synology]  ← lưu file PDF gốc, truy cập qua WebDAV
        │         └─ qua Cloudflare Tunnel (public domain, miễn nhiễm đổi IP)
        │
        └──→ [Gemini API]  ← OCR đọc PDF thành dữ liệu có cấu trúc
```

---

## 2. THÔNG TIN CỐ ĐỊNH (điền sẵn)

### Supabase
- Project ref: `xqqmfmljwycpehfyknoy`
- URL: `https://xqqmfmljwycpehfyknoy.supabase.co`
- Anon key (public, an toàn nhúng client):
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc
  ```
- Admin login: `admin@example.com` / `EvnAdmin@2026`

### NAS / Cloudflare Tunnel
- Public domain WebDAV: `nas.dulieuvanhanh.pro.vn`
- Tunnel name: `evn-nas-webdav-v2`
- cloudflared chạy = Docker container `cloudflared-nas` trên NAS (HOST network)
- Tunnel Service URL = `http://localhost:5005` (WebDAV HTTP port 5005)
- ⭐ Dùng localhost trong tunnel config → MIỄN NHIỄM khi NAS đổi IP nội bộ

### GitHub
- Repo: `https://github.com/tuandatbk12/thietbi` (branch main)
- Vercel tự deploy khi push main

### Gemini
- API key lưu trong Supabase secrets: `GEMINI_API_KEY`
- Models fallback: gemini-2.5-flash → gemini-2.0-flash → gemini-2.5-flash-lite

---

## 3. CÀI ĐẶT CÔNG CỤ (máy mới)

1. Git + Git Bash (Windows): https://git-scm.com
2. Node.js (cho `node --check` pre-commit hook): https://nodejs.org
3. Python 3 (chạy patch script): https://python.org
4. Supabase CLI:
   - Tải từ https://github.com/supabase/cli/releases
   - Hoặc: `scoop install supabase` / `npm i -g supabase`
5. (Tùy chọn) Docker Desktop — chỉ cần nếu muốn test Edge Function local

---

## 4. KHÔI PHỤC CODE

### Cách A — Từ GitHub (khuyến nghị, mới nhất)
```bash
cd ~/Documents
git clone https://github.com/tuandatbk12/thietbi.git
cd thietbi
```

### Cách B — Từ bundle (nếu không vào được GitHub)
```bash
mkdir thietbi && cd thietbi
tar -xzf /duong/dan/bundle-v106-YYYYMMDD-HHMM.tar.gz
git init && git add . && git commit -m "restore from bundle"
git remote add origin https://github.com/tuandatbk12/thietbi.git
```

---

## 5. KẾT NỐI SUPABASE CLI

```bash
cd ~/Documents/thietbi
supabase login                    # mở browser xác thực
supabase link --project-ref xqqmfmljwycpehfyknoy
```

### Deploy Edge Function
```bash
supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy --no-verify-jwt
```

### Set GEMINI_API_KEY (nếu chưa có)
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_key --project-ref xqqmfmljwycpehfyknoy
```
Lấy key tại: https://aistudio.google.com/app/apikey

---

## 6. KHÔI PHỤC DATABASE (nếu DB mới/trống)

Chạy lần lượt trong Supabase Dashboard → SQL Editor:
1. `phase1/00_preflight_check.sql` (kiểm tra trước)
2. `phase1/01_bbtn_schema.sql` (tạo bảng bbtn_records + constraint)
3. `phase1/02_auto_match_trigger.sql` (trigger tự đối chiếu)

Bảng chính: `bbtn_records` (xem cột chi tiết trong phase1/01_bbtn_schema.sql)

Constraint quan trọng:
- `bbtn_dang_check`: dang_kiem_dinh ∈ {Lần đầu, Định kỳ, Đột xuất, Sửa chữa, Khác} hoặc NULL
- `bbtn_match_check`: match_status ∈ {pending, matched, not_in_db, manual_review}

### Khôi phục data từ backup
Nếu có backup CSV (folder `backups/` từ GitHub Actions v88):
- Import qua Supabase Dashboard → Table Editor → Import CSV
- Hoặc dùng SQL COPY

---

## 7. CLOUDFLARE TUNNEL (NAS) — nếu dựng lại NAS

Trên NAS Synology, container Docker `cloudflared-nas`:
1. Cài cloudflared qua Container Manager (Docker)
2. Network mode: HOST
3. Command: `tunnel run` (dùng token tunnel evn-nas-webdav-v2)
4. Trong Cloudflare Zero Trust Dashboard:
   - Tunnel evn-nas-webdav-v2 → Public hostname: nas.dulieuvanhanh.pro.vn
   - Service: `HTTP://localhost:5005` ⭐ (localhost, KHÔNG dùng IP NAS)
5. Bật WebDAV trên NAS (port 5005 HTTP) qua Synology WebDAV Server package

---

## 8. CHECKLIST VERIFY SAU KHI CÀI

- [ ] Mở https://thietbi.vercel.app/ — trang load OK
- [ ] Đăng nhập admin@example.com — vào được
- [ ] Dashboard hiện số liệu (loadStats chạy)
- [ ] Vào Quản lý BBTN OCR — thấy danh sách records
- [ ] Duyệt file NAS — thấy cây thư mục (tunnel OK)
- [ ] OCR thử 1 file — chạy thành công (Edge Function + Gemini OK)
- [ ] Console F12 không có lỗi đỏ nghiêm trọng

---

## 9. QUY TRÌNH SỬA CODE (giữ an toàn)

1. Backup trước: `cp app.js app.js.before-vNN.bak`
2. Sửa qua patch script Python (xem PLAYBOOK), KHÔNG sửa tay file lớn
3. `node --check app.js` (pre-commit hook tự chạy + bump cache sw.js)
4. git commit + push → Vercel tự deploy
5. Hard reset cache browser khi test (xem lệnh trong PLAYBOOK)
6. Định kỳ tạo bundle + cập nhật CONTEXT.md

### Deploy nhanh
```bash
# Frontend: chỉ cần push
git add app.js && git commit -m "..." && git push origin main

# Edge Function: phải deploy riêng
supabase functions deploy bbtn-ocr-extract --project-ref xqqmfmljwycpehfyknoy --no-verify-jwt
```
