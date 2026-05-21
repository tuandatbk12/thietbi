# Hướng dẫn triển khai — FIX triệt để lỗi NAS/BBTN

## I. Tóm tắt vấn đề & cách fix

| Triệu chứng | Nguyên nhân gốc | Cách fix |
|---|---|---|
| `[NAS_TIMEOUT] NAS/WebDAV phản hồi quá lâu — The signal has been aborted` khi mở BBTN | Edge Function timeout 15-20s, ngrok free có cold-start 3-8s, PROPFIND không có `Depth: 1` → trả XML khổng lồ | Edge Function mới: PROPFIND `Depth: 1`, timeout 45s + retry 1 lần, header `ngrok-skip-browser-warning: true` |
| Tải file lớn (PDF scan 10-20 MB) bị treo / lỗi | Edge Function cũ buffer toàn bộ body vào RAM (50 MB limit), client timeout 30s | Edge Function mới: stream `Response(upstream.body)` zero-copy, hỗ trợ `Range`, client 120s |
| Upload ảnh thiết bị thất bại với file > 5 MB | Frontend dùng Base64 (33% overhead) qua JSON, Edge Function decode chậm + đụng giới hạn 50 MB | Frontend đổi sang `multipart/form-data` (binary), Edge Function streaming PUT |
| Refresh trang → BBTN load chậm dù vừa xem xong | Không có cache phía client, mỗi lần navigate phải đợi cold-start ngrok lại | Cache 60s in-memory + dedupe concurrent request cùng path |
| ngrok trả HTML "You are about to visit..." thay vì XML | Thiếu header `ngrok-skip-browser-warning` | Edge Function tự thêm header này khi gọi NAS |
| Service Worker giữ cache cũ của Supabase API | `sw.js` cũ áp dụng `networkFirstWithCache` cho mọi request supabase.co | `sw.js` mới: hoàn toàn bypass supabase.co và ngrok-free.dev |

## II. Cấu trúc file đã sửa & file mới

```
project/
├── index.html              (giữ nguyên — không cần sửa)
├── app.js                  ✏️  Đã sửa: timeout/retry/cache/multipart
├── styles.css              (giữ nguyên)
├── sw.js                   ✏️  Đã sửa: bypass supabase & ngrok
└── supabase/
    ├── functions/
    │   ├── _shared/
    │   │   ├── cors.ts             ✨ MỚI — CORS headers chung
    │   │   └── nas.ts              ✨ MỚI — NAS WebDAV client + auth
    │   ├── bbtn-list/index.ts      ✨ MỚI — PROPFIND Depth:1
    │   ├── bbtn-download/index.ts  ✨ MỚI — Streaming proxy
    │   ├── asset-upload/index.ts   ✨ MỚI — Multipart + Base64 (BC)
    │   └── asset-download/index.ts ✨ MỚI — Streaming proxy
    ├── migrations/
    │   └── 20260520_equipment_attachments.sql  ✨ MỚI
    └── deploy.sh                   ✨ MỚI — script deploy
```

## III. Các bước triển khai (theo thứ tự)

### Bước 1 — Bật WebDAV trên Synology NAS

1. Mở **DSM → Control Panel → File Services → WebDAV**.
2. Bật **HTTPS WebDAV** (port mặc định **5006**). Có thể bật cả HTTP **5005** nhưng nên dùng HTTPS.
3. Tạo Shared Folder gốc tên ví dụ `EVNHANOI` chứa hai subfolder:
   - `BBTN/`     (cấu trúc bên trong: `BBTN/<Đơn vị>/<Năm>/<Trạm>/<file>`)
   - `TNDK/`     (sẽ tạo subfolder theo trạm khi upload)
4. **Control Panel → User & Group**: tạo user dành riêng cho service (vd `evnservice`), gán quyền **Read/Write** vào hai folder trên, **KHÔNG** cấp quyền admin.
5. Test thử bằng cURL từ máy local (mạng nội bộ):
   ```bash
   curl -u evnservice:PASS -X PROPFIND \
        -H "Depth: 1" \
        https://192.168.x.x:5006/BBTN/ \
        --insecure
   ```
   Phải trả `207 Multi-Status` kèm XML.

### Bước 2 — Cấu hình ngrok tunnel

#### 2a. Tạo file config (chạy 1 lần trên Synology Container Manager)

Vì bạn đã có `ngrok-webdav` container, chỉ cần đảm bảo:

- Authtoken (free tier OK).
- **Reserved domain** (free tier cho 1 reserved domain): hiện URL của bạn là `slicing-requisite-custodian.ngrok-free.dev` — đây là URL **động** trừ khi bạn reserve nó. Vào https://dashboard.ngrok.com/cloud-edge/domains → claim domain này → reserve để không đổi mỗi lần restart container.

#### 2b. ngrok.yml gợi ý

