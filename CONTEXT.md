# 🚀 CONTEXT — EVN Hà Nội Dashboard Project

> Đây là file context cho chat mới của Claude. Đọc kỹ trước khi trả lời để hiểu dự án.

---

## 📋 GIỚI THIỆU DỰ ÁN

**Tên**: EVN Hà Nội Dashboard - Hệ thống quản lý thiết bị điện cao thế

**URL Live**: https://thietbi.vercel.app/

**Repo**: https://github.com/tuandatbk12/thietbi

**Stack**:
- Frontend: Vanilla JS/CSS/HTML (1 file `app.js` ~770KB)
- Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- OCR: Google Gemini 2.5 Flash
- Hosting: Vercel (auto-deploy từ GitHub main branch)

**User**: Admin EVN quản lý ~22,974 thiết bị tại 68 trạm biến áp

---

## 🔑 CREDENTIALS QUAN TRỌNG

```
Supabase URL: https://xqqmfmljwycpehfyknoy.supabase.co
Supabase Project: xqqmfmljwycpehfyknoy
Admin login: admin@example.com / EvnAdmin@2026

Local repo: /c/Users/admin/Documents/thietbi (Git Bash)
GEMINI_API_KEY: trong Supabase secrets
```

---

## 📊 TRẠNG THÁI HIỆN TẠI (cập nhật cuối: 31/05/2026)

**Cache version**: `evn-v56-rename-html`
**Git commit HEAD**: `9c98787`
**Bundle production**: v6.5 (đóng gói trong `evnhanoi-bundle-v6.5-final-20260531.zip`)

### Các module đã hoàn thiện

✅ **Dashboard**: Tổng quan + 6 module thống kê (68 TBA, 22,974 thiết bị)
✅ **Quản lý thiết bị**: 26 loại + filter chip + lý lịch + ảnh attachment
✅ **BBTN OCR**: Upload + Gemini OCR + dedupe + Manage page + Export Excel
✅ **PMIS Compare**: So sánh 40K thiết bị PMIS vs DB (3 tầng + 7 nhóm + Excel 13 sheet)
✅ **Thí nghiệm định kỳ** (đổi tên từ "TNĐK định kỳ" trong v56)
✅ **Thí nghiệm đột xuất**
✅ **Kế hoạch NGCCĐ** + **Khối lượng TNĐK**
✅ **Báo cáo, theo dõi kết quả**
✅ **UX patches**: Friendly error messages + OCR ETA
✅ **Performance**: DNS prefetch + Preconnect + Brotli compression

---

## 🗂️ CẤU TRÚC FILE QUAN TRỌNG

```
/c/Users/admin/Documents/thietbi/
├── app.js (~770KB, monolithic - KHÔNG nên tách)
├── index.html (sidebar menu hardcoded)
├── sw.js (Service Worker, CACHE_VERSION = 'evn-v56-rename-html')
├── styles.css
├── bbtn-ocr-ui.css (dark theme dropdown, BBTN preview cards)
├── supabase/functions/bbtn-ocr-extract/index.ts (Edge Function v5.2)
└── *.bak files (backup từ các patch trước)
```

---

## 🗄️ SCHEMA DB QUAN TRỌNG

### Table `TongHopThietBi` (22,974 rows)
- `Tram, Ten_thiet_bi, Phan_loai_thiet_bi, Cap_dien_ap, Ngan_thiet_bi`
- **CHÚ Ý**: KHÔNG có column `Nhom_thiet_bi` (chỉ ở `CongTacThiNghiem`)

### Table `CongTacThiNghiem` (~17,917 rows)
- Có thêm column `Nhom_thiet_bi`
- `Doi`: 'Đội 1' đến 'Đội 8' (data sạch, UTF-8 đúng)

### Table `bbtn_records` (BBTN OCR results)
- Required columns: `sfra boolean`, `tiet_dien text` (đã thêm migration v3)

### Bucket Storage
- `bbtn-files/`: lưu file BBTN OCR

---

## 🔧 WORKFLOW LÀM VIỆC

