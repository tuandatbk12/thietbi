# 📚 PLAYBOOK — Làm Dự Án Mới Tương Tự (đúc kết từ EVN Dashboard)

> Mục đích: không lặp lại sai lầm + dùng lại "công thức" đã chạy tốt.
> Đúc kết qua 106 phiên bản dự án EVN BBTN OCR.

═══════════════════════════════════════════════════════════
## A. KIẾN TRÚC ĐÃ CHẠY TỐT (tái sử dụng)
═══════════════════════════════════════════════════════════

Stack: Vercel (frontend tĩnh) + Supabase (DB/Auth/Edge Function) + NAS qua Cloudflare Tunnel + Gemini OCR.

Vì sao chạy tốt:
- Vercel auto-deploy từ GitHub push, không cần CI phức tạp
- Supabase free tier đủ cho dashboard nội bộ (lưu ý giới hạn bên dưới)
- Cloudflare Tunnel + localhost service URL, NAS đổi IP không sập
- Gemini đọc PDF ra JSON cấu trúc, không cần viết parser thủ công

═══════════════════════════════════════════════════════════
## B. CÁC GIỚI HẠN PHẢI BIẾT TRƯỚC (tránh vỡ trận)
═══════════════════════════════════════════════════════════

### Supabase Edge Function (free tier)
- 60s wall-clock timeout, vượt là shutdown -> client nhận HTTP 546/502
- RAM ~256MB, encode base64 file lớn (x1.33) + giữ nhiều copy = OOM
- Bài học: retry/backoff PHẢI ngắn (tổng dưới ~50s). Upload bytes thẳng, không base64 cho file lớn.

### Gemini free tier
- 15 requests/phút (RPM) + 1,500 requests/NGÀY (RPD) MỖI MODEL
- 429 = hết quota (đợi reset ~14-15h VN, hoặc billing)
- 503 = model overload tạm thời
- Bài học: dùng NHIỀU model fallback (quota riêng mỗi model = nhân quota). Throttle 4s/file cho RPM.

### Browser
- Chrome chặn confirm()/alert() native khi tab inactive -> trả false
- Bài học: dùng modal HTML tự tạo (Promise-based) thay confirm() trong luồng tự động.
- localStorage mất nếu xóa site data; còn nếu chỉ xóa cache + unregister SW.

### File lớn
- Load file lớn vào RAM browser -> crash tab
- Bài học: stream qua server (Edge Function tự fetch), browser chỉ gửi đường dẫn.

═══════════════════════════════════════════════════════════
## C. QUY TRÌNH SỬA CODE AN TOÀN (rất quan trọng)
═══════════════════════════════════════════════════════════

### 1. LUÔN backup trước khi sửa: cp app.js app.js.before-vNN.bak

### 2. Sửa file lớn qua PATCH SCRIPT Python, KHÔNG paste tay
Heredoc dài + Unicode trên Git Bash dễ crash. Mẫu patch script:
- Mở file đọc nội dung (encoding utf-8)
- old = đoạn cũ (unique), new = đoạn mới
- n = c.count(old); in ra n
- AN TOÀN: if n != 1 -> sys.exit(1) KHÔNG ghi file
- c = c.replace(old, new); ghi lại file
- chạy: python3 /tmp/vNN_patch.py

LƯU Ý BẪY: nếu nội dung patch chứa chính delimiter heredoc (vd PYSCRIPT_END)
thì heredoc vỡ. Dùng delimiter độc nhất không trùng nội dung.

### 3. Quy tắc patch
- LINE-BASED an toàn hơn string match (~95% vs ~75%) khi có dòng trống/CRLF/Unicode
- Luôn in match count, if n != 1 thì dừng KHÔNG ghi file
- Patch bắt buộc (n==1) vs tùy chọn (cảnh báo nếu lệch)
- Dùng cat -A để thấy CRLF (^M) / trailing space khi pattern fail

### 4. Verify sau patch: node --check app.js + grep -c marker để chắc patch vào

### 5. Hard reset cache khi test (KHÔNG xóa localStorage):
- unregister tất cả service worker
- xóa tất cả caches
- location.reload(true)
(Đoạn JS cụ thể xem trong HUONG_DAN_CAI_LAI.md hoặc CONTEXT.md)

═══════════════════════════════════════════════════════════
## D. BÀI HỌC JAVASCRIPT (đã vấp phải)
═══════════════════════════════════════════════════════════

1. const X / let X ở top-level KHÔNG tạo window.X (chỉ var mới tạo).
   - Code cùng scope dùng X trực tiếp; code khác scope phải gán window explicit.
   - Triệu chứng: widget check window.X mãi undefined dù X có giá trị.

2. API trả field không đảm bảo kiểu, luôn guard typeof trước .slice/.replace:
   let text = data?.x?.y?.text; if (typeof text !== "string") text = text==null ? "" : String(text);

3. Nút inject phải bám element ĐANG HIỂN THỊ (getBoundingClientRect width>0),
   không chỉ tồn tại DOM. Khi có nhiều bản nút trùng -> inject động theo visible.

4. Phân biệt lỗi từ ĐÂU: luôn xem SERVER log (không chỉ browser console).
   - 502 ở client có thể do Edge Function shutdown (timeout), không phải lỗi code.
   - 429 vs 503 vs 502 = nguyên nhân + cách xử lý hoàn toàn khác nhau.

5. Khi nhiều version chồng nhau (V57/V60/V68...) -> bản ACTIVE là bản load SAU CÙNG
   (override). Tìm đúng bản active trước khi sửa.

═══════════════════════════════════════════════════════════
## E. CHECKLIST KHỞI TẠO DỰ ÁN MỚI
═══════════════════════════════════════════════════════════

[ ] Tạo Supabase project, lấy URL + anon key
[ ] Thiết kế schema + CHECK constraint (chuẩn hóa data OCR TRƯỚC insert!)
[ ] Tạo repo GitHub + link Vercel auto-deploy
[ ] Nếu cần file lớn: NAS + Cloudflare Tunnel (service = localhost:port)
[ ] Edge Function OCR: stream từ NAS + fallback nhiều Gemini model + retry NGẮN (dưới 50s)
[ ] Frontend: modal confirm HTML (không dùng confirm() native)
[ ] Pre-commit hook: node --check + auto bump cache version
[ ] Cơ chế theo dõi + retry item lỗi (localStorage)
[ ] Auto-backup DB (GitHub Actions cron) + setup Secrets
[ ] File CONTEXT.md cập nhật mỗi mốc + tạo bundle định kỳ

═══════════════════════════════════════════════════════════
## F. CÔNG THỨC GIẢI QUYẾT OCR HÀNG LOẠT (đã chứng minh)
═══════════════════════════════════════════════════════════

1. Stream file qua Edge Function (browser chỉ gửi path), tránh crash
2. File >10MB: upload bytes thẳng Gemini File API, tránh OOM
3. Fallback nhiều model, tránh 429/503, nhân quota miễn phí
4. Retry NGẮN trong Edge Function (2 lần/model, backoff 2-3s), tránh shutdown 60s
5. Throttle 4s/file phía client, tránh đụng RPM 15/phút
6. Modal confirm HTML, bulk không bị Chrome chặn
7. localStorage lưu file lỗi + nút retry, tự sửa lỗi sót
8. Normalize data theo CHECK constraint trước insert, tránh lỗi 23514

Đây là kết tinh của 106 phiên bản. Bắt đầu dự án mới từ đây, không từ số 0.