Mount vào container đường dẫn `/etc/ngrok/ngrok.yml`:

```yaml
version: "3"
authtoken: <NGROK_AUTHTOKEN_CỦA_BẠN>

tunnels:
  nas-webdav:
    proto: http
    addr: https://host.docker.internal:5006   # WebDAV HTTPS của Synology
    domain: slicing-requisite-custodian.ngrok-free.dev
    inspect: false
    # Quan trọng: ngrok rewrite Host header → NAS Synology cần origin chính xác
    host_header: "host.docker.internal:5006"
    # Tăng request timeout (mặc định 5 phút là OK)
```

> ⚠️ ngrok free tier có rate-limit **40 req/phút/tunnel**. Với 5 user dùng cùng lúc + nhiều file thumb load đồng thời thì sẽ chạm trần. Lựa chọn:
> - **Nâng cấp ngrok Personal ($8/tháng)** — hết rate limit, hỗ trợ TCP, multiple endpoints. Khuyên dùng cho production.
> - Hoặc đổi sang **Cloudflare Tunnel** (miễn phí, không rate-limit, ổn định hơn ngrok) — xem [Phụ lục](#phụ-lục-thay-ngrok-bằng-cloudflare-tunnel).

#### 2c. Test ngrok URL từ máy local

```bash
curl -u evnservice:PASS \
     -X PROPFIND -H "Depth: 1" \
     -H "ngrok-skip-browser-warning: true" \
     https://slicing-requisite-custodian.ngrok-free.dev/BBTN/ \
     --insecure
```

Phải trả XML PROPFIND. Nếu trả HTML interstitial của ngrok → thiếu header `ngrok-skip-browser-warning`.

### Bước 3 — Tạo bảng Supabase

Mở **Supabase Dashboard → SQL Editor**, paste & chạy file `supabase/migrations/20260520_equipment_attachments.sql`. Hoặc qua CLI:

```bash
supabase db push
```

### Bước 4 — Set secrets cho Edge Function

> **Tên secrets đã đồng bộ với UI Supabase của bạn** (xem screenshot Custom Secrets):
> `NAS_BASE_URL`, `NAS_USERNAME`, `NAS_PASSWORD`, `NAS_BBTN_PATH`, `NAS_ASSET_PATH`.
> Code Edge Function cũng accept tên cũ (`NAS_USER`, `NAS_PASS`, `NAS_BBTN_ROOT`, `NAS_ASSETS_ROOT`) làm fallback — bạn không cần đổi gì nếu đã set sẵn.

```bash
# Cài Supabase CLI (1 lần)
npm install -g supabase

# Login
supabase login

# Link với project
cd <project-folder>     # nơi có thư mục supabase/
supabase link --project-ref xqqmfmljwycpehfyknoy

# Set secrets — DÙNG TÊN CHUẨN
supabase secrets set NAS_BASE_URL=https://slicing-requisite-custodian.ngrok-free.dev
supabase secrets set NAS_USERNAME=evnservice
supabase secrets set NAS_PASSWORD='mật-khẩu-mạnh'
supabase secrets set NAS_BBTN_PATH=/BBTN
supabase secrets set NAS_ASSET_PATH=/TNDK

# Verify
supabase secrets list
```

#### Về SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (DEPRECATED)

Supabase 2026 đã đánh dấu `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` là **DEPRECATED** và khuyến nghị dùng:
- `SUPABASE_PUBLISHABLE_KEYS` — JSON dict các publishable key
- `SUPABASE_SECRET_KEYS` — JSON dict các secret key

✅ **Code Edge Function của bạn đã sẵn sàng cho cả 2 pattern**: `getServiceRoleKey()` / `getAnonKey()` trong `_shared/nas.ts` tự dò JSON dict mới trước, fallback về biến deprecated. Khi Supabase tắt biến cũ trong tương lai, code KHÔNG cần sửa.

> 🔒 **NAS_BASE_URL không bao giờ lộ ra browser** — chỉ Edge Function đọc được.

### Bước 5 — Deploy Edge Functions

```bash
chmod +x supabase/deploy.sh
PROJECT_REF=xqqmfmljwycpehfyknoy ./supabase/deploy.sh
```

Hoặc thủ công (5 functions):

```bash
supabase functions deploy bbtn-list        --no-verify-jwt --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy bbtn-download    --no-verify-jwt --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy asset-upload     --no-verify-jwt --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy asset-download   --no-verify-jwt --project-ref xqqmfmljwycpehfyknoy
supabase functions deploy nas-health-check --no-verify-jwt --project-ref xqqmfmljwycpehfyknoy
```

> 🛈 Dùng `--no-verify-jwt` vì các function tự gọi `/auth/v1/user` để verify (chính xác hơn, biết được user_id để ghi vào DB). Riêng `nas-health-check` không yêu cầu JWT — dùng cho monitoring/uptime check.

### Bước 6 — Test từng Edge Function

```bash
# Lấy access token từ một user đã đăng nhập (paste từ DevTools localStorage 'sb-...auth-token')
TOKEN="eyJ..."
ANON_KEY="eyJ..."   # _AUTH_SB_KEY trong app.js
PROJECT="https://xqqmfmljwycpehfyknoy.supabase.co"

# Test bbtn-list
curl -H "Authorization: Bearer $TOKEN" -H "apikey: $ANON_KEY" \
     "$PROJECT/functions/v1/bbtn-list?path=/BBTN"

# Test bbtn-download
curl -OJ -H "Authorization: Bearer $TOKEN" -H "apikey: $ANON_KEY" \
     "$PROJECT/functions/v1/bbtn-download?path=/BBTN/Đội%20X/2024/Trạm%20Y/file.pdf"
```

Kết quả mong đợi cho `bbtn-list`:

```json
{"items":[{"name":"Đội 1","isFolder":true,"size":0,"modified":"...","relativePath":"/BBTN/Đội 1"}, ...],"path":"/BBTN"}
```

### Bước 7 — Replace app.js / sw.js trên hosting

1. Copy file mới `app.js` và `sw.js` từ thư mục output vào GitHub repo (hoặc Synology Web Station).
2. **Force update Service Worker** trên browser của tất cả user:
   - Mở DevTools (F12) → **Application → Service Workers → Update** hoặc tick **Update on reload**.
   - Hoặc thêm trong Console: `caches.keys().then(k=>k.forEach(x=>caches.delete(x))); navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())); location.reload()`.
3. CACHE_VERSION trong `sw.js` mới là `evn-v7-nas-fix` → SW tự skipWaiting + xóa cache cũ ngay khi user mở app.

### Bước 8 — Verify trên UI

1. Login vào dashboard.
2. Vào **BBTN** → phải thấy danh sách Đội (folders level 1).
3. Mở DevTools → Network → filter `bbtn-list` — phải thấy:
   - Status 200
   - Response time **< 50s** trong lần đầu (cold start)
   - Lần thứ 2 navigate trở lại cùng path → **không gọi network** (hit cache 60s).
4. Click vào 1 file PDF → mở tab mới hoặc download → file phải mở được.
5. Vào trang chi tiết MBA → bấm "Tải lên NAS" với ảnh < 5 MB → status phải hiện `✅ Upload thành công!`.

## IV. Troubleshooting

### Vẫn `NAS_TIMEOUT` sau khi deploy

1. **Test endpoint trực tiếp** (skip Edge Function):
   ```bash
   curl -u evnservice:PASS -H "ngrok-skip-browser-warning: true" \
        -X PROPFIND -H "Depth: 1" \
        https://slicing-requisite-custodian.ngrok-free.dev/BBTN/ \
        -w "\nTime: %{time_total}s\n"
   ```
   Nếu > 30s → vấn đề ở NAS hoặc ngrok, không phải Edge Function.

2. **Check ngrok dashboard** (https://dashboard.ngrok.com/observability/traffic-inspector) → xem request có đến không, response code, latency.

3. **Check Synology log**: DSM → Log Center → WebDAV — có thể NAS bị overload hoặc đang index `@eaDir`.

4. **Tạm khắc phục**: Tăng `timeoutMs` trong `_shared/nas.ts` lên 90_000 và redeploy.

### Lỗi 401 trên Edge Function

- Token Supabase hết hạn → user logout/login lại.
- Hoặc `NAS_USER` / `NAS_PASS` sai → vào DSM kiểm tra user `evnservice` còn quyền không.

### Lỗi 502 từ Edge Function

Edge Function trả 502 khi NAS trả lỗi. Coi `console.error` log trong Supabase Functions Logs:
```
supabase functions logs bbtn-list --project-ref xqqmfmljwycpehfyknoy
```

### Service Worker không update

User chạy `cmd/ctrl + shift + R` (hard reload), hoặc clear `localStorage` và `Cache Storage` qua DevTools.

### Upload file lớn vẫn lỗi

- Supabase Free plan giới hạn **request body 6 MB** với JSON, **50 MB** với multipart. Frontend đã set max 25 MB là an toàn.
- Nếu cần > 25 MB, đổi sang **direct WebDAV upload** (frontend → NAS qua presigned URL) — tốn công code hơn, hỏi nếu cần.

## V. Phụ lục — So sánh các phương án Tunnel & gợi ý chọn

### 5.1 Bảng so sánh

| Phương án | Chi phí | Ưu | Nhược |
|---|---|---|---|
| **ngrok Free + reserved domain** *(đang dùng)* | $0 | Sẵn rồi, chỉ cần claim 1 domain free để URL không đổi | Rate-limit 40 req/phút/tunnel; cold-start 3-8s sau idle |
| **ngrok Personal** | $8/tháng | Hết rate-limit, multiple endpoints, TCP | Có phí, vẫn cold-start nhẹ |
| **Cloudflare Tunnel + domain riêng** | Tunnel free + ~**$10/năm domain** (.com qua Cloudflare Registrar) | Không rate-limit, không cold-start, ổn định nhất | Cần đăng ký 1 domain (rẻ nhưng có phí) |
| **Cloudflare Tunnel + TryCloudflare URL** | $0 | Thật sự miễn phí 100% | URL ngẫu nhiên đổi mỗi lần restart (không production-friendly) |
| **Tailscale Funnel** | $0 (cá nhân) | Wireguard tunnel, cực nhanh nội bộ | Quota 1GB/tháng cho free, hạn chế production |

### 5.2 Khuyến nghị thực tế

**Phương án 1 — Tiếp tục ngrok Free (đang dùng)**: phù hợp khi chỉ 3-5 user dùng dashboard, không quá nhiều thumbnail load đồng thời. Đảm bảo:
- ✅ Reserved domain (`slicing-requisite-custodian.ngrok-free.dev`) đã claim, không bị đổi sau restart container.
- ✅ Patch hiện tại (timeout 45s, retry, cache 60s, header skip-warning) đã giúp ngrok cold-start không gây fail user.
- ⚠️ Nếu thấy lỗi 429 thường xuyên (3+ lần/ngày) → cần nâng cấp.

**Phương án 2 — Cloudflare Tunnel với domain mua**: nếu có ngân sách ~250k VND/năm, đây là lựa chọn tốt nhất cho production:
- Domain `.com` qua Cloudflare Registrar: ~$8-12/năm (rẻ hơn GoDaddy nhiều).
- Tunnel hoàn toàn miễn phí, không rate-limit, latency thấp (Cloudflare có PoP ở Singapore + HK gần Việt Nam).
- Domain có thể tận dụng cho nhiều việc khác (email, page khác...).

**Phương án 3 — Cloudflare Tunnel với TryCloudflare**: chỉ dùng cho dev/test, KHÔNG production vì URL đổi mỗi lần.

### 5.3 Cách chuyển từ ngrok sang Cloudflare Tunnel (khi sẵn sàng)

1. Mua domain qua Cloudflare Registrar (vd `evnhanoi.work` ~$8/năm, `evnhanoi.com` ~$10/năm).
2. Cài image `cloudflare/cloudflared:latest` lên Synology Container Manager (thay container ngrok-webdav).
3. Vào Cloudflare Zero Trust → Networks → Tunnels → Create → trỏ public hostname `nas.evnhanoi.com` về `https://host.docker.internal:5006`.
4. Đổi 1 secret duy nhất:
   ```bash
   supabase secrets set NAS_BASE_URL=https://nas.evnhanoi.com
   ```
5. KHÔNG cần đụng code — header `ngrok-skip-browser-warning` vô hại với Cloudflare.

### 5.4 Tóm tắt

**Trước mắt**: cứ giữ ngrok free + patch hiện tại đã đủ — đo thực tế xem có lỗi rate-limit không. Nếu chạy mượt trong 2 tuần thì không cần đổi.

**Khi nào nâng cấp**: thấy ≥3 báo lỗi NAS_TIMEOUT/429 mỗi ngày, hoặc số user concurrent vượt 10.

## VI. Checklist nghiệm thu

- [ ] DSM WebDAV bật, user `evnservice` đăng nhập được
- [ ] ngrok tunnel chạy, `slicing-requisite-custodian.ngrok-free.dev` trả PROPFIND XML với cURL
- [ ] Bảng `equipment_attachments` đã tạo trong Supabase
- [ ] 5 secrets đã set: `NAS_BASE_URL`, `NAS_USERNAME`, `NAS_PASSWORD`, `NAS_BBTN_PATH`, `NAS_ASSET_PATH`
- [ ] 5 Edge Functions deploy thành công (bbtn-list, bbtn-download, asset-upload, asset-download, nas-health-check)
- [ ] `GET /functions/v1/nas-health-check` trả `{"ok":true,...}` mà không cần JWT
- [ ] `app.js` và `sw.js` mới đã đẩy lên hosting
- [ ] Hard reload trang, mở BBTN — danh sách load < 10s ở lần đầu, < 1s từ cache
- [ ] Upload ảnh thiết bị thành công với file 5 MB
- [ ] Download file PDF 10 MB từ BBTN — mở được trong tab mới

---

**Đã sửa & test cú pháp:**
- `app.js` — JavaScript syntax valid
- `sw.js` — JavaScript syntax valid
- 4 Edge Functions — TypeScript, sẽ được Deno verify khi `supabase functions deploy`
