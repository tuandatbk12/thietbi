// ════════════════════════════════════════════════════════════════
// PMIS COMPARE MODULE — So sánh PMIS vs Dashboard EVN Hà Nội
// 
// Tính năng:
//   - Upload file PMIS_TBA_*.xlsb hoặc .xlsx
//   - Parse 89 sheet, ~40K thiết bị
//   - So sánh 3 tầng: tổng hợp / chi tiết vận hành / định danh
//   - Phân loại 7 nhóm kết quả sai khác
//   - Export Excel 13 sheet báo cáo
//
// Triển khai:
//   - Phase 1: Parser + Match engine + UI shell (FILE NÀY)
//   - Phase 2: Render bảng + biểu đồ
//   - Phase 3: Export Excel
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._pmisCompareLoaded) return;
  window._pmisCompareLoaded = true;

  // ────────────────────────────────────────────────────────────
  // CONSTANTS
  // ────────────────────────────────────────────────────────────
  
  // Mapping: sheet name PMIS → Phan_loai_thiet_bi trong DB
  const SHEET_TO_TYPE = {
    'Máy cắt 110kV': 'MC', 'Máy cắt 22kV': 'MC', 'Máy cắt 35kV': 'MC',
    'Máy cắt 220kV (GIS)': 'MC', 'Máy cắt HGIS 110kV': 'MC', 'Máy cắt 110kV (GIS)': 'MC',
    'Máy biến áp 110kV': 'MBA', 'Máy biến áp 220kV': 'MBA',
    'Máy biến áp 35kV': 'MBA', 'Máy biến áp 22kV': 'MBA',
    'Máy biến áp tự dùng 22kV': 'MBATD', 'Máy biến áp tự dùng 35kV': 'MBATD',
    'Dao cách ly 110kV': 'DCL', 'Dao cách ly 22kV': 'DCL', 'Dao cách ly 35kV': 'DCL',
    'Dao cách ly 220kV (GIS)': 'DCL', 'Dao cách ly 110kV (GIS)': 'DCL', 'Dao cách ly HGIS 110kV': 'DCL',
    'Biến dòng điện 110kV': 'TI', 'Biến dòng điện 22kV': 'TI', 'Biến dòng điện 35kV': 'TI',
    'Biến dòng điện 6kV': 'TI', 'Biến dòng điện 10kV': 'TI', 'Biến dòng điện 220kV': 'TI',
    'Biến dòng điện 220kV (GIS)': 'TI', 'Biến dòng điện 110kV (GIS)': 'TI', 'Biến dòng điện HGIS 110kV': 'TI',
    'Biến điện áp 110kV': 'TU', 'Biến điện áp 22kV': 'TU', 'Biến điện áp 35kV': 'TU',
    'Biến điện áp 110kV (GIS)': 'TU', 'Biến điện áp 220kV (GIS)': 'TU', 'Biến điện áp HGIS 110kV': 'TU',
    'Chống sét van 110kV': 'CSV', 'Chống sét van 22kV': 'CSV', 'Chống sét van 35kV': 'CSV',
    'Chống sét van 220kV': 'CSV', 'Chống sét van 220kV (GIS)': 'CSV', 'Chống sét van 110kV (GIS)': 'CSV',
    'Chống sét van 10kV': 'CSV',
    'Tụ bù 110kV': 'TBN', 'Tụ bù 22kV': 'TBN', 'Tụ bù 35kV': 'TBN',
    'Thanh cái 110kV': 'TC', 'Thanh cái 22kV': 'TC', 'Thanh cái 35kV': 'TC', 'Thanh cái 220kV': 'TC',
    'Sứ 110kV': 'TIchânsứ', 'Sứ 22kV': 'TIchânsứ', 'Sứ 35kV': 'TIchânsứ',
    'Sứ 6kV': 'TIchânsứ', 'Sứ 220kV': 'TIchânsứ',
    'Đầu cáp 110kV': 'Cáp', 'Đầu cáp 22kV': 'Cáp', 'Đầu cáp 35kV': 'Cáp',
    'Dây cáp ngầm 22kV': 'Cáp', 'Dây cáp ngầm 35kV': 'Cáp', 'Cáp ngầm 110kV': 'Cáp',
    'Bộ HGIS 110kV': 'HGIS', 'Bộ GIS 110kV': 'GIS', 'Bộ GIS 220kV': 'GIS',
    'Cầu dao phụ tải (LBS) 22kV': 'FCO',
    'Role 0,4kV': 'RL',
  };
  
  // Cột PMIS quan trọng (theo phân tích file mẫu)
  const PMIS_COLS = {
    TEN_FILE: 0,        // E1.1
    MA_THIET_BI: 1,
    DUONG_DAY_TBA: 2,   // E1.1 Đông Anh
    MA_CHA: 3,
    NGAN_LO: 4,         // 173 E1.1 Đông Anh
    TEN_THIET_BI: 5,    // MC 173
    SO_CHE_TAO: 7,
    NGAY_VAN_HANH: 8,
    TINH_TRANG: 11,     // Đang sử dụng
    HANG_SX: 13,
    NUOC_SX: 15,
    NGAY_LAP_DAT: 17,
    NAM_SX: 18,
    MA_HIEU: 25,
    DIEN_AP: 26,
    CHUNG_LOAI: 27,
    DONG_DIEN: 29,
  };
  
  // 7 nhóm kết quả
  const RESULT_GROUPS = {
    N1_MISSING_DB: 'Thiếu trong DB (có PMIS, không có DB)',
    N2_EXTRA_DB: 'Thừa trong DB (có DB, không có PMIS)',
    N3_QUANTITY: 'Lệch số lượng',
    N4_SERIAL: 'Lệch serial',
    N5_HANG: 'Lệch hãng SX',
    N6_KIEU: 'Lệch kiểu/model',
    N7_MISSING_INFO: 'Thiếu thông tin quan trọng',
  };
  
  // State
  let _state = {
    pmisData: [],          // Array of devices
    dbData: [],
    matchResults: null,    // { matched, unmatched_pmis, unmatched_db, ... }
    pmisStats: null,
    dbStats: null,
    parsing: false,
    fileName: '',
  };
  
  // ────────────────────────────────────────────────────────────
  // LIBRARY LOADER
  // ────────────────────────────────────────────────────────────
  function _loadLib(name, url) {
    return new Promise((resolve, reject) => {
      if (window[name]) { resolve(window[name]); return; }
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve(window[name]);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  
  async function _ensureSheetJS() {
    if (window.XLSX) return window.XLSX;
    await _loadLib('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    return window.XLSX;
  }
  
  // ────────────────────────────────────────────────────────────
  // NORMALIZE HELPERS
  // ────────────────────────────────────────────────────────────
  function _normTram(tram) {
    if (!tram) return '';
    return String(tram).trim().toUpperCase()
      .replace(/^(TBA|TRẠM)\s+/i, '')
      .replace(/\s+ĐÔNG ANH$|\s+THANH XUÂN$|\s+ĐỐNG ĐA$/i, ''); // bỏ tên huyện
  }
  function _normName(name) {
    if (!name) return '';
    return String(name).trim().toLowerCase().replace(/\s+/g, '');
  }
  function _normSerial(s) {
    if (!s) return '';
    return String(s).trim().replace(/^0+/, '').toLowerCase();
  }
  function _normVoltage(v) {
    if (!v) return '';
    const n = parseFloat(String(v).replace(/[^\d.]/g,''));
    if (isNaN(n)) return '';
    // PMIS dùng số: 145 → 110kV, 22 → 22kV, etc.
    if (n >= 110 && n <= 170) return '110kV';
    if (n >= 200 && n <= 250) return '220kV';
    if (n >= 33 && n <= 40) return '35kV';
    if (n >= 20 && n <= 24) return '22kV';
    if (n >= 8 && n <= 12) return '10kV';
    if (n >= 5 && n <= 8) return '6kV';
    return n + 'kV';
  }
  
  // ────────────────────────────────────────────────────────────
  // PARSE PMIS FILE
  // ────────────────────────────────────────────────────────────
  async function _parsePmisFile(file, onProgress) {
    const XLSX = await _ensureSheetJS();
    if (onProgress) onProgress('Đang đọc file...');
    
    const arrayBuffer = await file.arrayBuffer();
    let wb;
    try {
      wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, cellNF: false, cellText: false });
    } catch (err) {
      throw new Error('Không đọc được file. Có thể file .xlsb không support — hãy convert sang .xlsx trước (Mở Excel → Save As → Excel Workbook .xlsx).');
    }
    
    if (onProgress) onProgress(`Đã mở file: ${wb.SheetNames.length} sheets`);
    
    const allDevices = [];
    const sheetStats = {};
    const unmappedSheets = [];
    
    for (let i = 0; i < wb.SheetNames.length; i++) {
      const sheetName = wb.SheetNames[i];
      if (sheetName === 'MENU') continue;
      
      const dbType = SHEET_TO_TYPE[sheetName];
      if (!dbType) {
        unmappedSheets.push(sheetName);
        continue;
      }
      
      if (onProgress && i % 10 === 0) {
        onProgress(`Parsing sheet ${i+1}/${wb.SheetNames.length}: ${sheetName}`);
      }
      
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      
      // Extract rows (start from row 2, skip header)
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        const getCell = (C) => {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          return cell ? cell.v : null;
        };
        
        const tenFile = getCell(PMIS_COLS.TEN_FILE);
        const tenThietBi = getCell(PMIS_COLS.TEN_THIET_BI);
        if (!tenFile && !tenThietBi) continue; // empty row
        
        allDevices.push({
          // Identity
          tram: _normTram(tenFile),
          tram_full: getCell(PMIS_COLS.DUONG_DAY_TBA) || tenFile,
          ngan_lo: getCell(PMIS_COLS.NGAN_LO) || '',
          ten_thiet_bi: String(tenThietBi || '').trim(),
          loai_thiet_bi: dbType,
          cap_dien_ap: _normVoltage(getCell(PMIS_COLS.DIEN_AP)) || '',
          
          // Details
          so_che_tao: String(getCell(PMIS_COLS.SO_CHE_TAO) || '').trim(),
          hang_san_xuat: String(getCell(PMIS_COLS.HANG_SX) || '').trim(),
          nuoc_san_xuat: String(getCell(PMIS_COLS.NUOC_SX) || '').trim(),
          nam_san_xuat: getCell(PMIS_COLS.NAM_SX) || null,
          kieu: String(getCell(PMIS_COLS.MA_HIEU) || '').trim(),
          chung_loai: String(getCell(PMIS_COLS.CHUNG_LOAI) || '').trim(),
          dong_dien: getCell(PMIS_COLS.DONG_DIEN) || null,
          tinh_trang: String(getCell(PMIS_COLS.TINH_TRANG) || '').trim(),
          
          // Source
          sheet_name: sheetName,
          row_num: R + 1,
        });
      }
      
      sheetStats[sheetName] = { type: dbType, count: 0 };
    }
    
    // Lọc thiết bị "Đang sử dụng" (bỏ thiết bị đã dừng)
    const activeDevices = allDevices.filter(d => 
      !d.tinh_trang || d.tinh_trang.includes('Đang sử dụng') || d.tinh_trang.includes('Vận hành')
    );
    
    return { devices: activeDevices, totalRaw: allDevices.length, unmappedSheets };
  }
  
  // ────────────────────────────────────────────────────────────
  // FETCH DASHBOARD DATA
  // ────────────────────────────────────────────────────────────
  async function _fetchDbData(onProgress) {
    if (onProgress) onProgress('Đang tải dữ liệu Dashboard...');
    
    // Use existing cached data if available
    if (window._TH && Array.isArray(window._TH) && window._TH.length > 0) {
      if (onProgress) onProgress(`Đã có cache: ${window._TH.length} thiết bị`);
      return window._TH.map(r => ({
        tram: _normTram(r.Tram || r.tram),
        ten_thiet_bi: String(r.Ten_thiet_bi || '').trim(),
        loai_thiet_bi: r.Phan_loai_thiet_bi || '',
        cap_dien_ap: String(r.Cap_dien_ap || '').trim(),
        ngan_lo: r.Ngan_thiet_bi || '',
        nhom: r.Nhom_thiet_bi || '',
      }));
    }
    
    // Fetch from Supabase
    const SB_URL = 'https://xqqmfmljwycpehfyknoy.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';
    
    // Get token
    let token = null;
    try {
      if (window._sbClient) {
        const { data: { session } } = await window._sbClient.auth.getSession();
        token = session?.access_token;
      }
    } catch (e) {}
    if (!token) {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.includes('-auth-token'));
      if (key) {
        try { token = JSON.parse(localStorage.getItem(key))?.access_token; } catch (e) {}
      }
    }
    if (!token) throw new Error('Chưa đăng nhập');
    
    const headers = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token };
    const all = [];
    const BATCH = 1000;
    let offset = 0;
    while (true) {
      if (onProgress) onProgress(`Tải DB rows ${offset+1}-${offset+BATCH}...`);
      const res = await fetch(`${SB_URL}/rest/v1/TongHopThietBi?select=Tram,Ten_thiet_bi,Phan_loai_thiet_bi,Cap_dien_ap,Ngan_thiet_bi,Nhom_thiet_bi&offset=${offset}&limit=${BATCH}`, { headers });
      if (!res.ok) throw new Error(`Fetch DB fail: ${res.status}`);
      const batch = await res.json();
      if (!batch.length) break;
      all.push(...batch);
      offset += BATCH;
      if (batch.length < BATCH) break;
    }
    
    return all.map(r => ({
      tram: _normTram(r.Tram),
      ten_thiet_bi: String(r.Ten_thiet_bi || '').trim(),
      loai_thiet_bi: r.Phan_loai_thiet_bi || '',
      cap_dien_ap: String(r.Cap_dien_ap || '').trim(),
      ngan_lo: r.Ngan_thiet_bi || '',
      nhom: r.Nhom_thiet_bi || '',
    }));
  }
  
  // ────────────────────────────────────────────────────────────
  // MATCH ENGINE — 3 tầng so sánh
  // ────────────────────────────────────────────────────────────
  function _runComparison(pmisData, dbData) {
    // ── Tầng 1: TỔNG HỢP (tram × loai × cấp ĐA) ──
    const tier1 = {};
    function _addT1(map, dev, src) {
      const key = `${dev.tram}|${dev.loai_thiet_bi}|${dev.cap_dien_ap}`;
      if (!map[key]) map[key] = { tram: dev.tram, loai: dev.loai_thiet_bi, cap_dien_ap: dev.cap_dien_ap, pmis: 0, db: 0, diff: 0 };
      map[key][src]++;
    }
    pmisData.forEach(d => _addT1(tier1, d, 'pmis'));
    dbData.forEach(d => _addT1(tier1, d, 'db'));
    Object.values(tier1).forEach(r => r.diff = r.pmis - r.db);
    
    // ── Tầng 2: NGĂN LỘ (tram × cấp ĐA × ngăn lộ × loại) ──
    const tier2 = {};
    function _addT2(map, dev, src) {
      const key = `${dev.tram}|${dev.cap_dien_ap}|${dev.ngan_lo}|${dev.loai_thiet_bi}`;
      if (!map[key]) map[key] = { tram: dev.tram, cap_dien_ap: dev.cap_dien_ap, ngan_lo: dev.ngan_lo, loai: dev.loai_thiet_bi, pmis: 0, db: 0 };
      map[key][src]++;
    }
    pmisData.forEach(d => _addT2(tier2, d, 'pmis'));
    dbData.forEach(d => _addT2(tier2, d, 'db'));
    
    // ── Tầng 3: ĐỊNH DANH (match từng thiết bị) ──
    const tier3 = { matched: [], unmatched_pmis: [], unmatched_db: [], conflicts: [] };
    const dbByKey = {};
    dbData.forEach((d, i) => {
      const k1 = `${d.tram}|${_normName(d.ten_thiet_bi)}|${d.loai_thiet_bi}`;
      const k2 = `${d.tram}|${_normName(d.ten_thiet_bi)}`;
      if (!dbByKey[k1]) dbByKey[k1] = [];
      dbByKey[k1].push({ ...d, _idx: i });
      if (!dbByKey[k2]) dbByKey[k2] = [];
      dbByKey[k2].push({ ...d, _idx: i });
    });
    const dbMatchedIdx = new Set();
    
    pmisData.forEach(p => {
      const k1 = `${p.tram}|${_normName(p.ten_thiet_bi)}|${p.loai_thiet_bi}`;
      const k2 = `${p.tram}|${_normName(p.ten_thiet_bi)}`;
      let match = null;
      if (dbByKey[k1]?.length) match = dbByKey[k1].find(d => !dbMatchedIdx.has(d._idx));
      if (!match && dbByKey[k2]?.length) match = dbByKey[k2].find(d => !dbMatchedIdx.has(d._idx));
      
      if (match) {
        dbMatchedIdx.add(match._idx);
        const score = _scoreMatch(p, match);
        if (score < 100) tier3.conflicts.push({ pmis: p, db: match, score });
        tier3.matched.push({ pmis: p, db: match, score });
      } else {
        tier3.unmatched_pmis.push(p); // N1: Thiếu trong DB
      }
    });
    
    dbData.forEach((d, i) => {
      if (!dbMatchedIdx.has(i)) tier3.unmatched_db.push(d); // N2: Thừa trong DB
    });
    
    // ── 7 nhóm kết quả ──
    const groups = {
      N1: tier3.unmatched_pmis,
      N2: tier3.unmatched_db,
      N3: Object.values(tier1).filter(r => r.diff !== 0),
      N4: tier3.conflicts.filter(c => !c.pmis.so_che_tao || c.pmis.so_che_tao !== (c.db.so_che_tao || '')),
      N5: tier3.conflicts.filter(c => c.pmis.hang_san_xuat && c.db.hang_san_xuat && c.pmis.hang_san_xuat.toLowerCase() !== (c.db.hang_san_xuat || '').toLowerCase()),
      N6: tier3.conflicts.filter(c => c.pmis.kieu && c.db.kieu && c.pmis.kieu.toLowerCase() !== (c.db.kieu || '').toLowerCase()),
      N7: pmisData.filter(p => !p.so_che_tao || !p.hang_san_xuat || !p.nam_san_xuat),
    };
    
    return { tier1, tier2, tier3, groups };
  }
  
  function _scoreMatch(pmis, db) {
    let score = 100;
    if (pmis.so_che_tao && db.so_che_tao && _normSerial(pmis.so_che_tao) !== _normSerial(db.so_che_tao)) score -= 30;
    if (pmis.hang_san_xuat && db.hang_san_xuat && pmis.hang_san_xuat.toLowerCase() !== db.hang_san_xuat.toLowerCase()) score -= 20;
    if (pmis.kieu && db.kieu && pmis.kieu.toLowerCase() !== db.kieu.toLowerCase()) score -= 15;
    return Math.max(0, score);
  }
  
  // ────────────────────────────────────────────────────────────
  // STATS
  // ────────────────────────────────────────────────────────────
  function _computeStats(data) {
    const trams = new Set();
    const byType = {};
    const byVoltage = {};
    data.forEach(d => {
      trams.add(d.tram);
      byType[d.loai_thiet_bi] = (byType[d.loai_thiet_bi] || 0) + 1;
      if (d.cap_dien_ap) byVoltage[d.cap_dien_ap] = (byVoltage[d.cap_dien_ap] || 0) + 1;
    });
    return { total: data.length, trams: trams.size, byType, byVoltage };
  }
  
  // ────────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────────
  window._pmisCompareState = _state;
  window._pmisCompareRun = async function(file, onProgress) {
    _state.parsing = true;
    _state.fileName = file.name;
    try {
      // Parse PMIS file
      const parseResult = await _parsePmisFile(file, onProgress);
      _state.pmisData = parseResult.devices;
      _state.pmisStats = _computeStats(parseResult.devices);
      
      if (onProgress) onProgress(`Đã parse ${parseResult.devices.length} thiết bị PMIS`);
      
      // Fetch DB data
      _state.dbData = await _fetchDbData(onProgress);
      _state.dbStats = _computeStats(_state.dbData);
      
      if (onProgress) onProgress(`Đã tải ${_state.dbData.length} thiết bị DB. Đang so sánh...`);
      
      // Run comparison
      _state.matchResults = _runComparison(_state.pmisData, _state.dbData);
      
      if (onProgress) onProgress('Hoàn thành!');
      _state.parsing = false;
      return _state;
    } catch (err) {
      _state.parsing = false;
      throw err;
    }
  };
  
  // Util exports
  window._pmisCompareUtils = {
    normTram: _normTram,
    normName: _normName,
    normVoltage: _normVoltage,
    SHEET_TO_TYPE,
    RESULT_GROUPS,
  };
  
  console.log('[PMIS Compare] Module loaded');
})();
