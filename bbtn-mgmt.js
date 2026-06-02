// ════════════════════════════════════════════════════════════════
// BBTN OCR Management Page
// Trang "Quản lý BBTN OCR" — xem toàn bộ records + filter + export Excel
// ════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const SB_URL = (typeof _AUTH_SB_URL !== 'undefined') ? _AUTH_SB_URL : 'https://xqqmfmljwycpehfyknoy.supabase.co';
  const SB_KEY = (typeof _AUTH_SB_KEY !== 'undefined') ? _AUTH_SB_KEY : '';

  const PAGE_SIZE = 50;

  // State
  let _bbtnMgmtState = {
    page: 0,
    filters: {
      tram: '',
      loai_thiet_bi: '',
      ngay_from: '',
      ngay_to: '',
      match_status: '',
      search: '',
    },
    data: [],
    total: 0,
    loading: false,
  };

  async function _authToken() {
    try { return await _authGetToken(); } catch { return null; }
  }

  function _toast(msg, type = 'info') {
    if (typeof showChangeNotif === 'function') {
      const map = { info: 'info', success: 'ok', warn: 'warn', error: 'err' };
      showChangeNotif(map[type] || 'info', 'BBTN OCR', msg);
    } else { console.log(`[${type}]`, msg); }
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ────────────────────────────────────────────────────────────
  // BUILD QUERY URL với filter
  // ────────────────────────────────────────────────────────────
  function _buildQueryUrl() {
    const f = _bbtnMgmtState.filters;
    const params = ['select=*', 'order=created_at.desc'];
    if (f.tram) params.push(`tram=ilike.*${encodeURIComponent(f.tram)}*`);
    if (f.loai_thiet_bi) params.push(`loai_thiet_bi=eq.${encodeURIComponent(f.loai_thiet_bi)}`);
    if (f.ngay_from) params.push(`ngay_kiem_dinh=gte.${f.ngay_from}`);
    if (f.ngay_to) params.push(`ngay_kiem_dinh=lte.${f.ngay_to}`);
    if (f.match_status) params.push(`match_status=eq.${f.match_status}`);
    if (f.search) {
      const s = encodeURIComponent(f.search);
      params.push(`or=(ten_thiet_bi.ilike.*${s}*,so_che_tao.ilike.*${s}*,kieu.ilike.*${s}*)`);
    }
    return `${SB_URL}/rest/v1/bbtn_records?${params.join('&')}`;
  }

  // ────────────────────────────────────────────────────────────
  // FETCH DATA
  // ────────────────────────────────────────────────────────────
  async function _fetchData() {
    _bbtnMgmtState.loading = true;
    _renderTable();

    const token = await _authToken();
    if (!token) {
      _toast('Chưa đăng nhập', 'error');
      _bbtnMgmtState.loading = false;
      return;
    }

    try {
      const url = _buildQueryUrl();
      const from = _bbtnMgmtState.page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
          'Range': `${from}-${to}`,
          'Prefer': 'count=exact',
        },
      });

      if (!res.ok) {
        _toast(`Lỗi ${res.status}: ${await res.text()}`, 'error');
        return;
      }

      const data = await res.json();
      _bbtnMgmtState.data = Array.isArray(data) ? data : [];

      // Total count từ content-range header
      const cr = res.headers.get('content-range') || '';
      const m = cr.match(/\/(\d+)$/);
      _bbtnMgmtState.total = m ? parseInt(m[1]) : data.length;
    } catch (err) {
      _toast(`Fetch error: ${err.message}`, 'error');
    } finally {
      _bbtnMgmtState.loading = false;
      _renderTable();
    }
  }

  // ────────────────────────────────────────────────────────────
  // RENDER PAGE
  // ────────────────────────────────────────────────────────────
  async function _bbtnMgmtRenderPage() {
    const ov = document.getElementById('tbPageOverlay');
    if (!ov) return;
    ov.style.display = 'block';

    const f = _bbtnMgmtState.filters;
    ov.innerHTML = `
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <h2 style="margin:0;color:var(--text-primary);font-size:18px">
            <i class="fas fa-database" style="color:#00c8ff"></i> Quản lý BBTN OCR
          </h2>
          <div style="display:flex;gap:8px">
            <button onclick="_bbtnMgmtExportExcel()" id="bbtnMgmtBtnExport"
                    style="padding:7px 14px;border-radius:7px;border:1px solid rgba(0,230,118,.4);background:linear-gradient(135deg,rgba(0,230,118,.15),rgba(0,200,100,.15));color:#00e676;font-size:11px;font-weight:700;cursor:pointer">
              <i class="fas fa-file-excel"></i> Export Excel
            </button>
            <button onclick="_bbtnMgmtClearFilters()"
                    style="padding:7px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;cursor:pointer">
              <i class="fas fa-times"></i> Xoá lọc
            </button>
            <button onclick="_fetchBbtnMgmtData()"
                    style="padding:7px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;cursor:pointer">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button onclick="navActivate(document.querySelector('.nav-item'))"
                    style="padding:7px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;cursor:pointer">
              <i class="fas fa-arrow-left"></i> Dashboard
            </button>
          </div>
        </div>

        <!-- Filters bar -->
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;margin-bottom:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Trạm</label>
            <input type="text" id="bbtnFilterTram" value="${_esc(f.tram)}" placeholder="VD: E1.1"
                   onchange="_bbtnMgmtSetFilter('tram', this.value)"
                   style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box" />
          </div>
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Loại TB</label>
            <select id="bbtnFilterLoai" onchange="_bbtnMgmtSetFilter('loai_thiet_bi', this.value)"
                    style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box">
              <option value="">— Tất cả —</option>
              ${['MC','MBA','MBATD','DCL','TĐ','TĐ1pha','TI','TI0','TIchânsứ','TU','CSV','Cáp','GIS','HGIS','TBN','TC','K','FCO','RL','THM','HTTĐ','Dầu']
                .map(l => `<option value="${l}" ${f.loai_thiet_bi===l?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Ngày từ</label>
            <input type="date" id="bbtnFilterFrom" value="${f.ngay_from}"
                   onchange="_bbtnMgmtSetFilter('ngay_from', this.value)"
                   style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box" />
          </div>
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Ngày đến</label>
            <input type="date" id="bbtnFilterTo" value="${f.ngay_to}"
                   onchange="_bbtnMgmtSetFilter('ngay_to', this.value)"
                   style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box" />
          </div>
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Trạng thái</label>
            <select id="bbtnFilterStatus" onchange="_bbtnMgmtSetFilter('match_status', this.value)"
                    style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box">
              <option value="">— Tất cả —</option>
              <option value="matched" ${f.match_status==='matched'?'selected':''}>✅ Khớp DB</option>
              <option value="not_in_db" ${f.match_status==='not_in_db'?'selected':''}>⚠️ Chưa khớp</option>
              <option value="manual_review" ${f.match_status==='manual_review'?'selected':''}>📝 Cần xem</option>
              <option value="pending" ${f.match_status==='pending'?'selected':''}>⏳ Đang xử lý</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:10px;color:rgba(180,200,220,.6);text-transform:uppercase;margin-bottom:3px">Tìm kiếm</label>
            <input type="text" id="bbtnFilterSearch" value="${_esc(f.search)}" placeholder="Tên TB, Serial, Kiểu..."
                   onchange="_bbtnMgmtSetFilter('search', this.value)"
                   style="width:100%;padding:6px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eef;font-size:12px;box-sizing:border-box" />
          </div>
        </div>

        <div id="bbtnMgmtTableWrap"></div>
      </div>
    `;

    _fetchData();
  }

  // ────────────────────────────────────────────────────────────
  // RENDER TABLE
  // ────────────────────────────────────────────────────────────
  function _renderTable() {
    const wrap = document.getElementById('bbtnMgmtTableWrap');
    if (!wrap) return;

    if (_bbtnMgmtState.loading) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(180,200,220,.6)">
        <i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang tải...
      </div>`;
      return;
    }

    const data = _bbtnMgmtState.data;
    const total = _bbtnMgmtState.total;
    const page = _bbtnMgmtState.page;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (!data.length) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(180,200,220,.6)">
        <i class="fas fa-inbox" style="color:rgba(180,200,220,.3);font-size:48px"></i>
        <div style="margin-top:12px;font-size:14px">Không có dữ liệu</div>
        <div style="font-size:11px;margin-top:4px">Thử bỏ bớt filter hoặc upload BBTN mới</div>
      </div>`;
      return;
    }

    const statusBadge = (s) => {
      const map = {
        matched: '<span style="background:rgba(0,230,118,.15);color:#00e676;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">✅ Khớp</span>',
        not_in_db: '<span style="background:rgba(255,82,82,.15);color:#ff5252;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">⚠️ Chưa khớp</span>',
        manual_review: '<span style="background:rgba(255,193,7,.15);color:#ffc107;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">📝 Cần xem</span>',
        pending: '<span style="background:rgba(108,117,125,.15);color:#9ab;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">⏳ Pending</span>',
      };
      return map[s] || s;
    };

    const rows = data.map((r, i) => {
      const dateStr = r.ngay_kiem_dinh ? new Date(r.ngay_kiem_dinh).toLocaleDateString('vi-VN') : '';
      const createdStr = r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '';
      const fileBadge = r.file_url
        ? `<a href="${_esc(r.file_url)}" target="_blank" style="color:#00c8ff;text-decoration:none;font-size:11px"><i class="fas fa-file"></i></a>`
        : '<span style="opacity:.4">—</span>';

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
          <td style="padding:8px;font-size:11px;color:rgba(180,200,220,.5)">${page * PAGE_SIZE + i + 1}</td>
          <td style="padding:8px"><span style="background:#00c8ff;color:#000;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${_esc(r.loai_thiet_bi || '?')}</span></td>
          <td style="padding:8px;font-size:12px;font-weight:600;color:#eef">${_esc(r.tram || '')}</td>
          <td style="padding:8px;font-size:12px;color:#00e676;font-weight:600">${_esc(r.ten_thiet_bi || '')}</td>
          <td style="padding:8px;font-size:11px;color:#ccd">${_esc(r.kieu || '')}</td>
          <td style="padding:8px;font-size:11px;color:#ccd">${_esc(r.so_che_tao || '')}</td>
          <td style="padding:8px;font-size:11px;color:#ccd">${_esc(r.hang_san_xuat || '')}</td>
          <td style="padding:8px;font-size:11px;color:#ccd">${_esc(r.nam_san_xuat || '')}</td>
          <td style="padding:8px;font-size:11px;color:#ccd;font-weight:600">${dateStr}</td>
          <td style="padding:8px">${statusBadge(r.match_status)}</td>
          <td style="padding:8px;text-align:center">${fileBadge}</td>
          <td style="padding:8px;font-size:10px;color:rgba(180,200,220,.5)">${createdStr}</td>
        </tr>
      `;
    }).join('');

    wrap.innerHTML = `
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden">
        <div style="padding:8px 12px;font-size:11px;color:rgba(180,200,220,.7);border-bottom:1px solid rgba(255,255,255,.05);display:flex;justify-content:space-between">
          <span>Hiển thị ${data.length} / ${total} records</span>
          <span>Trang ${page + 1} / ${totalPages}</span>
        </div>
        <div style="overflow-x:auto;max-height:600px;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead style="background:rgba(0,200,255,.08);position:sticky;top:0;z-index:5">
              <tr>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">#</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Loại</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Trạm</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Tên thiết bị</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Kiểu</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Serial</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Hãng</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Năm SX</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Ngày KĐ</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Trạng thái</th>
                <th style="padding:10px 8px;text-align:center;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">File</th>
                <th style="padding:10px 8px;text-align:left;font-size:11px;color:#00c8ff;border-bottom:1px solid rgba(0,200,255,.2)">Upload</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,.05);display:flex;justify-content:space-between;align-items:center">
          <button onclick="_bbtnMgmtSetPage(${page - 1})" ${page === 0 ? 'disabled' : ''}
                  style="padding:5px 12px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#eef;font-size:11px;cursor:${page === 0 ? 'not-allowed' : 'pointer'};opacity:${page === 0 ? '.4' : '1'}">
            ← Trước
          </button>
          <span style="font-size:11px;color:rgba(180,200,220,.7)">Trang ${page + 1} / ${totalPages}</span>
          <button onclick="_bbtnMgmtSetPage(${page + 1})" ${page >= totalPages - 1 ? 'disabled' : ''}
                  style="padding:5px 12px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#eef;font-size:11px;cursor:${page >= totalPages - 1 ? 'not-allowed' : 'pointer'};opacity:${page >= totalPages - 1 ? '.4' : '1'}">
            Sau →
          </button>
        </div>
        ` : ''}
      </div>
    `;
  }

  // ────────────────────────────────────────────────────────────
  // FILTER ACTIONS
  // ────────────────────────────────────────────────────────────
  function _bbtnMgmtSetFilter(key, value) {
    _bbtnMgmtState.filters[key] = value;
    _bbtnMgmtState.page = 0;
    _fetchData();
  }

  function _bbtnMgmtClearFilters() {
    _bbtnMgmtState.filters = { tram: '', loai_thiet_bi: '', ngay_from: '', ngay_to: '', match_status: '', search: '' };
    _bbtnMgmtState.page = 0;
    _bbtnMgmtRenderPage();
  }

  function _bbtnMgmtSetPage(p) {
    if (p < 0) return;
    _bbtnMgmtState.page = p;
    _fetchData();
  }

  // ────────────────────────────────────────────────────────────
  // EXPORT EXCEL (.xlsx)
  // ────────────────────────────────────────────────────────────
  async function _bbtnMgmtExportExcel() {
    const btn = document.getElementById('bbtnMgmtBtnExport');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang fetch...';

    const token = await _authToken();
    if (!token) {
      _toast('Chưa đăng nhập', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
      return;
    }

    try {
      // Fetch ALL data (không pagination) với cùng filter
      const url = _buildQueryUrl();
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
          'Range-Unit': 'items',
          'Range': '0-9999',
        },
      });

      if (!res.ok) {
        _toast(`Export fail: ${res.status}`, 'error');
        return;
      }

      const data = await res.json();
      if (!data.length) {
        _toast('Không có dữ liệu để export', 'warn');
        return;
      }

      btn.innerHTML = `<i class="fas fa-cog fa-spin"></i> Tạo Excel (${data.length})...`;

      // Đảm bảo SheetJS có sẵn (đã import từ /quanlybbtn module dùng XLSX rồi)
      let XLSX = window.XLSX;
      if (!XLSX) {
        // Load XLSX dynamic
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        XLSX = window.XLSX;
      }
      if (!XLSX) {
        _toast('Không load được thư viện XLSX', 'error');
        return;
      }

      // Build sheet data
      const STATUS_LABELS = {
        matched: 'Khớp DB',
        not_in_db: 'Chưa khớp',
        manual_review: 'Cần xem',
        pending: 'Đang xử lý',
      };

      const sheetData = data.map((r, i) => ({
        'STT': i + 1,
        'Loại TB': r.loai_thiet_bi || '',
        'Trạm': r.tram || '',
        'Tên thiết bị': r.ten_thiet_bi || '',
        'Kiểu/Model': r.kieu || '',
        'Số chế tạo': r.so_che_tao || '',
        'Hãng SX': r.hang_san_xuat || '',
        'Nước SX': r.nuoc_san_xuat || '',
        'Năm SX': r.nam_san_xuat || '',
        'Điện áp': r.dien_ap || '',
        'Dòng điện': r.dong_dien || '',
        'Ngày KĐ': r.ngay_kiem_dinh || '',
        'Dạng KĐ': r.dang_kiem_dinh || '',
        'Vị trí lắp đặt': r.vi_tri_lap_dat || '',
        'Trang BBTN': (r.ocr_raw?.page_start && r.ocr_raw?.page_end)
          ? (r.ocr_raw.page_start === r.ocr_raw.page_end ? `${r.ocr_raw.page_start}` : `${r.ocr_raw.page_start}-${r.ocr_raw.page_end}`)
          : '',
        'Trạng thái': STATUS_LABELS[r.match_status] || r.match_status || '',
        'File gốc': r.file_name || '',
        'URL file': r.file_url || '',
        'Người upload': r.created_email || '',
        'Ngày upload': r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '',
      }));

      // Tạo workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);

      // Auto-fit column widths
      const cols = Object.keys(sheetData[0]);
      ws['!cols'] = cols.map(col => {
        const maxLen = Math.max(
          col.length,
          ...sheetData.map(r => String(r[col] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
      });

      // Freeze row 1
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      // Style header row (cells A1:V1)
      const headerRange = XLSX.utils.decode_range(ws['!ref']);
      for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          fill: { fgColor: { rgb: '00C8FF' } },
          font: { bold: true, color: { rgb: '000000' }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      }

      // Style status column (cột thứ 16 = index Q)
      const statusColIdx = cols.indexOf('Trạng thái');
      if (statusColIdx >= 0) {
        for (let r = 1; r <= headerRange.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: statusColIdx });
          if (!ws[addr]) continue;
          const v = String(ws[addr].v || '');
          let fillColor = null;
          if (v === 'Khớp DB') fillColor = 'D4F4DD';
          else if (v === 'Chưa khớp') fillColor = 'FFE5E5';
          else if (v === 'Cần xem') fillColor = 'FFF4D4';
          if (fillColor) {
            ws[addr].s = {
              fill: { fgColor: { rgb: fillColor } },
              alignment: { horizontal: 'center' },
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'BBTN OCR');

      // Tên file có timestamp + filter info
      const f = _bbtnMgmtState.filters;
      let suffix = '';
      if (f.tram) suffix += `_${f.tram}`;
      if (f.loai_thiet_bi) suffix += `_${f.loai_thiet_bi}`;
      if (f.match_status) suffix += `_${f.match_status}`;
      const fileName = `bbtn_ocr_${new Date().toISOString().slice(0,10).replace(/-/g,'')}${suffix}.xlsx`;

      // Write file
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });

      _toast(`✅ Đã export ${data.length} records → ${fileName}`, 'success');
    } catch (err) {
      console.error(err);
      _toast(`Export error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
    }
  }

  // ────────────────────────────────────────────────────────────
  // INJECT SIDEBAR MENU
  // ────────────────────────────────────────────────────────────
  function _bbtnMgmtInjectMenu() {
    // Tìm menu "BBTN chưa khớp DB" — chèn ngay sau nó
    const alertMenu = document.getElementById('bbtnAlertsMenu');
    if (!alertMenu) {
      setTimeout(_bbtnMgmtInjectMenu, 500);
      return;
    }

    if (document.getElementById('bbtnMgmtMenu')) return;

    const newMenu = document.createElement('a');
    newMenu.id = 'bbtnMgmtMenu';
    newMenu.href = '#';
    newMenu.className = 'nav-item nav-user-allowed';
    newMenu.onclick = function() { navActivate(this); return false; };
    newMenu.innerHTML = `
      <i class="fas fa-database" style="color:#00c8ff"></i>
      <span>Quản lý BBTN OCR</span>
    `;

    alertMenu.parentNode.insertBefore(newMenu, alertMenu.nextSibling);

    // Register handler
    if (typeof window._navExtMapBBTN !== 'undefined') {
      window._navExtMapBBTN['Quản lý BBTN OCR'] = _bbtnMgmtRenderPage;
    }

    console.log('[BBTN Mgmt] Menu injected');
  }

  // ────────────────────────────────────────────────────────────
  // EXPORT functions
  // ────────────────────────────────────────────────────────────
  window._bbtnMgmtRenderPage = _bbtnMgmtRenderPage;
  window._bbtnMgmtSetFilter = _bbtnMgmtSetFilter;
  window._bbtnMgmtClearFilters = _bbtnMgmtClearFilters;
  window._bbtnMgmtSetPage = _bbtnMgmtSetPage;
  window._bbtnMgmtExportExcel = _bbtnMgmtExportExcel;
  window._fetchBbtnMgmtData = _fetchData;

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bbtnMgmtInjectMenu);
  } else {
    setTimeout(_bbtnMgmtInjectMenu, 800);
  }
})();
