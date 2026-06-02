// ════════════════════════════════════════════════════════════════
// Patch: Fix Công tác TNĐK + Đổi tên → Báo cáo, theo dõi kết quả
//
// Appended vào CUỐI app.js bởi fix-congtactndk-nav-v1.sh
//
// Xử lý:
//   1. FIX BUG: click "Công tác TNĐK" → hiện đúng section thay vì BBTN
//   2. ĐỔI TÊN: "Công tác TNĐK" → "Báo cáo, theo dõi kết quả thực hiện"
//   3. SECTION MỚI: render danh sách, add/edit/delete, upload ảnh BB
// ════════════════════════════════════════════════════════════════

(() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // CONSTANTS — dùng globals từ app.js chính
  // ──────────────────────────────────────────────────────────────
  const SB_URL  = (typeof _AUTH_SB_URL  !== 'undefined') ? _AUTH_SB_URL  : 'https://xqqmfmljwycpehfyknoy.supabase.co';
  const SB_KEY  = (typeof _AUTH_SB_KEY  !== 'undefined') ? _AUTH_SB_KEY  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';
  const TABLE   = 'CongTacTNDK';
  const BUCKET  = 'congtactndk-photos';
  const SECTION_KEY   = 'baocao-ketqua';    // ID nhận dạng section này
  const LABEL_OLD_RE  = /Công\s*tác\s*TNĐK/gi;
  const LABEL_NEW     = 'Báo cáo, theo dõi kết quả thực hiện';
  const LABEL_SHORT   = 'Báo cáo kết quả';  // dùng trong badge/tiêu đề ngắn

  // ──────────────────────────────────────────────────────────────
  // AUTH HELPERS — reuse từ app.js
  // ──────────────────────────────────────────────────────────────
  async function getToken() {
    if (typeof _authGetToken === 'function') return await _authGetToken();
    // Fallback: lấy từ localStorage Supabase
    try {
      const key = Object.keys(localStorage).find(k => k.includes('auth-token') || k.includes('supabase.auth'));
      if (key) {
        const parsed = JSON.parse(localStorage.getItem(key));
        return parsed?.access_token || parsed?.currentSession?.access_token || null;
      }
    } catch (_) { /* */ }
    return null;
  }

  async function getCurrentUserEmail() {
    try {
      if (typeof _authGetCurrentUser === 'function') {
        const u = await _authGetCurrentUser();
        return u?.email || '';
      }
      const token = await getToken();
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.email || '';
    } catch (_) { return ''; }
  }

  // ──────────────────────────────────────────────────────────────
  // API HELPERS
  // ──────────────────────────────────────────────────────────────
  async function sbFetch(path, opts = {}) {
    const token = await getToken();
    const headers = {
      'apikey': SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(SB_URL + '/rest/v1/' + path, { ...opts, headers });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    if (!res.ok) throw new Error((data?.message || data?.error || text || 'HTTP ' + res.status));
    return data;
  }

  async function loadRecords({ month, tram } = {}) {
    let q = TABLE + '?select=*&order=ngay_tn.desc,id.desc';
    if (month) {
      // month = "2026-05" → filter ngay_tn >= 2026-05-01 AND < 2026-06-01
      const [y, m] = month.split('-').map(Number);
      const from = `${y}-${String(m).padStart(2,'0')}-01`;
      const toM  = m === 12 ? 1 : m + 1;
      const toY  = m === 12 ? y + 1 : y;
      const to   = `${toY}-${String(toM).padStart(2,'0')}-01`;
      q += '&ngay_tn=gte.' + from + '&ngay_tn=lt.' + to;
    }
    if (tram && tram !== '__all__') q += '&tram=eq.' + encodeURIComponent(tram);
    return await sbFetch(q, { headers: { 'Range': '0-999' } });
  }

  async function loadTramsFromTHietBi() {
    try {
      const rows = await sbFetch('TongHopThietBi?select=Tram&order=Tram.asc', {
        headers: { 'Range': '0-1000' }
      });
      const unique = [...new Set((rows || []).map(r => r.Tram).filter(Boolean))].sort();
      return unique;
    } catch (_) { return []; }
  }

  async function insertRecord(rec) {
    return await sbFetch(TABLE, {
      method: 'POST',
      body: JSON.stringify(rec),
    });
  }

  async function updateRecord(id, rec) {
    return await sbFetch(TABLE + '?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify(rec),
    });
  }

  async function deleteRecord(id) {
    await sbFetch(TABLE + '?id=eq.' + id, { method: 'DELETE' });
  }

  // ──────────────────────────────────────────────────────────────
  // STORAGE — upload ảnh BB vào Supabase Storage
  // ──────────────────────────────────────────────────────────────
  async function uploadPhoto(file) {
    const token = await getToken();
    const ext   = file.name.split('.').pop().toLowerCase() || 'jpg';
    const fname = Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.' + ext;
    const path  = fname;

    const res = await fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': SB_KEY,
        'Content-Type': file.type || 'image/jpeg',
        'x-upsert': 'false',
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || err.message || 'Upload ảnh thất bại');
    }
    const publicUrl = SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
    return { url: publicUrl, name: file.name, path };
  }

  async function deletePhoto(path) {
    try {
      const token = await getToken();
      await fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token, 'apikey': SB_KEY },
      });
    } catch (_) { /* best effort */ }
  }

  // ──────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────
  let _state = {
    records: [],
    trams: [],
    filterMonth: '',
    filterTram: '__all__',
    pendingPhotos: [],  // {file, dataUrl} chưa upload
    editId: null,       // null = thêm mới, số = đang sửa
    editPhotos: [],     // {url, name, path?, isNew?, file?} trong modal
    loading: false,
  };

  function _thisMonthStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // ──────────────────────────────────────────────────────────────
  // FORMATTERS
  // ──────────────────────────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function isoToInput(iso) {
    if (!iso) return '';
    return iso.slice(0, 10);  // YYYY-MM-DD
  }
  function monthLabel(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    return `${m}/${y}`;
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN SECTION HTML
  // ──────────────────────────────────────────────────────────────
  function buildSectionHTML() {
    const now = _state.filterMonth || _thisMonthStr();
    const records = _state.records;
    const trams   = _state.trams;

    // Stats
    const totalRec  = records.length;
    const uniqueTrams = [...new Set(records.map(r => r.tram).filter(Boolean))].length;
    const uniqueUsers = [...new Set(records.map(r => r.nguoi_th).filter(Boolean))].length;
    const totalPhotos = records.reduce((s, r) => s + ((r.photos || []).length), 0);

    // Month options (current ± 12 tháng)
    const monthOpts = [];
    for (let i = -2; i <= 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      monthOpts.push(`<option value="${val}" ${val === now ? 'selected' : ''}>${monthLabel(val)}</option>`);
    }

    // Tram options
    const tramOpts = trams.map(t =>
      `<option value="${esc(t)}" ${_state.filterTram === t ? 'selected' : ''}>${esc(t)}</option>`
    ).join('');

    // Record cards
    const cards = records.length === 0
      ? `<div style="text-align:center;padding:48px 24px;color:var(--text-secondary,#888);font-size:13px">
           <div style="font-size:36px;margin-bottom:12px">📋</div>
           <div>Không có dữ liệu cho bộ lọc này</div>
         </div>`
      : records.map(r => buildCard(r)).join('');

    return `
<div id="_bc_section" style="padding:0">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;
              padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">📋</span>
      <span style="font-size:15px;font-weight:800;color:var(--text-primary,#eef)">${LABEL_NEW}</span>
    </div>
    <button id="_bc_addBtn" onclick="_bcOpenModal(null)"
      style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;
             border:1px solid rgba(0,200,255,.4);background:rgba(0,200,255,.1);
             color:var(--accent,#00c8ff);font-size:12px;font-weight:700;cursor:pointer">
      <i class="fas fa-plus"></i> Thêm công tác mới
    </button>
  </div>

  <!-- Filters -->
  <div style="display:flex;flex-wrap:wrap;gap:10px;padding:12px 20px;
              background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.06)">
    <div style="display:flex;align-items:center;gap:7px">
      <label style="font-size:11px;color:var(--text-secondary,#9ab);font-weight:600">Tháng</label>
      <select id="_bc_filterMonth" onchange="_bcChangeFilter()"
        style="padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.15);
               background:rgba(255,255,255,.06);color:var(--text-primary,#eef);font-size:12px">
        ${monthOpts.join('')}
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:7px">
      <label style="font-size:11px;color:var(--text-secondary,#9ab);font-weight:600">Trạm</label>
      <select id="_bc_filterTram" onchange="_bcChangeFilter()"
        style="padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.15);
               background:rgba(255,255,255,.06);color:var(--text-primary,#eef);font-size:12px;max-width:180px">
        <option value="__all__">Tất cả</option>
        ${tramOpts}
      </select>
    </div>
  </div>

  <!-- Stats bar -->
  <div style="display:flex;flex-wrap:wrap;gap:0;border-bottom:1px solid rgba(255,255,255,.06)">
    ${statChip('📄', totalRec, 'bản ghi')}
    ${statChip('🏢', uniqueTrams, 'trạm')}
    ${statChip('👤', uniqueUsers, 'người TH')}
    ${statChip('🖼', totalPhotos, 'ảnh BB')}
  </div>

  <!-- Cards -->
  <div id="_bc_cards" style="padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    ${cards}
  </div>

</div>`;
  }

  function statChip(icon, count, label) {
    return `<div style="padding:10px 18px;font-size:12px;color:var(--text-secondary,#9ab);
                        border-right:1px solid rgba(255,255,255,.06)">
      ${icon} <strong style="color:var(--text-primary,#eef)">${count}</strong> ${label}
    </div>`;
  }

  function buildCard(r) {
    const photos = r.photos || [];
    const thumbs = photos.slice(0, 5).map(p =>
      `<img src="${esc(p.url)}" alt="${esc(p.name||'ảnh')}"
            onclick="_bcViewPhoto('${esc(p.url)}')"
            style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:zoom-in;
                   border:1px solid rgba(255,255,255,.1);flex-shrink:0"
            onerror="this.style.display='none'">`
    ).join('');
    const morePhotos = photos.length > 5 ? `<div style="width:64px;height:64px;border-radius:6px;
      background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;
      font-size:11px;color:#9ab;border:1px solid rgba(255,255,255,.1)">
      +${photos.length - 5}</div>` : '';

    return `
<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
            border-radius:10px;padding:14px 16px">
  <!-- Card header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:14px">🏢</span>
      <strong style="font-size:13px;color:var(--text-primary,#eef)">${esc(r.tram || '—')}</strong>
      <span style="font-size:11px;padding:2px 8px;border-radius:12px;
                   background:rgba(0,200,255,.1);color:var(--accent,#00c8ff);
                   border:1px solid rgba(0,200,255,.2)">
        <i class="fas fa-calendar-alt" style="font-size:10px;margin-right:4px"></i>${fmtDate(r.ngay_tn)}
      </span>
    </div>
    <div style="display:flex;gap:6px">
      <button onclick="_bcOpenModal(${r.id})"
        style="padding:4px 12px;border-radius:6px;border:1px solid rgba(0,200,255,.3);
               background:rgba(0,200,255,.07);color:var(--accent,#00c8ff);font-size:11px;cursor:pointer">
        <i class="fas fa-edit"></i> Sửa
      </button>
      <button onclick="_bcDelete(${r.id}, '${esc(r.tram)}', '${fmtDate(r.ngay_tn)}')"
        style="padding:4px 10px;border-radius:6px;border:1px solid rgba(255,82,82,.3);
               background:rgba(255,82,82,.07);color:#ff5252;font-size:11px;cursor:pointer">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </div>

  <!-- Photos -->
  ${photos.length > 0 ? `
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
    ${thumbs}${morePhotos}
    <span style="font-size:10px;color:#9ab;align-self:flex-end;padding-bottom:4px">(${photos.length} ảnh BB)</span>
  </div>` : ''}

  <!-- Meta -->
  <div style="font-size:12px;color:var(--text-secondary,#9ab);display:flex;flex-wrap:wrap;gap:12px">
    ${r.ghi_chu ? `<span><i class="fas fa-sticky-note" style="margin-right:4px;color:#ffd740"></i>${esc(r.ghi_chu)}</span>` : ''}
    ${r.nguoi_th ? `<span><i class="fas fa-user" style="margin-right:4px;color:#00e676"></i>${esc(r.nguoi_th)}</span>` : ''}
    <span style="margin-left:auto;font-size:11px;opacity:.6">
      Tạo: ${fmtDate(r.created_at ? r.created_at.slice(0,10) : '')}
    </span>
  </div>
</div>`;
  }

  // ──────────────────────────────────────────────────────────────
  // ADD / EDIT MODAL
  // ──────────────────────────────────────────────────────────────
  function _bcOpenModal(id) {
    const isEdit = id !== null;
    let rec = null;
    if (isEdit) {
      rec = _state.records.find(r => r.id === id);
      if (!rec) { alert('Không tìm thấy bản ghi'); return; }
    }
    _state.editId = isEdit ? id : null;
    _state.editPhotos = isEdit ? (rec.photos || []).map(p => ({ ...p, isNew: false })) : [];

    const title = isEdit ? 'Sửa công tác' : 'Thêm công tác mới';

    // Tram options (from loaded trams)
    const tramOpts = _state.trams.map(t =>
      `<option value="${esc(t)}" ${isEdit && rec.tram === t ? 'selected' : ''}>${esc(t)}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = '_bc_modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.8);' +
      'backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px';

    overlay.innerHTML = `
<div style="background:#151c23;border:1px solid rgba(0,200,255,.2);border-radius:12px;
            width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.6)">

  <!-- Modal Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <div style="font-size:15px;font-weight:800;color:#eef">
      <i class="fas fa-clipboard-list" style="color:var(--accent,#00c8ff);margin-right:8px"></i>${title}
    </div>
    <button onclick="document.getElementById('_bc_modal')?.remove()"
      style="background:none;border:none;color:#9ab;font-size:20px;cursor:pointer;line-height:1">&times;</button>
  </div>

  <!-- Trạm -->
  <div style="margin-bottom:14px">
    <label style="display:block;font-size:11px;font-weight:700;color:#9ab;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">
      Trạm <span style="color:#ff5252">*</span>
    </label>
    <select id="_bc_mTram"
      style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);
             background:rgba(255,255,255,.06);color:#eef;font-size:13px">
      <option value="">-- Chọn trạm --</option>
      ${tramOpts}
    </select>
    <div id="_bc_tramSearch" style="margin-top:6px">
      <input type="text" id="_bc_tramInput" placeholder="Hoặc nhập thủ công tên trạm..."
        value="${isEdit ? esc(rec.tram||'') : ''}"
        style="width:100%;padding:8px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.1);
               background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box">
      <div style="font-size:10px;color:#789;margin-top:3px">Nhập thủ công sẽ ưu tiên hơn chọn từ dropdown</div>
    </div>
  </div>

  <!-- Ngày TN -->
  <div style="margin-bottom:14px">
    <label style="display:block;font-size:11px;font-weight:700;color:#9ab;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">
      Ngày thực hiện <span style="color:#ff5252">*</span>
    </label>
    <input type="date" id="_bc_mDate" value="${isEdit ? isoToInput(rec.ngay_tn) : isoToInput(new Date().toISOString())}"
      style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);
             background:rgba(255,255,255,.06);color:#eef;font-size:13px;box-sizing:border-box">
  </div>

  <!-- Ghi chú -->
  <div style="margin-bottom:14px">
    <label style="display:block;font-size:11px;font-weight:700;color:#9ab;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">
      Ghi chú
    </label>
    <input type="text" id="_bc_mNote" placeholder="VD: TN MBA T1, DCL 131-1..."
      value="${isEdit ? esc(rec.ghi_chu||'') : ''}"
      style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);
             background:rgba(255,255,255,.06);color:#eef;font-size:13px;box-sizing:border-box">
  </div>

  <!-- Ảnh BB -->
  <div style="margin-bottom:20px">
    <label style="display:block;font-size:11px;font-weight:700;color:#9ab;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">
      Ảnh Biên Bản (BB)
    </label>

    <!-- Drop zone -->
    <div id="_bc_dropZone"
      style="border:2px dashed rgba(0,200,255,.3);border-radius:8px;padding:20px;text-align:center;
             cursor:pointer;margin-bottom:10px;transition:border-color .2s"
      onclick="document.getElementById('_bc_fileInput').click()"
      ondragover="event.preventDefault();this.style.borderColor='rgba(0,200,255,.7)'"
      ondragleave="this.style.borderColor='rgba(0,200,255,.3)'"
      ondrop="_bcHandleDrop(event)">
      <i class="fas fa-camera" style="font-size:22px;color:#9ab;margin-bottom:8px;display:block"></i>
      <div style="font-size:12px;color:#9ab">Kéo thả hoặc <strong style="color:var(--accent,#00c8ff)">click</strong> để chọn ảnh</div>
      <div style="font-size:10px;color:#789;margin-top:4px">JPG / PNG / WebP — tối đa 10 MB/ảnh</div>
    </div>
    <input type="file" id="_bc_fileInput" accept="image/jpeg,image/png,image/webp"
      multiple style="display:none" onchange="_bcHandleFiles(this.files)">

    <!-- Preview -->
    <div id="_bc_photoPreview" style="display:flex;flex-wrap:wrap;gap:8px">
      <!-- rendered by _bcRenderPhotoPreview() -->
    </div>
  </div>

  <!-- Buttons -->
  <div style="display:flex;gap:10px">
    <button onclick="document.getElementById('_bc_modal')?.remove()"
      style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);
             background:transparent;color:#9ab;font-size:13px;cursor:pointer">
      Hủy
    </button>
    <button id="_bc_saveBtn" onclick="_bcSave()"
      style="flex:2;padding:10px;border-radius:8px;border:none;
             background:linear-gradient(135deg,#00c8ff,#0088ff);
             color:#000;font-size:13px;font-weight:800;cursor:pointer">
      <i class="fas fa-save"></i> Lưu
    </button>
  </div>

  <!-- Status -->
  <div id="_bc_modalStatus" style="margin-top:10px;font-size:12px;text-align:center;min-height:18px"></div>
</div>`;

    document.body.appendChild(overlay);
    _bcRenderPhotoPreview();

    // Click outside to close
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }
  window._bcOpenModal = _bcOpenModal;

  function _bcRenderPhotoPreview() {
    const container = document.getElementById('_bc_photoPreview');
    if (!container) return;
    container.innerHTML = _state.editPhotos.map((p, i) => `
      <div style="position:relative;flex-shrink:0">
        <img src="${esc(p.isNew ? p.dataUrl : p.url)}" alt="${esc(p.name||'')}"
          style="width:70px;height:70px;object-fit:cover;border-radius:7px;
                 border:1px solid rgba(255,255,255,.12)"
          onerror="this.style.display='none'">
        <button onclick="_bcRemovePhoto(${i})"
          style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;
                 border:none;background:#ff5252;color:#fff;font-size:10px;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
      </div>
    `).join('');
  }

  function _bcHandleDrop(e) {
    e.preventDefault();
    const dz = document.getElementById('_bc_dropZone');
    if (dz) dz.style.borderColor = 'rgba(0,200,255,.3)';
    _bcHandleFiles(e.dataTransfer.files);
  }
  window._bcHandleDrop = _bcHandleDrop;

  function _bcHandleFiles(files) {
    if (!files || !files.length) return;
    Array.from(files).forEach(f => {
      if (!f.type.startsWith('image/')) { alert('Chỉ chấp nhận file ảnh: ' + f.name); return; }
      if (f.size > 10 * 1024 * 1024) { alert('File quá lớn (>10MB): ' + f.name); return; }
      const reader = new FileReader();
      reader.onload = e => {
        _state.editPhotos.push({ dataUrl: e.target.result, name: f.name, file: f, isNew: true });
        _bcRenderPhotoPreview();
      };
      reader.readAsDataURL(f);
    });
  }
  window._bcHandleFiles = _bcHandleFiles;

  function _bcRemovePhoto(idx) {
    _state.editPhotos.splice(idx, 1);
    _bcRenderPhotoPreview();
  }
  window._bcRemovePhoto = _bcRemovePhoto;

  // ──────────────────────────────────────────────────────────────
  // SAVE LOGIC
  // ──────────────────────────────────────────────────────────────
  async function _bcSave() {
    const btn    = document.getElementById('_bc_saveBtn');
    const status = document.getElementById('_bc_modalStatus');
    const tramSel   = (document.getElementById('_bc_mTram')?.value || '').trim();
    const tramInput = (document.getElementById('_bc_tramInput')?.value || '').trim();
    const tram  = tramInput || tramSel;
    const date  = (document.getElementById('_bc_mDate')?.value || '').trim();
    const note  = (document.getElementById('_bc_mNote')?.value || '').trim();

    if (!tram) { setStatus(status, '❌ Chưa chọn/nhập trạm', '#ff5252'); return; }
    if (!date) { setStatus(status, '❌ Chưa chọn ngày thực hiện', '#ff5252'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    try {
      // 1. Upload new photos
      const newPhotos = _state.editPhotos.filter(p => p.isNew && p.file);
      const oldPhotos = _state.editPhotos.filter(p => !p.isNew);

      setStatus(status, newPhotos.length > 0 ? `⬆️ Đang tải ${newPhotos.length} ảnh...` : '💾 Đang lưu...', '#ffd740');

      const uploadedPhotos = [];
      for (const p of newPhotos) {
        const res = await uploadPhoto(p.file);
        uploadedPhotos.push(res);
      }

      const allPhotos = [...oldPhotos.map(p => ({ url: p.url, name: p.name, path: p.path })), ...uploadedPhotos];

      // 2. Get current user
      const userEmail = await getCurrentUserEmail();

      // 3. Build payload
      const payload = {
        tram,
        ngay_tn: date,
        ghi_chu: note || null,
        nguoi_th: userEmail || null,
        photos: allPhotos,
      };

      if (_state.editId === null) {
        // INSERT
        const token = await getToken();
        const res = await fetch(SB_URL + '/rest/v1/' + TABLE, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ ...payload, created_by: null }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        await updateRecord(_state.editId, payload);
      }

      setStatus(status, '✅ Lưu thành công!', '#00e676');
      setTimeout(() => {
        document.getElementById('_bc_modal')?.remove();
        _bcLoad();
      }, 800);

    } catch (e) {
      setStatus(status, '❌ Lỗi: ' + e.message, '#ff5252');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Lưu';
    }
  }
  window._bcSave = _bcSave;

  function setStatus(el, msg, color) {
    if (el) { el.textContent = msg; el.style.color = color || '#eef'; }
  }

  // ──────────────────────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────────────────────
  async function _bcDelete(id, tram, date) {
    if (!confirm(`Xóa bản ghi:\n• Trạm: ${tram}\n• Ngày: ${date}\n\nCác ảnh đính kèm cũng sẽ bị xóa. Tiếp tục?`)) return;
    try {
      const rec = _state.records.find(r => r.id === id);
      // Delete photos from storage first
      if (rec && rec.photos) {
        for (const p of rec.photos) {
          if (p.path) await deletePhoto(p.path);
          else if (p.url) {
            // Extract path from URL
            const parts = p.url.split('/' + BUCKET + '/');
            if (parts.length > 1) await deletePhoto(parts[1]);
          }
        }
      }
      await deleteRecord(id);
      _bcLoad();
    } catch (e) {
      alert('Lỗi xóa: ' + e.message);
    }
  }
  window._bcDelete = _bcDelete;

  // ──────────────────────────────────────────────────────────────
  // PHOTO LIGHTBOX
  // ──────────────────────────────────────────────────────────────
  function _bcViewPhoto(url) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,.92);' +
      'display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    ov.onclick = () => ov.remove();
    ov.innerHTML = `<img src="${esc(url)}" style="max-width:95vw;max-height:92vh;border-radius:8px;
      box-shadow:0 0 60px rgba(0,0,0,.8)">
      <button style="position:fixed;top:16px;right:20px;background:none;border:none;
        color:#fff;font-size:28px;cursor:pointer" onclick="this.closest('div').remove()">✕</button>`;
    document.body.appendChild(ov);
  }
  window._bcViewPhoto = _bcViewPhoto;

  // ──────────────────────────────────────────────────────────────
  // FILTER CHANGE
  // ──────────────────────────────────────────────────────────────
  function _bcChangeFilter() {
    const m = document.getElementById('_bc_filterMonth')?.value;
    const t = document.getElementById('_bc_filterTram')?.value;
    if (m !== undefined) _state.filterMonth = m;
    if (t !== undefined) _state.filterTram  = t;
    _bcLoad();
  }
  window._bcChangeFilter = _bcChangeFilter;

  // ──────────────────────────────────────────────────────────────
  // LOAD & RENDER
  // ──────────────────────────────────────────────────────────────
  async function _bcLoad() {
    const container = document.getElementById('_bc_cards');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ab"><i class="fas fa-spinner fa-spin" style="font-size:20px"></i></div>';

    try {
      _state.records = await loadRecords({
        month: _state.filterMonth,
        tram:  _state.filterTram,
      });
    } catch (e) {
      if (container) container.innerHTML = `<div style="color:#ff5252;padding:20px;text-align:center">❌ Lỗi tải dữ liệu: ${esc(e.message)}</div>`;
      return;
    }

    // Re-render section content
    const section = document.getElementById('_bc_section');
    if (section) {
      const parent = section.parentNode;
      const tmp = document.createElement('div');
      tmp.innerHTML = buildSectionHTML();
      parent.replaceChild(tmp.firstElementChild, section);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // SHOW SECTION (called by nav)
  // ──────────────────────────────────────────────────────────────
  async function showBaoCaoKetQua() {
    // Find the main content container
    const mainContent = document.getElementById('mainContent')
      || document.getElementById('main-content')
      || document.getElementById('content')
      || document.querySelector('.main-content')
      || document.querySelector('[id*="content"]')
      || document.querySelector('main');

    if (!mainContent) {
      console.error('[BaoCaoKetQua] Không tìm thấy main content container');
      return;
    }

    // Mark active nav item
    document.querySelectorAll('.nav-item, [data-section], .sidebar-item').forEach(el => {
      el.classList.remove('active');
      const txt = el.textContent;
      if (txt.includes(LABEL_SHORT) || txt.includes('TNĐK') || el.dataset.section === SECTION_KEY) {
        el.classList.add('active');
      }
    });

    // Loading state
    mainContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px;gap:12px;color:#9ab"><i class="fas fa-spinner fa-spin" style="font-size:20px"></i><span>Đang tải dữ liệu...</span></div>';

    // Load trams + records
    if (_state.trams.length === 0) {
      _state.trams = await loadTramsFromTHietBi();
    }
    if (!_state.filterMonth) {
      _state.filterMonth = _thisMonthStr();
    }

    try {
      _state.records = await loadRecords({
        month: _state.filterMonth,
        tram:  _state.filterTram,
      });
    } catch (e) {
      mainContent.innerHTML = `<div style="padding:32px;color:#ff5252;text-align:center">❌ Lỗi: ${esc(e.message)}<br><small>Kiểm tra bảng CongTacTNDK đã tạo trong DB chưa (chạy SQL 07)</small></div>`;
      return;
    }

    mainContent.innerHTML = buildSectionHTML();
  }
  window.showBaoCaoKetQua = showBaoCaoKetQua;

  // ──────────────────────────────────────────────────────────────
  // ESCAPE HTML
  // ──────────────────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  // ──────────────────────────────────────────────────────────────
  // NAV FIX — chạy sau khi DOM load xong
  // Tìm và fix TẤT CẢ nav elements có text "Công tác TNĐK"
  // ──────────────────────────────────────────────────────────────
  function fixNavItems() {
    const candidates = [
      ...document.querySelectorAll('nav a, nav button, nav li, nav div'),
      ...document.querySelectorAll('.nav-item, .sidebar-item, [data-section]'),
      ...document.querySelectorAll('aside a, aside button, aside li'),
    ];

    let fixed = 0;
    candidates.forEach(el => {
      if (!el.textContent.match(LABEL_OLD_RE)) return;

      // Đổi tên label (giữ icon nếu có)
      el.childNodes.forEach(node => {
        if (node.nodeType === 3) { // text node
          node.textContent = node.textContent.replace(LABEL_OLD_RE, LABEL_NEW);
        }
      });
      // Also replace in innerHTML for span/strong wrappers
      const iconHTML = el.querySelector('i')?.outerHTML || '';
      if (!iconHTML) {
        el.innerHTML = el.innerHTML.replace(LABEL_OLD_RE, LABEL_NEW);
      } else {
        // Keep icon, replace text
        el.innerHTML = el.innerHTML.replace(LABEL_OLD_RE, LABEL_NEW);
      }

      // Fix data-section attribute if wrong
      if (el.dataset && el.dataset.section) {
        el.dataset.section = SECTION_KEY;
      }

      // Override click handler
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        showBaoCaoKetQua();
      });

      fixed++;
    });

    if (fixed > 0) {
      console.log(`[BaoCaoKetQua] Đã fix ${fixed} nav item(s): "${LABEL_NEW}"`);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────────────────────────
  function init() {
    fixNavItems();

    // MutationObserver: fix nav items được render động (sau login)
    const mo = new MutationObserver(() => {
      const toFix = [...document.querySelectorAll('nav a,nav button,nav li,nav div,.nav-item,.sidebar-item,[data-section],aside a,aside button,aside li')]
        .filter(el => el.textContent.match(LABEL_OLD_RE));
      if (toFix.length > 0) fixNavItems();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Xử lý routing: nếu URL hash chứa TNĐK, navigate đến section mới
    const checkHash = () => {
      const h = location.hash.toLowerCase();
      if (h.includes('tndk') || h.includes('tnđk') || h.includes('congtactn') || h.includes('baocao')) {
        showBaoCaoKetQua();
      }
    };
    window.addEventListener('hashchange', checkHash);
    checkHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose để gọi từ Console debug
  window._bcDebug = { showBaoCaoKetQua, loadRecords, _state };

})();
