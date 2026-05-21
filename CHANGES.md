# Bảng so sánh thay đổi — `app.js` & `sw.js` & Supabase Edge Functions

> Phiên bản đã đồng bộ với UI Supabase thực tế của project (sau khi xem screenshot Secrets & Functions list).

## ⚙️ Đồng bộ với Supabase UI

| Item | Trước | Sau |
|---|---|---|
| Env var (NAS user) | `NAS_USER` | **`NAS_USERNAME`** (accept cả 2) |
| Env var (NAS pass) | `NAS_PASS` | **`NAS_PASSWORD`** (accept cả 2) |
| Env var (BBTN root) | `NAS_BBTN_ROOT` | **`NAS_BBTN_PATH`** (accept cả 2) |
| Env var (Asset root) | `NAS_ASSETS_ROOT` | **`NAS_ASSET_PATH`** (accept cả 2) |
| Supabase keys | `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (deprecated) | Resolver `getServiceRoleKey()` ưu tiên `SUPABASE_SECRET_KEYS` (JSON dict), fallback legacy |
| Edge Functions deploy | 4 functions | **5 functions** — thêm `nas-health-check` |

Tất cả Edge Function code đều **backward-compatible**: chấp nhận cả tên cũ lẫn mới, không cần migration secrets thủ công.

## 📄 app.js — Các function đã sửa

| # | Function | Dòng (mới) | Loại sửa | Mục đích |
|---|---|---|---|---|
| 1 | `nasUploadFile` | ~8884 | Thêm header | `ngrok-skip-browser-warning: true` cho PUT WebDAV |
| 2 | `nasMkdir` | ~8909 | Thêm header | Tương tự cho MKCOL |
| 3 | `_bbtnDownloadSelectedZip` | 9063-9143 | **Viết lại** | Tách `_collectFiles` & `_runPool`, song song 3 luồng, progress `Tải N/M…`, timeout 90s + retry |
| 4 | `_bbtnFetchEdge` | 9285-9341 | **Viết lại** | Loop retry với exponential backoff, timeout 45s mặc định, header ngrok |
| 5 | `_bbtnPropfind` | 9351-9388 | **Mở rộng** | + In-memory cache 60s, dedupe concurrent fetch, timeout 50s + retry 1 |
| 6 | `_bbtnInvalidateCache` | 9385-9390 | ✨ **MỚI** | Xóa cache theo path / toàn bộ |
| 7 | `_bbtnRefresh` | 9524-9528 | Sửa | Gọi `_bbtnInvalidateCache(path)` trước khi reload |
| 8 | `_bbtnViewFile` | 9538-9580 | Sửa | timeout 120s, retry 1, decode fileName trước notif |
| 9 | `_assetFetchThumb` | 10166-10193 | Sửa | timeout 30s + header ngrok |
| 10 | `_assetView` | 10463-10493 | Sửa | timeout 90s + header ngrok + báo "Quá lâu (90s)" rõ ràng |
| 11 | `_assetDoUpload` | 10377-10463 | **Viết lại** | Đổi từ Base64 JSON → `FormData` (binary), limit 25MB, timeout 120s, header ngrok |

## 📄 sw.js — Viết lại toàn bộ (v6 → v7)

| Thay đổi | Lý do |
|---|---|
| `CACHE_VERSION = 'evn-v7-nas-fix'` | Bump version → SW tự xoá cache cũ + skipWaiting |
| Bỏ hằng `API_CACHE` | Không còn cache cho API |
| **Bypass hoàn toàn** `*.supabase.co` | Dữ liệu live, cache sai sẽ cho user file ảo |
| **Bypass hoàn toàn** `*.ngrok-free.dev` / `.app` / `.io` / `ngrok.app` | Phòng trường hợp frontend gọi NAS trực tiếp |
| Đổi tên `networkFirstWithCache` → `networkFirstShortFallback` | Áp dụng chỉ cho HTML/JS/CSS static, có timeout 8s ngắn |
| Thông điệp comment Vietnamese rõ ràng hơn | Để team sau dễ maintain |

## 🚫 Không đổi

- `index.html` — không cần sửa (UI giữ nguyên).
- `styles.css` — không liên quan tới NAS.
- `NAS_CONFIG` block (lines 8820-8945) — giữ nguyên vì:
  - Admin vẫn dùng "Cài đặt NAS" modal để fallback cho TNDK photo upload
  - Cấu hình này không ảnh hưởng BBTN (BBTN dùng Edge Function exclusive)
- Các hàm khác trong app.js (chip toggle, layout editor, stats, charts...) — không đụng vào.

## 🧪 Kiểm tra syntax

```
$ node --check app.js
OK ✅
$ node --check sw.js
OK ✅
$ tsc --noEmit supabase/functions/**/*.ts
OK ✅ (ngoài lỗi import Deno expected)
```

## 🔍 Cách verify đã merge đúng

Tìm các marker mới trong `app.js`:

```bash
grep -n "ngrok-skip-browser-warning" app.js
# Phải có ≥ 6 hit
grep -n "_bbtnListCache" app.js
# Phải có 4 hit
grep -n "maxRetries" app.js
# Phải có 6 hit
grep -n "evn-v7-nas-fix" sw.js
# Phải có 1 hit
```

Nếu thiếu hit → merge sai, kéo lại file `app.js` từ folder outputs.

## 🔄 Rollback nếu cần

```bash
# Backup file cũ trước khi replace
cp app.js app.js.backup-$(date +%Y%m%d)
cp sw.js  sw.js.backup-$(date +%Y%m%d)

# Sau khi deploy nếu có vấn đề:
cp app.js.backup-* app.js
cp sw.js.backup-* sw.js

# Trên Supabase, để rollback Edge Function:
supabase functions deploy bbtn-list --project-ref xqqmfmljwycpehfyknoy
# (deploy lại bản cũ từ git history)
```
