#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# add-csv-buttons-to-admin.sh
#
# Thêm 2 nút Upload CSV vào admin panel users (cạnh nút "Them tai khoan").
# Click → mở modal Upload CSV (đã có sẵn từ patch trước).
# ════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f app.js ]]; then
  echo "❌ Không tìm thấy app.js"
  exit 1
fi

# Restore từ backup nếu trước fail
if [[ -f app.js.before-csv-buttons.bak ]]; then
  echo "↩️  Restore từ backup trước..."
  cp app.js.before-csv-buttons.bak app.js
fi

cp app.js app.js.before-csv-buttons.bak
echo "✓ Backup → app.js.before-csv-buttons.bak"

# Dùng Node để inject 2 nút mới TRƯỚC nút "Them tai khoan"
cat > /tmp/_inject_csv_btns.js <<'NODEEOF'
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf-8');

// Pattern: tìm vị trí ngay TRƯỚC nút "Them tai khoan" trong admin users panel
const OLD = `<span style="font-size:12px;font-weight:700;color:var(--text-primary)">\${(profiles||[]).length} tai khoan</span>
        <button onclick="_adminAddUser()" style="padding:6px 14px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:rgba(0,200,255,.08);color:var(--accent);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <i class="fas fa-user-plus"></i> Them tai khoan
        </button></div>`;

const NEW = `<span style="font-size:12px;font-weight:700;color:var(--text-primary)">\${(profiles||[]).length} tai khoan</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button onclick="_openCsvUpload('TongHopThietBi')" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(0,230,118,.4);background:rgba(0,230,118,.08);color:#00e676;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px" title="Upload CSV thay thế dữ liệu Thiết bị">
            <i class="fas fa-file-csv"></i> CSV Thiết bị
          </button>
          <button onclick="_openCsvUpload('CongTacThiNghiem')" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(255,215,64,.4);background:rgba(255,215,64,.08);color:#ffd740;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px" title="Upload CSV thay thế dữ liệu Công tác TN">
            <i class="fas fa-file-csv"></i> CSV TN
          </button>
          <button onclick="_adminAddUser()" style="padding:6px 14px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:rgba(0,200,255,.08);color:var(--accent);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <i class="fas fa-user-plus"></i> Them tai khoan
          </button>
        </div></div>`;

if (!src.includes(OLD)) {
  // Có thể đã apply rồi
  if (src.includes("_openCsvUpload('TongHopThietBi')") && src.includes("CSV Thiết bị")) {
    console.log("⚠️  CSV buttons đã apply từ trước. Skip.");
    process.exit(0);
  }
  console.error("❌ Không tìm thấy pattern admin panel cũ.");
  console.error("Hint: tìm string 'tai khoan</span>' + '_adminAddUser()' trong app.js");
  process.exit(1);
}

src = src.replace(OLD, NEW);
fs.writeFileSync('app.js', src, 'utf-8');
console.log("✓ Đã inject 2 nút CSV upload vào admin panel");
NODEEOF

node /tmp/_inject_csv_btns.js
RC=$?
rm -f /tmp/_inject_csv_btns.js

if [[ $RC -ne 0 ]]; then
  echo "❌ Inject fail — restore"
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi

# Syntax check
if node --check app.js; then
  echo "✓ Syntax check PASS"
else
  echo "❌ Syntax FAIL — restore"
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi

# Verify
c1=$(grep -c "_openCsvUpload('TongHopThietBi')" app.js || true)
c2=$(grep -c "_openCsvUpload('CongTacThiNghiem')" app.js || true)
c3=$(grep -c "CSV Thiết bị" app.js || true)

echo ""
echo "── Verify ──"
echo "  _openCsvUpload('TongHopThietBi'):    $c1 (cần ≥2 — định nghĩa + button)"
echo "  _openCsvUpload('CongTacThiNghiem'):  $c2 (cần ≥1)"
echo "  'CSV Thiết bị':                       $c3 (cần ≥1)"

if [[ $c1 -ge 1 && $c2 -ge 1 && $c3 -ge 1 ]]; then
  echo ""
  echo "🎉 ÁP DỤNG THÀNH CÔNG"
  echo ""
  echo "Bước tiếp:"
  echo "  1. Bump SW: sed -i \"s/CACHE_VERSION = 'evn-v[0-9]*-[a-z-]*'/CACHE_VERSION = 'evn-v12-csv-buttons'/g\" sw.js"
  echo "  2. Commit + push"
  echo "  3. Reload → vào admin panel → thấy 2 nút mới"
else
  echo "⚠️  Verify FAIL — restore"
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi
