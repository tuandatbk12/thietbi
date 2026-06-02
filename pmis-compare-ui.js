// ════════════════════════════════════════════════════════════════
// PMIS COMPARE UI MODULE — Inject menu + Modal + Render results
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._pmisCompareUiLoaded) return;
  window._pmisCompareUiLoaded = true;

  // Wait for sidebar to load before injecting menu
  function _injectMenu() {
    const sidebar = document.querySelector('#sidebarMenu, .sidebar-nav, .sidebar-menu, nav.sidebar');
    if (!sidebar) {
      setTimeout(_injectMenu, 1000);
      return;
    }
    
    if (document.getElementById('pmisCompareMenu')) return; // Already injected
    
    // Find a good place to insert (after BBTN Mgmt menu)
    const bbtnMenu = document.getElementById('bbtnMgmtMenu') || sidebar.lastElementChild;
    
    const menu = document.createElement('a');
    menu.id = 'pmisCompareMenu';
    menu.className = (bbtnMenu?.className || 'sidebar-item') + ' pmis-menu';
    menu.href = '#';
    menu.innerHTML = `<i class="fas fa-balance-scale" style="margin-right:8px"></i> <span>📊 So sánh PMIS vs DB</span>`;
    menu.style.cssText = 'display:flex;align-items:center;padding:10px 15px;color:#fff;text-decoration:none;cursor:pointer;font-size:13px';
    
    menu.onclick = (e) => {
      e.preventDefault();
      _openPmisModal();
    };
    
    if (bbtnMenu && bbtnMenu.parentNode) {
      bbtnMenu.parentNode.insertBefore(menu, bbtnMenu.nextSibling);
    } else {
      sidebar.appendChild(menu);
    }
    
    console.log('[PMIS Compare UI] Menu injected');
  }
  
  // ────────────────────────────────────────────────────────────
  // OPEN MODAL
  // ────────────────────────────────────────────────────────────
  function _openPmisModal() {
    // Remove old modal if exists
    document.getElementById('pmisCompareModal')?.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'pmisCompareModal';
    overlay.className = 'pmis-modal-overlay';
    overlay.innerHTML = `
      <div class="pmis-modal-card">
        <div class="pmis-modal-header">
          <div class="pmis-modal-title">
            <i class="fas fa-balance-scale" style="margin-right:8px"></i>
            So sánh PMIS vs Dashboard
          </div>
          <button class="pmis-modal-close" onclick="document.getElementById('pmisCompareModal').remove()">✕</button>
        </div>
        <div class="pmis-modal-body" id="pmisModalBody">
          <div class="pmis-upload-zone" id="pmisUploadZone">
            <div style="text-align:center;padding:30px">
              <i class="fas fa-cloud-upload-alt" style="font-size:48px;color:#00c8ff;margin-bottom:15px"></i>
              <h3 style="color:#fff;margin:10px 0">Kéo thả file PMIS vào đây hoặc</h3>
              <button class="pmis-btn-primary" onclick="document.getElementById('pmisFileInput').click()">
                <i class="fas fa-folder-open"></i> Chọn tệp PMIS...
              </button>
              <input type="file" id="pmisFileInput" accept=".xlsb,.xlsx,.xls" style="display:none">
              <p style="color:#aaa;font-size:12px;margin-top:15px">
                Hỗ trợ: <strong>.xlsb</strong>, <strong>.xlsx</strong>, .xls — max 20MB<br>
                File phải có cấu trúc PMIS_TBA_*.xlsb (89 sheet, ~40K thiết bị)
              </p>
            </div>
          </div>
          
          <div class="pmis-progress-wrap" id="pmisProgressWrap" style="display:none">
            <div class="pmis-progress-bar"><div class="pmis-progress-fill" id="pmisProgressFill"></div></div>
            <div class="pmis-progress-text" id="pmisProgressText">Đang xử lý...</div>
          </div>
          
          <div id="pmisResultWrap" style="display:none"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    _attachUpload();
  }
  
  // ────────────────────────────────────────────────────────────
  // ATTACH UPLOAD HANDLERS
  // ────────────────────────────────────────────────────────────
  function _attachUpload() {
    const zone = document.getElementById('pmisUploadZone');
    const input = document.getElementById('pmisFileInput');
    
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = '#00c8ff';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = '';
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) _handleFile(file);
    });
    
    input.addEventListener('change', () => {
      if (input.files[0]) _handleFile(input.files[0]);
    });
  }
  
  async function _handleFile(file) {
    if (file.size > 20 * 1024 * 1024) {
      alert('File quá lớn (>20MB). Vui lòng nén hoặc tách file trước.');
      return;
    }
    
    document.getElementById('pmisUploadZone').style.display = 'none';
    document.getElementById('pmisProgressWrap').style.display = 'block';
    document.getElementById('pmisResultWrap').style.display = 'none';
    
    const onProgress = (msg) => {
      document.getElementById('pmisProgressText').textContent = msg;
    };
    
    try {
      const state = await window._pmisCompareRun(file, onProgress);
      document.getElementById('pmisProgressWrap').style.display = 'none';
      _renderResults(state);
    } catch (err) {
      document.getElementById('pmisProgressText').innerHTML = 
        `<span style="color:#ff5252">❌ Lỗi: ${err.message}</span><br>
        <button class="pmis-btn-primary" style="margin-top:10px" onclick="document.getElementById('pmisUploadZone').style.display='block';document.getElementById('pmisProgressWrap').style.display='none'">↻ Thử lại</button>`;
      console.error('[PMIS] Error:', err);
    }
  }
  
  // ────────────────────────────────────────────────────────────
  // RENDER RESULTS (Tabbed)
  // ────────────────────────────────────────────────────────────
  function _renderResults(state) {
    const wrap = document.getElementById('pmisResultWrap');
    wrap.style.display = 'block';
    
    const { pmisStats, dbStats, matchResults } = state;
    const groups = matchResults.groups;
    
    wrap.innerHTML = `
      <div class="pmis-tabs">
        <button class="pmis-tab active" data-tab="overview"><i class="fas fa-chart-pie"></i> Tổng quan</button>
        <button class="pmis-tab" data-tab="tier1"><i class="fas fa-layer-group"></i> Theo trạm + loại</button>
        <button class="pmis-tab" data-tab="tier2"><i class="fas fa-sitemap"></i> Theo ngăn lộ</button>
        <button class="pmis-tab" data-tab="missing"><i class="fas fa-exclamation-triangle"></i> Thiếu DB (${groups.N1.length})</button>
        <button class="pmis-tab" data-tab="extra"><i class="fas fa-plus-circle"></i> Thừa DB (${groups.N2.length})</button>
        <button class="pmis-tab" data-tab="conflicts"><i class="fas fa-not-equal"></i> Lệch (${matchResults.tier3.conflicts.length})</button>
        <button class="pmis-tab" data-tab="export"><i class="fas fa-file-excel"></i> Export</button>
      </div>
      <div class="pmis-tab-content" id="pmisTabContent"></div>
    `;
    
    document.querySelectorAll('.pmis-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pmis-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderTab(btn.dataset.tab, state);
      };
    });
    
    _renderTab('overview', state);
  }
  
  function _renderTab(tab, state) {
    const c = document.getElementById('pmisTabContent');
    const { pmisStats, dbStats, matchResults } = state;
    const groups = matchResults.groups;
    
    if (tab === 'overview') {
      const matchPct = ((matchResults.tier3.matched.length / (pmisStats.total || 1)) * 100).toFixed(1);
      c.innerHTML = `
        <div class="pmis-kpi-grid">
          <div class="pmis-kpi"><div class="pmis-kpi-label">Tổng PMIS</div><div class="pmis-kpi-value">${pmisStats.total.toLocaleString()}</div></div>
          <div class="pmis-kpi"><div class="pmis-kpi-label">Tổng DB</div><div class="pmis-kpi-value">${dbStats.total.toLocaleString()}</div></div>
          <div class="pmis-kpi"><div class="pmis-kpi-label">Khớp được</div><div class="pmis-kpi-value" style="color:#4caf50">${matchResults.tier3.matched.length.toLocaleString()} (${matchPct}%)</div></div>
          <div class="pmis-kpi"><div class="pmis-kpi-label">Số trạm</div><div class="pmis-kpi-value">${pmisStats.trams}</div></div>
        </div>
        
        <h3 style="color:#fff;margin-top:25px">7 nhóm sai khác</h3>
        <div class="pmis-group-grid">
          <div class="pmis-group" data-group="N1"><span class="pmis-group-icon" style="color:#ff5252">❌</span> <span class="pmis-group-label">N1: Thiếu DB</span><span class="pmis-group-count">${groups.N1.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N2"><span class="pmis-group-icon" style="color:#ff9100">➕</span> <span class="pmis-group-label">N2: Thừa DB</span><span class="pmis-group-count">${groups.N2.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N3"><span class="pmis-group-icon" style="color:#fbc02d">⚖️</span> <span class="pmis-group-label">N3: Lệch số lượng</span><span class="pmis-group-count">${groups.N3.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N4"><span class="pmis-group-icon" style="color:#9c27b0">🔢</span> <span class="pmis-group-label">N4: Lệch serial</span><span class="pmis-group-count">${groups.N4.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N5"><span class="pmis-group-icon" style="color:#03a9f4">🏭</span> <span class="pmis-group-label">N5: Lệch hãng</span><span class="pmis-group-count">${groups.N5.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N6"><span class="pmis-group-icon" style="color:#00bcd4">📦</span> <span class="pmis-group-label">N6: Lệch kiểu</span><span class="pmis-group-count">${groups.N6.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N7"><span class="pmis-group-icon" style="color:#607d8b">❓</span> <span class="pmis-group-label">N7: Thiếu info</span><span class="pmis-group-count">${groups.N7.length.toLocaleString()}</span></div>
        </div>
        
        <h3 style="color:#fff;margin-top:25px">Phân bố theo loại</h3>
        <table class="pmis-table">
          <thead><tr><th>Loại</th><th>PMIS</th><th>DB</th><th>Chênh lệch</th></tr></thead>
          <tbody>
            ${_renderTypeBreakdown(pmisStats.byType, dbStats.byType)}
          </tbody>
        </table>
      `;
    } else if (tab === 'tier1') {
      const rows = Object.values(matchResults.tier1).sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff));
      c.innerHTML = `
        <div style="margin-bottom:10px"><input type="text" id="t1Filter" placeholder="Lọc trạm..." class="pmis-input" oninput="window._pmisFilterT1(this.value)"></div>
        <div class="pmis-table-wrap">
          <table class="pmis-table" id="pmisT1Table">
            <thead><tr><th>Trạm</th><th>Loại</th><th>Cấp ĐA</th><th>PMIS</th><th>DB</th><th>Chênh lệch</th></tr></thead>
            <tbody>${_renderTier1Rows(rows)}</tbody>
          </table>
        </div>
      `;
      window._pmisFilterT1 = (q) => {
        const filtered = q ? rows.filter(r => (r.tram||'').toLowerCase().includes(q.toLowerCase())) : rows;
        document.querySelector('#pmisT1Table tbody').innerHTML = _renderTier1Rows(filtered);
      };
    } else if (tab === 'tier2') {
      const rows = Object.values(matchResults.tier2)
        .filter(r => r.pmis !== r.db)
        .sort((a,b) => Math.abs(b.pmis - b.db) - Math.abs(a.pmis - a.db))
        .slice(0, 500);
      c.innerHTML = `
        <p style="color:#aaa">Hiển thị 500 ngăn lộ có chênh lệch cao nhất.</p>
        <div class="pmis-table-wrap">
          <table class="pmis-table">
            <thead><tr><th>Trạm</th><th>Cấp ĐA</th><th>Ngăn lộ</th><th>Loại</th><th>PMIS</th><th>DB</th><th>Δ</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td>${_esc(r.tram)}</td><td>${_esc(r.cap_dien_ap)}</td><td>${_esc(r.ngan_lo)}</td><td>${_esc(r.loai)}</td><td>${r.pmis}</td><td>${r.db}</td><td style="color:${r.pmis>r.db?'#ff5252':'#ff9100'}">${r.pmis-r.db}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      `;
    } else if (tab === 'missing') {
      c.innerHTML = _renderDeviceList(groups.N1, 'Thiết bị có trong PMIS nhưng KHÔNG có trong DB', true);
    } else if (tab === 'extra') {
      c.innerHTML = _renderDeviceList(groups.N2, 'Thiết bị có trong DB nhưng KHÔNG có trong PMIS', false);
    } else if (tab === 'conflicts') {
      c.innerHTML = _renderConflicts(matchResults.tier3.conflicts);
    } else if (tab === 'export') {
      c.innerHTML = `
        <div style="padding:30px;text-align:center">
          <h3 style="color:#fff">Export báo cáo Excel</h3>
          <p style="color:#aaa">Báo cáo gồm 13 sheet theo yêu cầu</p>
          <button class="pmis-btn-primary" onclick="window._pmisExportExcel()">
            <i class="fas fa-file-excel"></i> Tải báo cáo Excel
          </button>
          <p style="color:#666;font-size:11px;margin-top:20px">
            Bao gồm: Dashboard, DM_Tram, Tong_hop_theo_tram, Tong_hop_theo_loai_TB,<br>
            So_sanh_tram_loai_capdienap, So_sanh_ngan_lo, So_sanh_serial,<br>
            So_sanh_hang_model, Thiet_bi_PMIS_chua_co_TNDK, Thiet_bi_TNDK_chua_co_PMIS,<br>
            Du_lieu_thieu_thong_tin, Bang_quy_doi_loai_TB, Bang_chuan_hoa_hang
          </p>
        </div>
      `;
    }
  }
  
  function _renderTier1Rows(rows) {
    return rows.map(r => {
      let color = '#aaa';
      if (r.diff > 0) color = '#ff5252'; // PMIS nhiều hơn → thiếu DB
      else if (r.diff < 0) color = '#ff9100'; // DB nhiều hơn → thừa
      else color = '#4caf50'; // bằng nhau
      return `<tr>
        <td>${_esc(r.tram)}</td>
        <td>${_esc(r.loai)}</td>
        <td>${_esc(r.cap_dien_ap)}</td>
        <td>${r.pmis}</td>
        <td>${r.db}</td>
        <td style="color:${color};font-weight:600">${r.diff > 0 ? '+' : ''}${r.diff}</td>
      </tr>`;
    }).join('');
  }
  
  function _renderTypeBreakdown(pmisTypes, dbTypes) {
    const allTypes = new Set([...Object.keys(pmisTypes), ...Object.keys(dbTypes)]);
    return [...allTypes].sort().map(t => {
      const p = pmisTypes[t] || 0;
      const d = dbTypes[t] || 0;
      const diff = p - d;
      const color = diff > 0 ? '#ff5252' : (diff < 0 ? '#ff9100' : '#4caf50');
      return `<tr>
        <td><strong>${_esc(t)}</strong></td>
        <td>${p.toLocaleString()}</td>
        <td>${d.toLocaleString()}</td>
        <td style="color:${color}">${diff > 0 ? '+' : ''}${diff.toLocaleString()}</td>
      </tr>`;
    }).join('');
  }
  
  function _renderDeviceList(devices, title, isPmis) {
    if (!devices.length) return `<p style="color:#aaa;text-align:center;padding:40px">✅ Không có thiết bị nào trong nhóm này</p>`;
    const shown = devices.slice(0, 500);
    return `
      <h3 style="color:#fff">${title} (Hiển thị ${shown.length}/${devices.length})</h3>
      <div class="pmis-table-wrap">
        <table class="pmis-table">
          <thead><tr><th>Trạm</th><th>Tên TB</th><th>Loại</th><th>Cấp ĐA</th>${isPmis ? '<th>Hãng</th><th>Năm SX</th>' : ''}</tr></thead>
          <tbody>
            ${shown.map(d => `<tr>
              <td>${_esc(d.tram)}</td>
              <td>${_esc(d.ten_thiet_bi)}</td>
              <td>${_esc(d.loai_thiet_bi)}</td>
              <td>${_esc(d.cap_dien_ap)}</td>
              ${isPmis ? `<td>${_esc(d.hang_san_xuat||'')}</td><td>${d.nam_san_xuat||''}</td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  function _renderConflicts(conflicts) {
    if (!conflicts.length) return `<p style="color:#aaa;text-align:center;padding:40px">✅ Không có conflict nào</p>`;
    const shown = conflicts.slice(0, 200);
    return `
      <h3 style="color:#fff">Conflict matched nhưng khác chi tiết (${shown.length}/${conflicts.length})</h3>
      <div class="pmis-table-wrap">
        <table class="pmis-table">
          <thead><tr><th>Trạm</th><th>Tên</th><th>Loại</th><th>Score</th><th>PMIS serial</th><th>DB serial</th><th>PMIS hãng</th><th>DB hãng</th></tr></thead>
          <tbody>
            ${shown.map(c => `<tr>
              <td>${_esc(c.pmis.tram)}</td>
              <td>${_esc(c.pmis.ten_thiet_bi)}</td>
              <td>${_esc(c.pmis.loai_thiet_bi)}</td>
              <td style="color:${c.score >= 80 ? '#4caf50' : c.score >= 50 ? '#ff9100' : '#ff5252'};font-weight:600">${c.score}</td>
              <td>${_esc(c.pmis.so_che_tao||'-')}</td>
              <td>${_esc(c.db.so_che_tao||'-')}</td>
              <td>${_esc(c.pmis.hang_san_xuat||'-')}</td>
              <td>${_esc(c.db.hang_san_xuat||'-')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
  }
  
  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectMenu);
  } else {
    _injectMenu();
  }
  setTimeout(_injectMenu, 2000); // Retry after 2s
  setTimeout(_injectMenu, 5000); // Retry after 5s
  
  console.log('[PMIS Compare UI] Loaded');
})();
