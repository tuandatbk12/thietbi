// ════════════════════════════════════════════════════════════════
// TNDK UI Patch — Công tác TNĐK module
//
// Append vào app.js:
//   - _tndkRenderPage() — main page renderer
//   - _tndkOpenAddModal() — modal thêm mới
//   - Image lightbox
//   - Filter + stats
//
// Cần thêm menu item HTML vào index.html (sau "Upload TNĐK"):
//   <a href="#" class="nav-item nav-user-allowed" onclick="navActivate(this)">
//     <i class="fas fa-clipboard-check"></i>
//     <span>Công tác TNĐK</span>
//   </a>
//
// Và đăng ký vào _navExtMapBBTN:
//   'Công tác TNĐK': _tndkRenderPage,
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';
  
  const TNDK_BASE = _AUTH_SB_URL.replace(/\/$/, '');
  const TNDK_UPLOAD_ENDPOINT = TNDK_BASE + '/functions/v1/tndk-upload';
  
  let _tndkRecords = [];
  let _tndkTramOptions = [];
  let _tndkFilterMonth = null;     // null = all months
  let _tndkFilterTram = null;
  
  // ──────────────────────────────────────────────────────────────
  // STYLES
  // ──────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
#tndkPage{padding:24px;color:#dff}
#tndkPage h2{margin:0 0 16px;color:var(--accent);font-size:20px;display:flex;align-items:center;gap:10px}
#tndkPage .tndk-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px;padding:12px;background:rgba(255,255,255,.03);border-radius:8px}
#tndkPage .tndk-toolbar select,#tndkPage .tndk-toolbar input{padding:6px 10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#dff;border-radius:6px;font-size:12.5px}
#tndkPage .tndk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}
#tndkPage .tndk-stat{padding:12px;background:rgba(0,230,118,.08);border-left:3px solid #00e676;border-radius:6px}
#tndkPage .tndk-stat .num{font-size:22px;font-weight:700;color:#00e676}
#tndkPage .tndk-stat .lbl{font-size:11px;color:#9ab;text-transform:uppercase;letter-spacing:.5px}
#tndkPage .tndk-list{display:flex;flex-direction:column;gap:12px}
#tndkPage .tndk-card{padding:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;transition:all .2s}
#tndkPage .tndk-card:hover{background:rgba(255,255,255,.06);border-color:rgba(0,230,118,.3)}
#tndkPage .tndk-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px}
#tndkPage .tndk-card-title{font-size:15px;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px}
#tndkPage .tndk-card-date{font-size:12px;color:#aee;font-weight:500}
#tndkPage .tndk-photos{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
#tndkPage .tndk-photo{width:80px;height:80px;border-radius:6px;background-size:cover;background-position:center;cursor:pointer;border:1px solid rgba(255,255,255,.1);transition:transform .2s}
#tndkPage .tndk-photo:hover{transform:scale(1.05);border-color:#00e676}
#tndkPage .tndk-meta{font-size:11.5px;color:#9ab;margin-top:8px}
#tndkPage .tndk-meta i{margin-right:4px}
#tndkPage .tndk-card-actions{display:flex;gap:6px;margin-top:8px}
#tndkPage .tndk-btn-icon{padding:5px 10px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#dff;border-radius:5px;font-size:11px;cursor:pointer}
#tndkPage .tndk-btn-icon:hover{border-color:var(--accent);color:var(--accent)}
#tndkPage .tndk-btn-icon.danger:hover{border-color:#ff5252;color:#ff5252}
#tndkPage .tndk-btn-primary{padding:8px 16px;border:none;background:linear-gradient(135deg,#00e676,#00b8d4);color:#000;font-weight:600;border-radius:6px;cursor:pointer;font-size:12.5px}
#tndkPage .tndk-empty{padding:40px;text-align:center;color:#9ab}
#tndkPage .tndk-empty i{font-size:48px;color:rgba(255,255,255,.1);margin-bottom:10px;display:block}

#tndkModal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:none;justify-content:center;align-items:center;padding:20px}
#tndkModal.open{display:flex}
#tndkModalBox{background:rgba(20,25,35,.98);border:1px solid rgba(0,230,118,.3);border-radius:12px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;padding:20px}
#tndkModalBox h3{margin:0 0 16px;color:#00e676;font-size:16px;display:flex;align-items:center;gap:8px}
#tndkModalBox label{display:block;margin-bottom:14px}
#tndkModalBox label .lbl{font-size:11.5px;color:#9ab;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
#tndkModalBox input,#tndkModalBox select,#tndkModalBox textarea{width:100%;padding:8px 10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.3);color:#dff;border-radius:5px;font-size:13px;box-sizing:border-box;font-family:inherit}
#tndkModalBox textarea{min-height:60px;resize:vertical}
#tndkModalBox .photo-drop{padding:20px;border:2px dashed rgba(255,255,255,.2);border-radius:8px;text-align:center;cursor:pointer;color:#9ab;font-size:12.5px;transition:all .2s}
#tndkModalBox .photo-drop:hover,#tndkModalBox .photo-drop.dragover{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.05)}
#tndkModalBox .photo-drop i{font-size:32px;display:block;margin-bottom:8px}
#tndkModalBox .photo-preview{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#tndkModalBox .photo-preview-item{position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}
#tndkModalBox .photo-preview-item img{width:100%;height:100%;object-fit:cover}
#tndkModalBox .photo-preview-item .remove{position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(255,82,82,.9);color:#fff;border-radius:50%;border:none;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center}
#tndkModalBox .modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
#tndkModalBox button{padding:8px 16px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#dff;cursor:pointer;font-size:12.5px}
#tndkModalBox button.primary{background:linear-gradient(135deg,#00e676,#00b8d4);color:#000;font-weight:600;border:none}
#tndkModalBox button:disabled{opacity:.5;cursor:not-allowed}

#tndkLightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:10001;display:none;justify-content:center;align-items:center;padding:40px}
#tndkLightbox.open{display:flex}
#tndkLightbox img{max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5)}
#tndkLightbox .close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px}
#tndkLightbox .nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.1);border:none;color:#fff;width:50px;height:50px;border-radius:50%;cursor:pointer;font-size:22px}
#tndkLightbox .nav.prev{left:20px}
#tndkLightbox .nav.next{right:20px}
#tndkLightbox .counter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;padding:6px 12px;border-radius:14px;font-size:12px}
`;
  document.head.appendChild(style);

  // ──────────────────────────────────────────────────────────────
  // FETCH HELPERS
  // ──────────────────────────────────────────────────────────────
  async function _tndkFetchRecords() {
    const resp = await _authedFetch(TNDK_BASE + '/rest/v1/tndk_records_full?order=ngay_tn.desc', {});
    return resp.ok ? await resp.json() : [];
  }

  async function _tndkFetchTramOptions() {
    const resp = await _authedFetch(TNDK_BASE + '/rest/v1/tram_options', {});
    return resp.ok ? await resp.json() : [];
  }

  async function _tndkDeleteRecord(id) {
    const resp = await _authedFetch(TNDK_BASE + '/rest/v1/tndk_records?id=eq.' + id, { method: 'DELETE' });
    return resp.ok;
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN PAGE
  // ──────────────────────────────────────────────────────────────
  window._tndkRenderPage = async function() {
    // Setup container
    let pageEl = document.getElementById('tndkPage');
    const overlay = document.getElementById('tbPageOverlay');
    if (!overlay) return;
    
    if (!pageEl) {
      overlay.innerHTML = '<div id="tndkPage"><div class="tndk-empty"><i class="fas fa-spinner fa-spin"></i>Đang tải...</div></div>';
      pageEl = document.getElementById('tndkPage');
    }
    
    // Hide canvas, show overlay
    const cv = document.getElementById('canvasArea');
    const rp = document.querySelector('.props-panel');
    if (cv) cv.style.display = 'none';
    if (rp) rp.style.display = 'none';
    overlay.style.display = 'block';
    
    // Load data
    try {
      [_tndkRecords, _tndkTramOptions] = await Promise.all([
        _tndkFetchRecords(),
        _tndkFetchTramOptions(),
      ]);
    } catch (e) {
      pageEl.innerHTML = '<div class="tndk-empty">Lỗi tải dữ liệu: ' + e.message + '</div>';
      return;
    }
    
    // Render
    _tndkRender(pageEl);
  };

  function _tndkRender(pageEl) {
    // Filter records
    let filtered = _tndkRecords;
    if (_tndkFilterMonth) {
      filtered = filtered.filter(r => r.ngay_tn.startsWith(_tndkFilterMonth));
    }
    if (_tndkFilterTram) {
      filtered = filtered.filter(r => r.tram === _tndkFilterTram);
    }
    
    // Build months list
    const months = [...new Set(_tndkRecords.map(r => r.ngay_tn.substring(0, 7)))].sort().reverse();
    
    // Stats
    const totalRecords = filtered.length;
    const uniqueTrams = new Set(filtered.map(r => r.tram)).size;
    const totalPhotos = filtered.reduce((sum, r) => sum + (r.photo_count || 0), 0);
    const uniqueUsers = new Set(filtered.map(r => r.uploaded_email)).size;
    
    // Tram options
    const tramOpts = _tndkTramOptions.map(t => `<option value="${t.tram}">${t.tram}</option>`).join('');
    const monthOpts = months.map(m => `<option value="${m}">${m}</option>`).join('');
    
    pageEl.innerHTML = `
      <h2><i class="fas fa-clipboard-check"></i> Công tác TNĐK</h2>
      
      <div class="tndk-toolbar">
        <button class="tndk-btn-primary" onclick="_tndkOpenAddModal()">
          <i class="fas fa-plus"></i> Thêm công tác
        </button>
        <span style="color:#9ab;margin-left:8px">Lọc:</span>
        <select id="tndkFilterMonth">
          <option value="">Tất cả tháng</option>
          ${monthOpts}
        </select>
        <select id="tndkFilterTram">
          <option value="">Tất cả trạm</option>
          ${tramOpts}
        </select>
        <button class="tndk-btn-icon" onclick="_tndkResetFilter()">
          <i class="fas fa-times"></i> Xoá lọc
        </button>
      </div>
      
      <div class="tndk-stats">
        <div class="tndk-stat">
          <div class="num">${totalRecords}</div>
          <div class="lbl">Công tác</div>
        </div>
        <div class="tndk-stat">
          <div class="num">${uniqueTrams}</div>
          <div class="lbl">Trạm</div>
        </div>
        <div class="tndk-stat">
          <div class="num">${totalPhotos}</div>
          <div class="lbl">Ảnh BB</div>
        </div>
        <div class="tndk-stat">
          <div class="num">${uniqueUsers}</div>
          <div class="lbl">Người TH</div>
        </div>
      </div>
      
      <div class="tndk-list" id="tndkList"></div>
    `;
    
    // Restore filter UI state
    if (_tndkFilterMonth) document.getElementById('tndkFilterMonth').value = _tndkFilterMonth;
    if (_tndkFilterTram) document.getElementById('tndkFilterTram').value = _tndkFilterTram;
    
    // Bind filter events
    document.getElementById('tndkFilterMonth').onchange = (e) => {
      _tndkFilterMonth = e.target.value || null;
      _tndkRender(pageEl);
    };
    document.getElementById('tndkFilterTram').onchange = (e) => {
      _tndkFilterTram = e.target.value || null;
      _tndkRender(pageEl);
    };
    
    // Render list
    const listEl = document.getElementById('tndkList');
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="tndk-empty">
          <i class="fas fa-clipboard"></i>
          ${_tndkRecords.length === 0 ? 'Chưa có công tác TNĐK nào.<br>Bấm "Thêm công tác" để bắt đầu.' : 'Không có kết quả với bộ lọc này.'}
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = filtered.map(r => {
      const photos = r.photos || [];
      const photoHtml = photos.map((p, idx) => 
        `<div class="tndk-photo" style="background-image:url('${p.url}')" onclick="_tndkOpenLightbox(${r.id}, ${idx})" title="${p.name||''}"></div>`
      ).join('');
      
      const ngay = new Date(r.ngay_tn).toLocaleDateString('vi-VN');
      const taoNgay = new Date(r.created_at).toLocaleDateString('vi-VN');
      const ghiChu = r.ghi_chu ? `<div class="tndk-meta"><i class="fas fa-sticky-note"></i> ${_tndkEsc(r.ghi_chu)}</div>` : '';
      
      return `
        <div class="tndk-card">
          <div class="tndk-card-head">
            <div class="tndk-card-title"><i class="fas fa-building" style="color:#00e676"></i> Trạm ${_tndkEsc(r.tram)}</div>
            <div class="tndk-card-date"><i class="fas fa-calendar-day"></i> ${ngay}</div>
          </div>
          ${photos.length > 0 ? `<div class="tndk-photos">${photoHtml}</div>` : '<div style="color:#9ab;font-size:12px;font-style:italic">Không có ảnh BB</div>'}
          ${ghiChu}
          <div class="tndk-meta">
            <i class="fas fa-user"></i> ${r.uploaded_email || 'N/A'}
            &nbsp;·&nbsp;<i class="fas fa-clock"></i> Tạo ${taoNgay}
            &nbsp;·&nbsp;<i class="fas fa-images"></i> ${photos.length} ảnh
          </div>
          <div class="tndk-card-actions">
            <button class="tndk-btn-icon danger" onclick="_tndkDeleteConfirm(${r.id})">
              <i class="fas fa-trash"></i> Xoá
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function _tndkEsc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window._tndkResetFilter = function() {
    _tndkFilterMonth = null;
    _tndkFilterTram = null;
    _tndkRenderPage();
  };

  window._tndkDeleteConfirm = async function(id) {
    if (!confirm('Xoá công tác này? (Ảnh BB cũng sẽ bị xoá)')) return;
    const ok = await _tndkDeleteRecord(id);
    if (ok) {
      if (typeof showChangeNotif === 'function') showChangeNotif('success', 'Đã xoá', '');
      _tndkRenderPage();
    } else {
      alert('Xoá thất bại. Bạn có quyền không?');
    }
  };

  // ──────────────────────────────────────────────────────────────
  // MODAL ADD
  // ──────────────────────────────────────────────────────────────
  let _tndkSelectedFiles = [];
  
  window._tndkOpenAddModal = function() {
    _tndkSelectedFiles = [];
    
    // Create modal if not exists
    let modal = document.getElementById('tndkModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tndkModal';
      document.body.appendChild(modal);
    }
    
    const tramOpts = _tndkTramOptions.map(t => `<option value="${t.tram}">${t.tram}</option>`).join('');
    const today = new Date().toISOString().slice(0, 10);
    
    modal.innerHTML = `
      <div id="tndkModalBox">
        <h3><i class="fas fa-plus-circle"></i> Thêm công tác TNĐK</h3>
        
        <label>
          <span class="lbl">Trạm *</span>
          <select id="tndkInputTram">
            <option value="">-- Chọn trạm --</option>
            ${tramOpts}
          </select>
        </label>
        
        <label>
          <span class="lbl">Ngày thí nghiệm *</span>
          <input type="date" id="tndkInputDate" value="${today}" max="${today}">
        </label>
        
        <label>
          <span class="lbl">Ghi chú (tuỳ chọn)</span>
          <textarea id="tndkInputNote" placeholder="VD: TN định kỳ MBA T1, kiểm tra cách điện..."></textarea>
        </label>
        
        <label>
          <span class="lbl">Ảnh BB xác nhận</span>
          <div class="photo-drop" id="tndkDropZone">
            <i class="fas fa-cloud-upload-alt"></i>
            Click hoặc kéo thả ảnh vào đây<br>
            <small>JPG / PNG / WebP, mỗi ảnh < 10 MB</small>
            <input type="file" id="tndkFileInput" multiple accept="image/*" style="display:none">
          </div>
          <div class="photo-preview" id="tndkPreview"></div>
        </label>
        
        <div class="modal-actions">
          <button onclick="_tndkCloseModal()">Huỷ</button>
          <button class="primary" id="tndkSubmitBtn" onclick="_tndkSubmit()">
            <i class="fas fa-save"></i> Lưu
          </button>
        </div>
      </div>
    `;
    
    modal.classList.add('open');
    
    // Bind drop zone
    const dropZone = document.getElementById('tndkDropZone');
    const fileInput = document.getElementById('tndkFileInput');
    
    dropZone.onclick = () => fileInput.click();
    
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      _tndkHandleFiles(e.dataTransfer.files);
    };
    
    fileInput.onchange = (e) => _tndkHandleFiles(e.target.files);
  };

  function _tndkHandleFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 10 * 1024 * 1024) {
        alert(`Ảnh "${f.name}" vượt 10 MB. Bỏ qua.`);
        continue;
      }
      _tndkSelectedFiles.push(f);
    }
    _tndkUpdatePreview();
  }

  function _tndkUpdatePreview() {
    const preview = document.getElementById('tndkPreview');
    if (!preview) return;
    
    preview.innerHTML = _tndkSelectedFiles.map((f, idx) => {
      const url = URL.createObjectURL(f);
      return `
        <div class="photo-preview-item">
          <img src="${url}" alt="${f.name}">
          <button class="remove" onclick="_tndkRemoveFile(${idx})">×</button>
        </div>
      `;
    }).join('');
  }

  window._tndkRemoveFile = function(idx) {
    _tndkSelectedFiles.splice(idx, 1);
    _tndkUpdatePreview();
  };

  window._tndkCloseModal = function() {
    const modal = document.getElementById('tndkModal');
    if (modal) modal.classList.remove('open');
    _tndkSelectedFiles = [];
  };

  window._tndkSubmit = async function() {
    const tram = document.getElementById('tndkInputTram').value;
    const ngayTn = document.getElementById('tndkInputDate').value;
    const ghiChu = document.getElementById('tndkInputNote').value;
    
    if (!tram) { alert('Vui lòng chọn trạm'); return; }
    if (!ngayTn) { alert('Vui lòng chọn ngày'); return; }
    
    const submitBtn = document.getElementById('tndkSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải lên...';
    
    try {
      const formData = new FormData();
      formData.append('tram', tram);
      formData.append('ngay_tn', ngayTn);
      formData.append('ghi_chu', ghiChu);
      
      _tndkSelectedFiles.forEach((f, idx) => {
        formData.append('photo_' + idx, f);
      });
      
      const resp = await _authedFetch(TNDK_UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });
      
      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.error || 'Upload thất bại');
      }
      
      if (typeof showChangeNotif === 'function') {
        showChangeNotif('success', 'Đã lưu', data.message);
      } else {
        alert(data.message);
      }
      
      _tndkCloseModal();
      _tndkRenderPage();
      
    } catch (e) {
      alert('Lỗi: ' + e.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Lưu';
    }
  };

  // ──────────────────────────────────────────────────────────────
  // LIGHTBOX
  // ──────────────────────────────────────────────────────────────
  let _tndkLightboxRecord = null;
  let _tndkLightboxIdx = 0;
  
  window._tndkOpenLightbox = function(recordId, photoIdx) {
    _tndkLightboxRecord = _tndkRecords.find(r => r.id === recordId);
    if (!_tndkLightboxRecord || !_tndkLightboxRecord.photos.length) return;
    _tndkLightboxIdx = photoIdx;
    
    let lb = document.getElementById('tndkLightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'tndkLightbox';
      document.body.appendChild(lb);
      lb.onclick = (e) => { if (e.target === lb) _tndkCloseLightbox(); };
    }
    
    _tndkRenderLightbox();
    lb.classList.add('open');
    
    // Keyboard nav
    document.onkeydown = (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') _tndkCloseLightbox();
      if (e.key === 'ArrowLeft') _tndkLightboxNav(-1);
      if (e.key === 'ArrowRight') _tndkLightboxNav(1);
    };
  };
  
  function _tndkRenderLightbox() {
    const lb = document.getElementById('tndkLightbox');
    const photos = _tndkLightboxRecord.photos;
    const photo = photos[_tndkLightboxIdx];
    lb.innerHTML = `
      <button class="close" onclick="_tndkCloseLightbox()"><i class="fas fa-times"></i></button>
      ${photos.length > 1 ? `<button class="nav prev" onclick="_tndkLightboxNav(-1)"><i class="fas fa-chevron-left"></i></button>` : ''}
      <img src="${photo.url}" alt="${photo.name||''}">
      ${photos.length > 1 ? `<button class="nav next" onclick="_tndkLightboxNav(1)"><i class="fas fa-chevron-right"></i></button>` : ''}
      <div class="counter">${_tndkLightboxIdx + 1} / ${photos.length} — Trạm ${_tndkLightboxRecord.tram}</div>
    `;
  }
  
  window._tndkLightboxNav = function(delta) {
    const total = _tndkLightboxRecord.photos.length;
    _tndkLightboxIdx = (_tndkLightboxIdx + delta + total) % total;
    _tndkRenderLightbox();
  };
  
  window._tndkCloseLightbox = function() {
    const lb = document.getElementById('tndkLightbox');
    if (lb) lb.classList.remove('open');
    document.onkeydown = null;
  };

  // ──────────────────────────────────────────────────────────────
  // REGISTER với navExtMapBBTN
  // ──────────────────────────────────────────────────────────────
  if (typeof _navExtMapBBTN === 'object') {
    _navExtMapBBTN['Công tác TNĐK'] = _tndkRenderPage;
  }
  
  console.log('[TNDK] Module loaded');
})();
