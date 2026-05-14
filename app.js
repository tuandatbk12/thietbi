# Patch app.js — Fix "Đang tải..." không hết

## Vấn đề

Hàm `_assetLoadGallery` có đoạn:
```javascript
if (!gEl || !window._sbClient) return;
```

Khi `_sbClient` chưa sẵn sàng → hàm `return` ngay mà **không cập nhật giao diện**
→ spinner "Đang tải..." mãi không tắt.

---

## Cách tìm đoạn cần sửa trong app.js

Dùng **Ctrl+F** trong editor tìm chuỗi:
```
if (!gEl || !window._sbClient) return;
```

Sẽ tìm thấy khoảng dòng **9477** (±10 dòng).

---

## Sửa 1: Xử lý khi _sbClient chưa sẵn sàng

**Tìm đoạn này** (khoảng 3 dòng):
```javascript
  const gEl = document.getElementById('_assetGallery_' + idx)
  if (!gEl || !window._sbClient) return;

  const assetKey = makeAssetKey(r)
```

**Thay bằng:**
```javascript
  const gEl = document.getElementById('_assetGallery_' + idx)
  if (!gEl) return;

  // Nếu _sbClient chưa sẵn sàng, thử lại sau 500ms (tối đa 5 lần)
  if (!window._sbClient) {
    const retryCount = parseInt(gEl.dataset.retryCount || '0', 10);
    if (retryCount < 5) {
      gEl.dataset.retryCount = String(retryCount + 1);
      setTimeout(() => _assetLoadGallery(idx), 500);
    } else {
      gEl.innerHTML = `<div style="font-size:10px;color:#ff9100;text-align:center;padding:8px 0">
        ⚠ Chưa kết nối — thử đóng và mở lại panel
      </div>`;
    }
    return;
  }

  const assetKey = makeAssetKey(r)
```

---

## Sửa 2: Hiển thị lỗi rõ ràng thay vì silent fail

**Tìm đoạn catch ở cuối hàm** (khoảng dòng 9580):
```javascript
  } catch (e) {
    console.error('[_assetLoadGallery]', e);
    gEl.innerHTML = `<div style="font-size:10px;color:#ff5252;text-align:center;padding:8px 0">
      ✗ Lỗi tải dữ liệu: ${e.message}
    </div>`;
  }
```

Đoạn này **đã đúng** — nếu có lỗi sẽ hiện thông báo đỏ.
Vấn đề chính là `return` silent ở trên.

---

## Sửa 3 (Nếu vẫn lỗi): Kiểm tra RLS bảng equipment_attachments

Vào **Supabase → SQL Editor** chạy:

```sql
-- Kiểm tra policy hiện tại
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'equipment_attachments';
```

Kết quả mong đợi: phải có 3 policy (eq_attach_read, eq_attach_insert, eq_attach_update).

Nếu thiếu policy SELECT, chạy lại:
```sql
CREATE POLICY "eq_attach_read" ON public.equipment_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

## Kiểm tra nhanh sau khi sửa

Mở **DevTools (F12) → Console** khi mở panel Lý lịch thiết bị.

Nếu thấy lỗi như:
- `[_assetLoadGallery] permission denied` → RLS chưa đúng
- `[_assetLoadGallery] relation "equipment_attachments" does not exist` → bảng chưa tạo
- `[_assetLoadGallery] TypeError: Cannot read...` → _sbClient null → sửa theo Patch 1

Nếu không thấy log gì cả → vấn đề là silent return, cần sửa theo Patch 1.
