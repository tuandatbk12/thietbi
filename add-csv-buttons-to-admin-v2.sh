#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# add-csv-buttons-to-admin-v2.sh
# 
# v2: normalize line endings (CRLF↔LF) trước khi match pattern
# ════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f app.js ]]; then
  echo "❌ Không tìm thấy app.js"
  exit 1
fi

# Restore từ backup nếu có
if [[ -f app.js.before-csv-buttons.bak ]]; then
  echo "↩️  Restore từ backup trước..."
  cp app.js.before-csv-buttons.bak app.js
fi

cp app.js app.js.before-csv-buttons.bak
echo "✓ Backup → app.js.before-csv-buttons.bak"

cat > /tmp/_inject_csv_btns_v2.js <<'NODEEOF'
const fs = require('fs');

// Read raw → normalize CRLF → LF
let src = fs.readFileSync('app.js', 'utf-8');
const originalLen = src.length;
const hadCRLF = src.includes('\r\n');
src = src.replace(/\r\n/g, '\n');
console.log(`  Line endings: ${hadCRLF ? 'CRLF (normalized to LF)' : 'LF (already)'}`);
console.log(`  Original length: ${originalLen}, normalized length: ${src.length}`);

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
  console.error("❌ Không tìm thấy pattern.");
  console.error("");
  console.error("Hint diagnostic — chạy lệnh sau để xem context:");
  console.error("  grep -n '_adminAddUser()' app.js");
  console.error("  grep -n 'Them tai khoan' app.js");
  process.exit(1);
}

src = src.replace(OLD, NEW);
fs.writeFileSync('app.js', src, 'utf-8');
console.log("✓ Đã inject 2 nút CSV upload");
NODEEOF

node /tmp/_inject_csv_btns_v2.js
RC=$?
rm -f /tmp/_inject_csv_btns_v2.js

if [[ $RC -ne 0 ]]; then
  echo "❌ Inject fail — restore"
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi

if node --check app.js; then
  echo "✓ Syntax check PASS"
else
  echo "❌ Syntax FAIL — restore"
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi

c1=$(grep -c "_openCsvUpload('TongHopThietBi')" app.js || true)
c2=$(grep -c "_openCsvUpload('CongTacThiNghiem')" app.js || true)
c3=$(grep -c "CSV Thiết bị" app.js || true)

echo ""
echo "── Verify ──"
echo "  _openCsvUpload('TongHopThietBi'):    $c1 (cần ≥1)"
echo "  _openCsvUpload('CongTacThiNghiem'):  $c2 (cần ≥1)"
echo "  'CSV Thiết bị':                       $c3 (cần ≥1)"

if [[ $c1 -ge 1 && $c2 -ge 1 && $c3 -ge 1 ]]; then
  echo ""
  echo "🎉 ÁP DỤNG THÀNH CÔNG"
  echo ""
  echo "Bước tiếp:"
  echo "  1. Bump SW (v12)"
  echo "  2. Commit + push"
  echo "  3. Reload + clear SW → admin panel có 3 nút"
else
  cp app.js.before-csv-buttons.bak app.js
  exit 1
fi
