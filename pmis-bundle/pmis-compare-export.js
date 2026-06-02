// ════════════════════════════════════════════════════════════════
// PMIS COMPARE EXPORT — Export Excel báo cáo 13 sheet
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._pmisExportLoaded) return;
  window._pmisExportLoaded = true;
  
  window._pmisExportExcel = async function() {
    if (!window.XLSX) {
      alert('Đang tải thư viện Excel...');
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    
    const state = window._pmisCompareState;
    if (!state || !state.matchResults) {
      alert('Chưa có dữ liệu so sánh');
      return;
    }
    
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const { pmisStats, dbStats, matchResults, fileName } = state;
    const groups = matchResults.groups;
    
    // ── Sheet 1: Dashboard ──
    const dashboardRows = [
      ['BÁO CÁO SO SÁNH PMIS vs DASHBOARD'],
      ['File PMIS', fileName],
      ['Ngày export', new Date().toLocaleString('vi-VN')],
      [],
      ['CHỈ TIÊU', 'PMIS', 'Dashboard', 'Chênh lệch'],
      ['Tổng thiết bị', pmisStats.total, dbStats.total, pmisStats.total - dbStats.total],
      ['Số trạm', pmisStats.trams, dbStats.trams, pmisStats.trams - dbStats.trams],
      [],
      ['NHÓM SAI KHÁC', 'SỐ LƯỢNG'],
      ['N1: Thiếu trong DB', groups.N1.length],
      ['N2: Thừa trong DB', groups.N2.length],
      ['N3: Lệch số lượng (cấp trạm + loại)', groups.N3.length],
      ['N4: Lệch serial', groups.N4.length],
      ['N5: Lệch hãng SX', groups.N5.length],
      ['N6: Lệch kiểu/model', groups.N6.length],
      ['N7: Thiếu thông tin', groups.N7.length],
      [],
      ['MATCH SCORE'],
      ['Khớp được', matchResults.tier3.matched.length],
      ['Conflict (matched nhưng khác chi tiết)', matchResults.tier3.conflicts.length],
      ['Match rate (%)', ((matchResults.tier3.matched.length / pmisStats.total) * 100).toFixed(2)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(dashboardRows);
    ws1['!cols'] = [{wch:40},{wch:15},{wch:15},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Dashboard');
    
    // ── Sheet 2: DM_Tram ──
    const trams = new Set([...state.pmisData.map(d=>d.tram), ...state.dbData.map(d=>d.tram)]);
    const tramRows = [['Trạm', 'Có trong PMIS', 'Có trong DB', 'TB PMIS', 'TB DB', 'Chênh lệch']];
    [...trams].sort().forEach(t => {
      const pmisCount = state.pmisData.filter(d => d.tram === t).length;
      const dbCount = state.dbData.filter(d => d.tram === t).length;
      tramRows.push([t, pmisCount > 0 ? 'Có' : '-', dbCount > 0 ? 'Có' : '-', pmisCount, dbCount, pmisCount - dbCount]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(tramRows);
    ws2['!cols'] = [{wch:15},{wch:15},{wch:15},{wch:12},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, 'DM_Tram');
    
    // ── Sheet 3: Tong_hop_theo_tram ──
    const tramAgg = {};
    state.pmisData.forEach(d => { tramAgg[d.tram] = tramAgg[d.tram] || {pmis:0,db:0}; tramAgg[d.tram].pmis++; });
    state.dbData.forEach(d => { tramAgg[d.tram] = tramAgg[d.tram] || {pmis:0,db:0}; tramAgg[d.tram].db++; });
    const ws3rows = [['Trạm', 'PMIS', 'DB', 'Chênh lệch', 'Mức ưu tiên']];
    Object.entries(tramAgg).sort((a,b) => Math.abs(b[1].pmis - b[1].db) - Math.abs(a[1].pmis - a[1].db)).forEach(([t, c]) => {
      const diff = c.pmis - c.db;
      const priority = Math.abs(diff) > 50 ? 'CAO' : Math.abs(diff) > 10 ? 'TRUNG BÌNH' : 'THẤP';
      ws3rows.push([t, c.pmis, c.db, diff, priority]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws3rows), 'Tong_hop_theo_tram');
    
    // ── Sheet 4: Tong_hop_theo_loai_TB ──
    const allTypes = new Set([...Object.keys(pmisStats.byType), ...Object.keys(dbStats.byType)]);
    const ws4rows = [['Loại thiết bị', 'PMIS', 'DB', 'Chênh lệch']];
    [...allTypes].sort().forEach(t => {
      ws4rows.push([t, pmisStats.byType[t] || 0, dbStats.byType[t] || 0, (pmisStats.byType[t] || 0) - (dbStats.byType[t] || 0)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws4rows), 'Tong_hop_theo_loai_TB');
    
    // ── Sheet 5: So_sanh_tram_loai_capdienap ──
    const ws5rows = [['Trạm', 'Loại', 'Cấp điện áp', 'PMIS', 'DB', 'Chênh lệch']];
    Object.values(matchResults.tier1).sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)).forEach(r => {
      ws5rows.push([r.tram, r.loai, r.cap_dien_ap, r.pmis, r.db, r.diff]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws5rows), 'So_sanh_tram_loai_capdienap');
    
    // ── Sheet 6: So_sanh_ngan_lo ──
    const ws6rows = [['Trạm', 'Cấp ĐA', 'Ngăn lộ', 'Loại', 'PMIS', 'DB', 'Chênh lệch']];
    Object.values(matchResults.tier2).filter(r => r.pmis !== r.db).sort((a,b) => Math.abs(b.pmis-b.db) - Math.abs(a.pmis-a.db)).slice(0, 5000).forEach(r => {
      ws6rows.push([r.tram, r.cap_dien_ap, r.ngan_lo, r.loai, r.pmis, r.db, r.pmis - r.db]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws6rows), 'So_sanh_ngan_lo');
    
    // ── Sheet 7: So_sanh_serial ──
    const ws7rows = [['Trạm', 'Tên TB', 'Loại', 'PMIS Serial', 'DB Serial', 'Match score']];
    groups.N4.slice(0, 5000).forEach(c => {
      ws7rows.push([c.pmis.tram, c.pmis.ten_thiet_bi, c.pmis.loai_thiet_bi, c.pmis.so_che_tao||'', c.db.so_che_tao||'', c.score]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws7rows), 'So_sanh_serial');
    
    // ── Sheet 8: So_sanh_hang_model ──
    const ws8rows = [['Trạm', 'Tên TB', 'Loại', 'PMIS Hãng', 'DB Hãng', 'PMIS Kiểu', 'DB Kiểu']];
    const hangModelDiffs = [...groups.N5, ...groups.N6].slice(0, 5000);
    hangModelDiffs.forEach(c => {
      ws8rows.push([c.pmis.tram, c.pmis.ten_thiet_bi, c.pmis.loai_thiet_bi, c.pmis.hang_san_xuat||'', c.db.hang_san_xuat||'', c.pmis.kieu||'', c.db.kieu||'']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws8rows), 'So_sanh_hang_model');
    
    // ── Sheet 9: Thiet_bi_PMIS_chua_co_TNDK ──
    const ws9rows = [['Trạm', 'Ngăn lộ', 'Tên TB', 'Loại', 'Cấp ĐA', 'Serial', 'Hãng', 'Năm SX', 'Kiểu']];
    groups.N1.slice(0, 10000).forEach(d => {
      ws9rows.push([d.tram, d.ngan_lo||'', d.ten_thiet_bi, d.loai_thiet_bi, d.cap_dien_ap, d.so_che_tao||'', d.hang_san_xuat||'', d.nam_san_xuat||'', d.kieu||'']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws9rows), 'PMIS_chua_co_DB');
    
    // ── Sheet 10: Thiet_bi_TNDK_chua_co_PMIS ──
    const ws10rows = [['Trạm', 'Ngăn lộ', 'Tên TB', 'Loại', 'Cấp ĐA']];
    groups.N2.slice(0, 10000).forEach(d => {
      ws10rows.push([d.tram, d.ngan_lo||'', d.ten_thiet_bi, d.loai_thiet_bi, d.cap_dien_ap]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws10rows), 'DB_chua_co_PMIS');
    
    // ── Sheet 11: Du_lieu_thieu_thong_tin ──
    const ws11rows = [['Trạm', 'Tên TB', 'Loại', 'Thiếu Serial?', 'Thiếu Hãng?', 'Thiếu Năm SX?']];
    groups.N7.slice(0, 10000).forEach(d => {
      ws11rows.push([d.tram, d.ten_thiet_bi, d.loai_thiet_bi, !d.so_che_tao ? 'X' : '', !d.hang_san_xuat ? 'X' : '', !d.nam_san_xuat ? 'X' : '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws11rows), 'Thieu_thong_tin');
    
    // ── Sheet 12: Bang_quy_doi_loai_TB ──
    const map = window._pmisCompareUtils.SHEET_TO_TYPE;
    const ws12rows = [['Sheet PMIS', 'Loại DB']];
    Object.entries(map).forEach(([k,v]) => ws12rows.push([k, v]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws12rows), 'Bang_quy_doi_loai_TB');
    
    // ── Sheet 13: Bang_chuan_hoa_hang ──
    const hangs = new Set();
    state.pmisData.forEach(d => { if (d.hang_san_xuat) hangs.add(d.hang_san_xuat); });
    state.dbData.forEach(d => { if (d.hang_san_xuat) hangs.add(d.hang_san_xuat); });
    const ws13rows = [['Hãng (raw)', 'Hãng chuẩn hóa (gợi ý)']];
    [...hangs].sort().forEach(h => ws13rows.push([h, h.replace(/Group|Inc|Ltd|Co.|\(.*?\)/gi,'').trim()]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws13rows), 'Bang_chuan_hoa_hang');
    
    // Write
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `BaoCao_SoSanh_PMIS_DB_${dateStr}.xlsx`);
  };
  
  console.log('[PMIS Export] Module loaded');
})();
