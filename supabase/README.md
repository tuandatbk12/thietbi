# Supabase Edge Functions — EVNHANOI

## Cấu trúc

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts          # CORS headers + helper response
│   │   └── nas.ts           # WebDAV client: PROPFIND/GET/PUT/MKCOL + JWT verify
│   ├── bbtn-list/index.ts
│   ├── bbtn-download/index.ts
│   ├── asset-upload/index.ts
│   ├── asset-download/index.ts
│   └── nas-health-check/index.ts
├── migrations/
│   └── 20260520_equipment_attachments.sql
└── deploy.sh
```

## Environment variables (Supabase secrets — đã đồng bộ với UI)

| Tên (chuẩn) | Alias chấp nhận | Bắt buộc | Ví dụ | Mô tả |
|---|---|---|---|---|
| `NAS_BASE_URL`     | — | ✅ | `https://slicing-requisite-custodian.ngrok-free.dev` | URL public của NAS (qua ngrok/CF Tunnel) — KHÔNG có path |
| `NAS_USERNAME`     | `NAS_USER` | ✅ | `evnservice` | User NAS có quyền R/W vào BBTN & TNDK |
| `NAS_PASSWORD`     | `NAS_PASS` | ✅ | `***` | Mật khẩu user trên |
| `NAS_BBTN_PATH`    | `NAS_BBTN_ROOT` | ⛔ optional | `/BBTN` | Root folder BBTN trên NAS |
| `NAS_ASSET_PATH`   | `NAS_ASSETS_ROOT` | ⛔ optional | `/TNDK` | Root folder ảnh/tài liệu |

> Code Edge Function chấp nhận cả tên chuẩn lẫn alias cũ — không cần migration nếu đã set sẵn.

Supabase tự cung cấp (Default secrets):
- `SUPABASE_URL` — URL project
- `SUPABASE_PUBLISHABLE_KEYS` — JSON dict (mới) / `SUPABASE_ANON_KEY` (legacy)
- `SUPABASE_SECRET_KEYS` — JSON dict (mới) / `SUPABASE_SERVICE_ROLE_KEY` (legacy)
- `SUPABASE_JWKS` — JWKS verify

Code dùng helper `getServiceRoleKey()` / `getAnonKey()` trong `_shared/nas.ts` để tự dò pattern mới trước, fallback legacy.

## Functions overview

### `bbtn-list`
**GET** `?path=/BBTN/...`
→ Trả `{ items: [{ name, isFolder, size, modified, relativePath }] }`

- PROPFIND **Depth: 1** (CHỈ 1 cấp, không recursive)
- Timeout 45s + retry 1
- Cache control: client tự cache 60s (xem `app.js`)

### `bbtn-download`
**GET** `?path=/BBTN/.../file.pdf[&download=1]`
→ Stream binary từ NAS về client.

- Hỗ trợ `Range` header (cho video/PDF progressive)
- Content-Type tự suy luận từ extension
- `Content-Disposition: inline` (xem trong tab) hoặc `attachment` (download)
- Timeout 120s, **không retry** (vì đã stream — retry sẽ corrupt body)

### `asset-upload`
**POST** `multipart/form-data` (preferred) hoặc `application/json` với `fileBase64`
Fields: `assetKey, tram, capDienAp, loaiThietBi, tenThietBi, nganThietBi, fileName, mimeType, fileSize, fileType, note, file`
→ Trả `{ success: true, id, nasPath }`

- Limit 25MB
- Tự tạo folder trạm (`MKCOL` ignore 405)
- PUT binary lên NAS → insert vào `equipment_attachments`

### `asset-download`
**GET** `?id=<int>`
→ Tra DB lấy `nas_path` → stream từ NAS về.

- Cache `private, max-age=3600` (asset thiết bị ít đổi)
- Cùng hỗ trợ `Range`

### `nas-health-check` *(public, không cần JWT)*
**GET** `/functions/v1/nas-health-check`
→ Trả `{ ok, latencyMs, nasReachable, nasAuth, bbtnAccessible, assetAccessible, checkedAt }`

- Dùng cho health badge trên dashboard, hoặc uptime monitor ngoài (UptimeRobot, BetterStack...).
- HTTP 200 nếu OK; HTTP 503 nếu fail (cho monitor parse status code).
- `HEAD` request được hỗ trợ — trả header `X-Health-Ok` và `X-Health-Latency`.
- Không lộ NAS URL hay credentials — chỉ flag boolean.

## Local testing

```bash
# Start Supabase local stack
supabase start

# Serve all functions
supabase functions serve --no-verify-jwt

# Test
curl http://localhost:54321/functions/v1/bbtn-list?path=/BBTN \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "apikey: YOUR_ANON_KEY"
```

## Logs

```bash
# Realtime tail logs cho function
supabase functions logs bbtn-list --project-ref xqqmfmljwycpehfyknoy
```

## Security notes

1. **NAS credentials** không bao giờ chạm tới browser. Browser chỉ gửi Supabase JWT.
2. **JWT verify** chạy ở mỗi function (qua `requireUser`) — refuse 401 nếu invalid/expired.
3. **Path traversal** chống bằng `safeJoinPath` — không cho phép `..` hoặc escape root.
4. **CORS** mở `*` — chỉ JWT bảo vệ. Nếu cần lock domain, đổi `corsHeaders.Access-Control-Allow-Origin`.
5. **DB writes** dùng `service_role` → bypass RLS. Lệnh write chỉ trong `asset-upload`.

## Error codes returned

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `AUTH_EXPIRED` | 401 | Token Supabase hết hạn |
| `NOT_FOUND`    | 404 | File/folder không tồn tại trên NAS |
| `NAS_AUTH`     | 502 | NAS từ chối auth (sai NAS_USER/NAS_PASS) |
| `NAS_TIMEOUT`  | 200 | NAS phản hồi quá 45s/120s |
| `NAS_MISSING`  | 404 | DB có ghi nhận file nhưng NAS không còn |
| `DELETED`      | 410 | File đã soft-delete (active=false) |
| `NAS_ERROR`    | 200/502 | Lỗi khác từ NAS |
