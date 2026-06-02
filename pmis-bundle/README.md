# 📊 PMIS COMPARE MODULE

Module so sánh dữ liệu **PMIS** (file `.xlsb`/`.xlsx`) với **Dashboard EVN Hà Nội**.

## ✨ Tính năng

### 1. Upload file PMIS
- Hỗ trợ `.xlsb` (binary Excel) và `.xlsx`
- Max 20MB, auto-detect 89 sheets
- Parse ~40,000 thiết bị trong ~5-10s
- Mapping 26 loại thiết bị: MC, MBA, MBATD, DCL, TI, TU, CSV, Cáp, GIS, HGIS, TBN, TC, FCO, RL, TIchânsứ

### 2. So sánh 3 tầng (theo yêu cầu user)
- **Tầng 1 — Tổng hợp**: Trạm × Loại × Cấp ĐA → báo cáo lãnh đạo
- **Tầng 2 — Vận hành**: Trạm × Cấp ĐA × Ngăn lộ × Loại → giao đội kiểm tra
- **Tầng 3 — Định danh**: Match từng thiết bị + chấm điểm 0-100 → cập nhật hồ sơ

### 3. 7 nhóm kết quả sai khác
- **N1**: Thiếu DB (có PMIS, không có DB)
- **N2**: Thừa DB (có DB, không có PMIS)
- **N3**: Lệch số lượng
- **N4**: Lệch serial
- **N5**: Lệch hãng SX
- **N6**: Lệch kiểu/model
- **N7**: Thiếu thông tin quan trọng

### 4. Export báo cáo Excel — 13 sheet
1. **Dashboard** — Tổng hợp số trạm, thiết bị, sai khác
2. **DM_Tram** — Danh mục trạm 2 nguồn
3. **Tong_hop_theo_tram** — Tổng số TB từng trạm
4. **Tong_hop_theo_loai_TB** — Theo loại
5. **So_sanh_tram_loai_capdienap** — Tầng 1
6. **So_sanh_ngan_lo** — Tầng 2
7. **So_sanh_serial** — Đối chiếu serial
8. **So_sanh_hang_model** — Đối chiếu hãng + model
9. **PMIS_chua_co_DB** — Nhóm N1
10. **DB_chua_co_PMIS** — Nhóm N2
11. **Thieu_thong_tin** — Nhóm N7
12. **Bang_quy_doi_loai_TB** — Mapping rule
13. **Bang_chuan_hoa_hang** — Chuẩn hóa tên hãng

## 🚀 Cài đặt

```bash
cd /c/Users/admin/Documents/thietbi

# Copy module files vào repo
cp /path/to/bundle/pmis-compare*.js .
cp /path/to/bundle/pmis-compare.css .
cp /path/to/bundle/apply-pmis-module.sh .

# Apply
bash apply-pmis-module.sh

# Push
git add app.js sw.js
git commit -m "feat: PMIS vs DB compare module"
git push origin main
```

## 🧪 Test

1. Clear cache + reload trang
2. Sidebar trái → **"📊 So sánh PMIS vs DB"** (menu mới)
3. Click → modal mở
4. Drag file `PMIS_TBA_*.xlsb` hoặc `.xlsx`
5. Đợi 10-15s parse + match
6. Click qua 7 tabs: Tổng quan / Tầng 1 / Tầng 2 / Thiếu DB / Thừa DB / Lệch / Export

## ⚙️ Tech

- **Parser**: SheetJS xlsx@0.18.5 (CDN)
- **Match engine**: Hash-map O(n+m)
- **UI**: Vanilla JS + CSS, no framework
- **Export**: SheetJS writeFile

## ⚠️ Hạn chế

- Browser ngốn ~200MB RAM khi parse 40K rows
- File `.xlsb` có thể fail nếu format đặc biệt → hướng dẫn convert `.xlsx`
- Match dựa trên `tram + ten_thiet_bi` → có thể miss nếu dashboard nhập sai trạm

## 📞 Mapping logic

```
PMIS Sheet              → Dashboard Loại
─────────────────────────────────────────
Máy cắt *kV             → MC
Máy biến áp 110/220/35  → MBA
Máy biến áp tự dùng *   → MBATD
Dao cách ly *           → DCL
Biến dòng điện *        → TI
Biến điện áp *          → TU
Chống sét van *         → CSV
Tụ bù *                 → TBN
Thanh cái *             → TC
Sứ *                    → TIchânsứ
Đầu cáp / Cáp ngầm *    → Cáp
Bộ GIS *                → GIS
Bộ HGIS 110kV           → HGIS
Cầu dao phụ tải         → FCO
```

26 sheet PMIS map sang **15 loại** trong dashboard. Các sheet còn lại (NấcOLTC, Cuộn-MBA, TủHạThế...) không có tương ứng → skip.
