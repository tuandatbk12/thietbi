# MAINTENANCE — EVNHANOI Dashboard

> Tài liệu cho team duy trì hệ thống sau lần deploy đầu tiên 20/05/2026.

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ BROWSER (https://tuandatbk12.github.io/thietbi/)            │
│  ↓ app.js gọi Supabase Edge Functions                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ SUPABASE EDGE FUNCTIONS (xqqmfmljwycpehfyknoy.supabase.co)  │
│  ┌───────────────┬─────────────────┬──────────────────┐    │
│  │ bbtn-list     │ bbtn-download   │ asset-upload     │    │
│  │ asset-download│ nas-health-check│                  │    │
│  └───────────────┴─────────────────┴──────────────────┘    │
│  Đọc secrets: NAS_BASE_URL, NAS_USERNAME, NAS_PASSWORD...   │
│  Verify JWT từ Supabase Auth                                │
│  ↓ HTTPS                                                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ CLOUDFLARE TUNNEL (nas.dulieuvanhanh.pro.vn)                │
│  Tunnel name: evn-nas-webdav                                │
│  Public hostname → http://192.168.1.2:5005                  │
│  Unlimited bandwidth, auto HTTPS, anti-DDoS                 │
│  PoP HAN (Hanoi) — latency ~300-700ms                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ SYNOLOGY NAS (LAN 192.168.1.2)                              │
│  Container: cloudflared (outbound tunnel, no port forward)  │
│  WebDAV server (port 5005 HTTP, internal only)              │
│  User: evn_webdav (R/W trên BBTN + THIETBI)                 │
│  Shared folders: /BBTN, /THIETBI                            │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 Secrets quản lý

| Secret | Giá trị mẫu | Khi nào đổi |
|---|---|---|
| `NAS_BASE_URL`     | `https://nas.dulieuvanhanh.pro.vn` | Khi đổi tên domain hoặc tunnel |
| `NAS_USERNAME`     | `evn_webdav` | Khi tạo user mới trên NAS |
| `NAS_PASSWORD`     | (hidden) | Khi reset password NAS — 90 ngày khuyến nghị |
| `NAS_BBTN_PATH`    | `/BBTN` | Khi đổi cấu trúc thư mục NAS |
| `NAS_ASSET_PATH`   | `/THIETBI` | Khi đổi cấu trúc thư mục NAS |

Đổi secret:
```bash
supabase secrets set KEY=value --project-ref xqqmfmljwycpehfyknoy
```
Không cần redeploy — function tự đọc lại env ở lần invoke tiếp theo.

## 🚀 Deploy update sau này

### Khi sửa frontend (app.js / sw.js / index.html)

```bash
cd ~/Documents/thietbi
# sửa file
git add app.js
git commit -m "fix: <mô tả>"
git push origin main
```

GitHub Pages tự rebuild (~1-2 phút). User cần hard reload `Ctrl+Shift+R` để Service Worker pick up bản mới.

### Khi sửa Edge Function

```bash
cd ~/Documents/thietbi
# sửa file trong supabase/functions/<fn>/
supabase functions deploy <fn-name> --project-ref xqqmfmljwycpehfyknoy --no-verify-jwt

git add supabase/functions/<fn-name>/
git commit -m "fix(<fn-name>): <mô tả>"
git push origin main
```

> Nhớ deploy CLI riêng — `git push` không tự deploy Edge Function. Hai bước riêng biệt.

### Khi sửa Database schema

1. Viết file SQL mới trong `supabase/migrations/YYYYMMDD_<name>.sql`
2. Chạy migration qua Supabase SQL Editor (paste content + Run)
3. Commit file vào git để lưu lịch sử

## 🔍 Monitoring NAS

### Health check thủ công

```bash
curl -sS https://xqqmfmljwycpehfyknoy.supabase.co/functions/v1/nas-health-check \
  -H "apikey: <ANON_KEY>"
```

Trả `{"ok":true,"status":"ok","latencyMs":<số>}` khi mọi thứ OK.

### Health log query

```sql
-- 24h uptime
select * from nas_health_summary;

-- Lịch sử log
select id, status, response_ms, checked_at, detail
from nas_health_log
order by id desc
limit 50;

-- Tỷ lệ fail 24h
select
  count(*) filter (where status = 'ok') as ok_count,
  count(*) filter (where status != 'ok') as fail_count,
  round(100.0 * count(*) filter (where status = 'ok') / count(*), 2) as uptime_pct
from nas_health_log
where checked_at > now() - interval '24 hours';
```

### Debug endpoint khi NAS lỗi

```bash
curl -sS "https://xqqmfmljwycpehfyknoy.supabase.co/functions/v1/nas-health-check?debug=1" \
  -H "apikey: <ANON_KEY>"
```

Trả chi tiết 5 method probe (HEAD/OPTIONS/GET/PROPFIND) với status code thật.

### Setup cron job tự động (tùy chọn)

Trong Supabase SQL Editor:
```sql
-- Cần enable pg_cron + pg_net extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ping mỗi 5 phút (giảm tải, không 1 phút)
select cron.schedule(
  'nas-health-every-5min',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://xqqmfmljwycpehfyknoy.supabase.co/functions/v1/nas-health-check',
    headers := '{"apikey":"<ANON_KEY>"}'::jsonb
  );
  $$
);
```

## ⚠️ Troubleshooting

### "NAS_TIMEOUT" trong dashboard

1. Kiểm tra cloudflared container trên Synology: vào Container Manager → cloudflared-nas → phải green dot
2. Test trực tiếp Cloudflare Tunnel:
   ```bash
   curl -I https://nas.dulieuvanhanh.pro.vn/BBTN/
   ```
   Phải HTTP 401 hoặc 404 — không phải timeout.
3. Chạy debug endpoint (xem bên trên) để biết error chính xác.
4. Last resort: restart container cloudflared-nas trên Synology.

### Upload thất bại với file lớn

- Limit hiện tại: **40 MB** (set ở `_assetFileChosen`, `_assetDoUpload`, và Edge Function `asset-upload`).
- Để tăng: sửa cả 3 chỗ trên + chú ý Supabase free tier giới hạn body 50 MB.

### Click "Xem" file BBTN tự download

- Browser block popup vì user activation đã expire (async fetch quá lâu).
- Code hiện tại đã mở tab `about:blank` sync ngay khi click — không nên xảy ra nữa.
- Nếu vẫn xảy ra: dùng nút "Tải" thay vì "Xem".

### Edge Function 401 sau khi đổi secret

- Đợi 10-30s cho secret propagate
- Hard reload browser để clear JWT cache nếu có
- Verify secret value: `supabase secrets list` (chỉ thấy DIGEST hash)

## 🔄 Rotation Plan

| Thứ | Tần suất |
|---|---|
| Đổi password user `evn_webdav` trên NAS | 6 tháng |
|  Renew Cloudflare Tunnel token | 6 tháng/lần (security) |
| Audit `equipment_attachments` orphans | Hàng tháng (xem query phần Monitoring) |
| Backup `nas_health_log` | 1 lần/quý nếu cần (table tự tích lũy) |

## 📞 Liên hệ

- **GitHub repo**: https://github.com/tuandatbk12/thietbi
- **Supabase project**: https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy
- **Owner**: tuandatbk12 (mtuandat@gmail.com)
