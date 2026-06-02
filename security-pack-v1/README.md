# 🔒 Security Pack v1 — EVN Dashboard

**Áp dụng**: Bảo mật mức "cân bằng" — vá lỗ hổng quan trọng, giữ UX mượt

---

## 📦 Nội dung

| File | Mục đích |
|---|---|
| `08_security_hardening.sql` | RLS chặt cho tất cả bảng + audit log + RPC `log_user_action` |
| `vercel.json` | HTTP security headers (CSP, HSTS, X-Frame-Options...) |
| `security-patch-v1.js` | Watermark, disable Ctrl+S/P, audit log calls, hook nav |
| `apply-security-v1.sh` | Script tự động apply |
| `README.md` | (file này) Hướng dẫn |

---

## 🚀 Cách apply (3 bước)

### Bước 1: Chạy SQL trên Supabase

Mở https://supabase.com/dashboard/project/xqqmfmljwycpehfyknoy/sql/new
→ Paste toàn bộ `08_security_hardening.sql` → Run

Kết quả mong đợi:
```
NOTICE:  ✅ Bảo mật: 12 RLS policies, 4 bảng đã enable RLS
Success. No rows returned
```

### Bước 2: Copy files vào repo + chạy script

```bash
# Copy 3 file vào thư mục thietbi
cp security-patch-v1.js /c/Users/admin/Documents/thietbi/
cp vercel.json /c/Users/admin/Documents/thietbi/
cp apply-security-v1.sh /c/Users/admin/Documents/thietbi/

# Chạy script
cd /c/Users/admin/Documents/thietbi
bash apply-security-v1.sh
```

### Bước 3: Commit + push

```bash
git add app.js sw.js vercel.json
git commit -m "feat(security): RLS hardening + watermark + audit log + CSP headers"
git push origin main
```

Vercel sẽ auto-deploy trong 1-2 phút.

### Bước 4: Clear cache + test

1. F12 → Application → Service Workers → Unregister
2. Storage → Clear site data
3. Đóng tab → mở lại → Ctrl+Shift+R

Test các tính năng:

| Test | Kết quả mong đợi |
|---|---|
| Login admin | Thấy watermark mờ overlay (email + thời gian) trên toàn trang |
| Bấm Ctrl+S | Bị block + toast cảnh báo "Tính năng lưu trang đã bị vô hiệu hóa" |
| Bấm Ctrl+P | Bị block + toast cảnh báo |
| Bấm PrintScreen | Toast warning "Phát hiện chụp màn hình" |
| In trang (Browser menu → Print) | Trang trắng + cảnh báo "TRANG NÀY KHÔNG ĐƯỢC PHÉP IN" |
| F12 Console | `window._securityDebug.logBuffer()` xem audit logs |
| Network tab | Thấy POST `/rpc/log_user_action` định kỳ (mỗi 5s nếu có action) |

### Bước 5: Verify Vercel headers

```bash
curl -I https://thietbi.vercel.app/
```

Phải thấy:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), ...
```

### Bước 6: Verify RLS trên Supabase

Login user thường (không phải admin), F12 Console:
```javascript
// 1. SELECT vẫn được (OK)
fetch(SB_URL + '/rest/v1/TongHopThietBi?limit=1', {
  headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token }
}).then(r => r.json()).then(console.log);

// 2. INSERT/UPDATE/DELETE bị REJECT (OK)
fetch(SB_URL + '/rest/v1/TongHopThietBi', {
  method: 'POST',
  headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ Tram: 'TEST', Ten_thiet_bi: 'HACK' })
}).then(r => console.log('Status:', r.status));
// Phải trả 403 hoặc lỗi RLS
```

---

## 🛡️ Bảo vệ KHÔNG có

Pack này KHÔNG bao gồm (gây khó chịu / không hiệu quả):

| ❌ | Lý do |
|---|---|
| Disable right-click | User cần copy text serial/số liệu |
| Disable text selection | Cần copy data cho công việc |
| Detect DevTools open | False positive nhiều, dev cần DevTools |
| Encrypt JS code (obfuscate) | Phá UX + dễ debug hơn không |
| Disable Ctrl+C | Cần copy serial number |
| Auto-logout sau 5 phút | Khó chịu cho user thật |

---

## 📊 Audit log dùng thế nào?

Admin xem log:

```sql
-- Top 20 actions gần đây
SELECT created_at, user_email, action, resource, details
FROM access_log
ORDER BY created_at DESC
LIMIT 20;

-- Thống kê 7 ngày qua
SELECT * FROM audit_summary
WHERE day >= now() - interval '7 days'
ORDER BY day DESC, count DESC;

-- User nào export data nhiều nhất tuần qua
SELECT user_email, count(*) AS exports
FROM access_log
WHERE action = 'export_data'
AND created_at >= now() - interval '7 days'
GROUP BY user_email
ORDER BY exports DESC;

-- Ai bị block Ctrl+S/P nhiều
SELECT user_email, action, count(*)
FROM access_log
WHERE action LIKE 'blocked_%'
GROUP BY user_email, action
ORDER BY count DESC;
```

---

## 🔄 Rollback (nếu cần)

### Rollback JS:
```bash
cd /c/Users/admin/Documents/thietbi
cp app.js.before-security.bak app.js
# Bump cache mới
sed -i "s/evn-v19-security/evn-v20-rollback/g" sw.js
git add app.js sw.js && git commit -m "rollback: security patch" && git push
```

### Rollback Vercel headers:
```bash
rm vercel.json
git add vercel.json && git commit -m "rollback: remove vercel headers" && git push
```

### Rollback RLS:
```sql
-- Mở RLS lại cho anon (NGUY HIỂM — chỉ dùng debug)
GRANT SELECT ON public."TongHopThietBi" TO anon;
GRANT SELECT ON public."CongTacThiNghiem" TO anon;
```

---

## 🆘 Troubleshooting

### Lỗi: "Watermark che mất UI"
→ Tăng z-index của UI elements, hoặc giảm opacity watermark trong CSS:
```javascript
// F12 Console
document.getElementById('_security_watermark').style.opacity = '0.04';
```

### Lỗi: "User thường không xem được data"
→ Verify user có role gì:
```sql
SELECT id, email, role FROM evn_user_profiles WHERE email = 'user@example.com';
```
Nếu chưa có row → INSERT:
```sql
INSERT INTO evn_user_profiles (id, role, display_name)
SELECT id, 'user', email FROM auth.users WHERE email = 'user@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'user';
```

### Lỗi: "CSP block một script/CSS bên ngoài"
→ Mở `vercel.json` → thêm domain vào `script-src` hoặc `style-src`:
```json
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://YOUR_DOMAIN_HERE"
```
→ Commit + push.

### Lỗi: "Edge Function fail 401 sau khi apply"
→ Edge function dùng `SUPABASE_SERVICE_ROLE_KEY` bypass RLS — không bị ảnh hưởng. Nếu fail, kiểm tra logs:
```bash
supabase functions logs chat-query --project-ref xqqmfmljwycpehfyknoy --limit 50
```

---

## 🎯 Roadmap (v2 nếu cần thêm)

- [ ] 2FA (TOTP) cho admin
- [ ] IP whitelist (chỉ EVN intranet)
- [ ] Session timeout config (admin set)
- [ ] Export ra Excel có watermark in cell
- [ ] Honeypot endpoints (bẫy scanner)
- [ ] Anomaly detection (alert nếu 1 user query > 1000 records/h)