### Patch lên production (template):
```bash
cd /c/Users/admin/Documents/thietbi

# 1. Backup file trước khi sửa
cp app.js app.js.before-feature.bak

# 2. Patch với Python (an toàn hơn sed)
python3 << 'PYEOF'
with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()
# patch logic
content = content.replace('OLD', 'NEW')
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
PYEOF

# 3. Verify
node --check app.js && echo "✓ Syntax PASS"

# 4. Bump cache version
sed -i "s/CACHE_VERSION\s*=\s*'evn-v[0-9]*-[^']*'/CACHE_VERSION = 'evn-vXX-feature-name'/g" sw.js

# 5. Commit + push
git add -A && git commit -m "feat: ..." && git push origin main

# 6. Đợi Vercel deploy 1-2 phút
```

### Hard reset cache client (F12 Console):
```javascript
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const keys = await caches.keys();
for (const k of keys) await caches.delete(k);
localStorage.clear();
sessionStorage.clear();
window.location.href = window.location.origin + '?_bust=' + Date.now();
```

---

## ⚠️ CRITICAL WARNINGS

1. **Không tách app.js**: User đã reject — rủi ro cao, không đáng cải thiện
2. **3 nơi định nghĩa `navActivate`** trong app.js (line 5775, 10077, 12066) — phải xem context khi sửa nav
3. **`encodeURIComponent(path)` BREAKS Supabase signed URL** — phải dùng `path.split('/').map(encodeURIComponent).join('/')` để giữ '/' 
4. **Anon key là PUBLIC** — an toàn để hardcode trong frontend (RLS bảo vệ)
5. **Schema reload sau ALTER TABLE**: phải chạy `NOTIFY pgrst, 'reload schema';`
6. **Edge Function bbtn-ocr-extract timeout 60s** (Supabase Free tier limit)
7. **Service Worker cache stickiness** — cần bump CACHE_VERSION + triple invalidation để force update

---

## 🎯 ĐỀ XUẤT TÍNH NĂNG CHƯA LÀM (priority order)

### CAO
- **#1 Tour onboarding** cho user mới (~4h)
- **#3 Quick filter preset** + Auto-save filter (~3h)
- **#10 Mobile responsive** (~6h)

### TRUNG BÌNH
- **#6 Search box toàn cục** (Ctrl+K, ~3h)
- **#7 Excel template đẹp** với logo EVN (~4h)
- **#8 PWA install + offline** (~4h)
- **#9 Audit log + Activity feed** (~5h)

### THẤP
- #11 Dark/Light mode toggle (~3h)
- #12 Multi-language EN/VN (~5h)
- #14 Backup tự động hàng ngày (~2h)

---

## 📚 TÀI LIỆU THAM KHẢO

Bundle v6.5 chứa 3 file docs tiếng Việt:
- `USER-GUIDE-VN.md` (464 dòng) - Hướng dẫn user
- `RESTORE-FROM-BACKUP-VN.md` (490 dòng) - Setup từ A-Z
- `TROUBLESHOOTING-VN.md` (646 dòng) - 20+ scenarios lỗi thường gặp

---

## 💬 CÁCH GIAO TIẾP VỚI USER

- User dùng Windows + Git Bash, làm việc trên Vercel + Supabase Free tier
- Thích patch nhỏ, test từng bước (an toàn hơn rewrite lớn)
- Người dùng cuối là Admin EVN trình độ vi tính trung bình
- Vietnamese language UI/UX
- Hay paste output bash để verify

### Quy trình chuẩn cho mỗi patch:
1. **Verify trước**: grep/sed -n để xem code hiện tại
2. **Backup**: cp file file.bak
3. **Patch nhỏ**: Python heredoc thay vì sed (UTF-8 safe)
4. **Verify**: count matches, syntax check
5. **Bump cache**: sw.js CACHE_VERSION
6. **Push**: git add + commit + push
7. **Test**: F12 Console + screenshot

---

## 🆘 KHI USER NÓI "X KHÔNG HOẠT ĐỘNG"

1. Hỏi: Cache version hiện tại là gì? (F12 `caches.keys()`)
2. Hỏi: Có hard reset cache chưa?
3. Verify Vercel đã deploy chưa (`git log --oneline -3`)
4. Check F12 Console có error không
5. So sánh expected vs actual

---

**Đến đây là đủ context. Bắt đầu task của bạn bằng cách hỏi cụ thể bạn muốn làm gì tiếp theo trên dự án này.**
