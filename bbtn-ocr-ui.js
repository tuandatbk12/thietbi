// ════════════════════════════════════════════════════════════════
// BBTN OCR UI — Phase 3
// Tích hợp OCR vào module "Báo cáo, theo dõi kết quả thực hiện"
//
// Features:
//   1. Nút "📄 Upload BBTN OCR" trong header module Báo cáo
//   2. Modal popup: upload nhiều file → progress → preview cards với checkbox → confirm save
//   3. Sidebar menu "⚠️ BBTN chưa khớp DB [N]" với badge số đỏ
//   4. Trang chi tiết alerts khi click menu
// ════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ────────────────────────────────────────────────────────────
  // CONSTANTS
  // ────────────────────────────────────────────────────────────
  const SB_URL = (typeof _AUTH_SB_URL !== 'undefined') ? _AUTH_SB_URL : 'https://xqqmfmljwycpehfyknoy.supabase.co';
  const SB_KEY = (typeof _AUTH_SB_KEY !== 'undefined') ? _AUTH_SB_KEY : '';
  const OCR_ENDPOINT = SB_URL + '/functions/v1/bbtn-ocr-extract';

  const FIELD_LABELS = {
    loai_thiet_bi: '🏷️ Loại',
    tram: 'Trạm',
    ten_thiet_bi: '⭐ Tên thiết bị',
    kieu: 'Kiểu/Model',
    so_che_tao: 'Serial',
    hang_san_xuat: 'Hãng SX',
    nuoc_san_xuat: 'Nước SX',
    nam_san_xuat: 'Năm SX',
    dien_ap: 'Điện áp',
    dong_dien: 'Dòng điện',
    ngay_kiem_dinh: '📅 Ngày KĐ',
    dang_kiem_dinh: 'Dạng KĐ',
    vi_tri_lap_dat: 'Vị trí lắp đặt',
  };

  // State: tất cả items đang preview (chưa save)
  let _ocrPreviewItems = []; // [{ item, fileInfo, fileBase64, selected: true }]

  // ────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────
  async function _authToken() {
    try { return await _authGetToken(); }
    catch { return null; }
  }

  async function _authEmail() {
    try {
      const u = await _authCurrentUser();
      return u?.email || '';
    } catch { return ''; }
  }

  function _toast(msg, type = 'info') {
    if (typeof showChangeNotif === 'function') {
      const map = { info: 'info', success: 'ok', warn: 'warn', error: 'err' };
      showChangeNotif(map[type] || 'info', 'BBTN OCR', msg);
    } else {
      console.log(`[BBTN OCR ${type}]`, msg);
    }
  }

  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ────────────────────────────────────────────────────────────
  // MODAL OCR
  // ────────────────────────────────────────────────────────────
  function _bbtnOcrOpenModal() {
    // Check role admin
    const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    if (sess?.role !== 'admin') {
      _toast('Chỉ admin được phép upload BBTN OCR', 'warn');
      return;
    }

    // Reset state
    _ocrPreviewItems = [];

    // Tạo modal nếu chưa có
    let modal = document.getElementById('bbtnOcrModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bbtnOcrModal';
      modal.className = 'bbtn-modal-overlay';
      modal.innerHTML = `
        <div class="bbtn-modal-card">
          <div class="bbtn-modal-header">
            <div class="bbtn-modal-title">
              <i class="fas fa-file-import"></i> OCR Biên bản thí nghiệm
            </div>
            <button class="bbtn-modal-close" onclick="_bbtnOcrCloseModal()">✕</button>
          </div>
          <div class="bbtn-modal-body">
            <div class="bbtn-upload-zone" id="bbtnUploadZone">
              <div class="bbtn-upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
              <div class="bbtn-upload-text">Kéo thả file ảnh/PDF vào đây hoặc</div>
              <button class="bbtn-btn-primary" onclick="document.getElementById('bbtnFileInput').click()">
                <i class="fas fa-folder-open"></i> Chọn tệp...
              </button>
              <div class="bbtn-upload-hint">Hỗ trợ JPG, PNG, PDF — max 22MB/file. Có thể chọn nhiều file.</div>
              <input type="file" id="bbtnFileInput" multiple accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none" onchange="_bbtnOcrFilesChanged(this)" />
            </div>
            <div class="bbtn-progress-wrap" id="bbtnProgressWrap" style="display:none">
              <div class="bbtn-progress-text" id="bbtnProgressText"></div>
              <div class="bbtn-progress-bar"><div class="bbtn-progress-fill" id="bbtnProgressFill"></div></div>
            </div>
            <div class="bbtn-preview-wrap" id="bbtnPreviewWrap"></div>
          </div>
          <div class="bbtn-modal-footer">
            <div class="bbtn-footer-info" id="bbtnFooterInfo"></div>
            <div class="bbtn-footer-actions">
              <button class="bbtn-btn-secondary" onclick="_bbtnOcrCloseModal()">Hủy</button>
              <button class="bbtn-btn-primary" id="bbtnBtnSave" onclick="_bbtnOcrSaveSelected()" disabled>
                <i class="fas fa-save"></i> Lưu thiết bị đã chọn
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Drag-drop
      const zone = modal.querySelector('#bbtnUploadZone');
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        _bbtnOcrProcessFiles(Array.from(e.dataTransfer.files));
      });
    }

    modal.style.display = 'flex';
  }

  function _bbtnOcrCloseModal() {
    const modal = document.getElementById('bbtnOcrModal');
    if (modal) modal.style.display = 'none';
    // Reset state
    _ocrPreviewItems = [];
    const preview = document.getElementById('bbtnPreviewWrap');
    if (preview) preview.innerHTML = '';
    const fileInput = document.getElementById('bbtnFileInput');
    if (fileInput) fileInput.value = '';
    const footerInfo = document.getElementById('bbtnFooterInfo');
    if (footerInfo) footerInfo.textContent = '';
    const btnSave = document.getElementById('bbtnBtnSave');
    if (btnSave) btnSave.disabled = true;
  }

  function _bbtnOcrFilesChanged(input) {
    _bbtnOcrProcessFiles(Array.from(input.files));
  }

  async function _bbtnOcrProcessFiles(files) {
    if (!files.length) return;

    // Validate
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    files = files.filter(f => {
      if (!ALLOWED.includes(f.type)) {
        _toast(`File ${f.name}: định dạng không hỗ trợ`, 'warn');
        return false;
      }
      if (f.size > 22 * 1024 * 1024) {
        _toast(`File ${f.name}: quá lớn (>22MB)`, 'warn');
        return false;
      }
      return true;
    });

    if (!files.length) return;

    // Show progress
    const progressWrap = document.getElementById('bbtnProgressWrap');
    const progressText = document.getElementById('bbtnProgressText');
    const progressFill = document.getElementById('bbtnProgressFill');
    progressWrap.style.display = 'block';

    const token = await _authToken();

    // Process từng file (sequential để Gemini không quá tải)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pct = Math.round((i / files.length) * 100);
      progressText.textContent = `Đang OCR file ${i + 1}/${files.length}: ${file.name}...`;
      progressFill.style.width = pct + '%';

      try {
        const b64 = await _fileToBase64(file);
        const res = await fetch(OCR_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SB_KEY,
            'Authorization': token ? 'Bearer ' + token : '',
          },
          body: JSON.stringify({
            file_base64: b64,
            mime_type: file.type,
            file_name: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          _toast(`OCR file ${file.name} fail: ${data.error || res.status}`, 'error');
          continue;
        }

        const items = data.items || [];
        for (const item of items) {
          _ocrPreviewItems.push({
            item,
            fileInfo: {
              name: file.name,
              size: file.size,
              type: file.type,
            },
            fileBase64: b64,
            selected: true,
          });
        }

        _toast(`✅ ${file.name}: ${items.length} thiết bị`, 'success');
      } catch (err) {
        _toast(`OCR file ${file.name} error: ${err.message}`, 'error');
        console.error(err);
      }
    }

    progressFill.style.width = '100%';
    progressText.textContent = `Hoàn thành: ${_ocrPreviewItems.length} thiết bị từ ${files.length} file`;
    setTimeout(() => { progressWrap.style.display = 'none'; }, 1500);

    _bbtnOcrRenderPreview();
  }

  function _bbtnOcrRenderPreview() {
    const wrap = document.getElementById('bbtnPreviewWrap');
    if (!wrap) return;

    if (!_ocrPreviewItems.length) {
      wrap.innerHTML = '';
      return;
    }

    let html = `<div class="bbtn-preview-title">📋 ${_ocrPreviewItems.length} thiết bị đã OCR — xem lại trước khi lưu:</div>`;

    _ocrPreviewItems.forEach((entry, idx) => {
      const it = entry.item;
      const pageBadge = it.page_start
        ? (it.page_start === it.page_end ? `Trang ${it.page_start}` : `Trang ${it.page_start}-${it.page_end}`)
        : '';
      const fileName = entry.fileInfo.name.length > 30
        ? entry.fileInfo.name.slice(0, 27) + '...'
        : entry.fileInfo.name;

      html += `
        <div class="bbtn-preview-card ${entry.selected ? '' : 'unselected'}" data-idx="${idx}">
          <div class="bbtn-card-header">
            <label class="bbtn-card-check">
              <input type="checkbox" ${entry.selected ? 'checked' : ''} onchange="_bbtnOcrToggleItem(${idx}, this.checked)" />
              <span class="bbtn-card-badge">${_esc(it.loai_thiet_bi || '?')}</span>
              <span class="bbtn-card-name">${_esc(it.ten_thiet_bi || '(chưa đọc được)')}</span>
            </label>
            <div class="bbtn-card-meta">
              ${pageBadge ? `<span class="bbtn-page-badge">📄 ${pageBadge}</span>` : ''}
              <span class="bbtn-file-name" title="${_esc(entry.fileInfo.name)}">${_esc(fileName)}</span>
            </div>
          </div>
          <div class="bbtn-card-body">
            ${Object.entries(FIELD_LABELS).map(([key, label]) => {
              const val = it[key];
              const empty = val === null || val === undefined || val === '';
              return `
                <div class="bbtn-field">
                  <div class="bbtn-field-label">${label}</div>
                  <input class="bbtn-field-input ${empty ? 'empty' : ''}"
                         value="${_esc(empty ? '' : val)}"
                         placeholder="(không đọc được)"
                         onchange="_bbtnOcrEditField(${idx}, '${key}', this.value)" />
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    wrap.innerHTML = html;
    _bbtnOcrUpdateFooter();
  }

  function _bbtnOcrToggleItem(idx, checked) {
    if (_ocrPreviewItems[idx]) {
      _ocrPreviewItems[idx].selected = checked;
      const card = document.querySelector(`.bbtn-preview-card[data-idx="${idx}"]`);
      if (card) card.classList.toggle('unselected', !checked);
      _bbtnOcrUpdateFooter();
    }
  }

  function _bbtnOcrEditField(idx, key, value) {
    if (_ocrPreviewItems[idx]) {
      _ocrPreviewItems[idx].item[key] = value.trim() || null;
    }
  }

  function _bbtnOcrUpdateFooter() {
    const selectedCount = _ocrPreviewItems.filter(e => e.selected).length;
    const info = document.getElementById('bbtnFooterInfo');
    const btn = document.getElementById('bbtnBtnSave');
    if (info) info.textContent = `${selectedCount}/${_ocrPreviewItems.length} thiết bị đã chọn`;
    if (btn) {
      btn.disabled = selectedCount === 0;
      btn.innerHTML = `<i class="fas fa-save"></i> Lưu ${selectedCount} thiết bị đã chọn`;
    }
  }

  // ────────────────────────────────────────────────────────────
  // SAVE TO DB
  // ────────────────────────────────────────────────────────────
  async function _bbtnOcrSaveSelected() {
    const selected = _ocrPreviewItems.filter(e => e.selected);
    if (!selected.length) return;

    const btn = document.getElementById('bbtnBtnSave');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang lưu...`;

    const token = await _authToken();
    const email = await _authEmail();
    if (!token) {
      _toast('Chưa đăng nhập', 'error');
      btn.disabled = false;
      _bbtnOcrUpdateFooter();
      return;
    }

    let savedCount = 0;
    let alertsCount = 0;
    let failCount = 0;

    for (const entry of selected) {
      try {
        const it = entry.item;

        // Step 1: Upload file lên Storage
        let fileUrl = null;
        try {
          const filePath = `${new Date().toISOString().slice(0,10)}/${Date.now()}_${entry.fileInfo.name}`;
          const blob = await (await fetch('data:' + entry.fileInfo.type + ';base64,' + entry.fileBase64)).blob();
          const upRes = await fetch(`${SB_URL}/storage/v1/object/bbtn-files/${encodeURIComponent(filePath)}`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'apikey': SB_KEY,
              'Content-Type': entry.fileInfo.type,
              'x-upsert': 'true',
            },
            body: blob,
          });
          if (upRes.ok) {
            fileUrl = `${SB_URL}/storage/v1/object/bbtn-files/${filePath}`;
          } else {
            console.warn('Upload file fail, vẫn lưu record:', await upRes.text());
            fileUrl = 'pending://' + entry.fileInfo.name;
          }
        } catch (uErr) {
          console.warn('Upload err:', uErr);
          fileUrl = 'pending://' + entry.fileInfo.name;
        }

        // Step 2: Insert vào bbtn_records
        const insertBody = {
          file_url: fileUrl,
          file_name: entry.fileInfo.name,
          file_size: entry.fileInfo.size,
          file_type: entry.fileInfo.type,
          loai_thiet_bi: it.loai_thiet_bi,
          tram: it.tram,
          ten_thiet_bi: it.ten_thiet_bi,
          kieu: it.kieu,
          so_che_tao: it.so_che_tao,
          hang_san_xuat: it.hang_san_xuat,
          nuoc_san_xuat: it.nuoc_san_xuat,
          nam_san_xuat: it.nam_san_xuat,
          dien_ap: it.dien_ap,
          dong_dien: it.dong_dien,
          ngay_kiem_dinh: it.ngay_kiem_dinh,
          dang_kiem_dinh: it.dang_kiem_dinh,
          vi_tri_lap_dat: it.vi_tri_lap_dat,
          ocr_raw: { page_start: it.page_start, page_end: it.page_end },
          ocr_provider: 'gemini',
          match_status: 'pending',
          created_email: email,
        };

        const insRes = await fetch(`${SB_URL}/rest/v1/bbtn_records`, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(insertBody),
        });

        if (!insRes.ok) {
          const errText = await insRes.text();
          console.error('Insert fail:', errText);
          failCount++;
          continue;
        }

        const insData = await insRes.json();
        const recordId = Array.isArray(insData) ? insData[0]?.id : insData?.id;

        // Step 3: Call check_bbtn_match
        if (recordId) {
          const matchRes = await fetch(`${SB_URL}/rest/v1/rpc/check_bbtn_match`, {
            method: 'POST',
            headers: {
              'apikey': SB_KEY,
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_bbtn_id: recordId }),
          });
          if (matchRes.ok) {
            const matchResult = await matchRes.text();
            const clean = matchResult.replace(/^"|"$/g, '');
            if (clean === 'not_in_db' || clean === 'manual_review') {
              alertsCount++;
            }
          }
        }

        savedCount++;
      } catch (err) {
        console.error(err);
        failCount++;
      }
    }

    // Final toast
    let msg = `Đã lưu ${savedCount} thiết bị`;
    if (alertsCount > 0) msg += `, ${alertsCount} cảnh báo mới`;
    if (failCount > 0) msg += `, ${failCount} lỗi`;
    _toast(msg, savedCount > 0 ? 'success' : 'warn');

    // Update sidebar badge
    _bbtnAlertsBadgeUpdate();

    // Close modal
    setTimeout(_bbtnOcrCloseModal, 500);
  }

  // ────────────────────────────────────────────────────────────
  // SIDEBAR BADGE
  // ────────────────────────────────────────────────────────────
  async function _bbtnAlertsBadgeUpdate() {
    const token = await _authToken();
    if (!token) return;

    try {
      const res = await fetch(`${SB_URL}/rest/v1/bbtn_alerts?resolved=eq.false&select=id`, {
        method: 'GET',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
          'Prefer': 'count=exact',
        },
      });
      if (!res.ok) return;

      // Đếm từ content-range header hoặc array length
      const contentRange = res.headers.get('content-range') || '';
      let count = 0;
      const m = contentRange.match(/\/(\d+)$/);
      if (m) count = parseInt(m[1]);
      else {
        const data = await res.json();
        count = Array.isArray(data) ? data.length : 0;
      }

      const badge = document.getElementById('bbtnAlertsBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('Badge update fail:', err);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TRANG BBTN ALERTS
  // ────────────────────────────────────────────────────────────
  async function _bbtnAlertsRenderPage() {
    const ov = document.getElementById('tbPageOverlay');
    if (!ov) return;
    ov.style.display = 'block';
    ov.innerHTML = `
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0;color:var(--text-primary);font-size:18px"><i class="fas fa-exclamation-triangle" style="color:#ff9800"></i> BBTN chưa khớp DB</h2>
          <div style="display:flex;gap:8px">
            <button onclick="_bbtnAlertsRenderPage()" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;cursor:pointer">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button onclick="navActivate(document.querySelector('.nav-item'))" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;cursor:pointer">
              <i class="fas fa-arrow-left"></i> Dashboard
            </button>
          </div>
        </div>
        <div id="bbtnAlertsLoading" style="padding:40px;text-align:center;color:rgba(180,200,220,.6)">
          <i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang tải...
        </div>
        <div id="bbtnAlertsList"></div>
      </div>
    `;

    const token = await _authToken();
    if (!token) {
      document.getElementById('bbtnAlertsLoading').textContent = 'Chưa đăng nhập';
      return;
    }

    try {
      const res = await fetch(`${SB_URL}/rest/v1/bbtn_unresolved_alerts?select=*&order=alert_created_at.desc`, {
        method: 'GET',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
        },
      });
      const data = await res.json();
      document.getElementById('bbtnAlertsLoading').style.display = 'none';

      const list = document.getElementById('bbtnAlertsList');
      if (!Array.isArray(data) || !data.length) {
        list.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(180,200,220,.6)">
          <i class="fas fa-check-circle" style="color:#00e676;font-size:48px"></i>
          <div style="margin-top:12px;font-size:14px">Không có cảnh báo nào!</div>
          <div style="font-size:11px;margin-top:4px;color:rgba(180,200,220,.4)">Mọi BBTN đều khớp với DB</div>
        </div>`;
        return;
      }

      let html = `<div style="font-size:12px;color:rgba(180,200,220,.7);margin-bottom:12px">${data.length} cảnh báo chưa xử lý</div>`;
      data.forEach(a => {
        const dateStr = a.ngay_kiem_dinh
          ? new Date(a.ngay_kiem_dinh).toLocaleDateString('vi-VN')
          : '';
        html += `
          <div class="bbtn-alert-row" style="background:rgba(255,152,0,.08);border:1px solid rgba(255,152,0,.25);border-radius:8px;padding:12px 16px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:#ffc107">
                  <span style="background:#00c8ff;color:#000;padding:2px 8px;border-radius:4px;font-size:10px;margin-right:6px">${_esc(a.loai_thiet_bi || '?')}</span>
                  ${_esc(a.ten_thiet_bi || '?')} • ${_esc(a.tram || '?')} • ${dateStr}
                </div>
                <div style="font-size:11px;color:rgba(180,200,220,.7);margin-top:4px">${_esc(a.message || '')}</div>
                <div style="font-size:10px;color:rgba(180,200,220,.5);margin-top:4px">
                  File: ${_esc(a.file_name || '?')} • Upload: ${_esc(a.created_email || '?')}
                </div>
              </div>
              <button onclick="_bbtnAlertResolve(${a.alert_id})" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(0,230,118,.4);background:rgba(0,230,118,.1);color:#00e676;font-size:11px;font-weight:700;cursor:pointer">
                <i class="fas fa-check"></i> Xử lý
              </button>
            </div>
          </div>
        `;
      });
      list.innerHTML = html;
    } catch (err) {
      document.getElementById('bbtnAlertsLoading').textContent = 'Lỗi: ' + err.message;
    }
  }

  async function _bbtnAlertResolve(alertId) {
    const token = await _authToken();
    if (!token) return;
    try {
      const res = await fetch(`${SB_URL}/rest/v1/bbtn_alerts?id=eq.${alertId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved: true, resolved_at: new Date().toISOString() }),
      });
      if (res.ok) {
        _toast('Đã đánh dấu xử lý', 'success');
        _bbtnAlertsRenderPage();
        _bbtnAlertsBadgeUpdate();
      } else {
        _toast('Lỗi: ' + res.status, 'error');
      }
    } catch (err) {
      _toast('Error: ' + err.message, 'error');
    }
  }

  // ────────────────────────────────────────────────────────────
  // INJECT BUTTON vào module Báo cáo
  // ────────────────────────────────────────────────────────────
  function _bbtnInjectUploadButton() {
    // Hook vào _tndkRender — sau khi nó render xong, ta inject thêm nút
    const tryInject = () => {
      const overlay = document.getElementById('tbPageOverlay');
      if (!overlay) return false;

      // Tìm container chứa nút "Dashboard" (back btn) — chèn nút Upload trước nó
      const backBtn = overlay.querySelector('button[onclick*="navActivate"]');
      if (!backBtn) return false;

      // Tránh inject 2 lần
      if (overlay.querySelector('#bbtnUploadOcrBtn')) return true;

      // Check role admin
      const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
      if (sess?.role !== 'admin') return true;

      const btn = document.createElement('button');
      btn.id = 'bbtnUploadOcrBtn';
      btn.onclick = _bbtnOcrOpenModal;
      btn.style.cssText = 'padding:6px 14px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:linear-gradient(135deg,rgba(0,200,255,.15),rgba(0,136,255,.15));color:#00c8ff;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-right:8px';
      btn.innerHTML = '<i class="fas fa-file-import"></i> Upload BBTN OCR';

      backBtn.parentNode.insertBefore(btn, backBtn);
      return true;
    };

    // Inject ngay nếu module Báo cáo đang mở
    if (!tryInject()) {
      // Hoặc đợi user mở module — hook navActivate
      const origRender = window._tndkRenderPage;
      if (typeof origRender === 'function' && !origRender._bbtnHooked) {
        window._tndkRenderPage = async function() {
          const result = await origRender.apply(this, arguments);
          setTimeout(tryInject, 100);
          return result;
        };
        window._tndkRenderPage._bbtnHooked = true;
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // INJECT MENU "BBTN chưa khớp DB" vào sidebar
  // ────────────────────────────────────────────────────────────
  function _bbtnInjectSidebarMenu() {
    // Tìm menu "Báo cáo, theo dõi kết quả thực hiện"
    const baoCaoMenu = Array.from(document.querySelectorAll('.nav-item')).find(el => {
      const text = (el.querySelector('span')?.textContent || '').trim();
      return text === 'Báo cáo, theo dõi kết quả thực hiện';
    });

    if (!baoCaoMenu) {
      setTimeout(_bbtnInjectSidebarMenu, 500);
      return;
    }

    // Tránh inject 2 lần
    if (document.getElementById('bbtnAlertsMenu')) return;

    const newMenu = document.createElement('a');
    newMenu.id = 'bbtnAlertsMenu';
    newMenu.href = '#';
    newMenu.className = 'nav-item nav-user-allowed';
    newMenu.onclick = function() { navActivate(this); return false; };
    newMenu.innerHTML = `
      <i class="fas fa-exclamation-triangle" style="color:#ff9800"></i>
      <span>BBTN chưa khớp DB</span>
      <span id="bbtnAlertsBadge" class="bbtn-sidebar-badge" style="display:none">0</span>
    `;

    // Chèn ngay sau menu "Báo cáo, theo dõi"
    baoCaoMenu.parentNode.insertBefore(newMenu, baoCaoMenu.nextSibling);

    // Register handler vào _navExtMapBBTN
    if (typeof window._navExtMapBBTN !== 'undefined') {
      window._navExtMapBBTN['BBTN chưa khớp DB'] = _bbtnAlertsRenderPage;
    }

    // Update badge ngay
    setTimeout(_bbtnAlertsBadgeUpdate, 1000);
    // Auto refresh badge mỗi 60s
    setInterval(_bbtnAlertsBadgeUpdate, 60000);
  }

  // ────────────────────────────────────────────────────────────
  // EXPORT functions
  // ────────────────────────────────────────────────────────────
  window._bbtnOcrOpenModal = _bbtnOcrOpenModal;
  window._bbtnOcrCloseModal = _bbtnOcrCloseModal;
  window._bbtnOcrFilesChanged = _bbtnOcrFilesChanged;
  window._bbtnOcrToggleItem = _bbtnOcrToggleItem;
  window._bbtnOcrEditField = _bbtnOcrEditField;
  window._bbtnOcrSaveSelected = _bbtnOcrSaveSelected;
  window._bbtnAlertsRenderPage = _bbtnAlertsRenderPage;
  window._bbtnAlertResolve = _bbtnAlertResolve;
  window._bbtnAlertsBadgeUpdate = _bbtnAlertsBadgeUpdate;

  // ────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────
  function _init() {
    _bbtnInjectUploadButton();
    _bbtnInjectSidebarMenu();
    console.log('[BBTN OCR UI] Phase 3 loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 500);
  }
})();
