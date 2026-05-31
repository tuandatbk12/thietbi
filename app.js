/* ════════════════════════════════════════════════════════════════
   EVNHANOI Dashboard — app.js
   Tách từ index.html để tận dụng browser cache.
   Đồng bộ giữa 2 file đã được loại bỏ — chỉ còn file này là nguồn.
════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
/* ════════════════════════════════════════════════════════════════
   PHẦN 1 - LAYOUT EDITOR & DASHBOARD
════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   DOM CACHE — Tối ưu #4
   Cache references để tránh gọi getElementById lặp đi lặp lại.
   Truy cập: $('tbPageOverlay') thay vì document.getElementById('tbPageOverlay')
   Tự động cache lazy lần đầu, re-fetch nếu DOM đã thay đổi.
════════════════════════════════════════════════════════════════ */
const _domCache = new Map();
function $(id) {
  let el = _domCache.get(id);
  // Kiểm tra el còn trong DOM không (có thể đã bị remove)
  if (el && !document.body.contains(el)) {
    _domCache.delete(id);
    el = null;
  }
  if (!el) {
    el = document.getElementById(id);
    if (el) _domCache.set(id, el);
  }
  return el;
}
// Xóa cache khi cần force refresh (vd: sau khi re-render layout)
function $clear(id) {
  if (id) _domCache.delete(id);
  else _domCache.clear();
}
window.$dom = $;  // expose cho debug

/* ════════════════════════════════════════════════════════════════
   DEBOUNCE HELPER — Tối ưu #3
════════════════════════════════════════════════════════════════ */
function debounce(fn, wait = 250) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ════════════════════════════════════════════════════════════════
   DATA MODEL
════════════════════════════════════════════════════════════════ */
const DEFS = {
  filter: {
    label: 'Bộ lọc', badgeClass: 'badge-filter', badgeText: 'FILTER',
    dotColor: '#ffd740', headerColor: '#ffd740', icon: 'fas fa-filter', id: 'filterPanel',
    defaultProps: { visible: true, sticky: true, bgColor: '#111720', borderRadius: 8, padding: 12 }
  },
  stats: {
    label: 'Thông tin chung', badgeClass: 'badge-stats', badgeText: 'STATS',
    dotColor: '#00e676', headerColor: '#00e676', icon: 'fas fa-chart-bar', id: 'statsGrid',
    defaultProps: {
      visible: true, sticky: false, bgColor: '#111720', borderRadius: 8, padding: 12, columns: 4, layoutStyle: 'tech-stack-3x3',
      cards: [
        { icon: '🏢', label: 'Tổng số TBA',           value: '—',    color: '#00e676' },
        { icon: '🏗', label: 'TBA 220kV',              value: '—',    color: '#ff9100', ratio: true, ratioValue: '—' },
        { icon: '⚡', label: 'TBA 110kV',              value: '—',    color: '#ff4081', ratio: true, ratioValue: '—' },
        { icon: '🏗', label: 'Công nghệ thiết bị TBA', value: '',     color: '#40c4ff',
          chartType: 'tech',
          tech220: { AIS: 0, GIS: 0, HGIS: 0, HGIS_AIS: 0 },
          tech110: { AIS: 0, GIS: 0, HGIS: 0, HGIS_AIS: 0 },
          tech22:  { GIS: 0, KCK: 0, GIS_KCK: 0 }
        },
        { icon: '🔌', label: 'Tổng số thiết bị',       value: '—',    color: '#00c8ff' },
        { icon: '⚡', label: 'Tổng công suất',          value: '—',    color: '#18ffff' },
        { icon: '▦',  label: 'Tổng số ngăn',           value: '—',    color: '#b388ff' },
        { icon: '↗',  label: 'Ngăn đường dây',         value: '—',    color: '#69ff47' },
        { icon: '🔧', label: 'MBA',                value: '—',    color: '#ffd740' },
        { icon: '↗',  label: 'Ngăn xuất tuyến',        value: '—',    color: '#ff4081' },
        { icon: '⇄',  label: 'Ngăn liên lạc (LL)',     value: '—',    color: '#18ffff' },
        { icon: '🔋', label: 'Ngăn tụ bù (TBN)',       value: '—',    color: '#00e676' },
        { icon: '🔌', label: 'Ngăn tự dùng (TD)',      value: '—',    color: '#ff9100' },
        { icon: '🧲', label: 'Ngăn kháng',              value: '—',    color: '#b388ff' },
      ]
    }
  },
  chips: {
    label: 'Danh sách thiết bị', badgeClass: 'badge-chips', badgeText: 'CHIPS',
    dotColor: '#b388ff', headerColor: '#b388ff', icon: 'fas fa-tags', id: 'deviceByType',
    defaultProps: { visible: true, sticky: false, bgColor: '#111720', borderRadius: 8, padding: 12 }
  },
  charts: {
    label: 'Số lượng thiết bị theo trạm', badgeClass: 'badge-charts', badgeText: 'CHARTS',
    dotColor: '#00c8ff', headerColor: '#00c8ff', icon: 'fas fa-chart-pie', id: 'chartsRow',
    defaultProps: { visible: true, sticky: false, bgColor: '#111720', borderRadius: 8, padding: 12, layout: '50/50' }
  },
  timeline: {
    label: 'Năm vận hành', badgeClass: 'badge-timeline', badgeText: 'TIMELINE',
    dotColor: '#18ffff', headerColor: '#18ffff', icon: 'fas fa-stream', id: 'chartTN',
    defaultProps: { visible: true, sticky: false, bgColor: '#111720', borderRadius: 8, padding: 12, months: 24 }
  },
  table: {
    label: 'Danh sách thiết bị', badgeClass: 'badge-table', badgeText: 'TABLE',
    dotColor: '#ff5252', headerColor: '#ff5252', icon: 'fas fa-table', id: 'tbody',
    defaultProps: { visible: true, sticky: false, bgColor: '#111720', borderRadius: 8, padding: 12, rowsPerPage: 20, exportBtn: true }
  }
};

const IC_COLORS = ['#00e676','#00c8ff','#b388ff','#ff5252','#ffd740','#18ffff','#ff9100','#ff4081','#69ff47','#40c4ff'];

const SAVED_LAYOUT = [
  {
    "type": "stats",
    "id": "statsGrid",
    "props": {
      "visible": true,
      "sticky": false,
      "bgColor": "#111720",
      "borderRadius": 10,
      "padding": 14,
      "columns": 4,
      "layoutStyle": "tech-stack-3x3",
      "cards": [
        {
          "icon": "🏢",
          "label": "Tổng số TBA",
          "value": "—",
          "color": "#00e676"
        },
        {
          "icon": "🏗",
          "label": "TBA 220kV",
          "value": "—",
          "color": "#ff9100",
          "ratio": true,
          "ratioValue": "—"
        },
        {
          "icon": "⚡",
          "label": "TBA 110kV",
          "value": "—",
          "color": "#ff4081",
          "ratio": true,
          "ratioValue": "—"
        },
        {
          "icon": "🏗",
          "label": "Công nghệ thiết bị TBA",
          "value": "",
          "color": "#40c4ff",
          "chartType": "tech",
          "tech220": {
            "AIS": 0,
            "GIS": 0,
            "HGIS": 0,
            "HGIS_AIS": 0
          },
          "tech110": {
            "AIS": 0,
            "GIS": 0,
            "HGIS": 0,
            "HGIS_AIS": 0
          },
          "tech22": {
            "GIS": 0,
            "KCK": 0,
            "GIS_KCK": 0
          }
        },
        {
          "icon": "🔌",
          "label": "Tổng số thiết bị",
          "value": "—",
          "color": "#00c8ff"
        },
        {
          "icon": "⚡",
          "label": "Tổng công suất",
          "value": "—",
          "color": "#18ffff"
        },
        {
          "icon": "▦",
          "label": "Tổng số ngăn",
          "value": "—",
          "color": "#b388ff"
        },
        {
          "icon": "↗",
          "label": "Ngăn đường dây",
          "value": "—",
          "color": "#69ff47"
        },
        {
          "icon": "🔧",
          "label": "MBA",
          "value": "—",
          "color": "#ffd740"
        },
        {
          "icon": "↗",
          "label": "Ngăn xuất tuyến",
          "value": "—",
          "color": "#ff4081"
        },
        {
          "icon": "⇄",
          "label": "Ngăn liên lạc (LL)",
          "value": "—",
          "color": "#18ffff"
        },
        {
          "icon": "🔋",
          "label": "Ngăn tụ bù (TBN)",
          "value": "—",
          "color": "#00e676"
        },
        {
          "icon": "🔌",
          "label": "Ngăn tự dùng (TD)",
          "value": "—",
          "color": "#ff9100"
        },
        {
          "icon": "🧲",
          "label": "Ngăn kháng",
          "value": "—",
          "color": "#b388ff"
        }
      ]
    }
  },
  {
    "type": "filter",
    "id": "filterPanel",
    "props": {
      "visible": true,
      "sticky": true,
      "bgColor": "#111720",
      "borderRadius": 10,
      "padding": 14
    }
  },
  {
    "type": "chips",
    "id": "deviceByType",
    "props": {
      "visible": true,
      "sticky": false,
      "bgColor": "#111720",
      "borderRadius": 10,
      "padding": 14
    }
  },
  {
    "type": "charts",
    "id": "chartsRow",
    "props": {
      "visible": true,
      "sticky": false,
      "bgColor": "#111720",
      "borderRadius": 10,
      "padding": 14,
      "layout": "50/50"
    }
  },
  {
    "type": "timeline",
    "id": "chartTN",
    "props": {
      "visible": true,
      "sticky": false,
      "bgColor": "#111720",
      "borderRadius": 10,
      "padding": 14,
      "months": 24
    }
  }
];

function freshLayout() {
  return SAVED_LAYOUT.map(item => ({
    type: item.type,
    uid:  'uid_' + item.type,
    props: JSON.parse(JSON.stringify(item.props))
  }));
}

let layout     = freshLayout();
normalizeLayoutState();
let selectedUid = null;
let dragSrcIdx  = null;

/* ─── UNDO HISTORY ─── */
const MAX_HISTORY = 20;
let history   = [];   // stack of JSON snapshots
let isModified = false;
let layerSearchTerm = '';
let editorViewMode = 'edit';
const LAYOUT_DRAFT_KEY = 'evn_layout_editor_draft_v3';

function normalizeSearchText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normalizeStatsCardLabel(label) {
  const raw = String(label || '').trim();
  const k = normalizeSearchText(raw);
  if (k === 'tong so tba') return 'Tổng số TBA';
  if (k === 'tba 220kv') return 'TBA 220kV';
  if (k === 'tba 110kv') return 'TBA 110kV';
  if (k === 'cong nghe thiet bi tba') return 'Công nghệ thiết bị TBA';
  if (k === 'tong so thiet bi') return 'Tổng số thiết bị';
  if (k === 'tong cong suat (mva)' || k === 'tong cong suat') return 'Tổng công suất';
  if (k === 'tong so ngan') return 'Tổng số ngăn';
  if (k === 'ngan duong day') return 'Ngăn đường dây';
  if (k === 'ngan mba' || k === 'mba') return 'MBA';
  if (k === 'ngan xt' || k === 'ngan xuat tuyen' || k === 'ngan xuat tuyen (xt)') return 'Ngăn xuất tuyến';
  if (k === 'ngan lien lac (ll)' || k === 'ngan lien lac' || k === 'ngan ll') return 'Ngăn liên lạc (LL)';
  if (k === 'ngan tu bu (tbn)' || k === 'ngan tu bu' || k === 'ngan tbn') return 'Ngăn tụ bù (TBN)';
  if (k === 'ngan tu dung (td)' || k === 'ngan tu dung' || k === 'ngantd') return 'Ngăn tự dùng (TD)';
  if (k === 'ngan khang') return 'Ngăn kháng';
  return raw;
}

function normalizeStatsLayoutItem(item) {
  if (!item || item.type !== 'stats' || !item.props) return item;
  item.props.columns = 4;
  item.props.layoutStyle = 'tech-stack-3x3';
  if (!Array.isArray(item.props.cards)) return item;

  const desiredOrder = [
    'Tổng số TBA',
    'TBA 220kV',
    'TBA 110kV',
    'Công nghệ thiết bị TBA',
    'Tổng số thiết bị',
    'Tổng công suất',
    'Tổng số ngăn',
    'Ngăn đường dây',
    'MBA',
    'Ngăn xuất tuyến',
    'Ngăn liên lạc (LL)',
    'Ngăn tụ bù (TBN)',
    'Ngăn tự dùng (TD)',
    'Ngăn kháng'
  ];

  const cardsByLabel = new Map();
  const extras = [];
  item.props.cards.forEach(card => {
    const normalizedLabel = normalizeStatsCardLabel(card.label);
    card.label = normalizedLabel;
    if (normalizedLabel === 'Công nghệ thiết bị TBA') card.chartType = 'tech';
    if (!cardsByLabel.has(normalizedLabel)) cardsByLabel.set(normalizedLabel, card);
    else extras.push(card);
  });

  const reordered = [];
  desiredOrder.forEach(label => {
    if (cardsByLabel.has(label)) reordered.push(cardsByLabel.get(label));
  });
  extras.forEach(card => reordered.push(card));
  item.props.cards = reordered;
  return item;
}

function normalizeLayoutState() {
  layout = (Array.isArray(layout) ? layout : []).map(item => normalizeStatsLayoutItem(item));
}

function isTypingContext(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

function persistDraft() {
  try {
    // Loại bỏ card.value tính toán động (công suất, ngăn...) trước khi lưu draft
    // để tránh hiển thị giá trị cũ khi load lại trang
    const cleanLayout = layout.map(item => {
      if (item.type !== 'stats') return item;
      return {
        ...item,
        props: {
          ...item.props,
          cards: (item.props.cards || []).map(card => {
            // Giữ nguyên cấu trúc nhưng reset value về '—' để force recompute
            const { value: _v, ratioValue: _r, ...rest } = card;
            return { ...rest, value: '—' };
          })
        }
      };
    });
    localStorage.setItem(LAYOUT_DRAFT_KEY, JSON.stringify({ layout: cleanLayout, selectedUid, ts: Date.now() }));
  } catch (err) {
    console.warn('persistDraft failed', err);
  }
}

function clearDraft() {
  try { localStorage.removeItem(LAYOUT_DRAFT_KEY); } catch (err) {}
}

function restoreDraftIfAvailable() {
  try {
    const raw = localStorage.getItem(LAYOUT_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft || !Array.isArray(draft.layout)) return;

    // Lọc chặt: chỉ giữ item hợp lệ (không null, có type + uid + props)
    const validItems = draft.layout.filter(item =>
      item && typeof item === 'object' && item.type && item.uid && item.props
    );
    if (validItems.length === 0) {
      console.warn('[restoreDraft] Draft không có item hợp lệ — dùng fresh layout');
      clearDraft();
      return;
    }

    layout = validItems.map(item => {
      // Xóa card.value cũ của stats section — sẽ được recompute sau khi data load
      if (item.type !== 'stats') return item;
      return {
        ...item,
        props: {
          ...item.props,
          cards: (item.props.cards || []).map(card => ({ ...card, value: '—', ratioValue: undefined }))
        }
      };
    });
    normalizeLayoutState();
    selectedUid = draft.selectedUid || null;
    isModified = true;
    updateModifiedUI();
    showToast('↺ Đã khôi phục bản nháp gần nhất (' + validItems.length + ' sections)');
  } catch (err) {
    console.warn('restoreDraft failed', err);
    clearDraft();  // xoá draft hỏng, dùng fresh layout
  }
}

function filterLayers(term) {
  layerSearchTerm = String(term || '');
  const clearBtn = document.getElementById('layerSearchClear');
  if (clearBtn) clearBtn.style.opacity = layerSearchTerm ? '1' : '0.55';
  renderLayers();
}

function clearLayerSearch() {
  layerSearchTerm = '';
  const input = document.getElementById('layerSearchInput');
  if (input) input.value = '';
  renderLayers();
}

function getSelectedIndex() {
  return layout.findIndex(l => l.uid === selectedUid);
}

function selectRelativeSection(step) {
  if (!layout.length) return;
  let idx = getSelectedIndex();
  if (idx < 0) idx = step > 0 ? -1 : 1;
  idx = Math.max(0, Math.min(layout.length - 1, idx + step));
  const target = layout[idx];
  if (target) selectSection(target.uid);
}

function saveToHistory() {
  history.push(JSON.stringify(layout));
  if (history.length > MAX_HISTORY) history.shift();
  markModified();
  updateHistoryUI();
}

function undoLayout() {
  if (!history.length) return;
  layout = JSON.parse(history.pop());
  if (!history.length) { isModified = false; updateModifiedUI(); }
  render();
  updateHistoryUI();
  showToast('↩ Đã hoàn tác');
}

function markModified() {
  isModified = true;
  updateModifiedUI();
  persistDraft();
}

function updateModifiedUI() {
  document.getElementById('unsavedDot').classList.toggle('visible', isModified);
}

function updateHistoryUI() {
  const n = history.length;
  const btn  = document.getElementById('btnUndo');
  const hBtn = document.getElementById('histBtn');
  const lbl  = document.getElementById('histLabel');
  if (btn)  btn.disabled  = n === 0;
  if (hBtn) hBtn.disabled = n === 0;
  if (lbl)  lbl.textContent = n === 0 ? '0 thao tác' : `${n} thao tác`;
}

function getVisibleLayout() {
  return layout.filter(item => item && item.props && item.props.visible);
}

function analyzeLayoutUX() {
  const visibleItems = getVisibleLayout();
  const scorecard = { score: 100, strengths: [], issues: [] };
  const orderIdeal = ['filter', 'stats', 'chips', 'charts', 'timeline', 'table'];
  const stickyCount = layout.filter(item => item.props && item.props.sticky).length;
  const hiddenCount = layout.filter(item => item.props && !item.props.visible).length;
  const visibleOrder = visibleItems.map(item => item.type);
  const expectedOrder = orderIdeal.filter(type => visibleOrder.includes(type));
  const liveRows = Array.isArray(_chipAllData) ? _chipAllData.length : 0;
  const liveFiltered = Array.isArray(_chipFiltered) ? _chipFiltered.length : 0;
  const liveStations = new Set((_chipFiltered.length ? _chipFiltered : _chipAllData).map(d => (d.Tram || '').trim()).filter(Boolean)).size;
  const liveTypes = new Set((_chipFiltered.length ? _chipFiltered : _chipAllData).map(d => (d.Phan_loai_thiet_bi || '').trim()).filter(Boolean)).size;
  const isDataLoaded = liveRows > 0;

  const filterItem = layout.find(item => item.type === 'filter');
  if (!filterItem || !filterItem.props.visible) {
    scorecard.score -= 20;
    scorecard.issues.push({
      title: 'Thiếu bộ lọc ở đầu trang',
      detail: 'Người dùng vận hành cần lọc nhanh trước khi xem thống kê và bảng. Nên đặt section Bộ lọc lên đầu và luôn bật hiển thị.',
      tone: 'warn'
    });
  } else {
    scorecard.strengths.push('Bộ lọc đã hiện diện trên layout.');
    if (!filterItem.props.sticky) {
      scorecard.score -= 8;
      scorecard.issues.push({
        title: 'Bộ lọc chưa được ghim',
        detail: 'Khi cuộn sâu xuống bảng và biểu đồ, người dùng khó quay lại để chỉnh bộ lọc. Nên để Bộ lọc ở chế độ sticky.',
        tone: 'warn'
      });
    } else {
      scorecard.strengths.push('Bộ lọc đang được ghim khi cuộn.');
    }
  }

  const orderMismatch = visibleOrder.reduce((sum, type, idx) => sum + (expectedOrder[idx] === type ? 0 : 1), 0);
  if (orderMismatch > 0) {
    scorecard.score -= Math.min(14, orderMismatch * 3);
    scorecard.issues.push({
      title: 'Thứ tự section chưa tối ưu cho hành vi đọc',
      detail: 'Nên đi theo luồng: Bộ lọc → Tổng quan → Thiết bị → Biểu đồ → Timeline → Bảng chi tiết để giảm nhảy mắt.',
      tone: 'info'
    });
  } else if (visibleOrder.length) {
    scorecard.strengths.push('Luồng đọc đang đi từ tổng quan đến chi tiết.');
  }

  if (stickyCount > 1) {
    scorecard.score -= Math.min(12, (stickyCount - 1) * 5);
    scorecard.issues.push({
      title: 'Có quá nhiều section sticky',
      detail: 'Nhiều khối được ghim sẽ làm dashboard bị chiếm chiều cao và mất vùng nhìn dữ liệu.',
      tone: 'warn'
    });
  }

  if (hiddenCount > 0) {
    scorecard.score -= Math.min(10, hiddenCount * 3);
    scorecard.issues.push({
      title: 'Một số section đang bị ẩn',
      detail: 'Nếu đây là layout giao cho người dùng cuối, nên chỉ ẩn khi thật sự không dùng đến để tránh bỏ sót thông tin.',
      tone: 'info'
    });
  }

  const paddingSet = new Set(visibleItems.map(item => Number(item.props.padding || 0)));
  if (paddingSet.size > 2) {
    scorecard.score -= 6;
    scorecard.issues.push({
      title: 'Khoảng đệm giữa các khối chưa đồng nhất',
      detail: 'Padding không đồng đều làm cảm giác layout rời rạc. Nên chuẩn hóa quanh 12–14px.',
      tone: 'info'
    });
  }

  const radiusSet = new Set(visibleItems.map(item => Number(item.props.borderRadius || 0)));
  if (radiusSet.size > 2) {
    scorecard.score -= 5;
    scorecard.issues.push({
      title: 'Border radius chưa nhất quán',
      detail: 'Nên dùng cùng một ngôn ngữ bo góc để giao diện nhìn đồng bộ hơn.',
      tone: 'info'
    });
  }

  const statsItem = layout.find(item => item.type === 'stats');
  if (statsItem) {
    const cards = Array.isArray(statsItem.props.cards) ? statsItem.props.cards.length : 0;
    if (cards > 8) {
      scorecard.score -= 6;
      scorecard.issues.push({
        title: 'Khối thống kê đang khá dày',
        detail: 'Nhiều ô stats cùng lúc làm người dùng khó quét số chính. Ưu tiên 4–8 KPI quan trọng nhất ở phía trên.',
        tone: 'warn'
      });
    }
    if (Number(statsItem.props.columns || 0) > 4) {
      scorecard.score -= 5;
      scorecard.issues.push({
        title: 'Stats đang chia quá nhiều cột',
        detail: '5 cột trở lên làm chữ và số hẹp trên màn hình phổ biến. 4 cột thường dễ đọc hơn.',
        tone: 'info'
      });
    } else {
      scorecard.strengths.push('Khối stats giữ độ rộng ô vừa phải.');
    }
  }

  const chartsItem = layout.find(item => item.type === 'charts');
  if (chartsItem && chartsItem.props.layout !== '50/50') {
    scorecard.score -= 4;
    scorecard.issues.push({
      title: 'Bố cục chart chưa cân bằng',
      detail: 'Biểu đồ so sánh theo trạm và theo loại thiết bị nên chia 50/50 để người dùng quét ngang thuận hơn.',
      tone: 'info'
    });
  }

  const tableItem = layout.find(item => item.type === 'table');
  if (tableItem) {
    const rows = Number(tableItem.props.rowsPerPage || 20);
    if (rows < 10 || rows > 25) {
      scorecard.score -= 4;
      scorecard.issues.push({
        title: 'Số dòng mặc định của bảng chưa cân bằng',
        detail: 'Dưới 10 dòng làm mất ngữ cảnh, trên 25 dòng làm bảng quá dài. Khoảng 20 dòng là mức dễ theo dõi hơn.',
        tone: 'info'
      });
    }
  }

  if (isDataLoaded) {
    scorecard.strengths.push(`Đang chấm trên dữ liệu thực: ${liveFiltered.toLocaleString('vi-VN')}/${liveRows.toLocaleString('vi-VN')} dòng, ${liveStations.toLocaleString('vi-VN')} trạm.`);
    const filterActive = _chipFiltered.length && _chipFiltered.length < _chipAllData.length;
    if (filterActive) {
      scorecard.strengths.push('Điểm UX đã phản ánh đúng ngữ cảnh lọc hiện tại.');
    }
    if (liveStations > 60 && chartsItem?.props?.visible) {
      scorecard.score -= 8;
      scorecard.issues.push({
        title: 'Dữ liệu chart đang dày',
        detail: `Đang có ${liveStations.toLocaleString('vi-VN')} trạm hiển thị. Nên dùng xem nhanh, top list hoặc mở heatmap khi thật sự cần.`,
        tone: 'warn'
      });
    }
    if (liveTypes > 18 && layout.find(item => item.type === 'chips')?.props?.visible) {
      scorecard.score -= 5;
      scorecard.issues.push({
        title: 'Danh sách loại thiết bị khá nhiều',
        detail: `Có ${liveTypes.toLocaleString('vi-VN')} phân loại thiết bị. Nên ưu tiên chip đang hoạt động hoặc nhóm theo cấp điện áp để giảm tải quét mắt.`,
        tone: 'info'
      });
    }
    if (liveFiltered === 0) {
      scorecard.score -= 10;
      scorecard.issues.push({
        title: 'Layout hiện không có dữ liệu sau lọc',
        detail: 'Điểm UX giảm vì người dùng sẽ nhìn thấy trạng thái rỗng. Cần kiểm tra lại bộ lọc hoặc thêm gợi ý xóa lọc.',
        tone: 'warn'
      });
    }
  } else {
    scorecard.issues.push({
      title: 'Chưa có dữ liệu thực để chấm sâu',
      detail: 'Điểm hiện tại mới dựa trên cấu hình layout. Khi dữ liệu tải xong, điểm sẽ phản ánh sát thực tế hơn.',
      tone: 'info'
    });
    scorecard.score -= 4;
  }

  if (!scorecard.issues.length) {
    scorecard.strengths.push('Layout đang khá sạch và có thể giao thử nghiệm cho người dùng cuối.');
  }

  scorecard.score = Math.max(52, Math.min(100, Math.round(scorecard.score)));
  scorecard.visibleCount = visibleItems.length;
  scorecard.hiddenCount = hiddenCount;
  scorecard.stickyCount = stickyCount;
  scorecard.dataRows = liveRows;
  scorecard.dataRowsFiltered = liveFiltered;
  scorecard.stationCount = liveStations;
  return scorecard;
}

function renderUXAudit() {
  const box = document.getElementById('uxAuditPanel');
  const badge = document.getElementById('uxScoreBadge');
  if (!box || !badge) return;
  const audit = analyzeLayoutUX();
  const tone = audit.score >= 88 ? 'good' : audit.score >= 74 ? 'warn' : 'bad';
  badge.className = 'ux-score-chip ' + tone;
  badge.innerHTML = `<i class="fas fa-sparkles"></i> UX ${audit.score}/100`;

  const issueHtml = (audit.issues.length ? audit.issues.slice(0, 4) : [{
    title: 'Không phát hiện vấn đề lớn',
    detail: 'Bản layout hiện tại đã đi đúng mạch lọc → tổng quan → chi tiết. Bạn có thể chuyển sang Xem trước để kiểm thử nhanh.',
    tone: 'info'
  }]).map(item => `
    <div class="ux-issue-item ${item.tone || 'info'}">
      <strong>${item.title}</strong>
      <span>${item.detail}</span>
    </div>
  `).join('');

  const pillHtml = [
    ...audit.strengths.slice(0, 2).map(text => `<span class="ux-pill good"><i class="fas fa-check"></i>${text}</span>`),
    ...audit.issues.slice(0, 2).map(text => `<span class="ux-pill warn"><i class="fas fa-triangle-exclamation"></i>${text.title}</span>`)
  ].join('');

  box.innerHTML = `
    <div class="ux-score-card">
      <div class="ux-score-head">
        <span class="ux-score-label">Đánh giá hiện tại</span>
        <span class="ux-score-value">${audit.score}</span>
      </div>
      <div class="ux-score-meta">Tự động chấm theo cấu trúc layout và dữ liệu thực đang tải: mật độ trạm, trạng thái lọc và mức dễ quét của dashboard.</div>
      <div class="ux-mini-metrics">
        <div class="ux-mini-metric">
          <span class="lbl">Đang hiển thị</span>
          <span class="val">${audit.visibleCount}</span>
        </div>
        <div class="ux-mini-metric">
          <span class="lbl">Đang ẩn</span>
          <span class="val">${audit.hiddenCount}</span>
        </div>
        <div class="ux-mini-metric">
          <span class="lbl">Sticky</span>
          <span class="val">${audit.stickyCount}</span>
        </div>
        <div class="ux-mini-metric">
          <span class="lbl">Dòng dữ liệu</span>
          <span class="val">${(audit.dataRowsFiltered || audit.dataRows || 0).toLocaleString('vi-VN')}</span>
        </div>
      </div>
    </div>
    <div class="ux-review-card">
      <div class="ux-review-head">
        <span class="ux-review-title">Nhận xét & gợi ý áp dụng ngay</span>
        <button class="btn btn-primary" type="button" onclick="autoOptimizeLayout()"><i class="fas fa-wand-magic-sparkles"></i> Tối ưu</button>
      </div>
      <div class="ux-pill-row">${pillHtml}</div>
      <div class="ux-issue-list">${issueHtml}</div>
    </div>
  `;
}

function setViewMode(mode) {
  editorViewMode = mode === 'preview' ? 'preview' : 'edit';
  document.body.classList.toggle('preview-mode', editorViewMode === 'preview');
  const editBtn = document.getElementById('viewEditBtn');
  const previewBtn = document.getElementById('viewPreviewBtn');
  const topBtn = document.getElementById('btnPreviewTop');
  if (editBtn) editBtn.classList.toggle('active', editorViewMode === 'edit');
  if (previewBtn) previewBtn.classList.toggle('active', editorViewMode === 'preview');
  if (topBtn) {
    topBtn.innerHTML = editorViewMode === 'preview'
      ? '<i class="fas fa-pen-ruler"></i> Quay lại chỉnh sửa'
      : '<i class="fas fa-expand"></i> Xem trước';
  }
}

function togglePreviewMode() {
  setViewMode(editorViewMode === 'preview' ? 'edit' : 'preview');
}

function toggleLightMode() {
  const isLight = document.body.classList.toggle('light-mode');
  const btn = document.getElementById('btnLightMode');
  if (btn) {
    btn.innerHTML = isLight
      ? '<i class="fas fa-moon"></i> Chế độ tối'
      : '<i class="fas fa-sun"></i> Chế độ sáng';
  }
  try { localStorage.setItem('evn_light_mode', isLight ? '1' : '0'); } catch(_) {}
}

function commitLayoutState(options = {}) {
  const { clearHistory = true } = options;
  isModified = false;
  if (clearHistory) history = [];
  updateModifiedUI();
  updateHistoryUI();
  clearDraft();
}

function autoOptimizeLayout(options = {}) {
  const { silent = false, skipHistory = false, autoApply = true } = options;
  if (!skipHistory) saveToHistory();
  const orderedTypes = ['filter', 'stats', 'chips', 'charts', 'timeline', 'table'];
  const oldLayout = layout.slice();
  layout = orderedTypes.map((type, idx) => {
    const def = DEFS[type];
    const found = oldLayout.find(item => item.type === type);
    const base = found ? JSON.parse(JSON.stringify(found)) : { type, uid: 'uid_' + type + '_' + Date.now() + '_' + idx, props: JSON.parse(JSON.stringify(def.defaultProps)) };
    base.type = type;
    base.props = Object.assign({}, JSON.parse(JSON.stringify(def.defaultProps)), base.props || {});
    base.props.visible = true;
    base.props.sticky = type === 'filter';
    base.props.bgColor = '#111720';
    base.props.borderRadius = 10;
    base.props.padding = type === 'table' ? 12 : 14;
    if (type === 'stats') base.props.columns = 4;
    if (type === 'charts') base.props.layout = '50/50';
    if (type === 'timeline') base.props.months = 24;
    if (type === 'table') {
      base.props.rowsPerPage = 20;
      base.props.exportBtn = true;
    }
    return base;
  });
  selectedUid = layout[0] ? layout[0].uid : null;
  clearLayerSearch();
  render();
  switchRTab('props');
  document.getElementById('propsContent').scrollTop = 0;
  if (autoApply) commitLayoutState({ clearHistory: false });
  if (!silent) showToast(autoApply ? '✨ Đã tối ưu và áp dụng layout ngay' : '✨ Đã chuẩn hóa layout cho người dùng cuối');
}

function getPropsEmptyHTML() {
  const audit = analyzeLayoutUX();
  const bullets = (audit.issues.length ? audit.issues.slice(0, 3) : [{ title: 'Layout hiện tại đã khá gọn gàng.' }])
    .map(item => `<div class="ux-issue-item ${item.tone || 'info'}"><strong>${item.title}</strong><span>${item.detail || 'Bạn có thể chọn một section để tinh chỉnh sâu hơn.'}</span></div>`)
    .join('');
  return `<div class="props-empty"><i class="fas fa-mouse-pointer"></i><div>Chọn một section để chỉnh chi tiết<br>hoặc áp preset tối ưu nhanh</div><div class="props-empty-actions"><button class="btn btn-primary" onclick="autoOptimizeLayout()"><i class="fas fa-wand-magic-sparkles"></i> Tối ưu toàn layout</button><button class="btn" onclick="selectSection(layout[0]?.uid)"><i class="fas fa-sliders-h"></i> Chọn section đầu tiên</button></div></div><div class="props-section"><div class="props-section-title"><i class="fas fa-magnifying-glass-chart"></i>Đánh giá nhanh</div>${bullets}</div>`;
}

function updateStatusBar() {
  const total   = layout.length;
  const visible = layout.filter(l => l.props.visible).length;
  const hidden  = total - visible;
  const sticky  = layout.filter(l => l.props.sticky).length;
  document.getElementById('sb-count').textContent   = total;
  document.getElementById('sb-visible').textContent = visible;
  document.getElementById('sb-hidden').textContent  = hidden;
  document.getElementById('sb-sticky').textContent  = sticky;
  document.getElementById('layerCount').textContent = total;

  const selItem = document.getElementById('sb-selected-item');
  const selName = document.getElementById('sb-selected-name');
  if (selectedUid) {
    const item = layout.find(l => l.uid === selectedUid);
    selItem.style.display = 'flex';
    selName.textContent = item ? DEFS[item.type].label : '—';
  } else {
    selItem.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════ */
function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
tickClock();
setInterval(tickClock, 1000);

/* ═══════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════ */
function render() {
  renderCanvas();
  renderQuickNav();
  renderLayers();
  renderProps();
  updateStatusBar();
  renderUXAudit();
  setViewMode(editorViewMode);
  // Re-render live chips + charts nếu data đã có
  if (_chipAllData.length > 0) {
    setTimeout(() => { renderChipsSection(); renderChartsSection(); renderTimelineSection(); renderLiveFilterSection(); }, 50);
  }
}

let _canvasRenderRAF = 0;
let _canvasNeedsFull = false;
const _canvasDirtyUids = new Set();

function scheduleCanvasRender(uid = null) {
  if (uid) _canvasDirtyUids.add(uid);
  else _canvasNeedsFull = true;
  if (_canvasRenderRAF) return;
  _canvasRenderRAF = requestAnimationFrame(() => {
    _canvasRenderRAF = 0;
    if (_canvasNeedsFull) {
      renderCanvas();
      renderQuickNav();
      setupQuickNavObserver();
      // Full rebuild — restore live sections từ cache ngay lập tức
      if (_chipAllData.length > 0) {
        requestAnimationFrame(() => { renderChipsSection(); renderChartsSection(); renderTimelineSection(); renderLiveFilterSection(); });
      }
    } else if (_canvasDirtyUids.size) {
      // replaceCanvasSection đã xử lý charts/chips thông minh (không rebuild)
      [..._canvasDirtyUids].forEach(replaceCanvasSection);
    }
    _canvasNeedsFull = false;
    _canvasDirtyUids.clear();
  });
}

function renderQuickNav() {
  const host = document.getElementById('canvasQuickNav');
  if (!host) return;
  host.innerHTML = layout.map((item, idx) => {
    const def = DEFS[item.type];
    if (!def) return '';
    return `<button type="button" data-uid="${item.uid}" class="quick-nav-item ${selectedUid === item.uid ? 'active' : ''}" onclick="jumpToSection('${item.uid}')"><span class="idx">${idx+1}</span>${def.label}</button>`;
  }).join('');
}

function getCanvasScrollHost() {
  return document.getElementById('canvasArea') || document.querySelector('.canvas-area') || document.scrollingElement || document.documentElement;
}

function getCanvasStickyOffset() {
  const header = document.querySelector('.canvas-header');
  const audit = document.getElementById('uxAuditPanel');
  const quick = document.getElementById('canvasQuickNav');
  const pieces = [header, audit, quick].filter(Boolean);
  return pieces.reduce((sum, el) => {
    const styles = window.getComputedStyle(el);
    const mt = parseFloat(styles.marginTop) || 0;
    const mb = parseFloat(styles.marginBottom) || 0;
    return sum + el.offsetHeight + mt + mb;
  }, 12);
}

function scrollSectionIntoCanvasView(uid, behavior = 'smooth', attempt = 0) {
  const host = getCanvasScrollHost();
  const el = document.querySelector(`.section-wrapper[data-uid="${uid}"]`);
  if (!host || !el) {
    if (attempt < 8) requestAnimationFrame(() => scrollSectionIntoCanvasView(uid, behavior, attempt + 1));
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const targetRect = el.getBoundingClientRect();
  const stickyOffset = getCanvasStickyOffset();
  const nextTop = host.scrollTop + (targetRect.top - hostRect.top) - stickyOffset;

  host.scrollTo({
    top: Math.max(0, Math.round(nextTop)),
    behavior
  });
}

function jumpToSection(uid) {
  if (!uid) return;
  // Highlight nav button active
  document.querySelectorAll('.quick-nav-item[data-uid]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.uid === uid);
  });
  // Chỉ scroll — không gọi selectSection (tránh re-render / reload data)
  requestAnimationFrame(() => scrollSectionIntoCanvasView(uid, 'smooth'));
}

let _quickNavObserver = null;
let _quickNavVisibleUid = null;

function updateQuickNavVisible(uid) {
  _quickNavVisibleUid = uid || null;
  document.querySelectorAll('.quick-nav-item[data-uid]').forEach(btn => {
    btn.classList.toggle('in-view', !!uid && btn.dataset.uid === uid);
  });
}

function setupQuickNavObserver() {
  const root = getCanvasScrollHost();
  if (!root) return;
  if (_quickNavObserver) _quickNavObserver.disconnect();
  const seen = new Map();
  _quickNavObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const uid = entry.target?.dataset?.uid;
      if (!uid) return;
      seen.set(uid, entry.isIntersecting ? entry.intersectionRatio : 0);
    });
    let bestUid = selectedUid || null;
    let bestRatio = 0;
    seen.forEach((ratio, uid) => {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestUid = uid;
      }
    });
    if (bestUid) updateQuickNavVisible(bestUid);
  }, { threshold: [0.2, 0.35, 0.55], root });
  document.querySelectorAll('.section-wrapper[data-uid]').forEach(el => _quickNavObserver.observe(el));
  updateQuickNavVisible(selectedUid || document.querySelector('.section-wrapper[data-uid]')?.dataset?.uid || null);
}

function buildSectionWrapper(item, idx) {
  const def = DEFS[item.type];
  if (!def) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'section-wrapper' + (!item.props.visible ? ' is-hidden' : '');
  wrapper.dataset.uid = item.uid;

  const card = document.createElement('div');
  card.className = 'section-card' + (selectedUid === item.uid ? ' is-selected' : '');
  card.dataset.uid = item.uid;

  const dh = document.createElement('div');
  dh.className = 'card-drag';
  dh.innerHTML = '<i class="fas fa-grip-vertical"></i>';
  dh.draggable = true;
  dh.addEventListener('dragstart', e => sectionDragStart(e, idx));
  dh.addEventListener('dragend', sectionDragEnd);

  const hbar = document.createElement('div');
  hbar.className = 'card-header-bar';
  hbar.style.setProperty('--section-color', def.headerColor);

  const stickyBadge = item.props.sticky
    ? `<span class="card-sticky-badge"><i class="fas fa-thumbtack" style="font-size:7px;margin-right:3px"></i>STICKY</span>`
    : '';

  hbar.innerHTML = `
      <span class="card-order">${idx+1}</span>
      <span class="section-badge ${def.badgeClass}">${def.badgeText}</span>
      <span class="card-title-text">${def.label}</span>
      <div class="card-header-meta">
        ${stickyBadge}
        <span class="card-id-text">#${def.id}</span>
      </div>
      <div class="card-actions">
        <button class="card-act-btn" title="Lên" onclick="moveSection('${item.uid}',-1)"><i class="fas fa-chevron-up"></i></button>
        <button class="card-act-btn" title="Xuống" onclick="moveSection('${item.uid}',1)"><i class="fas fa-chevron-down"></i></button>
        <button class="card-act-btn" title="${item.props.visible?'Ẩn':'Hiện'}" onclick="toggleVis('${item.uid}')">
          <i class="fas fa-eye${item.props.visible?'':'-slash'}"></i>
        </button>
        <button class="card-act-btn del" title="Xóa" onclick="removeSection('${item.uid}')"><i class="fas fa-times"></i></button>
      </div>`;

  const prev = document.createElement('div');
  prev.className = 'card-preview';
  prev.innerHTML = getPreview(item.type, { ...item.props, _uid: item.uid });


  const rh = document.createElement('div');
  rh.className = 'resize-handle';

  card.appendChild(dh);
  card.appendChild(hbar);
  card.appendChild(prev);
  card.appendChild(rh);

  card.addEventListener('click', e => {
    if (e.target.closest('.card-actions') || e.target.closest('.card-drag')) return;
    if (e.target.closest('.hm-tram-trigger') || e.target.closest('.hm-tram-search')) return;
    if (e.target.closest('.ic-card')) return;
    if (e.target.closest('.device-chip')) return;
    selectSection(item.uid);
  });

  wrapper.appendChild(card);
  wrapper.addEventListener('dragover', e => e.preventDefault());
  wrapper.addEventListener('drop', e => sectionDrop(e, idx));
  return wrapper;
}

/* ── CANVAS ── */
function renderCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';

  layout.forEach((item, idx) => {
    const def = DEFS[item.type];
    if (!def) return;
    canvas.appendChild(mkDropZone(idx));
    const wrapper = buildSectionWrapper(item, idx);
    if (wrapper) canvas.appendChild(wrapper);
  });

  canvas.appendChild(mkDropZone(layout.length));
}

function replaceCanvasSection(uid) {
  const item = layout.find(l => l.uid === uid);
  const idx = layout.findIndex(l => l.uid === uid);
  const canvas = document.getElementById('canvas');
  const old = canvas?.querySelector(`.section-wrapper[data-uid="${uid}"]`);
  if (!canvas || !item || idx < 0 || !old) {
    renderCanvas();
    renderQuickNav();
    return;
  }

  // ── Tối ưu: charts & chips có live content — chỉ cập nhật selection state,
  // không destroy DOM đã render. Giữ chart/table nguyên vẹn.
  if (item.type === 'charts' || item.type === 'chips' || item.type === 'timeline') {
    // Cập nhật wrapper visibility
    old.className = 'section-wrapper' + (!item.props.visible ? ' is-hidden' : '');
    // Cập nhật selected highlight trên card
    const card = old.querySelector('.section-card');
    if (card) card.classList.toggle('is-selected', selectedUid === uid);
    // Nếu data sẵn: renderChartsSection tự xử lý (kể cả self-heal nếu mainEl bị mất)
    if (item.type === 'charts' && _chipAllData.length > 0) {
      requestAnimationFrame(() => renderChartsSection());
    }
    if (item.type === 'timeline' && _chipAllData.length > 0) {
      requestAnimationFrame(() => renderTimelineSection());
    }
    if (item.type === 'chips' && _chipAllData.length > 0) {
      const chipEl = old.querySelector('.card-preview');
      const isEmpty = !chipEl || !chipEl.querySelector('.device-chip');
      if (isEmpty) requestAnimationFrame(() => renderChipsSection());
    }
    return;
  }

  const next = buildSectionWrapper(item, idx);
  if (!next) return;
  old.replaceWith(next);

  // Sau khi rebuild các section khác, giữ charts/chips không bị mất nếu data sẵn
  if (_chipAllData.length > 0) {
    requestAnimationFrame(() => { renderChipsSection(); renderChartsSection(); });
  }
}

function mkDropZone(idx) {
  const dz = document.createElement('div');
  dz.className = 'drop-zone';
  dz.dataset.dropIdx = idx;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('active'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('active'));
  dz.addEventListener('drop', e => { dz.classList.remove('active'); dropZoneDrop(e, parseInt(dz.dataset.dropIdx)); });
  return dz;
}

/* ── LAYERS ── */
function renderLayers() {
  const list = document.getElementById('layerList');
  list.innerHTML = '';
  const term = normalizeSearchText(layerSearchTerm);
  const filteredLayout = layout.filter(item => {
    if (!term) return true;
    const def = DEFS[item.type] || {};
    const meta = [def.label, def.badgeText, def.id, item.type, item.props?.sticky ? 'sticky' : '', item.props?.visible ? 'visible' : 'hidden'].join(' ');
    return normalizeSearchText(meta).includes(term);
  });

  if (!filteredLayout.length) {
    const safeTerm = String(layerSearchTerm).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    list.innerHTML = `<div class="rpanel-empty"><i class="fas fa-search" style="margin-right:6px;color:var(--accent)"></i>Không có section phù hợp với từ khóa <strong>${safeTerm}</strong></div>`;
  }

  filteredLayout.forEach((item) => {
    const idx = layout.findIndex(l => l.uid === item.uid);
    const def = DEFS[item.type];
    const el = document.createElement('div');
    el.className = 'layer-item' +
      (selectedUid === item.uid ? ' selected' : '') +
      (!item.props.visible ? ' layer-hidden' : '');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${def.label} - ${item.props.visible ? 'đang hiển thị' : 'đang ẩn'}`);

    let meta = def.badgeText;
    if (item.type === 'stats' && item.props.cards) meta += ` · ${item.props.cards.length} ô`;
    if (item.props.sticky) meta += ' · STICKY';

    el.innerHTML = `
      <span class="layer-drag" draggable="true"><i class="fas fa-grip-vertical"></i></span>
      <span class="layer-accent" style="background:${def.dotColor}"></span>
      <div class="layer-info">
        <span class="layer-name">${def.label}</span>
        <span class="layer-meta">${meta}</span>
      </div>
      <div class="layer-badges">
        ${item.props.sticky ? `<span class="layer-sticky-badge"><i class="fas fa-thumbtack"></i></span>` : ''}
        <button class="layer-vis ${!item.props.visible ? 'hidden-eye' : ''}"
          title="Ẩn/Hiện"
          onclick="toggleVis('${item.uid}');event.stopPropagation()">
          <i class="fas fa-eye${item.props.visible ? '' : '-slash'}"></i>
        </button>
      </div>`;

    el.addEventListener('click', () => selectSection(item.uid));
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selectSection(item.uid);
      }
    });
    const dh = el.querySelector('.layer-drag');
    dh.addEventListener('dragstart', e => sectionDragStart(e, idx));
    dh.addEventListener('dragend', sectionDragEnd);
    list.appendChild(el);
  });

  const addBtns = document.getElementById('addButtons');
  addBtns.innerHTML = '';
  Object.entries(DEFS).forEach(([type, def]) => {
    if (layout.some(l => l.type === type)) return;
    const btn = document.createElement('button');
    btn.className = 'add-section-btn';
    btn.innerHTML = `<i class="${def.icon}"></i>${def.label}`;
    btn.onclick = () => addSection(type);
    addBtns.appendChild(btn);
  });
  if (!addBtns.children.length) {
    addBtns.innerHTML = '<span style="font-size:10px;color:var(--text-muted)">Tất cả section đã thêm</span>';
  }
}

/* ── PROPS ── */
function renderProps() {
  const body  = document.getElementById('propsContent');
  const title = document.getElementById('propsTitle');

  if (!selectedUid) {
    title.textContent = '—';
    body.innerHTML = getPropsEmptyHTML();
    return;
  }

  const item = layout.find(l => l.uid === selectedUid);
  if (!item) return;
  const def = DEFS[item.type];
  title.textContent = def.badgeText;

  let html = '';

  // ─ Summary chip for selected section
  html += `<div style="padding:10px 14px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;padding-bottom:10px">
    <span class="section-badge ${def.badgeClass}" style="font-size:9px">${def.badgeText}</span>
    <span style="font-size:12px;font-weight:600;color:var(--text-primary);flex:1">${def.label}</span>
    <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">#${def.id}</span>
  </div>`;

  // ─ Visibility
  html += `<div class="props-section">
    <div class="props-section-title"><i class="fas fa-eye"></i>Hiển thị</div>
    <div class="prop-toggle-row">
      <span class="toggle-label">Hiển thị</span>
      <button class="toggle ${item.props.visible ? 'on' : ''}" onclick="toggleProp('${item.uid}','visible')"></button>
    </div>
    <div class="prop-toggle-row">
      <span class="toggle-label">Sticky khi scroll</span>
      <button class="toggle ${item.props.sticky ? 'on' : ''}" onclick="toggleProp('${item.uid}','sticky')"></button>
    </div>
  </div>`;

  // ─ Appearance
  html += `<div class="props-section">
    <div class="props-section-title"><i class="fas fa-paint-brush"></i>Giao diện</div>
    <div class="prop-row">
      <label class="prop-label">
        Border Radius
        <span class="prop-label-val" id="br_v_${item.uid}">${item.props.borderRadius||8}px</span>
      </label>
      <input class="prop-input" type="range" min="0" max="24"
        value="${item.props.borderRadius||8}"
        oninput="setProp('${item.uid}','borderRadius',+this.value);document.getElementById('br_v_${item.uid}').textContent=this.value+'px'">
    </div>
    <div class="prop-row">
      <label class="prop-label">
        Padding
        <span class="prop-label-val" id="pd_v_${item.uid}">${item.props.padding||12}px</span>
      </label>
      <input class="prop-input" type="range" min="0" max="40"
        value="${item.props.padding||12}"
        oninput="setProp('${item.uid}','padding',+this.value);document.getElementById('pd_v_${item.uid}').textContent=this.value+'px'">
    </div>
    <div class="prop-row">
      <label class="prop-label">Background</label>
      <div class="color-row">
        <input type="color" value="${item.props.bgColor||'#111720'}"
          oninput="setProp('${item.uid}','bgColor',this.value)"
          style="width:30px;height:28px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent">
        <input class="prop-input" value="${item.props.bgColor||'#111720'}"
          oninput="setProp('${item.uid}','bgColor',this.value)">
      </div>
    </div>
  </div>`;

  // ─ Type-specific
  if (item.type === 'stats') {
    const cards = item.props.cards || [];
    const cols  = item.props.columns || 4;
    const max   = 10;

    let cardsHtml = cards.map((c, ci) => {
      const isBar  = c.chartType === 'bar';
      const isTech = c.chartType === 'tech';

      const extraFields = c.ratio ? `
        <div class="prop-row" style="margin-top:6px">
          <label class="prop-label" style="font-size:10px">
            <i class="fas fa-percent" style="font-size:9px;color:var(--accent);margin-right:4px;opacity:.6"></i>
            Tỷ lệ % (hiển thị góc phải)
          </label>
          <input class="prop-input" placeholder="vd: 15.6%" value="${c.ratioValue||''}"
            oninput="setCardProp('${item.uid}',${ci},'ratioValue',this.value)">
        </div>` : '';

      const apiField = isBar ? `
        <div class="prop-row" style="margin-top:6px">
          <label class="prop-label" style="font-size:10px">
            <i class="fas fa-link" style="font-size:9px;color:var(--accent);margin-right:4px;opacity:.6"></i>
            API Endpoint URL
          </label>
          <input class="prop-input" placeholder="https://…/api/data"
            value="${c.apiUrl||''}"
            oninput="setCardProp('${item.uid}',${ci},'apiUrl',this.value)">
          <button class="btn btn-primary" style="margin-top:5px;width:100%;font-size:11px;padding:6px"
            onclick="icFetchApi('${item.uid}',${ci})">
            <i class="fas fa-sync-alt"></i> Tải dữ liệu từ API
          </button>
          ${c._apiState === 'ok' ? `<div style="font-family:var(--font-mono);font-size:9px;color:var(--green);margin-top:4px;display:flex;gap:4px;align-items:center"><i class="fas fa-check-circle"></i> ${c.chartData?.length||0} mục đã tải</div>` : ''}
          ${c._apiState === 'error' ? `<div style="font-family:var(--font-mono);font-size:9px;color:var(--red);margin-top:4px;display:flex;gap:4px;align-items:center"><i class="fas fa-times-circle"></i> ${c._apiError||'Lỗi'}</div>` : ''}
        </div>` : '';

      const techValueFields = isTech && c.techData ? c.techData.series.map((s, si) => `
        <div style="margin-top:6px">
          <div class="prop-label" style="font-size:10px;margin-bottom:4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:5px"></span>${s.label}
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
            ${Object.entries(s.values).map(([volt, val]) => `
              <div>
                <div style="font-size:9px;color:var(--text-muted);margin-bottom:2px;font-family:var(--font-mono)">${volt}</div>
                <input class="prop-input" type="number" min="0" style="padding:4px 6px;font-size:11px" value="${val}"
                  oninput="icSetTechVal('${item.uid}',${ci},${si},'${volt}',+this.value)">
              </div>`).join('')}
          </div>
        </div>`).join('') : '';

      return `
      <div class="stat-editor-card">
        <div class="stat-editor-top">
          <span class="stat-editor-num">Ô ${ci+1}${isBar?' · BAR':isTech?' · TECH':c.ratio?' · RATIO':''}</span>
          ${ci > 0 ? `<button class="card-act-btn" onclick="moveCard('${item.uid}',${ci},-1)" title="Lên"><i class="fas fa-chevron-up"></i></button>` : ''}
          ${ci < cards.length-1 ? `<button class="card-act-btn" onclick="moveCard('${item.uid}',${ci},1)" title="Xuống"><i class="fas fa-chevron-down"></i></button>` : ''}
          <button class="card-act-btn del" onclick="removeCard('${item.uid}',${ci})" title="Xóa"><i class="fas fa-times"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:44px 1fr;gap:6px;margin-bottom:6px">
          <div>
            <div class="prop-label" style="margin-bottom:3px">Icon</div>
            <input class="prop-input" style="text-align:center;font-size:15px;padding:4px"
              maxlength="2" value="${c.icon||''}"
              oninput="setCardProp('${item.uid}',${ci},'icon',this.value)">
          </div>
          <div>
            <div class="prop-label" style="margin-bottom:3px">Nhãn</div>
            <input class="prop-input" value="${c.label||''}"
              oninput="setCardProp('${item.uid}',${ci},'label',this.value)">
          </div>
        </div>
        ${!isBar && !isTech ? `
        <div style="display:grid;grid-template-columns:1fr 42px;gap:6px">
          <div>
            <div class="prop-label" style="margin-bottom:3px">Giá trị</div>
            <input class="prop-input" value="${c.value||''}"
              oninput="setCardProp('${item.uid}',${ci},'value',this.value)">
          </div>
          <div>
            <div class="prop-label" style="margin-bottom:3px">Màu</div>
            <input type="color" value="${c.color||'#00e676'}"
              style="width:100%;height:30px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent"
              oninput="setCardProp('${item.uid}',${ci},'color',this.value)">
          </div>
        </div>
        ${extraFields}` : `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <span class="prop-label" style="margin-bottom:3px">Màu accent</span>
          <input type="color" value="${c.color||'#ffd740'}"
            style="width:28px;height:22px;border:1px solid var(--border);border-radius:5px;cursor:pointer;background:transparent"
            oninput="setCardProp('${item.uid}',${ci},'color',this.value)">
        </div>
        ${apiField}${techValueFields}`}
      </div>`;
    }).join('');

    html += `<div class="props-section">
      <div class="props-section-title"><i class="fas fa-th"></i>Cấu hình Stats</div>
      <div class="prop-row" style="margin-bottom:12px">
        <label class="prop-label">
          Số cột
          <span class="prop-label-val">${cols} cột</span>
        </label>
        <input class="prop-input" type="range" min="1" max="${Math.min(cards.length,10)}"
          value="${cols}"
          oninput="setProp('${item.uid}','columns',+this.value);renderProps()">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:.1em">
          CÁC Ô (${cards.length}/${max})
        </span>
        ${cards.length < max ? `<button class="btn" style="font-size:10px;padding:3px 9px" onclick="addCard('${item.uid}')"><i class="fas fa-plus"></i> Thêm</button>` : ''}
      </div>
      ${cardsHtml}
    </div>`;
  }

  if (item.type === 'table') {
    html += `<div class="props-section">
      <div class="props-section-title"><i class="fas fa-table"></i>Cấu hình Bảng</div>
      <div class="prop-row">
        <label class="prop-label">Số hàng / trang</label>
        <input class="prop-input" type="number" min="5" max="100"
          value="${item.props.rowsPerPage||20}"
          oninput="setProp('${item.uid}','rowsPerPage',+this.value)">
      </div>
      <div class="prop-toggle-row">
        <span class="toggle-label">Nút xuất CSV</span>
        <button class="toggle ${item.props.exportBtn ? 'on' : ''}" onclick="toggleProp('${item.uid}','exportBtn')"></button>
      </div>
    </div>`;
  }

  if (item.type === 'charts') {
    const cMode = item.props.chartMode || 'station';
    html += `<div class="props-section">
      <div class="props-section-title"><i class="fas fa-chart-bar"></i>Cấu hình Biểu đồ</div>
      <div class="prop-row">
        <label class="prop-label">Chế độ hiển thị</label>
        <span style="font-size:10px;color:var(--text-secondary);font-family:var(--font-mono)">
          Stacked Bar ngang · Y=Trạm · X=Số thiết bị · màu=cấp ĐA
        </span>
      </div>
      <div style="font-size:9px;color:var(--text-muted);line-height:1.6;margin-top:6px;padding:6px 8px;background:var(--bg-elevated);border-radius:5px;font-family:var(--font-mono)">
        Loại trừ: TIchânsứ &amp; HTTĐ<br>
        Sort: 220kV→110kV→35kV→22kV→10kV→6kV→TT<br>
        Bên phải: Pie phân loại TB + Pie công nghệ TBA
      </div>
    </div>`;
  }

  if (item.type === 'timeline') {
    html += `<div class="props-section">
      <div class="props-section-title"><i class="fas fa-stream"></i>Cấu hình Timeline</div>
      <div class="prop-row">
        <label class="prop-label">Số tháng</label>
        <input class="prop-input" type="number" min="6" max="36"
          value="${item.props.months||24}"
          oninput="setProp('${item.uid}','months',+this.value)">
      </div>
    </div>`;
  }

  // ─ Position
  const idx = layout.findIndex(l => l.uid === selectedUid);
  html += `<div class="props-section">
    <div class="props-section-title"><i class="fas fa-arrows-alt-v"></i>Vị trí</div>
    <div class="pos-btns">
      <button class="btn pos-btn" onclick="moveSection('${item.uid}',-1)" ${idx===0?'disabled':''}>
        <i class="fas fa-chevron-up"></i> Lên
      </button>
      <button class="btn pos-btn" onclick="moveSection('${item.uid}',1)" ${idx===layout.length-1?'disabled':''}>
        <i class="fas fa-chevron-down"></i> Xuống
      </button>
    </div>
    <button class="btn btn-danger" style="width:100%" onclick="removeSection('${item.uid}')">
      <i class="fas fa-trash"></i> Xóa section
    </button>
  </div>`;

  body.innerHTML = html;
}

/* ═══════════════════════════════════════════════
   PREVIEW HELPERS
═══════════════════════════════════════════════ */
const _getRatio = (cards, ci) => {
  const c = cards[ci];
  if (!c || !c.ratio) return null;
  return c.ratioValue || '—';
};

const _renderMiniBar = (c, color) => {
  const apiUrl = c.apiUrl || '';
  let statusHtml = '';
  if (apiUrl) {
    const state = c._apiState || 'idle';
    if (state === 'loading') statusHtml = `<div class="ic-api-status loading"><i class="fas fa-circle-notch fa-spin"></i> Đang tải…</div>`;
    else if (state === 'error') statusHtml = `<div class="ic-api-status error"><i class="fas fa-exclamation-triangle"></i> ${c._apiError||'Lỗi kết nối'}</div>`;
  }
  const chartData = c.chartData || [];
  if (!chartData.length && apiUrl && c._apiState !== 'ok') {
    return `${statusHtml}<div class="ic-api-empty"><i class="fas fa-plug"></i> Chờ dữ liệu API</div>`;
  }
  const maxVal = Math.max(...chartData.map(d => d.value), 1);
  const barsHtml = chartData.map(d => {
    const pct = Math.round(d.value / maxVal * 100);
    return `<div class="ic-bar-row">
      <span class="ic-bar-lbl" title="${d.label}">${d.label}</span>
      <div class="ic-bar-track"><div class="ic-bar-fill" style="width:${pct}%;background:${d.color||color}"></div></div>
      <span class="ic-bar-num">${d.value}</span>
    </div>`;
  }).join('');
  return `${statusHtml}<div class="ic-minichart-bars">${barsHtml}</div>`;
};

const _renderTechChart = (c, cardUid, ci) => {
  const t220 = c.tech220 || { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const t110 = c.tech110 || { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const t22  = c.tech22  || { GIS:0, KCK:0, GIS_KCK:0 };
  const t35  = c.tech35  || { GIS:0, KCK:0, GIS_KCK:0 };

  // Build a bar item html
  function barItem(cls, label, val, maxVal) {
    const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    return `
      <div class="ic-tech-bar-item">
        <span class="ic-tech-bar-label ${cls}">${label}</span>
        <span class="ic-tech-bar-number ${cls}">${val}</span>
        <div class="ic-tech-bar-track">
          <div class="ic-tech-bar-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  function buildHVSection(hvFilter) {
    // hvFilter: '220' | '110' | 'all' (= both)
    let ais, gis, hgis, honhop;
    if (hvFilter === 'all') {
      ais    = (t220.AIS||0)      + (t110.AIS||0);
      gis    = (t220.GIS||0)      + (t110.GIS||0);
      hgis   = (t220.HGIS||0)    + (t110.HGIS||0);
      honhop = (t220.HGIS_AIS||0) + (t110.HGIS_AIS||0);
    } else {
      const t = hvFilter === '220' ? t220 : t110;
      ais = t.AIS||0; gis = t.GIS||0; hgis = t.HGIS||0; honhop = t.HGIS_AIS||0;
    }
    const maxHV = Math.max(ais, gis, hgis, honhop, 1);
    // Dropdown embedded in cap header
    const dropHV = `<select class="ic-tech-cap-select" id="hvdrop_${cardUid}_${ci}"
      onchange="icTechHVFilter('${cardUid}',${ci},this.value)">
      <option value="all"${hvFilter==='all'?' selected':''}>220 – 110kV</option>
      <option value="220"${hvFilter==='220'?' selected':''}>220kV</option>
      <option value="110"${hvFilter==='110'?' selected':''}>110kV</option>
    </select>`;
    let html = `<div class="ic-tech-cap" style="display:flex;align-items:center;gap:6px;justify-content:space-between">
      <span>⚡</span>${dropHV}</div>`;
    html += `<div class="ic-tech-grid">`;
    if (ais    > 0) html += barItem('ais',    'AIS',        ais,    maxHV);
    if (honhop > 0) html += barItem('honhop', 'HGIS – AIS', honhop, maxHV);
    if (gis    > 0) html += barItem('gis',    'GIS',        gis,    maxHV);
    if (hgis   > 0) html += barItem('hgis',   'HGIS',       hgis,   maxHV);
    // Nếu tất cả = 0 (section trống), hiện AIS mặc định
    if (ais === 0 && gis === 0 && hgis === 0 && honhop === 0)
      html += barItem('ais', 'AIS', 0, 1);
    html += `</div>`;
    return html;
  }

  function buildLVSection() {
    // 22kV: GIS | GIS+KCK (hỗn hợp) | KCK (Khí-Chân không)
    const t = t22;
    const total = (t.GIS||0) + (t.KCK||0) + (t.GIS_KCK||0);
    if (total === 0) return ''; // Không có thiết bị 22-35kV -> ẩn section
    const maxV = Math.max(t.GIS||0, t.GIS_KCK||0, t.KCK||0, 1);
    let html = `<div class="ic-tech-cap" style="margin-top:8px">⚡ 22 – 35kV</div>`;
    html += `<div class="ic-tech-grid">`;
    if ((t.GIS||0) > 0)
      html += barItem('gis',    'GIS',              t.GIS||0,     maxV);
    if ((t.KCK||0) > 0)
      html += barItem('kck',    'Khí – Chân không', t.KCK||0,     maxV);
    if ((t.GIS_KCK||0) > 0)
      html += barItem('honhop', 'GIS + KCK',      t.GIS_KCK||0, maxV);
    html += `</div>`;
    return html;
  }

  const hvFilter = c._hvFilter || 'all';
  const rows = buildHVSection(hvFilter) + buildLVSection();

  return `<div class="ic-tech-chart" id="tc_${cardUid}_${ci}">
    <div class="ic-tech-rows" id="tr_${cardUid}_${ci}">${rows}</div>
  </div>`;
};

/* ═══════════════════════════════════════════════
   PREVIEW TEMPLATES
═══════════════════════════════════════════════ */
function getPreview(type, props) {
  if (type === 'filter') return `
    <div class="hm-filter-bar" style="flex-wrap:wrap;gap:8px;padding:4px 0" id="lf_bar_${props._uid||'f'}">
      <div class="hm-tram-sel" style="min-width:160px;max-width:240px">
        <button type="button" class="hm-tram-trigger" id="lytDdSel_lf_tram_${props._uid||'f'}"
          onclick="event.stopPropagation();lytFddTramToggle('${props._uid||'f'}',this)"
          onmousedown="event.stopPropagation()">
          <span class="hm-tram-trigger-label" id="lf_lbl_tram_${props._uid||'f'}">— Tất cả trạm —</span>
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <input id="lf_search_${props._uid||'f'}" type="text" placeholder="🔍 Tìm kiếm tên/loại/ngăn..."
        class="hm-tram-search" style="flex:1;min-width:160px;max-width:280px"
        oninput="lytFddOnSearch('${props._uid||'f'}',this.value)"
        onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onkeydown="event.stopPropagation()">
      <div class="hm-tram-sel" style="min-width:110px;max-width:150px">
        <button type="button" class="hm-tram-trigger" id="lytDdSel_lf_cap_${props._uid||'f'}"
          onclick="event.stopPropagation();lytFddCapToggle('${props._uid||'f'}',this)"
          onmousedown="event.stopPropagation()">
          <span class="hm-tram-trigger-label" id="lf_lbl_cap_${props._uid||'f'}">Cấp điện áp</span>
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="hm-tram-sel" style="min-width:120px;max-width:175px">
        <button type="button" class="hm-tram-trigger" id="lytDdSel_lf_type_${props._uid||'f'}"
          onclick="event.stopPropagation();lytFddTypeToggle('${props._uid||'f'}',this)"
          onmousedown="event.stopPropagation()">
          <span class="hm-tram-trigger-label" id="lf_lbl_type_${props._uid||'f'}">Loại thiết bị</span>
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="hm-tram-sel" style="min-width:115px;max-width:155px">
        <button type="button" class="hm-tram-trigger" id="lytDdSel_lf_year_${props._uid||'f'}"
          onclick="event.stopPropagation();lytFddYearToggle('${props._uid||'f'}',this)"
          onmousedown="event.stopPropagation()">
          <span class="hm-tram-trigger-label" id="lf_lbl_year_${props._uid||'f'}">Năm SX</span>
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="hm-tram-sel" style="min-width:120px;max-width:160px">
        <button type="button" class="hm-tram-trigger" id="lytDdSel_lf_opyr_${props._uid||'f'}"
          onclick="event.stopPropagation();lytFddOpyrToggle('${props._uid||'f'}',this)"
          onmousedown="event.stopPropagation()">
          <span class="hm-tram-trigger-label" id="lf_lbl_opyr_${props._uid||'f'}">Năm VH</span>
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <button id="lf_reset_${props._uid||'f'}" class="hm-reset-btn" style="display:none" onclick="lytFddReset('${props._uid||'f'}')">
        <i class="fas fa-times"></i> Xóa lọc
      </button>
      <button class="hm-export-btn" onclick="lytExportCSVFromFilter()" title="Xuất file CSV theo bộ lọc hiện tại" style="white-space:nowrap">
        <i class="fas fa-download"></i> CSV
      </button>
    </div>`;

  function getTechStackPlacementStyle(label) {
    switch (normalizeStatsCardLabel(label)) {
      // Row 1
      case 'Tổng số TBA':            return 'grid-column:1;grid-row:1;';
      case 'TBA 220kV':              return 'grid-column:2;grid-row:1;';
      case 'TBA 110kV':              return 'grid-column:3;grid-row:1;';
      // Công nghệ TBA: chiếm cột 4, span 3 rows
      case 'Công nghệ thiết bị TBA': return 'grid-column:4;grid-row:1 / span 3;align-self:stretch;min-height:calc(108px * 3 + 16px);';
      // Row 2
      case 'Tổng số thiết bị':       return 'grid-column:1;grid-row:2;';
      case 'Tổng công suất':         return 'grid-column:2;grid-row:2;';
      case 'Tổng số ngăn':           return 'grid-column:3;grid-row:2;';
      // Row 3
      case 'Ngăn đường dây':         return 'grid-column:1;grid-row:3;';
      case 'MBA': case 'Ngăn MBA':          return 'grid-column:2;grid-row:3;';
      case 'Ngăn xuất tuyến':        return 'grid-column:3;grid-row:3;';
      // Row 4 — 4 ngăn phụ, trải đủ 4 cột
      case 'Ngăn liên lạc (LL)':    return 'grid-column:1;grid-row:4;';
      case 'Ngăn tụ bù (TBN)':      return 'grid-column:2;grid-row:4;';
      case 'Ngăn tự dùng (TD)':     return 'grid-column:3;grid-row:4;';
      case 'Ngăn kháng':             return 'grid-column:4;grid-row:4;';
      default: return '';
    }
  }

  if (type === 'stats') {
    const cols  = props.columns || 4;
    const cards = props.cards   || [];
    const uid   = props._uid    || '';
    const nextC = IC_COLORS[cards.length % IC_COLORS.length];
    const useTechStackLayout = props.layoutStyle === 'tech-stack-3x3' && cols === 4 && cards.length >= 10 && cards.some(c => c.chartType === 'tech');

    const cardsHtml = cards.map((c, ci) => {
      c.label = normalizeStatsCardLabel(c.label);
      const ratioStr    = _getRatio(cards, ci);
      const isBarChart  = c.chartType === 'bar';
      const isTechChart = c.chartType === 'tech';
      const placementStyle = useTechStackLayout ? getTechStackPlacementStyle(c.label) : '';

      const ratioHtml = ratioStr !== null
        ? `<span class="ic-ratio" style="color:${c.color};border-color:${c.color}44">${ratioStr}</span>`
        : '';

      const extraHtml = isBarChart
        ? `<div class="ic-minichart">
            ${c.apiUrl ? `<div class="ic-api-row">
              <span class="ic-api-url" title="${c.apiUrl}"><i class="fas fa-link"></i> ${c.apiUrl.length>28?c.apiUrl.slice(0,28)+'…':c.apiUrl}</span>
              <button class="ic-tbtn" onclick="icFetchApi('${uid}',${ci})" title="Tải dữ liệu"><i class="fas fa-sync-alt"></i></button>
            </div>` : ''}
            ${_renderMiniBar(c, c.color)}
          </div>`
        : isTechChart
        ? _renderTechChart(c, uid, ci)
        : '';

      // Cards có giá trị tự động tính từ DB — KHÔNG contenteditable
      const COMPUTED_LABELS = new Set([
        'Tổng số TBA','TBA 220kV','TBA 110kV','Công nghệ thiết bị TBA',
        'Tổng số thiết bị','Tổng công suất','Tổng công suất (MVA)','Tổng số ngăn',
        'Ngăn đường dây','MBA','Ngăn MBA','Ngăn XT','Ngăn xuất tuyến',
        'Ngăn liên lạc (LL)','Ngăn tụ bù (TBN)','Ngăn tự dùng (TD)','Ngăn kháng',
        'Danh sách thiết bị'
      ]);
      const isComputed = COMPUTED_LABELS.has(c.label);

      const bodyHtml = (isBarChart || isTechChart) ? `
        <div class="ic-body">
          <div class="ic-icon" contenteditable="true" spellcheck="false"
            data-uid="${uid}" data-ci="${ci}" data-field="icon"
            style="font-size:${c.iconSize||18}px"
            onblur="icSave(this)">${c.icon||'▣'}</div>
          <div class="ic-lbl" contenteditable="true" spellcheck="false"
            style="color:${c.color};font-weight:600;font-size:${c.valSize ? Math.max(10, c.valSize*0.45)+'px' : '11px'};margin-bottom:6px"
            data-uid="${uid}" data-ci="${ci}" data-field="label"
            onblur="icSave(this)">${c.label}</div>
          ${extraHtml}
        </div>
      ` : `
                <div class="ic-body" style="${isComputed?'flex-direction:row;align-items:stretch;gap:10px':''}">
          ${isComputed ? (()=>{
            const vStr=String(c.value||'');
            const digits=vStr.replace(/[^0-9]/g,'').length;
            const fs=digits<=2?58:digits<=3?48:digits<=4?40:digits<=5?32:26;
            return `<div style="display:flex;flex-direction:column;justify-content:space-between;flex:1;min-width:0;cursor:pointer"
              onclick="event.stopPropagation();lytStatsCardClick('${c.label.replace(/'/g,"\\'")}','${c.color}')">
              <div style="font-size:${c.iconSize||20}px;filter:brightness(1.2)">${c.icon||'▣'}</div>
              <div style="font-size:clamp(9px,.85vw,11.5px);font-weight:500;color:rgba(195,215,235,.9);white-space:normal;line-height:1.3">${c.label}</div>
            </div>
            <div data-computed="true"
              style="color:${c.color};font-size:${fs}px;font-weight:900;letter-spacing:-0.05em;line-height:1;align-self:center;flex-shrink:0;text-align:right;cursor:pointer;filter:brightness(1.3);text-shadow:0 0 28px ${c.color}88"
              onclick="event.stopPropagation();lytStatsCardClick('${c.label.replace(/'/g,"\\'")}','${c.color}')"
            >${c.value}</div>`;
          })() : `
          <div class="ic-icon" contenteditable="true" spellcheck="false"
            data-uid="${uid}" data-ci="${ci}" data-field="icon"
            style="font-size:${c.iconSize||18}px"
            onblur="icSave(this)" onkeydown="if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();this.closest('.ic-card').querySelector('.ic-val').focus()}"
          >${c.icon||'▣'}</div>
          <div class="ic-val" contenteditable="true" spellcheck="false"
            style="color:${c.color};font-size:${c.valSize||26}px"
            data-uid="${uid}" data-ci="${ci}" data-field="value"
            onblur="icSave(this)" onkeydown="if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();this.closest('.ic-card').querySelector('.ic-lbl').focus()}"
          >${c.value}</div>
          <div class="ic-lbl" contenteditable="true" spellcheck="false"
            data-uid="${uid}" data-ci="${ci}" data-field="label"
            onblur="icSave(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
          >${c.label}</div>`}
        </div>
      `;

      return `
      <div class="ic-card ${isTechChart && useTechStackLayout ? 'ic-card-tech-stack' : ''}" id="icc_${uid}_${ci}"
        style="--card-color:${c.color};border-color:${c.color}22;border-top-color:${c.color};cursor:pointer;${placementStyle}"
        draggable="${isComputed ? 'false' : 'true'}"
        onclick="if(!event.target.closest('.ic-toolbar')&&!event.target.closest('.ic-sz-btn')&&!event.target.isContentEditable){lytStatsCardClick('${c.label}','${c.color}')}"
        ondragstart="icDragStart(event,'${uid}',${ci})"
        ondragover="icDragOver(event,'${uid}',${ci})"
        ondrop="icDrop(event,'${uid}',${ci})"
        ondragleave="icDragLeave(event,'${uid}',${ci})"
        ondragend="icDragEnd(event,'${uid}')">
        ${ratioHtml}
        <div class="ic-toolbar">
          <span class="ic-tbtn ic-drag-btn" draggable="true" ondragstart="event.stopPropagation();icDragStart(event,'${uid}',${ci})" title="Kéo để sắp xếp"><i class="fas fa-grip-vertical"></i></span>
          <button class="ic-tbtn" onclick="icPickColor(event,'${uid}',${ci})" title="Màu"><i class="fas fa-palette"></i></button>
          <div class="ic-size-ctrl" title="Cỡ icon">
            <button class="ic-sz-btn" onclick="icAdjustSize('${uid}',${ci},'icon',-2)">−</button>
            <span style="font-size:8px;color:var(--text-muted);font-family:var(--font-mono);padding:0 1px">i</span>
            <button class="ic-sz-btn" onclick="icAdjustSize('${uid}',${ci},'icon',+2)">+</button>
          </div>
          <div class="ic-size-ctrl" title="Cỡ số">
            <button class="ic-sz-btn" onclick="icAdjustSize('${uid}',${ci},'val',-2)">−</button>
            <span style="font-size:8px;color:var(--text-muted);font-family:var(--font-mono);padding:0 1px">A</span>
            <button class="ic-sz-btn" onclick="icAdjustSize('${uid}',${ci},'val',+2)">+</button>
          </div>
          <span style="flex:1"></span>
          ${ci > 0 ? `<button class="ic-tbtn" onclick="icMove('${uid}',${ci},-1)"><i class="fas fa-arrow-left"></i></button>` : ''}
          ${ci < cards.length-1 ? `<button class="ic-tbtn" onclick="icMove('${uid}',${ci},1)"><i class="fas fa-arrow-right"></i></button>` : ''}
          <button class="ic-tbtn danger" onclick="icDelete('${uid}',${ci})"><i class="fas fa-times"></i></button>
        </div>
        ${bodyHtml}
      </div>`;
    }).join('');

    // Build card html array for precise divider injection
    const cardHtmlParts = cards.map((c2, ci2) => {
      // find each card's html by its id marker
      const startMark = `id="icc_${uid}_${ci2}"`;
      return startMark; // used as lookup key only
    });

    // Inject row-divider between row1 (0..cols-1) and row2 (cols..end)
    // by finding the opening tag of card[cols] and inserting before it
    let finalCards = cardsHtml;
    if (!useTechStackLayout && cards.length > cols) {
      const rowBreakMark = `id="icc_${uid}_${cols}"`;
      const breakIdx = finalCards.indexOf(rowBreakMark);
      if (breakIdx > 0) {
        // Find the start of that card's outer <div  — walk back to nearest newline+whitespace+<div
        let insertAt = breakIdx;
        while (insertAt > 0 && finalCards[insertAt] !== '<') insertAt--;
        const divider = `<div class="ic-row-divider"></div>\n      `;
        finalCards = finalCards.slice(0, insertAt) + divider + finalCards.slice(insertAt);
      }
    }

    return `
      <div class="ic-wrap ${useTechStackLayout ? 'ic-wrap-tech-layout' : ''}" style="grid-template-columns:repeat(${cols},1fr)">
        ${finalCards}
        ${(!useTechStackLayout && cards.length < 10) ? `
          <div class="ic-add-card" onclick="icAddCard('${uid}','${nextC}')">
            <span class="ic-add-icon"><i class="fas fa-plus"></i></span>
            <span class="ic-add-lbl">Thêm ô</span>
          </div>` : ''}
      </div>`;
  }

  if (type === 'chips') return `
    <div class="prev-chips" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
      <div style="display:flex;flex-direction:column;gap:3px;padding:7px 11px;border-radius:7px;border:1px solid rgba(0,230,118,0.35);background:rgba(0,230,118,0.07);min-width:80px">
        <span style="font-size:11px;font-weight:600;color:#00e676">MC</span>
        <span style="font-size:15px;font-weight:800;font-family:var(--font-mono);color:#00e676">423</span>
        <span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono)">ABB · Siemens</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;padding:7px 11px;border-radius:7px;border:1px solid rgba(0,200,255,0.35);background:rgba(0,200,255,0.07);min-width:80px">
        <span style="font-size:11px;font-weight:600;color:#00c8ff">MBA</span>
        <span style="font-size:15px;font-weight:800;font-family:var(--font-mono);color:#00c8ff">201</span>
        <span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono)">ABB · THIBIDI</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;padding:7px 11px;border-radius:7px;border:1px solid rgba(255,215,64,0.35);background:rgba(255,215,64,0.07);min-width:80px">
        <span style="font-size:11px;font-weight:600;color:#ffd740">DCL</span>
        <span style="font-size:15px;font-weight:800;font-family:var(--font-mono);color:#ffd740">318</span>
        <span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono)">Schneider +2</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;padding:7px 11px;border-radius:7px;border:1px solid rgba(179,136,255,0.35);background:rgba(179,136,255,0.07);min-width:80px">
        <span style="font-size:11px;font-weight:600;color:#b388ff">TU</span>
        <span style="font-size:15px;font-weight:800;font-family:var(--font-mono);color:#b388ff">540</span>
        <span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono)">Mitsubishi</span>
      </div>
    </div>`;

  if (type === 'charts') {
    const uid = props._uid || '';
    return `<div class="lyt-charts-wrap" id="lytChartsWrap_${uid}">
      <div id="lytChartMain_${uid}" style="min-height:60px">
        <div class="hm-sub-bar"><i class="fas fa-spinner fa-spin" style="color:var(--accent)"></i> Đang tải…</div>
      </div>
    </div>`;
  }

  if (type === 'timeline') {
    return `<div id="lyt_tl_${props._uid||'tl'}" style="min-height:80px;padding:4px 0">
      <div style="font-size:10px;color:var(--text-muted);text-align:center;padding:20px 0">
        <i class="fas fa-chart-bar" style="color:var(--accent);margin-right:6px"></i>
        Đang tải phân tích thâm niên vận hành...
      </div>
    </div>`;
  }

  if (type === 'table') return `
    <div class="prev-table-wrap">
      <table class="prev-table">
        <thead><tr>
          <th>#</th><th>Tên thiết bị</th><th>Loại</th><th>Trạm</th><th>Cấp ĐA</th><th>Lần TN cuối</th><th>TN tiếp theo</th><th>Trạng thái</th>
        </tr></thead>
        <tbody>
          <tr><td>1</td><td style="color:var(--text-primary);font-weight:500">MC-110kV-BA1</td><td>Máy cắt</td><td>TBA Thủ Đức</td><td>110kV</td><td>06/2023</td><td style="color:var(--yellow)">06/2025</td><td><span class="pill pill-green">Bình thường</span></td></tr>
          <tr><td>2</td><td style="color:var(--text-primary);font-weight:500">TU-220kV-F2</td><td>TU đo lường</td><td>TBA Bình Dương</td><td>220kV</td><td>02/2022</td><td style="color:var(--red)">02/2024 ⚠</td><td><span class="pill pill-red">Quá hạn</span></td></tr>
          <tr><td>3</td><td style="color:var(--text-primary);font-weight:500">DCL-22kV-T3</td><td>Dao cách ly</td><td>TBA Hóc Môn</td><td>22kV</td><td>11/2023</td><td style="color:var(--cyan)">11/2025</td><td><span class="pill pill-green">Bình thường</span></td></tr>
        </tbody>
      </table>
    </div>`;

  return '<span style="color:var(--text-muted);font-size:11px">Preview không khả dụng</span>';
}

/* ═══════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   RIGHT PANEL TAB SWITCHER
═══════════════════════════════════════════════ */
function switchRTab(tab) {
  const layersPane = document.getElementById('paneLayersWrap');
  const propsPane  = document.getElementById('panePropWrap');
  const tabL = document.getElementById('tabLayers');
  const tabP = document.getElementById('tabProps');
  if (tab === 'layers') {
    layersPane.style.display = 'flex';
    propsPane.style.display  = 'none';
    tabL.classList.add('active');
    tabP.classList.remove('active');
  } else {
    layersPane.style.display = 'none';
    propsPane.style.display  = 'flex';
    tabL.classList.remove('active');
    tabP.classList.add('active');
  }
}

function selectSection(uid, opts = {}) {
  const prevUid = selectedUid;
  selectedUid = uid;
  const { preserveCanvasScroll = true } = opts;
  const host = preserveCanvasScroll ? getCanvasScrollHost() : null;
  const prevTop = host ? host.scrollTop : 0;

  renderQuickNav();
  renderLayers();
  renderProps();
  updateStatusBar();
  renderUXAudit();
  if (prevUid && prevUid !== uid) scheduleCanvasRender(prevUid);
  scheduleCanvasRender(uid);

  switchRTab('props');
  document.getElementById('propsContent').scrollTop = 0;

  if (host && preserveCanvasScroll) {
    requestAnimationFrame(() => { host.scrollTop = prevTop; });
  }
}

function destroyChartResources(uid) {
  if (_lytPieCharts[uid]) {
    try { _lytPieCharts[uid].destroy(); } catch (err) {}
    delete _lytPieCharts[uid];
  }
  if (_lytCharts[uid]) {
    Object.values(_lytCharts[uid] || {}).forEach(ch => { try { ch?.destroy?.(); } catch (err) {} });
    delete _lytCharts[uid];
  }
}

function toggleVis(uid) {
  saveToHistory();
  const item = layout.find(l => l.uid === uid);
  if (!item) return;
  item.props.visible = !item.props.visible;
  if (!item.props.visible && item.type === 'charts') destroyChartResources(uid);
  render();
  showToast(item.props.visible ? '👁 Đã hiện section' : '🚫 Đã ẩn section');
}

function moveSection(uid, dir) {
  saveToHistory();
  const idx = layout.findIndex(l => l.uid === uid);
  const ni = idx + dir;
  if (ni < 0 || ni >= layout.length) return;
  [layout[idx], layout[ni]] = [layout[ni], layout[idx]];
  render();
  showToast('↕ Di chuyển section');
}

function removeSection(uid) {
  const item = layout.find(l => l.uid === uid);
  const label = item ? DEFS[item.type].label : 'section này';
  if (!confirm(`Xóa ${label}?`)) return;
  saveToHistory();
  if (item?.type === 'charts') destroyChartResources(uid);
  layout = layout.filter(l => l.uid !== uid);
  if (selectedUid === uid) selectedUid = null;
  render();
  showToast('✕ Đã xóa section');
}

function addSection(type) {
  saveToHistory();
  const def = DEFS[type];
  const uid = 'uid_'+type+'_'+Date.now();
  layout.push({ type, uid, props: {...def.defaultProps} });
  selectedUid = uid;
  render();
  switchRTab('props');
  document.getElementById('propsContent').scrollTop = 0;
  showToast(`+ Đã thêm ${def.label}`);
}

function setProp(uid, key, value) {
  const item = layout.find(l => l.uid === uid);
  if (item) item.props[key] = value;
  markModified();
  scheduleCanvasRender(uid);
  renderLayers();
  renderProps();
  updateStatusBar();
  renderUXAudit();
}

function toggleProp(uid, key) {
  saveToHistory();
  const item = layout.find(l => l.uid === uid);
  if (item) item.props[key] = !item.props[key];
  render();
}

/* ═══════════════════════════════════════════════
   SECTION DRAG & DROP
═══════════════════════════════════════════════ */
function sectionDragStart(e, idx) {
  dragSrcIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx);
  setTimeout(() => {
    document.querySelectorAll('.section-wrapper')[idx]?.classList.add('is-dragging');
  }, 0);
}

function sectionDragEnd() {
  document.querySelectorAll('.section-wrapper.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.drop-zone.active').forEach(el => el.classList.remove('active'));
  dragSrcIdx = null;
}

function sectionDrop(e, targetIdx) {
  e.preventDefault();
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
  saveToHistory();
  const moved = layout.splice(dragSrcIdx, 1)[0];
  layout.splice(dragSrcIdx < targetIdx ? targetIdx-1 : targetIdx, 0, moved);
  render();
  showToast('⠿ Sắp xếp lại');
}

function dropZoneDrop(e, dropIdx) {
  e.preventDefault();
  if (dragSrcIdx === null) return;
  saveToHistory();
  const moved = layout.splice(dragSrcIdx, 1)[0];
  layout.splice(Math.max(0, dragSrcIdx < dropIdx ? dropIdx-1 : dropIdx), 0, moved);
  render();
  showToast('⠿ Sắp xếp lại');
}

/* ═══════════════════════════════════════════════
   INLINE CARD EDITOR
═══════════════════════════════════════════════ */
function icSave(el) {
  const { uid, ci, field } = el.dataset;
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards?.[+ci]) return;
  item.props.cards[+ci][field] = el.innerText.trim();
  markModified();
  scheduleCanvasRender(uid);
  renderProps();
}

function icSetTechVal(uid, ci, si, voltage, val) {
  const item = layout.find(l => l.uid === uid);
  const td = item?.props?.cards?.[ci]?.techData;
  if (!td?.series?.[si]) return;
  td.series[si].values[voltage] = val;
  markModified();
  scheduleCanvasRender(uid);
}

async function icFetchApi(uid, ci) {
  const item = layout.find(l => l.uid === uid);
  const card = item?.props?.cards?.[ci];
  if (!card?.apiUrl) return;

  card._apiState = 'loading';
  scheduleCanvasRender(uid);

  try {
    const res = await fetch(card.apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      card.chartData = data.map(d => ({
        label: d.label || d.name || d.ten || String(d.key || ''),
        value: Number(d.value ?? d.count ?? d.soLuong ?? 0),
        color: d.color || card.color
      }));
      card._apiState = 'ok';
      card._apiError = null;
      showToast('✓ Đã tải ' + card.chartData.length + ' mục từ API');
    } else {
      throw new Error('Định dạng JSON không hợp lệ (cần array)');
    }
  } catch (err) {
    card._apiState = 'error';
    card._apiError = err.message.slice(0, 40);
    showToast('✗ API lỗi: ' + card._apiError);
  }
  scheduleCanvasRender(uid);
}

function icTechHVFilter(uid, ci, filterKey) {
  const item = layout.find(l => l.uid === uid);
  const c = item?.props?.cards?.[ci];
  if (!c) return;

  // Persist selection on card object
  c._hvFilter = filterKey;
  markModified();

  const t220 = c.tech220 || { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const t110 = c.tech110 || { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const t22  = c.tech22  || { GIS:0, KCK:0, GIS_KCK:0 };

  function barItem(cls, label, val, maxVal) {
    const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    return `
      <div class="ic-tech-bar-item">
        <span class="ic-tech-bar-label ${cls}">${label}</span>
        <span class="ic-tech-bar-number ${cls}">${val}</span>
        <div class="ic-tech-bar-track">
          <div class="ic-tech-bar-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  // HV section (re-render rows div only, keep dropdown)
  let ais, gis, hgis, honhop;
  if (filterKey === 'all') {
    ais    = (t220.AIS||0)      + (t110.AIS||0);
    gis    = (t220.GIS||0)      + (t110.GIS||0);
    hgis   = (t220.HGIS||0)    + (t110.HGIS||0);
    honhop = (t220.HGIS_AIS||0) + (t110.HGIS_AIS||0);
  } else {
    const t = filterKey === '220' ? t220 : t110;
    ais = t.AIS||0; gis = t.GIS||0; hgis = t.HGIS||0; honhop = t.HGIS_AIS||0;
  }
  const maxHV = Math.max(ais, gis, hgis, honhop, 1);

  // Also update 1 STATS total display for 220/110
  if (filterKey === '220') {
    setText('total220kV', (t220.AIS+t220.GIS+t220.HGIS+t220.HGIS_AIS).toLocaleString('vi-VN'));
  } else if (filterKey === '110') {
    setText('total110kV', (t110.AIS+t110.GIS+t110.HGIS+t110.HGIS_AIS).toLocaleString('vi-VN'));
  }

  let html = `<div class="ic-tech-grid">`;
  html += barItem('ais',    'AIS',        ais,    maxHV);
  html += barItem('honhop', 'HGIS – AIS', honhop, maxHV);
  html += barItem('gis',    'GIS',        gis,    maxHV);
  html += barItem('hgis',   'HGIS',       hgis,   maxHV);
  html += `</div>`;

  // LV section
  const maxV = Math.max(t22.GIS||0, t22.GIS_KCK||0, t22.KCK||0, 1);
  html += `<div class="ic-tech-cap" style="margin-top:8px">⚡ 22 – 35kV</div>`;
  html += `<div class="ic-tech-grid">`;
  html += barItem('gis', 'GIS',              t22.GIS||0,     maxV);
  html += barItem('kck', 'Khí – Chân không', t22.KCK||0,     maxV);
  if ((t22.GIS_KCK||0) > 0)
    html += barItem('honhop', 'GIS + KCK', t22.GIS_KCK||0, maxV);
  html += `</div>`;

  const rowsEl = document.getElementById(`tr_${uid}_${ci}`);
  if (rowsEl) {
    // Rebuild entire rows including dropdown (to preserve selected)
    const dropHV = `<select class="ic-tech-cap-select" id="hvdrop_${uid}_${ci}"
      onchange="icTechHVFilter('${uid}',${ci},this.value)">
      <option value="all"${filterKey==='all'?' selected':''}>220 – 110kV</option>
      <option value="220"${filterKey==='220'?' selected':''}>220kV</option>
      <option value="110"${filterKey==='110'?' selected':''}>110kV</option>
    </select>`;
    const fullHtml = `<div class="ic-tech-cap" style="display:flex;align-items:center;gap:6px;justify-content:space-between">
      <span>⚡</span>${dropHV}</div>` + html;
    rowsEl.innerHTML = fullHtml;
  }
}

// Legacy stub — kept for any residual onclick refs
function icTechFilter(chipEl, uid, ci, filterKey) {
  icTechHVFilter(uid, ci, filterKey);
}

// ── SIZE ADJUST ──────────────────────────────────────────────
function lytSetChartMode(uid, mode) {
  const item = layout.find(l => l.uid === uid);
  if (!item) return;
  item.props.chartMode = mode;
  markModified();
  scheduleCanvasRender(uid);
  // Re-render chart với mode mới
  setTimeout(() => renderChartsSection(), 60);
}

function icAdjustSize(uid, ci, field, delta) {
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards?.[ci]) return;
  const card = item.props.cards[ci];
  if (field === 'icon') {
    card.iconSize = Math.min(40, Math.max(12, (card.iconSize || 18) + delta));
  } else if (field === 'val') {
    card.valSize  = Math.min(52, Math.max(14, (card.valSize  || 26) + delta));
  }
  markModified();
  scheduleCanvasRender(uid);
}

function icAddCard(uid, color) {
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards) return;
  saveToHistory();
  item.props.cards.push({ icon: '📌', label: 'Nhãn mới', value: '0', color });
  if (item.props.columns < item.props.cards.length) item.props.columns = item.props.cards.length;
  scheduleCanvasRender(uid); renderProps();
  setTimeout(() => {
    const ci = item.props.cards.length - 1;
    const el = document.querySelector(`[data-uid="${uid}"][data-ci="${ci}"][data-field="value"]`);
    if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  }, 60);
  showToast('+ Ô mới — nhập giá trị ngay');
}

function icDelete(uid, ci) {
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards || item.props.cards.length <= 1) { showToast('⚠ Cần ít nhất 1 ô'); return; }
  saveToHistory();
  item.props.cards.splice(ci, 1);
  if (item.props.columns > item.props.cards.length) item.props.columns = item.props.cards.length;
  scheduleCanvasRender(uid); renderProps();
  showToast('✕ Đã xóa ô');
}

function icMove(uid, ci, dir) {
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards) return;
  const ni = ci + dir;
  if (ni < 0 || ni >= item.props.cards.length) return;
  [item.props.cards[ci], item.props.cards[ni]] = [item.props.cards[ni], item.props.cards[ci]];
  scheduleCanvasRender(uid); renderProps();
}

let _icDUid = null, _icDCi = null;
function icDragStart(e, uid, ci) {
  _icDUid = uid; _icDCi = ci;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => document.getElementById(`icc_${uid}_${ci}`)?.classList.add('ic-dragging'), 0);
}
function icDragOver(e, uid, ci) {
  if (_icDUid !== uid || _icDCi === ci) return;
  e.preventDefault();
  document.getElementById(`icc_${uid}_${ci}`)?.classList.add('ic-drag-over');
}
function icDragLeave(e, uid, ci) {
  document.getElementById(`icc_${uid}_${ci}`)?.classList.remove('ic-drag-over');
}
function icDrop(e, uid, ci) {
  e.preventDefault();
  document.getElementById(`icc_${uid}_${ci}`)?.classList.remove('ic-drag-over');
  if (_icDUid !== uid || _icDCi === ci) return;
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards) return;
  saveToHistory();
  const [moved] = item.props.cards.splice(_icDCi, 1);
  item.props.cards.splice(ci, 0, moved);
  scheduleCanvasRender(uid); renderProps();
  showToast('↔ Đổi vị trí ô');
}
function icDragEnd(e, uid) {
  document.querySelectorAll('.ic-card').forEach(el => el.classList.remove('ic-dragging','ic-drag-over'));
  _icDUid = null; _icDCi = null;
}

/* ═══════════════════════════════════════════════
   COLOR PICKER
═══════════════════════════════════════════════ */
let _cpUid = null, _cpCi = null;

function icPickColor(e, uid, ci) {
  e.stopPropagation();
  if (_cpUid === uid && _cpCi === ci) { closeColorPicker(); return; }
  closeColorPicker();
  _cpUid = uid; _cpCi = ci;

  const item = layout.find(l => l.uid === uid);
  const cur = item?.props?.cards?.[ci]?.color || '#00e676';

  const overlay = document.createElement('div');
  overlay.id = 'cpOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:599';
  overlay.onclick = closeColorPicker;

  const picker = document.createElement('div');
  picker.id = 'cpPicker';
  picker.className = 'ic-colorpick';
  picker.onclick = ev => ev.stopPropagation();

  const swatches = IC_COLORS.map(c => `
    <div class="ic-cp-swatch" style="background:${c};${c===cur?'outline:2px solid #fff;transform:scale(1.15)':''}"
      onclick="icApplyColor('${uid}',${ci},'${c}')"></div>
  `).join('');

  picker.innerHTML = `
    <span class="ic-colorpick-label"><i class="fas fa-palette"></i> CHỌN MÀU</span>
    <div class="ic-colorpick-swatches">${swatches}</div>
    <div class="ic-colorpick-custom">
      <input type="color" value="${cur}"
        oninput="icApplyColor('${uid}',${ci},this.value);this.nextElementSibling.value=this.value">
      <input class="ic-hex-input" maxlength="7" value="${cur}"
        oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){icApplyColor('${uid}',${ci},this.value);this.previousElementSibling.value=this.value}">
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(picker);

  const r = e.currentTarget.getBoundingClientRect();
  let top = r.bottom + 6, left = r.left - 70;
  if (left + 180 > window.innerWidth - 8) left = window.innerWidth - 188;
  if (top + 170 > window.innerHeight - 8) top = r.top - 178;
  picker.style.top  = Math.max(4, top)+'px';
  picker.style.left = Math.max(4, left)+'px';
}

function closeColorPicker() {
  document.getElementById('cpOverlay')?.remove();
  document.getElementById('cpPicker')?.remove();
  _cpUid = null; _cpCi = null;
}

function icApplyColor(uid, ci, color) {
  const item = layout.find(l => l.uid === uid);
  if (!item?.props?.cards?.[ci]) return;
  item.props.cards[ci].color = color;
  const card = document.getElementById(`icc_${uid}_${ci}`);
  if (card) {
    card.style.setProperty('--card-color', color);
    card.style.borderColor = color + '22';
    card.style.borderTopColor = color;
    const v = card.querySelector('.ic-val');
    if (v) v.style.color = color;
  }
  markModified();
  renderProps();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeColorPicker();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLayout(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportLayout(); return; }
  if (isTypingContext(document.activeElement)) return;
  if (e.key === '/') {
    const input = document.getElementById('layerSearchInput');
    if (input) { e.preventDefault(); input.focus(); input.select(); }
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); selectRelativeSection(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectRelativeSection(-1); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid) {
    e.preventDefault();
    removeSection(selectedUid);
  }
});

window.addEventListener('beforeunload', e => {
  if (!isModified) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ═══════════════════════════════════════════════
   EXPORT / RESET / APPLY
═══════════════════════════════════════════════ */
function exportLayout() {
  const json = JSON.stringify(layout.map(l => ({
    type: l.type, id: DEFS[l.type].id, props: l.props
  })), null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], {type:'application/json'}));
  a.download = 'evn-dashboard-layout.json';
  a.click();
  isModified = false;
  history = [];
  updateModifiedUI();
  updateHistoryUI();
  clearDraft();
  showToast('⬇ Đã xuất evn-dashboard-layout.json');
}

function resetLayout() {
  if (!confirm('Khôi phục layout mặc định? Các thay đổi chưa xuất sẽ bị thay thế.')) return;
  saveToHistory();
  layout = freshLayout();
  selectedUid = null;
  clearLayerSearch();
  render();
  showToast('↺ Đã reset về mặc định');
}

function forceReloadData() {
  // Xóa cache hàng và tải lại từ Supabase để đảm bảo số liệu mới nhất
  try {
    localStorage.removeItem(LYT_DATA_CACHE_KEY);
    localStorage.removeItem(LYT_DATA_CACHE_META_KEY);
  } catch(_) {}
  _chipAllData = [];
  _chipFiltered = [];
  _lytNganCache = null;
  _lytNganSig = '';
  showToast('🔄 Đang tải lại dữ liệu từ Supabase...');
  loadStatsFromSupabase();
}

function applyLayout() {
  const visible = layout.filter(l => l.props.visible);
  const hidden  = layout.filter(l => !l.props.visible);
  const sticky  = layout.filter(l => l.props.sticky);

  const lines = layout.map((l,i) => {
    const def = DEFS[l.type];
    const vis = l.props.visible ? '✓' : '✗';
    const stk = l.props.sticky ? ' 📌' : '';
    return `${vis} ${i+1}. [${def.badgeText}] ${def.label}${stk}`;
  }).join('\n');

  alert(
    `✓ Layout sẵn sàng áp dụng\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Tổng: ${layout.length} sections\n` +
    `Hiển thị: ${visible.length}  |  Ẩn: ${hidden.length}  |  Sticky: ${sticky.length}\n\n` +
    lines + '\n\n' +
    `Dùng "Export JSON" để lưu cấu hình.`
  );

  commitLayoutState({ clearHistory: true });
  showToast('✓ Đã áp dụng layout');
}

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ═══════════════════════════════════════════════
   LEGACY STUBS
═══════════════════════════════════════════════ */
function setCardProp(uid, ci, key, val) {
  const item = layout.find(l => l.uid === uid);
  if (item?.props?.cards?.[ci]) {
    item.props.cards[ci][key] = val;
    markModified();
    scheduleCanvasRender(uid);
  }
}
function addCard(uid)          { icAddCard(uid, IC_COLORS[0]); }
function removeCard(uid, ci)   { icDelete(uid, ci); }
function moveCard(uid, ci, dir){ icMove(uid, ci, dir); }

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   SUPABASE LIVE STATS LOADER
   Tự động tính toán các chỉ số từ bảng TongHopThietBi
   và cập nhật các ô thống kê trên canvas
═══════════════════════════════════════════════ */
const _SB_URL = 'https://xqqmfmljwycpehfyknoy.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';

// ── LIVE CHARTS RENDERER ─────────────────────────────────────
// Đồng bộ với app.js: buildStationInfo, classifyTechChart, CAP_ORDER/COLORS
const _lytCharts = {}; // uid → { device, type, tech }

function lytIsExcluded(pl) {
  if (!pl) return true;
  const n = pl.trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
  if (n.startsWith('TICHAN')||n.includes('TICHÂN')) return true;
  if (n==='HTTĐ'||n==='HTTD'||n.startsWith('HTTD')) return true;
  if (n==='DẦU'||n==='DAU'||n.startsWith('DẦU')||n.startsWith('DAU')) return true;
  if (n==='RL') return true;
  return false;
}

function lytClassifyTech(typeSet) {
  // typeSet chứa các giá trị Phan_loai_thiet_bi (uppercase) của trạm ở cấp hiệu lực
  // GIS   : có 'GIS' (exact), không có HGIS, không có MC
  // HGIS  : có 'HGIS' (exact), không có MC
  // HGIS-AIS : có 'HGIS' VÀ có 'MC' trong cùng cấp
  // AIS   : còn lại (có MC, không có GIS/HGIS)
  const arr = [...typeSet];
  const hasGIS  = arr.some(t => t === 'GIS');
  const hasHGIS = arr.some(t => t === 'HGIS');
  const hasMC   = arr.some(t => t === 'MC');
  if (hasHGIS && hasMC) return 'HGIS_AIS';
  if (hasGIS  && hasMC) return 'HGIS_AIS';
  if (hasHGIS) return 'HGIS';
  if (hasGIS)  return 'GIS';
  return 'AIS';
}

function lytBuildStations(rows) {
  const map = {};
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  rows.forEach(d => {
    const tram = (d.Tram||'').trim(); if (!tram) return;
    const cap  = (d.Cap_dien_ap!==null&&d.Cap_dien_ap!==undefined)?String(d.Cap_dien_ap):null;
    const pl   = (d.Phan_loai_thiet_bi||'').trim();
    const sl   = Number(d.So_luong)||0;
    if (!map[tram]) map[tram]={caps:{},plByCap:{},total:0,maxCap:null};
    if (cap) {
      // Track maxCap từ TẤT CẢ thiết bị để xác định cấp ĐA trạm
      const ni=capPrio[cap]??99, xi=capPrio[map[tram].maxCap]??99;
      if (map[tram].maxCap===null||ni<xi) map[tram].maxCap=cap;
      // caps chỉ tính thiết bị không bị loại trừ
      if (!lytIsExcluded(pl)) {
        map[tram].caps[cap]=(map[tram].caps[cap]||0)+sl;
        if (!map[tram].plByCap[cap]) map[tram].plByCap[cap]=new Set();
        map[tram].plByCap[cap].add(pl.toUpperCase());
      }
    }
    if (!lytIsExcluded(pl)) map[tram].total+=sl;
  });
  return Object.entries(map).map(([tram,info])=>{
    const effCap=info.maxCap;
    let tech=null;
    if (effCap==='2'||effCap==='1') tech=lytClassifyTech(info.plByCap[effCap]||new Set());
    return {tram,maxCap:effCap,tech,...info};
  }).sort((a,b)=>{
    const capPrio2={'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
    const ai=capPrio2[a.maxCap??'']??99, bi=capPrio2[b.maxCap??'']??99;
    if(ai!==bi) return ai-bi;
    return b.total-a.total;
  });
}

function lytHexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function lytChartTooltipOpts() {
  return { backgroundColor:'#1a2332', borderColor:'#1f2d3d', borderWidth:1,
    titleColor:'#e2e8f0', bodyColor:'#8fa3bd', padding:10 };
}

// ── Tram state per chart uid ────────────────────────────────
// ══════════════════════════════════════════════════════
// CHARTS — state, helpers, render
// ══════════════════════════════════════════════════════
const _lytSelectedTram = {};
const _lytHeatmapGroup = {};
let _lytNganCache = null, _lytNganSig = '';

// ── Cache nganMap ───────────────────────────────────────
function lytBuildNganMap(rows) {
  const sig = rows.length + '|' + (rows[0]?.Tram||'');
  if (_lytNganCache && _lytNganSig === sig) return _lytNganCache;
  const NDEFS = [
    { key:'DZ',    fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn ĐZ' },
    { key:'MBA',   fn: d => (d.Phan_loai_thiet_bi||'').trim() === 'MBA' },
    { key:'XT',    fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn XT' },
    { key:'LL',    fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn LL' },
    { key:'TBN',   fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn TBN' },
    { key:'TD',    fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'NgănTD' },
    { key:'KHANG', fn: d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn Kháng' ||
                            (d.Phan_loai_thiet_bi || '').trim() === 'K' ||
                            (d.Phan_loai_thiet_bi || '').trim() === 'Kháng' },
  ];
  const map = {};
  rows.forEach(d => {
    const tram = (d.Tram||'').trim();
    if (!tram || !d.Ngan_thiet_bi) return;
    const pl = (d.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
    // Loại HTTĐ khỏi tổng ngăn
    if (pl === 'HTTĐ' || pl === 'HTTD' || pl.startsWith('HTTD')) return;
    if (!map[tram]) map[tram] = { allNgan:new Set(), totalTB:0 };
    const nm  = map[tram];
    const cap = String(d.Cap_dien_ap ?? '');
    const key = tram + '|||' + d.Ngan_thiet_bi;
    nm.allNgan.add(key);
    if (cap && cap !== '0') {
      NDEFS.forEach(n => {
        if (n.fn(d)) {
          const slot = n.key + '_' + cap;
          if (!nm[slot]) nm[slot] = new Set();
          nm[slot].add(key);
        }
      });
    }
    if (!lytIsExcluded((d.Phan_loai_thiet_bi||'').trim()))
      nm.totalTB += Number(d.So_luong) || 0;
  });
  _lytNganCache = map;
  _lytNganSig   = sig;
  return map;
}

// ── Dropdown helpers ────────────────────────────────────
// Tất cả function dùng id string để tránh closure stale
// ── Dropdown list dùng position:fixed — không bị clip bởi overflow ──
// Hiển thị danh sách trạm, tính vị trí từ anchor element

function lytDdRoot() {
  return document.querySelector('.canvas-area') || document.body;
}

function lytDdClose(uid) {
  const list = document.getElementById('lytDdL_' + uid);
  const trigger = document.getElementById('lytDdSel_' + uid);
  if (list) {
    list.classList.remove('open', 'open-up');
    if (list._outsideHandler) {
      document.removeEventListener('mousedown', list._outsideHandler, true);
      list._outsideHandler = null;
    }
    if (list._resizeHandler) {
      window.removeEventListener('resize', list._resizeHandler, true);
      list._resizeHandler = null;
    }
    list._anchorEl = null;
  }
  if (trigger) trigger.classList.remove('open');
  document.body.classList.remove('lyt-dd-open');
}

function lytDdPosition(uid) {
  const list = document.getElementById('lytDdL_' + uid);
  const anchorEl = list?._anchorEl;
  const root = lytDdRoot();
  if (!list || !anchorEl || !root || !document.body.contains(anchorEl)) {
    lytDdClose(uid);
    return;
  }

  if (list.parentElement !== root) root.appendChild(list);

  const ar = anchorEl.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  const width = Math.max(anchorEl.offsetWidth || 0, 280);

  const rootVisibleHeight = root === document.body ? window.innerHeight : root.clientHeight;
  const rootVisibleWidth  = root === document.body ? window.innerWidth  : root.clientWidth;
  const rootScrollTop  = root === document.body ? window.scrollY : root.scrollTop;
  const rootScrollLeft = root === document.body ? window.scrollX : root.scrollLeft;

  const maxH = Math.max(160, Math.min(320, rootVisibleHeight - 16));
  list.style.maxHeight = maxH + 'px';

  const listH = Math.min(maxH, list.scrollHeight || 300);
  const spaceBelow = rr.bottom - ar.bottom;
  const spaceAbove = ar.top - rr.top;
  const openUp = spaceAbove > spaceBelow && spaceBelow < Math.min(220, listH);

  let left = ar.left - rr.left + rootScrollLeft;
  const minLeft = rootScrollLeft + 8;
  const maxLeft = rootScrollLeft + rootVisibleWidth - width - 8;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  let top = openUp
    ? (ar.top - rr.top + rootScrollTop - listH - 4)
    : (ar.bottom - rr.top + rootScrollTop + 4);

  const minTop = rootScrollTop + 8;
  const maxTop = rootScrollTop + rootVisibleHeight - listH - 8;
  top = Math.max(minTop, Math.min(top, maxTop));

  list.style.width = width + 'px';
  list.style.left = left + 'px';
  list.style.top = top + 'px';
  list.classList.toggle('open-up', openUp);
}

function lytDdShow(uid, anchorEl) {
  const list = document.getElementById('lytDdL_' + uid);
  const trigger = document.getElementById('lytDdSel_' + uid);
  const anchor = anchorEl || trigger;
  const root = lytDdRoot();
  if (!list || !anchor || !root) return;

  const isOpen = list.classList.contains('open');

  document.querySelectorAll('.hm-dd-list-fixed.open').forEach(x => {
    const id = (x.id || '').replace('lytDdL_', '');
    if (id && id !== uid) lytDdClose(id);
  });
  document.querySelectorAll('.hm-tram-trigger.open').forEach(x => {
    if (x !== trigger) x.classList.remove('open');
  });

  if (list.parentElement !== root) root.appendChild(list);

  list._anchorEl = anchor;

  if (isOpen) {
    lytDdPosition(uid);
    return;
  }

  list.classList.add('open');
  if (trigger) trigger.classList.add('open');
  document.body.classList.add('lyt-dd-open');
  lytDdPosition(uid);

  if (!list._wheelHandler) {
    list._wheelHandler = ev => {
      ev.stopPropagation();
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
      if (maxScroll <= 0) return;
      const next = Math.max(0, Math.min(maxScroll, list.scrollTop + ev.deltaY));
      if (next !== list.scrollTop) {
        ev.preventDefault();
        list.scrollTop = next;
      }
    };
    list.addEventListener('wheel', list._wheelHandler, { passive:false });
  }

  const onOut = ev => {
    const currentAnchor = list._anchorEl;
    const search = document.getElementById('lytDdS_' + uid);
    const triggerNow = document.getElementById('lytDdSel_' + uid);
    if (!list.contains(ev.target) && !(currentAnchor && currentAnchor.contains(ev.target)) && !(triggerNow && triggerNow.contains(ev.target)) && !(search && search.contains(ev.target))) {
      lytDdClose(uid);
    }
  };

  if (list._outsideHandler) document.removeEventListener('mousedown', list._outsideHandler, true);
  list._outsideHandler = onOut;
  setTimeout(() => document.addEventListener('mousedown', onOut, true), 30);

  if (list._resizeHandler) {
    window.removeEventListener('resize', list._resizeHandler, true);
  }
  list._resizeHandler = () => lytDdPosition(uid);
  window.addEventListener('resize', list._resizeHandler, true);
}

function lytDdToggle(uid, anchorEl) {
  const list = document.getElementById('lytDdL_' + uid);
  if (!list) return;
  if (list.classList.contains('open')) {
    lytDdClose(uid);
    return;
  }
  lytDdShow(uid, anchorEl);
}

function lytDdFilter(uid, q) {

  const list = document.getElementById('lytDdL_' + uid);
  if (!list) return;
  const lq = (q || '').trim().toLowerCase();
  let cnt = 0;
  list.querySelectorAll('.hm-dd-item').forEach(el => {
    const txt = (el.dataset.val || '').toLowerCase();
    const ok  = !lq || txt.includes(lq);
    el.style.display = ok ? '' : 'none';
    if (ok) {
      cnt++;
      const orig = el.dataset.lbl || '';
      if (lq && orig) {
        const re = new RegExp('(' + lq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        el.innerHTML = orig.replace(re, '<mark>$1</mark>');
      } else {
        el.textContent = orig;
      }
    }
  });
  list.querySelectorAll('.hm-dd-grp').forEach(g => {
    let sib = g.nextElementSibling, any = false;
    while (sib && !sib.classList.contains('hm-dd-grp')) {
      if (sib.style.display !== 'none') any = true;
      sib = sib.nextElementSibling;
    }
    g.style.display = any ? '' : 'none';
  });
  let empty = list.querySelector('.hm-dd-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'hm-dd-empty';
    list.appendChild(empty);
  }
  empty.style.display = cnt ? 'none' : '';
  empty.textContent   = cnt ? '' : 'Không tìm thấy "' + q + '"';

  // Tự mở list nếu đang đóng
  if (!list.classList.contains('open')) {
    const search = document.getElementById('lytDdS_' + uid);
    if (search) lytDdShow(uid, search);
  }
}

function lytDdPick(uid, val, lbl) {
  const trigger = document.getElementById('lytDdSel_' + uid);
  const triggerLabel = trigger ? trigger.querySelector('.hm-tram-trigger-label') : null;
  if (trigger) trigger.dataset.value = val || '';
  if (triggerLabel) triggerLabel.textContent = val ? lbl : '— Tất cả trạm —';

  const search = document.getElementById('lytDdS_' + uid);
  if (search) {
    search.value = '';
    search.placeholder = val ? ('🔍  ' + lbl) : '🔍  Tìm trạm…';
  }

  const list = document.getElementById('lytDdL_' + uid);
  if (list) {
    lytDdClose(uid);
    list.querySelectorAll('.hm-dd-item').forEach(el => {
      el.style.display = '';
      el.textContent   = el.dataset.lbl || '';
      el.classList.toggle('active', el.dataset.val === val);
    });
    list.querySelectorAll('.hm-dd-grp').forEach(g => g.style.display = '');
    const empty = list.querySelector('.hm-dd-empty');
    if (empty) empty.style.display = 'none';
    if (list._outsideHandler) {
      document.removeEventListener('mousedown', list._outsideHandler);
      list._outsideHandler = null;
    }
  }
  lytFilterByTram(uid, val);
}

function lytFilterByTram(uid, tram) {
  _lytSelectedTram[uid] = tram;
  renderChartsSection();
}

// ── Cap pills ───────────────────────────────────────────
if (!window._lytSelCaps)   window._lytSelCaps   = {};
if (!window._lytSortState) window._lytSortState = {};

function lytToggleCap(uid, cap) {
  if (!_lytSelCaps[uid]) _lytSelCaps[uid] = new Set();
  _lytSelCaps[uid].has(cap) ? _lytSelCaps[uid].delete(cap) : _lytSelCaps[uid].add(cap);
  renderChartsSection();
}

function lytSortCol(uid, col) {
  const cur = _lytSortState[uid] || { col:null, dir:'desc' };
  _lytSortState[uid] = { col, dir: (cur.col===col && cur.dir==='desc') ? 'asc' : 'desc' };
  renderChartsSection();
}

function lytToggleChartDetail(uid) {
  window._lytChartDetailOpen = window._lytChartDetailOpen || {};
  // Mặc định false (chế độ nhanh). Bấm = bật chi tiết; bấm lại = tắt
  window._lytChartDetailOpen[uid] = window._lytChartDetailOpen[uid] === true ? false : true;
  renderChartsSection();
}

// ── Export CSV ──────────────────────────────────────────
function lytExportCSVFromFilter() {
  const rows = _chipFiltered.length ? _chipFiltered : _chipAllData;
  if (!rows.length) { showToast('⚠ Không có dữ liệu để xuất'); return; }
  const cols = ['Tram','Cap_dien_ap','Phan_loai_thiet_bi','So_luong','Ngan_thiet_bi','Loai_ngan_lo','Cong_suat','Nam_san_xuat','Nam_van_hanh'];
  const CAP_LBL = {'0':'TT','1':'110kV','2':'220kV','3':'35kV','4':'22kV','6':'6kV','9':'10kV'};
  const header = ['Trạm','Cấp ĐA','Loại TB','Số lượng','Ngăn TB','Loại ngăn','Công suất','Năm SX','Năm VH'];
  const csv = [header.join(','), ...rows.map(d =>
    [d.Tram||'', CAP_LBL[d.Cap_dien_ap]||d.Cap_dien_ap||'', d.Phan_loai_thiet_bi||'',
     d.So_luong||'', d.Ngan_thiet_bi||'', d.Loai_ngan_lo||'',
     d.Cong_suat||'', d.Nam_san_xuat||'', d.Nam_van_hanh||'']
    .map(v => `"${String(v).replace(/"/g,'""')}"`)
    .join(',')
  )].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = `EVN_ThietBi_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function lytExportCSV(uid) {
  const tbl = document.querySelector('#lytChartMain_' + uid + ' .hm-table');
  if (!tbl) return;
  const rows = [];
  tbl.querySelectorAll('thead tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th').forEach(th => {
      const t = (th.innerText||'').replace(/[↑↓\n]/g,' ').trim().replace(/,/g,';');
      for (let i=0; i<(+th.colSpan||1); i++) cells.push(t);
    });
    rows.push(cells.join(','));
  });
  tbl.querySelectorAll('tbody tr').forEach(tr => {
    const c = []; tr.querySelectorAll('td').forEach(td => c.push((td.textContent||'').trim().replace(/,/g,';')));
    if (c.length) rows.push(c.join(','));
  });
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\n')], {type:'text/csv;charset=utf-8'}));
  a.download = 'ngan_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}

// ── Detail panel ────────────────────────────────────────
function lytCellClick(td) {
  const tram = td.dataset.tram, lbl = td.dataset.lbl, ttb = +(td.dataset.ttb)||0;
  const list = (td.dataset.ngan||'').split('|').filter(Boolean);
  let p = document.getElementById('hm-detail-panel');
  if (!p) { p = document.createElement('div'); p.id='hm-detail-panel'; p.className='hm-detail-panel'; document.body.appendChild(p); }
  p.innerHTML = `<div class="hm-resize-grip"></div><div class="hm-detail-hd"><span>📍 ${tram} · ${lbl}</span>
    <span class="hm-detail-close" onclick="this.closest('.hm-detail-panel').classList.remove('open');let bd=document.getElementById('hm-detail-backdrop');if(bd)bd.style.display='none'">✕</span></div>
    <div style="padding:8px 16px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.07)">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono)">
        ${list.length} ngăn · TB: <b style="color:var(--text-primary)">${ttb.toLocaleString('vi-VN')}</b></div>
    </div>
    <div id="hm-detail-body" style="overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch;padding:8px 0;overscroll-behavior:contain">
      ${list.map((n,i)=>`<div class="hm-detail-item" style="padding:5px 16px">${i+1}. ${n}</div>`).join('')}
    </div>`;
  p.classList.add('open');
  _hmOpenPanel(p);
}

// ══════════════════════════════════════════════════════
// renderChartsSection — MAIN
// ══════════════════════════════════════════════════════
function lytSetHeatmapGroup(uid, key) {
  _lytHeatmapGroup[uid] = key;
  renderChartsSection();
}


function buildChartMiniPreview(viewSt, nganMap) {
  if (!viewSt.length) return '';
  const CAP_COL  = LYT_CAP_COLORS;
  const CAP_LBL  = LYT_CAP_LABEL;
  const CAP_PRIO = ['2','1','3','4','9','6','0'];

  // Top 12 trạm theo tổng ngăn, giữ màu theo cấp ĐA
  const ranked = [...viewSt]
    .map(st => ({
      tram: st.tram,
      maxCap: st.maxCap,
      totalNgan: nganMap[st.tram]?.allNgan?.size || 0,
      totalTB:   nganMap[st.tram]?.totalTB || 0,
      color: CAP_COL[st.maxCap] || '#64748b'
    }))
    .sort((a, b) => b.totalNgan - a.totalNgan)
    .slice(0, 12);

  if (!ranked.length) return '';
  const maxVal = Math.max(...ranked.map(r => r.totalNgan), 1);

  return `
  <div style="margin-top:14px">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;margin-bottom:8px;padding:0 4px">
      TOP TRẠM THEO TỔNG NGĂN
    </div>
    <div style="display:grid;gap:5px">
      ${ranked.map(item => {
        const pct = Math.max(6, Math.round((item.totalNgan / maxVal) * 100));
        const capLbl = CAP_LBL[item.maxCap] || '?';
        return `<div style="display:grid;grid-template-columns:140px 1fr 70px;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:6px;overflow:hidden">
            <span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;
              background:${item.color}22;color:${item.color};border:1px solid ${item.color}55;
              flex-shrink:0;white-space:nowrap">${capLbl}</span>
            <span style="font-size:10px;color:#d0ddf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${item.tram}</span>
          </div>
          <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.07);overflow:hidden">
            <div style="height:100%;width:${pct}%;border-radius:999px;
              background:linear-gradient(90deg,${item.color}ee,${item.color}88);
              box-shadow:0 0 8px ${item.color}66;transition:width .4s"></div>
          </div>
          <div style="font-family:var(--font-mono);font-size:10px;color:${item.color};font-weight:700;text-align:right;white-space:nowrap">
            ${item.totalNgan.toLocaleString('vi-VN')} <span style="font-weight:400;opacity:.7;font-size:9px">ngăn</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderChartsSection() {
  if (!_chipAllData.length) return;
  const chartsItem = layout.find(l => l.type === 'charts');
  if (!chartsItem) return;
  if (!document.querySelector(`.section-wrapper[data-uid="${chartsItem.uid}"]`)) return;
  if (!chartsItem.props.visible) { destroyChartResources(chartsItem.uid); return; }

  const uid = chartsItem.uid;
  // ── Guard: nếu mainEl đã có nội dung real (không phải spinner) VÀ
  //    cùng data signature → skip re-render hoàn toàn (0ms)
  const mainElCheck = document.getElementById('lytChartMain_' + uid);
  const currentSig  = (_chipFiltered.length || _chipAllData.length) + '|' + (_lytSelectedTram[uid]||'') + '|' + ((window._lytChartDetailOpen||{})[uid]);
  if (mainElCheck && mainElCheck._renderSig === currentSig && !mainElCheck.querySelector('.fa-spinner')) {
    return; // nội dung đã đúng, không cần render lại
  }

  // ── Self-healing: nếu lytChartMain_uid bị xoá (do skeleton hay rebuild),
  //    tạo lại element trước khi render nội dung vào
  if (!mainElCheck) {
    const wrapper = document.querySelector(`.section-wrapper[data-uid="${uid}"]`);
    const prev = wrapper?.querySelector('.card-preview');
    if (!prev) return;
    // Đảm bảo lytChartsWrap tồn tại hoặc tạo mới
    let wrap = document.getElementById('lytChartsWrap_' + uid);
    if (!wrap) {
      prev.innerHTML = `<div class="lyt-charts-wrap" id="lytChartsWrap_${uid}">
        <div id="lytChartMain_${uid}" style="min-height:60px"></div>
      </div>`;
    } else {
      wrap.innerHTML = `<div id="lytChartMain_${uid}" style="min-height:60px"></div>`;
    }
    // Xác nhận đã tạo xong
    if (!document.getElementById('lytChartMain_' + uid)) return;
  }

  const baseRows = _chipFiltered.length ? _chipFiltered : _chipAllData;
  const CAP_LBL  = LYT_CAP_LABEL;    // {0:TT, 1:110kV, 2:220kV, 3:35kV, 4:22kV, 6:6kV, 9:10kV}
  const CAP_COL  = LYT_CAP_COLORS;
  const CAP_ORDER_LBL = ['220kV','110kV','35kV','22kV','10kV','6kV'];

  const allSt   = lytBuildStations(baseRows);
  const nganMap = lytBuildNganMap(baseRows);   // cached

  const NGAN_DEFS = [
    { key:'DZ',    label:'Ngăn ĐZ',       color:'#00c8ff' },
    { key:'MBA',   label:'MBA',       color:'#ffd740' },
    { key:'XT',    label:'Ngăn XT',        color:'#00e676' },
    { key:'LL',    label:'Ngăn LL',        color:'#18ffff' },
    { key:'TBN',   label:'Ngăn TBN',       color:'#b388ff' },
    { key:'TD',    label:'Ngăn TD',        color:'#ff9100' },
    { key:'KHANG', label:'Ngăn Kháng',     color:'#ff4081' },
  ];

  const selTram   = _lytSelectedTram[uid] || '';
  const selCaps   = _lytSelCaps[uid]   || new Set();
  const sortState = _lytSortState[uid] || { col:null, dir:'desc' };
  // Mặc định hiển thị bảng đầy đủ (heatmap); người dùng bấm "Thu gọn" để chuyển chế độ nhanh
  const detailOpen = (window._lytChartDetailOpen || {})[uid] !== false;

  // Danh sách trạm hiển thị
  let viewSt = selTram ? allSt.filter(s => s.tram === selTram) : allSt;
  if (selCaps.size > 0) viewSt = viewSt.filter(s => selCaps.has(s.maxCap));


  // Fast path: nếu chỉ đang xem preview gọn thì không dựng heatmap chi tiết để tránh lag.
  const capPFast = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const capsUsedFast=[...new Set(allSt.map(s=>s.maxCap).filter(c=>c&&c!=='0'))].sort((a,b)=>(capPFast[a]??9)-(capPFast[b]??9));
  const byGrpFast={};
  allSt.forEach(s=>{const l=CAP_LBL[s.maxCap]||'?';if(!byGrpFast[l])byGrpFast[l]=[];byGrpFast[l].push(s);});
  let ddHTMLFast=`<div class="hm-dd-item${!selTram?' active':''}" data-val="" data-lbl="— Tất cả trạm —"
    onmousedown="event.preventDefault();event.stopPropagation();lytDdPick('${uid}','','')">— Tất cả trạm —</div>`;
  CAP_ORDER_LBL.forEach(capLbl=>{
    const arr=byGrpFast[capLbl];if(!arr||!arr.length)return;
    ddHTMLFast+=`<div class="hm-dd-grp">── ${capLbl} ──</div>`;
    arr.forEach(s=>{
      const tl=(s.tech||'').replace('_AIS',' – AIS');
      const lbl=s.tram+(tl?'  ['+tl+']':'');
      const ev=s.tram.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const el=lbl.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      ddHTMLFast+=`<div class="hm-dd-item${selTram===s.tram?' active':''}" data-val="${s.tram}" data-lbl="${lbl}"
        onmousedown="event.preventDefault();event.stopPropagation();lytDdPick('${uid}','${ev}','${el}')">${lbl}</div>`;
    });
  });
  const totalTBPreview = viewSt.reduce((sum, st) => sum + (nganMap[st.tram]?.totalTB || 0), 0);
  const totalNganPreview = viewSt.reduce((sum, st) => sum + (nganMap[st.tram]?.allNgan.size || 0), 0);
  let subFast='';
  if (selTram&&viewSt[0]) {
    const st=viewSt[0],nm=nganMap[st.tram],tk=st.tech||(st.maxCap==='2'||st.maxCap==='1'?'AIS':'OTHER');
    const TECH_LBL = {GIS:'GIS',HGIS:'HGIS',HGIS_AIS:'HGIS – AIS',AIS:'AIS',OTHER:'35kV/22kV/6kV'};
    const TECH_COL = {GIS:'#b388ff',HGIS:'#18ffff',HGIS_AIS:'#ff9100',AIS:'#00c8ff',OTHER:'#7a8fa8'};
    subFast=`<b style="color:var(--accent)">📍 ${selTram}</b> · Cấp:<b style="color:${CAP_COL[st.maxCap]||'#888'}">${CAP_LBL[st.maxCap]||''}</b>`+
      ` · CN:<b style="color:${TECH_COL[tk]}">${TECH_LBL[tk]}</b>`+
      ` · Ngăn:<b style="color:var(--text-primary)">${nm?.allNgan.size||0}</b>`+
      ` · TB:<b style="color:var(--text-primary)">${(nm?.totalTB||0).toLocaleString('vi-VN')}</b>`;
  } else {
    const totalTBPreview = viewSt.reduce((s,x)=>{
      const nm=nganMap[x.tram]; return s+(nm?.totalTB||0);
    },0);
    const selTBPreview = baseRows.reduce((s,d)=>s+(Number(d.So_luong)||0),0);
    subFast=`<span style="color:var(--text-muted)">Trạm:</span> <b style="color:var(--accent)">${viewSt.length}</b><span style="color:var(--text-muted)">/${allSt.length}</span>`+
      ` &nbsp;│&nbsp; <span style="color:var(--text-muted)">Ngăn:</span> <b style="color:var(--accent)">${totalNganPreview.toLocaleString('vi-VN')}</b>`+
      ` &nbsp;│&nbsp; <span style="color:var(--text-muted)">Thiết bị:</span> <b style="color:#00e676">${selTBPreview.toLocaleString('vi-VN')}</b>`;
  }
  const mainElFast=document.getElementById(`lytChartMain_${uid}`);
  if(!mainElFast)return;
  let ddListElFast = document.getElementById('lytDdL_' + uid);
  if (!ddListElFast) {
    ddListElFast = document.createElement('div');
    ddListElFast.id        = 'lytDdL_' + uid;
    ddListElFast.className = 'hm-dd-list-fixed';
  }
  ddListElFast.innerHTML = ddHTMLFast;
  const ddRootFast = lytDdRoot();
  if (!ddListElFast.isConnected || ddListElFast.parentElement !== ddRootFast) ddRootFast.appendChild(ddListElFast);
  if (!detailOpen) {
    mainElFast.innerHTML=`
      <div class="hm-filter-bar" style="padding:6px 0">
        ${_selectedChips.size ? `<span class="chart-sync-badge"><i class="fas fa-filter"></i> Đang lọc theo: ${[..._selectedChips].slice(0,4).join(', ')}${_selectedChips.size > 4 ? ` +${_selectedChips.size - 4}` : ''}</span>` : ''}
      </div>
      <div class="hm-sub-bar">${subFast}</div>
      <div class="chart-preview-note"><i class="fas fa-bolt" style="color:var(--accent);margin-right:6px"></i>Đang dùng chế độ xem nhanh để mở layout mượt hơn. Heatmap đầy đủ hiện có <b>${viewSt.length.toLocaleString('vi-VN')}</b> trạm và khoảng <b>${NGAN_DEFS.length * Math.max(1, capsUsedFast.length)}</b> cột dữ liệu. Chỉ dựng bảng heatmap khi bạn bấm <b>Xem bảng chi tiết</b>.</div>
      <div style="margin-top:10px;width:100%">${buildChartMiniPreview(viewSt, nganMap)}</div>>`;
    lytRenderPieChart(uid, baseRows, selTram);
    // Lưu signature cho fast mode
    if (mainElFast) mainElFast._renderSig = currentSig;
    return;
  }

  // Tổ hợp (nganKey × cap) — scan TOÀN BỘ nganMap, không qua allSt.caps[]
  // Lấy tất cả cấp ĐA thực có trong data (theo thứ tự ưu tiên, bỏ TT=0)
  const CAP_PRIO = ['2','1','3','4','9','6','0'];
  const ALL_CAPS = CAP_PRIO.filter(cap =>
    cap !== '0' &&
    Object.values(nganMap).some(nm =>
      Object.keys(nm).some(k => k.endsWith('_' + cap) && nm[k]?.size > 0)
    )
  );
  const usedHeatDefs = NGAN_DEFS.filter(n => ALL_CAPS.some(cap => Object.values(nganMap).some(nm => nm[n.key + '_' + cap]?.size > 0)));
  const activeHeatGroup = _lytHeatmapGroup[uid] || ((window.innerWidth < 1180 && usedHeatDefs[0]) ? usedHeatDefs[0].key : 'all');
  if (!_lytHeatmapGroup[uid]) _lytHeatmapGroup[uid] = activeHeatGroup;
  const scopedHeatDefs = activeHeatGroup === 'all' ? usedHeatDefs : usedHeatDefs.filter(n => n.key === activeHeatGroup);
  const activeCombos = [];
  scopedHeatDefs.forEach(n => {
    ALL_CAPS.forEach(cap => {
      const slot = n.key + '_' + cap;
      const has  = Object.values(nganMap).some(nm => nm[slot]?.size > 0);
      if (has) activeCombos.push({
        nganKey: n.key, cap, slot,
        nganLbl: n.label, capLbl: CAP_LBL[cap]||cap,
        color: n.color, capColor: CAP_COL[cap]||'#888'
      });
    });
  });
  const heatModeHTML = ['all', ...usedHeatDefs.map(n => n.key)].map(key => {
    const isAll = key === 'all';
    const def = usedHeatDefs.find(n => n.key === key);
    const label = isAll ? 'Tất cả cột' : (def?.label || key);
    return `<span class="heat-mode-pill ${activeHeatGroup === key ? 'active' : ''}" onclick="lytSetHeatmapGroup('${uid}','${key}')">${label}</span>`;
  }).join('');

  // Nhóm CN
  const TECH_ORD = ['GIS','HGIS','HGIS_AIS','AIS','OTHER'];
  const TECH_LBL = {GIS:'GIS',HGIS:'HGIS',HGIS_AIS:'HGIS – AIS',AIS:'AIS',OTHER:'35kV/22kV/6kV'};
  const TECH_COL = {GIS:'#b388ff',HGIS:'#18ffff',HGIS_AIS:'#ff9100',AIS:'#00c8ff',OTHER:'#7a8fa8'};
  const capP = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const groups = {GIS:[],HGIS:[],HGIS_AIS:[],AIS:[],OTHER:[]};
  viewSt.forEach(s => {
    if (s.maxCap==='2'||s.maxCap==='1') (groups[s.tech]||groups['AIS']).push(s);
    else groups['OTHER'].push(s);
  });
  Object.values(groups).forEach(arr =>
    arr.sort((a,b) => (capP[a.maxCap??'']??9)-(capP[b.maxCap??'']??9)||b.total-a.total)
  );
  if (sortState.col) {
    const flat = TECH_ORD.flatMap(tk => groups[tk]);
    flat.sort((a,b) => {
      const va = sortState.col==='total'?(nganMap[a.tram]?.allNgan.size||0):(nganMap[a.tram]?.[sortState.col]?.size||0);
      const vb = sortState.col==='total'?(nganMap[b.tram]?.allNgan.size||0):(nganMap[b.tram]?.[sortState.col]?.size||0);
      return sortState.dir==='asc'?va-vb:vb-va;
    });
    TECH_ORD.forEach(tk=>groups[tk]=[]);
    flat.forEach(s=>{if(s.maxCap==='2'||s.maxCap==='1')(groups[s.tech]||groups['AIS']).push(s);else groups['OTHER'].push(s);});
  }

  // maxVal
  const colMax = {};
  activeCombos.forEach(c => { colMax[c.slot]=Math.max(...viewSt.map(s=>nganMap[s.tram]?.[c.slot]?.size||0),1); });
  const maxTot = Math.max(...viewSt.map(s=>nganMap[s.tram]?.allNgan.size||0),1);

  // Anomaly
  const anomaly = {};
  activeCombos.forEach(c => {
    const vals = viewSt.map(s=>nganMap[s.tram]?.[c.slot]?.size||0).filter(v=>v>0);
    if (vals.length<3) return;
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    const std=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length);
    if (std===0) return;
    viewSt.forEach(s=>{const v=nganMap[s.tram]?.[c.slot]?.size||0;if(v>0&&Math.abs(v-mean)>2*std){if(!anomaly[s.tram])anomaly[s.tram]=new Set();anomaly[s.tram].add(c.slot);}});
  });

  // Dropdown items
  const byGrp={};
  allSt.forEach(s=>{const l=CAP_LBL[s.maxCap]||'?';if(!byGrp[l])byGrp[l]=[];byGrp[l].push(s);});
  let ddHTML=`<div class="hm-dd-item${!selTram?' active':''}" data-val="" data-lbl="— Tất cả trạm —"
    onmousedown="event.preventDefault();event.stopPropagation();lytDdPick('${uid}','','')">— Tất cả trạm —</div>`;
  CAP_ORDER_LBL.forEach(capLbl=>{
    const arr=byGrp[capLbl];if(!arr||!arr.length)return;
    ddHTML+=`<div class="hm-dd-grp">── ${capLbl} ──</div>`;
    arr.forEach(s=>{
      const tl=(s.tech||'').replace('_AIS',' – AIS');
      const lbl=s.tram+(tl?'  ['+tl+']':'');
      const ev=s.tram.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const el=lbl.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      ddHTML+=`<div class="hm-dd-item${selTram===s.tram?' active':''}" data-val="${s.tram}" data-lbl="${lbl}"
        onmousedown="event.preventDefault();event.stopPropagation();lytDdPick('${uid}','${ev}','${el}')">${lbl}</div>`;
    });
  });

  // Cap pills
  const capsUsed=[...new Set(allSt.map(s=>s.maxCap).filter(c=>c&&c!=='0'))].sort((a,b)=>(capP[a]??9)-(capP[b]??9));
  const pillsHTML=capsUsed.map(cap=>
    `<span class="hm-cap-pill${selCaps.has(cap)?' active':''}" style="color:${CAP_COL[cap]||'#888'}"
      onclick="lytToggleCap('${uid}','${cap}')">${CAP_LBL[cap]||cap}</span>`
  ).join('');

  // Sub-label
  let sub='';
  if (selTram&&viewSt[0]) {
    const st=viewSt[0],nm=nganMap[st.tram],tk=st.tech||(st.maxCap==='2'||st.maxCap==='1'?'AIS':'OTHER');
    sub=`<b style="color:var(--accent)">📍 ${selTram}</b> · Cấp:<b style="color:${CAP_COL[st.maxCap]||'#888'}">${CAP_LBL[st.maxCap]||''}</b>`+
      ` · CN:<b style="color:${TECH_COL[tk]}">${TECH_LBL[tk]}</b>`+
      ` · Ngăn:<b style="color:var(--text-primary)">${nm?.allNgan.size||0}</b>`+
      ` · TB:<b style="color:var(--text-primary)">${(nm?.totalTB||0).toLocaleString('vi-VN')}</b>`;
  } else {
    const tot=viewSt.reduce((s,x)=>s+(nganMap[x.tram]?.allNgan.size||0),0);
    const totalTBDetail = baseRows.reduce((s,d)=>s+(Number(d.So_luong)||0),0);
    sub=`<span style="color:var(--text-muted)">Trạm:</span> <b style="color:var(--accent)">${viewSt.length}</b><span style="color:var(--text-muted)">/${allSt.length}</span>`+
      ` &nbsp;│&nbsp; <span style="color:var(--text-muted)">Ngăn:</span> <b style="color:var(--accent)">${tot.toLocaleString('vi-VN')}</b>`+
      ` &nbsp;│&nbsp; <span style="color:var(--text-muted)">Thiết bị:</span> <b style="color:#00e676">${totalTBDetail.toLocaleString('vi-VN')}</b>`;
  }

  // Header 2 tầng
  const nganGrps={};
  activeCombos.forEach(c=>{if(!nganGrps[c.nganKey])nganGrps[c.nganKey]=[];nganGrps[c.nganKey].push(c);});
  let hR1=`<tr>`,hR2=`<tr>`;
  hR1+=`<th class="hm-th-grp" rowspan="2" style="vertical-align:middle">CN<span class="hm-resize-handle" data-col="0"></span></th>`;
  hR1+=`<th class="hm-th-tram" rowspan="2" style="vertical-align:middle">Trạm<span class="hm-resize-handle" data-col="1"></span></th>`;
  let ci=2; const colOrder=[];
  scopedHeatDefs.forEach(n=>{
    const combo=nganGrps[n.key];if(!combo||!combo.length)return;
    hR1+=`<th class="hm-th-ngan-grp" colspan="${combo.length}" style="color:${n.color};border-left:2px solid ${n.color}44">${n.label}</th>`;
    combo.forEach(c=>{
      const sc=sortState.col===c.slot?(sortState.dir==='asc'?' sort-asc':' sort-desc'):'';
      hR2+=`<th class="hm-th-cap${sc}" style="color:${c.capColor}" onclick="lytSortCol('${uid}','${c.slot}')">${c.capLbl}<span class="hm-resize-handle" data-col="${ci}"></span></th>`;
      colOrder.push({...c,ci});ci++;
    });
  });
  const scT=sortState.col==='total'?(sortState.dir==='asc'?' sort-asc':' sort-desc'):'';
  hR1+=`<th class="hm-th-total${scT}" rowspan="2" style="vertical-align:middle" onclick="lytSortCol('${uid}','total')">Tổng ngăn<span class="hm-resize-handle" data-col="${ci}"></span></th>`;
  hR1+=`<th class="hm-th-total" rowspan="2" style="vertical-align:middle">Tổng TB<span class="hm-resize-handle" data-col="${ci+1}"></span></th>`;
  hR1+=`</tr>`;hR2+=`</tr>`;

  // Rows
  function rgba(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}
  let rows='',hasData=false;
  TECH_ORD.forEach(tk=>{
    const arr=groups[tk];if(!arr.length)return;hasData=true;
    arr.forEach((s,i)=>{
      const nm=nganMap[s.tram],tot=nm?.allNgan.size||0;
      rows+=`<tr>`;
      if(i===0) rows+=`<td class="hm-cell-grp" rowspan="${arr.length}" style="color:${TECH_COL[tk]};border-top:2px solid ${TECH_COL[tk]}55"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:2px;background:${TECH_COL[tk]};display:inline-block;flex-shrink:0"></span>${TECH_LBL[tk]}</span></td>`;
      const cl=CAP_LBL[s.maxCap]||'';
      rows+=`<td class="hm-cell-tram" style="color:#c8d8ec">${s.tram}<span style="font-size:7.5px;color:${CAP_COL[s.maxCap]||'#888'};margin-left:4px;font-weight:700">${cl}</span></td>`;
      colOrder.forEach(c=>{
        const v=nm?.[c.slot]?.size||0;
        if(!v){rows+=`<td class="hm-cell-cap" style="color:rgba(255,255,255,0.18)">—</td>`;}
        else{
          const it=0.20+(v/colMax[c.slot])*0.72,ia=anomaly[s.tram]?.has(c.slot);
          const nl=[...(nm[c.slot]||[])].map(k=>k.split('|||')[1]).join('|');
          rows+=`<td class="hm-cell-cap${ia?' hm-cell-anomaly':''}" style="background:${rgba(c.color,it)};color:${it>0.42?'#ffffff':c.color};font-weight:${it>0.42?'700':'600'}" data-tram="${s.tram}" data-lbl="${c.nganLbl} ${c.capLbl}" data-ngan="${nl}" data-ttb="${nm?.totalTB||0}" data-tip="${s.tram}·${c.nganLbl} ${c.capLbl}:${v}ngăn" onclick="lytCellClick(this)">${v}</td>`;
        }
      });
      const it=tot?0.15+(tot/maxTot)*0.65:0;
      rows+=tot?`<td class="hm-cell-total" style="background:rgba(232,237,245,${it*0.22});color:#e8edf5;font-weight:800">${tot}</td>`:`<td class="hm-cell-total" style="color:rgba(255,255,255,0.2)">—</td>`;
      rows+=`<td class="hm-cell-total">${(nm?.totalTB||0).toLocaleString('vi-VN')}</td></tr>`;
    });
  });
  if(!hasData)rows=`<tr><td colspan="${colOrder.length+4}" style="text-align:center;padding:24px;color:var(--text-muted);font-family:var(--font-mono)"><i class="fas fa-inbox"></i> Không có dữ liệu</td></tr>`;

  // colWidths từ localStorage
  const lsKey=`hm_${uid}`;
  let W;try{W=JSON.parse(localStorage.getItem(lsKey)||'null');}catch(e){W=null;}
  if(!W||W.length!==colOrder.length+4) W=[90,130,...colOrder.map(()=>58),68,68];

  // Inject
  const totalTBPreviewHeavy = viewSt.reduce((sum, st) => sum + (nganMap[st.tram]?.totalTB || 0), 0);
  const totalNganPreviewHeavy = viewSt.reduce((sum, st) => sum + (nganMap[st.tram]?.allNgan.size || 0), 0);
  const mainEl=document.getElementById(`lytChartMain_${uid}`);
  if(!mainEl)return;
  // Dropdown list dạng popup chuẩn, mount vào canvas-area để bám đúng theo vùng cuộn
  let ddListEl = document.getElementById('lytDdL_' + uid);
  if (!ddListEl) {
    ddListEl = document.createElement('div');
    ddListEl.id        = 'lytDdL_' + uid;
    ddListEl.className = 'hm-dd-list-fixed';
  }
  ddListEl.innerHTML = ddHTML;
  const ddRoot = lytDdRoot();
  if (!ddListEl.isConnected || ddListEl.parentElement !== ddRoot) {
    ddRoot.appendChild(ddListEl);
  }

  mainEl.innerHTML=`
    <div id="hm-tooltip"></div>
    <div class="hm-filter-bar" style="padding:4px 0">
      ${_selectedChips.size ? `<span class="chart-sync-badge"><i class="fas fa-filter"></i> Đang lọc theo: ${[..._selectedChips].slice(0,4).join(', ')}${_selectedChips.size > 4 ? ` +${_selectedChips.size - 4}` : ''}</span>` : ''}


      </div>
    <div class="hm-sub-bar">${sub}</div>
    
      <div style="margin-top:10px"><div>
        ${detailOpen ? `
          <div class="hm-filter-bar" style="padding:0"></div>
          <div class="hm-wrap" id="lytHW_${uid}">
            <table class="hm-table" id="lytHT_${uid}">
              <colgroup id="lytCG_${uid}">${W.map(w=>`<col style="width:${w}px">`).join('')}</colgroup>
              <thead>${hR1}${hR2}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        ` : `<div class="chart-preview-note"><i class="fas fa-eye-slash" style="color:var(--accent);margin-right:6px"></i>Bảng chi tiết theo trạm/cấp đang được ẩn để màn hình dễ đọc hơn. Chỉ mở khi cần rà soát từng cột hoặc xuất CSV.</div>`}
      </div
      </div>>`;


  if (ddListEl.parentElement !== ddRoot) ddRoot.appendChild(ddListEl);

  if (detailOpen) lytInitHmTable(uid, W, lsKey);
  lytRenderPieChart(uid, baseRows, selTram);

  // Lưu signature để guard có thể skip re-render lần sau
  if (mainEl) mainEl._renderSig = currentSig;

  // Tooltip
  const tip=document.getElementById('hm-tooltip');
  if(tip) mainEl.querySelectorAll('[data-tip]').forEach(td=>{
    td.addEventListener('mouseenter',()=>{
      tip.innerHTML=`<b>${td.dataset.tram}</b><br>${td.dataset.lbl}: <b>${td.textContent}</b> ngăn`;
      tip.style.display='block';
      const r=td.getBoundingClientRect();
      tip.style.left=Math.min(r.left,window.innerWidth-230)+'px';
      tip.style.top=(r.bottom+5)+'px';
    });
    td.addEventListener('mouseleave',()=>tip.style.display='none');
  });
}

// ── Sticky + resize ─────────────────────────────────────
function lytInitHmTable(uid, W, lsKey) {
  const colg=document.getElementById('lytCG_'+uid);
  const tbl =document.getElementById('lytHT_'+uid);
  if(!colg||!tbl)return;
  const cols=Array.from(colg.querySelectorAll('col'));
  function upSticky(){
    tbl.querySelectorAll('.hm-th-grp,.hm-cell-grp').forEach(el=>el.style.left='0px');
    tbl.querySelectorAll('.hm-th-tram,.hm-cell-tram').forEach(el=>el.style.left=W[0]+'px');
  }
  upSticky();
  let raf=0;
  tbl.querySelectorAll('.hm-resize-handle').forEach(h=>{
    h.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const idx=+h.dataset.col,sx=e.clientX,sw=W[idx];
      document.body.style.cursor='col-resize';document.body.style.userSelect='none';
      const mv=ev=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        const nw=Math.max(36,sw+ev.clientX-sx);W[idx]=nw;
        if(cols[idx])cols[idx].style.width=nw+'px';
        upSticky();
        if(lsKey)try{localStorage.setItem(lsKey,JSON.stringify(W));}catch(_){}
      });};
      const up=()=>{document.body.style.cursor='';document.body.style.userSelect='';
        document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    });
  });
}


// ── Pie chart thiết bị (đồng bộ logic với app.js renderPieChart) ─
const _lytPieCharts = {};

function lytRenderPieChart(uid, rows, selTram) {
  const cvs = document.getElementById('lytPieChart_' + uid);
  if (!cvs || typeof Chart === 'undefined') return;

  function isExcl(pl) {
    if (!pl) return true;
    const n = pl.trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
    if (n.startsWith('TICHAN')||n.includes('TICHAN')) return true;
    if (n==='HTTD'||n.startsWith('HTTD')) return true;
    if (n==='RL') return true;
    return false;
  }

  const src = selTram ? rows.filter(d=>(d.Tram||'').trim()===selTram) : rows;
  const counts = {};
  src.forEach(d => {
    const pl = (d.Phan_loai_thiet_bi||'').trim();
    if (!pl || isExcl(pl)) return;
    counts[pl] = (counts[pl]||0) + (Number(d.So_luong)||0);
  });

  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const top    = sorted.slice(0,12);
  const others = sorted.slice(12).reduce((s,e)=>s+e[1],0);
  if (others>0) top.push(['Khác', others]);
  if (!top.length) return;

  const labels = top.map(e=>e[0]);
  const values = top.map(e=>e[1]);
  const total  = values.reduce((a,b)=>a+b,0);
  const PAL    = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#ec4899','#14b8a6','#f97316','#84cc16','#a78bfa','#fb923c','#60a5fa'];
  const colors = labels.map((_,i)=>PAL[i%PAL.length]);

  // ── Tối ưu #11: dùng Chart.getChart() để destroy chart cũ nếu có
  // Tránh memory leak khi rerender chart mà không xóa instance cũ.
  // Trước: chỉ check _lytPieCharts dict — có thể bị mất ref khi DOM rerender
  // Sau:  Chart.getChart(canvas) tìm theo DOM thực, an toàn 100%
  const existingChart = Chart.getChart(cvs);
  if (existingChart) existingChart.destroy();
  if (_lytPieCharts[uid]) { try { _lytPieCharts[uid].destroy(); } catch(_) {} delete _lytPieCharts[uid]; }

  _lytPieCharts[uid] = new Chart(cvs.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets:[{ data:values, backgroundColor:colors.map(c=>c+'cc'), borderColor:colors, borderWidth:2, hoverOffset:10 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'55%', animation:{duration:300},
      plugins:{
        legend:{ display: false },
        tooltip:{
          backgroundColor:'rgba(15,23,42,0.92)', titleColor:'#e8edf5', bodyColor:'#8fa3bd',
          borderColor:'rgba(255,255,255,0.12)', borderWidth:1,
          callbacks:{
            title: c=>c[0].label,
            label: c=>[' '+Number(c.parsed).toLocaleString('vi-VN')+' thiết bị',' '+((c.parsed/total)*100).toFixed(1)+'%']
          }
        }
      }
    }
  });

  // Render custom legend — readable, compact rows
  const legendEl = document.getElementById('lytPieLegend_' + uid);
  if (legendEl) {
    legendEl.innerHTML = labels.map((lbl, i) => {
      const pct = ((values[i]/total)*100).toFixed(1);
      const val = values[i].toLocaleString('vi-VN');
      const barW = Math.max(4, Math.round((values[i]/values[0])*100));
      return `<div style="display:grid;grid-template-columns:10px 52px 1fr 46px;gap:6px;align-items:center;cursor:pointer"
                   title="${lbl}: ${val} (${pct}%)">
        <span style="width:10px;height:10px;border-radius:2px;background:${colors[i]};flex-shrink:0;display:inline-block"></span>
        <span style="font-size:10px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</span>
        <div style="height:6px;border-radius:999px;background:var(--border);overflow:hidden">
          <div style="height:100%;width:${barW}%;background:${colors[i]}cc;border-radius:999px"></div>
        </div>
        <span style="font-size:9px;color:${colors[i]};font-family:var(--font-mono);font-weight:700;text-align:right">${pct}%</span>
      </div>`;
    }).join('');
  }

  const lbl = document.getElementById('lytPieTramLbl_'+uid);
  if (lbl) lbl.textContent = selTram ? '· '+selTram : '';
}

// ── LIVE FILTER SECTION ─────────────────────────────────────
const _lf = { tram:'', cap:'', type:'', year:'', opyr:'', search:'' };

function _lfUid() {
  const fi = layout.find(l => l.type === 'filter');
  return fi ? (fi.uid || 'f') : 'f';
}

// Called after data loads → init default labels (no populate yet)
function renderLiveFilterSection() {
  if (!_chipAllData.length) return;
  const uid = _lfUid();
  const hasFilter = _lf.tram||_lf.cap||_lf.type||_lf.year||_lf.opyr||_lf.search;
  const CAP_LBL = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};

  // Update active state of triggers
  const labels = {
    tram: _lf.tram || '— Tất cả trạm —',
    cap:  _lf.cap  ? (CAP_LBL[_lf.cap]||_lf.cap) : 'Cấp điện áp',
    type: _lf.type || 'Loại thiết bị',
    year: _lf.year || 'Năm SX',
    opyr: _lf.opyr || 'Năm VH',
  };
  ['tram','cap','type','year','opyr'].forEach(key => {
    const lbl = document.getElementById(`lf_lbl_${key}_${uid}`);
    const btn = document.getElementById(`lytDdSel_lf_${key}_${uid}`);
    if (lbl) lbl.textContent = labels[key];
    if (btn) {
      const active = !!_lf[key];
      btn.classList.toggle('open', active);
      btn.style.borderColor = active ? 'rgba(0,200,255,.5)' : '';
      btn.style.color       = active ? 'var(--accent)'      : '';
      btn.style.background  = active ? 'var(--accent-dim)'  : '';
    }
  });
  const rst = document.getElementById(`lf_reset_${uid}`);
  if (rst) rst.style.display = hasFilter ? 'inline-flex' : 'none';
}

// ── LAZY POPULATE: populate list when user clicks trigger ──
function _lfPopulate(key, anchorBtn) {
  if (!_chipAllData.length) return;
  const uid = _lfUid();
  const ddUid = `lf_${key}_${uid}`;
  const listId = `lytDdL_lf_${key}_${uid}`;
  const CAP_ORDER = ['2','1','3','4','9','6','0'];
  const CAP_LBL   = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const capPrio   = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};

  // Ensure list element exists and is in canvas-area (same as Charts)
  let list = document.getElementById(listId);
  if (!list) {
    list = document.createElement('div');
    list.id = listId;
    list.className = 'hm-dd-list-fixed';
    lytDdRoot().appendChild(list);
  }

  let html = '';

  if (key === 'tram') {
    // Build tramMaxCap + tramCaps for linkage
    const tramMaxCap = {}, tramCaps = {};
    _chipAllData.forEach(d => {
      const t = (d.Tram||'').trim(); if(!t) return;
      const cv = String(d.Cap_dien_ap??''); if(!cv||cv==='null') return;
      if(!tramMaxCap[t]||(capPrio[cv]??9)<(capPrio[tramMaxCap[t]]??9)) tramMaxCap[t]=cv;
      if(!tramCaps[t]) tramCaps[t]=new Set();
      tramCaps[t].add(cv);
    });
    // Store tramCaps for cap dropdown linkage
    list._tramCaps = tramCaps;
    list._tramMaxCap = tramMaxCap;

    const tramsAll = [...new Set(_chipAllData.map(d=>(d.Tram||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
    const byGrp = {};
    tramsAll.forEach(t => {
      const cap = tramMaxCap[t] || '?';
      const lbl = CAP_LBL[cap] || cap;
      if(!byGrp[lbl]) byGrp[lbl] = [];
      byGrp[lbl].push(t);
    });

    // Search box
    html = `<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;background:var(--bg-surface);z-index:1">
      <input type="text" id="lytDdS_lf_tram_${uid}" placeholder="🔍 Tìm trạm..."
        style="width:100%;box-sizing:border-box;padding:4px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:var(--text-primary);font-size:10px;outline:none"
        oninput="lytDdFilter('lf_tram_${uid}',this.value)" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onkeydown="event.stopPropagation()">
    </div>`;

    html += `<div class="hm-dd-item${!_lf.tram?' active':''}" data-val="" data-lbl="— Tất cả trạm —"
      onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('tram','','— Tất cả trạm —')">— Tất cả trạm —</div>`;

    CAP_ORDER.forEach(cap => {
      const grpLbl = CAP_LBL[cap];
      const arr = byGrp[grpLbl]; if(!arr||!arr.length) return;
      html += `<div class="hm-dd-grp">── ${grpLbl} ──</div>`;
      arr.forEach(t => {
        const ev = t.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        html += `<div class="hm-dd-item${_lf.tram===t?' active':''}" data-val="${t}" data-lbl="${t}"
          onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('tram','${ev}','${ev}')">${t}</div>`;
      });
    });

  } else if (key === 'cap') {
    // Caps available depend on selected tram (linkage)
    const tramList = document.getElementById(`lytDdL_lf_tram_${uid}`);
    const tramCaps = _lf.tram && tramList?._tramCaps?.[_lf.tram];
    const capsAvail = tramCaps
      ? [...tramCaps].sort((a,b)=>(capPrio[a]??9)-(capPrio[b]??9))
      : [...new Set(_chipAllData.map(d=>String(d.Cap_dien_ap??'')).filter(c=>c&&c!=='null'))].sort((a,b)=>(capPrio[a]??9)-(capPrio[b]??9));

    html = `<div class="hm-dd-item${!_lf.cap?' active':''}" data-val="" data-lbl="— Tất cả cấp —"
      onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('cap','','')">— Tất cả cấp —</div>`;
    capsAvail.forEach(cap => {
      const lbl = CAP_LBL[cap]||cap;
      html += `<div class="hm-dd-item${_lf.cap===cap?' active':''}" data-val="${cap}" data-lbl="${lbl}"
        onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('cap','${cap}','${lbl}')">${lbl}</div>`;
    });

  } else if (key === 'type') {
    const excl = pl => { const n=(pl||'').trim().toUpperCase().replace(/\s+/g,''); return n.startsWith('TICHAN')||n==='HTTD'||n.startsWith('HTTD'); };
    const types = [...new Set(_chipAllData.map(d=>(d.Phan_loai_thiet_bi||'').trim()).filter(Boolean).filter(t=>!excl(t)))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));

    html = `<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;background:var(--bg-surface);z-index:1">
      <input type="text" id="lytDdS_lf_type_${uid}" placeholder="🔍 Tìm loại..."
        style="width:100%;box-sizing:border-box;padding:4px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:var(--text-primary);font-size:10px;outline:none"
        oninput="lytDdFilter('lf_type_${uid}',this.value)" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onkeydown="event.stopPropagation()">
    </div>`;
    html += `<div class="hm-dd-item${!_lf.type?' active':''}" data-val="" data-lbl="— Tất cả loại —"
      onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('type','','')">— Tất cả loại —</div>`;
    types.forEach(t => {
      const ev = t.replace(/'/g,"\\'");
      html += `<div class="hm-dd-item${_lf.type===t?' active':''}" data-val="${t}" data-lbl="${t}"
        onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('type','${ev}','${ev}')">${t}</div>`;
    });

  } else if (key === 'year') {
    const years = [...new Set(_chipAllData.map(d=>Number(d.Nam_san_xuat)).filter(y=>y>1970))].sort((a,b)=>b-a);
    html = `<div class="hm-dd-item${!_lf.year?' active':''}" data-val="" data-lbl="— Tất cả năm —"
      onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('year','','')">— Tất cả năm —</div>`;
    years.forEach(y => {
      html += `<div class="hm-dd-item${_lf.year===String(y)?' active':''}" data-val="${y}" data-lbl="${y}"
        onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('year','${y}','${y}')">${y}</div>`;
    });

  } else if (key === 'opyr') {
    const years = [...new Set(_chipAllData.map(d=>Number(d.Nam_van_hanh)).filter(y=>y>1970))].sort((a,b)=>b-a);
    html = `<div class="hm-dd-item${!_lf.opyr?' active':''}" data-val="" data-lbl="— Tất cả năm —"
      onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('opyr','','')">— Tất cả năm —</div>`;
    years.forEach(y => {
      html += `<div class="hm-dd-item${_lf.opyr===String(y)?' active':''}" data-val="${y}" data-lbl="${y}"
        onmousedown="event.preventDefault();event.stopPropagation();lytFddPick('opyr','${y}','${y}')">${y}</div>`;
    });
  }

  list.innerHTML = html;
  lytDdToggle(ddUid, anchorBtn);
}

// Toggle handlers — populate then show
function lytFddTramToggle(uid, btn) { event.stopPropagation(); _lfPopulate('tram', btn); }
function lytFddCapToggle(uid, btn)  { event.stopPropagation(); _lfPopulate('cap',  btn); }
function lytFddTypeToggle(uid, btn) { event.stopPropagation(); _lfPopulate('type', btn); }
function lytFddYearToggle(uid, btn) { event.stopPropagation(); _lfPopulate('year', btn); }
function lytFddOpyrToggle(uid, btn) { event.stopPropagation(); _lfPopulate('opyr', btn); }

function lytFddPick(key, val, lbl) {
  const uid = _lfUid();
  lytDdClose(`lf_${key}_${uid}`);
  _lf[key] = val;
  if (key === 'tram') _lf.cap = ''; // linkage: reset cap when tram changes
  renderLiveFilterSection();
  _lfApply();
}

function lytFddOnSearch(uid, val) {
  // ── Tối ưu #3: debounce search để tránh re-render mỗi ký tự gõ ──
  _lf.search = (val||'').toLowerCase().trim();
  _lytSearchDebounced();
}

// Debounce helper — tối ưu #3
let _lytSearchTimer = null;
function _lytSearchDebounced() {
  clearTimeout(_lytSearchTimer);
  _lytSearchTimer = setTimeout(() => {
    _lfApply();
    renderLiveFilterSection();
  }, 250);  // 250ms — gõ phím mượt, không lag
}

function _lfApply() {
  const {tram, cap, type, year, opyr, search} = _lf;
  _chipFiltered = _chipAllData.filter(d => {
    if (tram && (d.Tram||'').trim() !== tram) return false;
    if (cap  && String(d.Cap_dien_ap??'') !== cap)  return false;
    if (type && (d.Phan_loai_thiet_bi||'').trim() !== type) return false;
    if (year && String(Number(d.Nam_san_xuat)||0) !== year) return false;
    if (opyr && String(Number(d.Nam_van_hanh)||0) !== opyr) return false;
    if (search) {
      const hay = [(d.Tram||''),(d.Phan_loai_thiet_bi||''),(d.Ngan_thiet_bi||''),(d.Loai_ngan_lo||'')].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  _selectedChips.clear();
  _lytNganCache = null; _lytNganSig = '';
  _recomputeStatsWithFilter();
  renderChipsSection();
  renderChartsSection();
  renderTimelineSection();          // ← sync timeline with filter
}

function lytFddReset(uid) {
  Object.assign(_lf, {tram:'',cap:'',type:'',year:'',opyr:'',search:''});
  const si = document.getElementById(`lf_search_${uid||_lfUid()}`);
  if (si) si.value = '';
  _selectedChips.clear();
  _lytNganCache = null; _lytNganSig = '';
  if (!_chipAllData.length) {
    showChangeNotif('info','Đang tải lại dữ liệu...','');
    if (typeof loadStatsFromSupabase === 'function') loadStatsFromSupabase();
    return;
  }
  _chipFiltered = [..._chipAllData];
  renderLiveFilterSection();
  _recomputeStatsWithFilter();
  renderChipsSection();
  renderChartsSection();
  renderTimelineSection();
}

// ── TIMELINE SECTION ─────────────────────────────────────────
const TL_DEVICE_TYPES = ['MBA','MBA TD','MC','TU','TI','DCL','Cáp'];
const TL_BUCKETS = [
  { key:'lt10',    label:'< 10 năm',    color:'#00e676', textColor:'#00e676' },
  { key:'b1015',   label:'10–<15 năm',  color:'#ffd740', textColor:'#ffd740' },
  { key:'gt15',    label:'≥ 15 năm',    color:'#ff5252', textColor:'#ff5252' },
  { key:'unknown', label:'Không rõ',    color:'#607d8b', textColor:'#8fa3bd' },
];

function _tlNormPl(pl) {
  if (!pl) return '';
  const n = pl.trim();
  // Normalize common variants
  if (/^MBA/i.test(n) && /TD|tự dùng/i.test(n)) return 'MBA TD';
  if (/^MBA/i.test(n)) return 'MBA';
  if (/^MC/i.test(n)) return 'MC';
  if (/^TU/i.test(n) || /^Tụ/i.test(n)) return 'TU';
  if (/^TI/i.test(n) && !/^TIO/i.test(n) && !/^TI1/i.test(n)) return 'TI';
  if (/^DCL/i.test(n)) return 'DCL';
  if (/^Cáp/i.test(n) || /^Cap/i.test(n)) return 'Cáp';
  return n;
}

function renderTimelineSection() {
  if (!_chipAllData.length) return;
  const tlItem = layout.find(l => l.type === 'timeline');
  if (!tlItem || !tlItem.props.visible) return;
  const wrapper = document.querySelector(`.section-wrapper[data-uid="${tlItem.uid}"]`);
  if (!wrapper) return;
  const preview = wrapper.querySelector('.card-preview');
  if (!preview) return;

  const nowY = new Date().getFullYear();
  const baseRows = _chipFiltered.length ? _chipFiltered : _chipAllData;

  // Build data per device type
  const typeData = {};
  TL_DEVICE_TYPES.forEach(t => { typeData[t] = { lt10:0, b1015:0, gt15:0, unknown:0, total:0, years:[] }; });

  baseRows.forEach(d => {
    const pl = _tlNormPl(d.Phan_loai_thiet_bi);
    if (!typeData[pl]) return;
    const nvh = Number(d.Nam_van_hanh);
    const nsx = Number(d.Nam_san_xuat);
    const refY = nvh > 1970 ? nvh : (nsx > 1970 ? nsx : 0);
    const age  = refY > 0 ? (nowY - refY) : -1;
    const qty  = Number(d.So_luong) || 1;
    typeData[pl].total += qty;
    if (refY > 1970) typeData[pl].years.push({ y: refY, qty });
    if      (age < 0)           typeData[pl].unknown += qty;
    else if (age < 10)          typeData[pl].lt10    += qty;
    else if (age < 15)          typeData[pl].b1015   += qty;
    else                        typeData[pl].gt15    += qty;
  });

  const fmt = n => Number(n).toLocaleString('vi-VN');

  // Summary stats
  let totalAll=0, total15=0;
  TL_DEVICE_TYPES.forEach(t => { totalAll += typeData[t].total; total15 += typeData[t].gt15; });
  const pct15 = totalAll > 0 ? ((total15/totalAll)*100).toFixed(1) : '0.0';

  // Find oldest device
  let oldestY = nowY, oldestType = '';
  TL_DEVICE_TYPES.forEach(t => {
    typeData[t].years.forEach(({y}) => { if(y < oldestY){ oldestY=y; oldestType=t; } });
  });

  let html = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
    <div style="background:rgba(0,200,255,.07);border:1px solid rgba(0,200,255,.2);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-calculator" style="margin-right:4px"></i>Tổng phân tích</div>
      <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);color:var(--accent)">${fmt(totalAll)}</div>
    </div>
    <div style="background:rgba(255,82,82,.07);border:1px solid rgba(255,82,82,.2);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Thiết bị > 15 năm</div>
      <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);color:#ff5252">${fmt(total15)}</div>
    </div>
    <div style="background:rgba(255,215,64,.07);border:1px solid rgba(255,215,64,.2);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-clock" style="margin-right:4px"></i>Thiết bị lâu nhất</div>
      <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);color:#ffd740">${oldestY < nowY ? oldestY + ' (' + (nowY-oldestY) + 'n)' : '—'}</div>
    </div>
    <div style="background:rgba(0,230,118,.07);border:1px solid rgba(0,230,118,.2);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-percent" style="margin-right:4px"></i>Tỷ lệ > 15 năm</div>
      <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);color:#00e676">${pct15}%</div>
    </div>
  </div>

  <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;margin-bottom:8px">
    PHÂN TÍCH THỜI GIAN VẬN HÀNH THEO LOẠI THIẾT BỊ
    <span style="margin-left:12px;font-weight:400">
      ${TL_BUCKETS.map(b=>`<span style="color:${b.color};margin-right:10px">■ ${b.label}</span>`).join('')}
    </span>
    <span style="float:right;font-weight:400;color:var(--text-muted);font-size:8px">
      <i class="fas fa-info-circle"></i> Ưu tiên Nam_van_hanh, fallback Nam_san_xuat
    </span>
  </div>`;

  TL_DEVICE_TYPES.forEach(t => {
    const d = typeData[t];
    if (!d.total) return;
    const maxVal = Math.max(d.lt10, d.b1015, d.gt15, d.unknown, 1);
    const yrMin = d.years.length ? Math.min(...d.years.map(x=>x.y)) : null;
    const yrMax = d.years.length ? Math.max(...d.years.map(x=>x.y)) : null;
    const yrRange = yrMin ? `${yrMin}–${yrMax}` : '';

    // Stacked bar
    const barTotal = d.lt10 + d.b1015 + d.gt15 + d.unknown;
    const barHtml = barTotal > 0 ? TL_BUCKETS.map(b => {
      const w = (d[b.key]/barTotal*100).toFixed(1);
      return w > 0 ? `<div style="width:${w}%;background:${b.color};height:100%;display:inline-block" title="${b.label}: ${fmt(d[b.key])}"></div>` : '';
    }).join('') : '';

    html += `
    <div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:10px;font-weight:700;color:var(--text-primary);min-width:60px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:5px"></span>${t}
        </span>
        <div style="flex:1;height:14px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">${barHtml}</div>
        ${d.gt15 > 0 ? `<span style="font-size:9px;color:#ff5252;font-weight:700;min-width:28px">▲${d.gt15}</span>` : '<span style="min-width:28px"></span>'}
        <span style="font-size:8px;color:var(--text-muted);min-width:70px;text-align:right">${yrRange ? yrRange : ''}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-left:68px">
        ${TL_BUCKETS.map(b=>`
        <div style="background:${b.color}18;border:1px solid ${b.color}33;border-radius:4px;padding:4px 8px;cursor:pointer;transition:filter .15s"
          onmouseenter="this.style.filter='brightness(1.2)'" onmouseleave="this.style.filter=''"
          onmouseup="lytTLBucketClick('${t}','${b.key}','${b.label}','${b.color}')">
          <div style="font-size:7.5px;color:${b.textColor};font-weight:700">${b.label}</div>
          <div style="font-size:14px;font-weight:800;font-family:var(--font-mono);color:${b.textColor}">${fmt(d[b.key])}</div>
          <div style="font-size:7.5px;color:${b.textColor};opacity:.6">${d.total>0?((d[b.key]/d.total)*100).toFixed(0)+'%':'—'}</div>
        </div>`).join('')}
      </div>
    </div>`;
  });




  preview.innerHTML = html;
}

// Timeline bucket click → detail panel (reuse _lytShowDetailPanel)
function lytTLBucketClick(type, bucketKey, bucketLabel, color) {
  const baseRows = _chipFiltered.length ? _chipFiltered : _chipAllData;
  if (!baseRows.length) return;
  const nowY = new Date().getFullYear();
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const capColor= {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
  const capLbl  = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const tramMaxCap = {};
  _chipAllData.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t)return;
    const cv=String(d.Cap_dien_ap??''); if(!cv||cv==='null')return;
    if(!tramMaxCap[t]||(capPrio[cv]??9)<(capPrio[tramMaxCap[t]]??9)) tramMaxCap[t]=cv;
  });
  const matched = baseRows.filter(d => {
    if (_tlNormPl(d.Phan_loai_thiet_bi) !== type) return false;
    const nvh=Number(d.Nam_van_hanh), nsx=Number(d.Nam_san_xuat);
    const refY = nvh>1970?nvh:(nsx>1970?nsx:0);
    const age  = refY>0?(nowY-refY):-1;
    if (bucketKey==='lt10')    return age>=0&&age<10;
    if (bucketKey==='b1015')   return age>=10&&age<15;
    if (bucketKey==='gt15')    return age>=15;
    if (bucketKey==='unknown') return age<0;
    return false;
  });
  if (!matched.length) return;
  const byTram = {};
  matched.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t)return;
    if(!byTram[t]) byTram[t]={qty:0,years:new Set(),ngans:new Set()};
    byTram[t].qty += Number(d.So_luong)||1;
    const nvh=Number(d.Nam_van_hanh),nsx=Number(d.Nam_san_xuat);
    const y=nvh>1970?nvh:(nsx>1970?nsx:0);
    if(y>1970) byTram[t].years.add(y);
    if(d.Ngan_thiet_bi) byTram[t].ngans.add(d.Ngan_thiet_bi);
  });
  const tramList = Object.keys(byTram).sort((a,b)=>{
    const pa=capPrio[tramMaxCap[a]]??9,pb=capPrio[tramMaxCap[b]]??9;
    return pa!==pb?pa-pb:a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
  });
  const items=[]; const byC={};
  tramList.forEach(t=>{const cv=tramMaxCap[t]||'?';if(!byC[cv])byC[cv]=[];byC[cv].push(t);});
  ['2','1','3','4','9','6','0'].forEach(cap=>{
    const arr=byC[cap];if(!arr?.length)return;
    items.push({isGroup:true,text:`── ${capLbl[cap]||cap} (${arr.length} trạm) ──`,color:capColor[cap]||'#888'});
    arr.forEach(t=>{
      const info=byTram[t];
      const yrs=[...info.years].sort();
      const yrStr=yrs.length?(yrs[0]===yrs[yrs.length-1]?`${yrs[0]}`:`${yrs[0]}–${yrs[yrs.length-1]}`):'—';
      const ages=yrs.map(y=>nowY-y);
      const ageStr=ages.length?`~${Math.round(ages.reduce((s,a)=>s+a,0)/ages.length)} năm`:'';
      const tDevices=matched.filter(d=>(d.Tram||'').trim()===t).map(d=>{
        const nvh=Number(d.Nam_van_hanh)||0,nsx=Number(d.Nam_san_xuat)||0;
        const refY=nvh>1970?nvh:(nsx>1970?nsx:0);
        const dAge=refY>0?(nowY-refY):-1;
        const dn=(d.Ten_thiet_bi||d.Ngan_thiet_bi||d.Phan_loai_thiet_bi||'—').trim();
        return `${dn}${refY?' · '+refY:''}${dAge>=0?' · ~'+dAge+' năm':''}`;
      });
      items.push({text:t,badge:`${info.qty}TB · ${yrStr}${ageStr?' · '+ageStr:''}`,color:capColor[cap]||'#888',detail:tDevices});
    });
  });
  const totalQty = matched.reduce((s,d)=>s+(Number(d.So_luong)||1),0);
  _lytShowDetailPanel(`${type} · ${bucketLabel}`, color||'#00c8ff',
    `${totalQty.toLocaleString('vi-VN')} thiết bị · ${tramList.length} trạm`, items);
}

// ── Shared detail panel (reused by all sections) ──────────────
function _lytShowDetailPanel(title, color, totalLine, items, mbaSection) {
  if (!items || !items.length) return;
  let p = document.getElementById('hm-detail-panel');
  if (!p) {
    p = document.createElement('div');
    p.id = 'hm-detail-panel';
    p.className = 'hm-detail-panel';
    document.body.appendChild(p);
  }

  let _pIdx = 0;
  const mkTogBtn = (uid, col) =>
    `<button onclick="event.stopPropagation();(function(btn,id){var el=document.getElementById(id);if(!el)return;var op=el.style.display!=='none';el.style.display=op?'none':'block';btn.textContent=op?'+':'-';btn.style.background=op?'rgba(255,255,255,.06)':'rgba(0,200,255,.15)';btn.style.color=op?'rgba(220,235,250,.8)':'var(--accent)';})(this,'${uid}')"
       style="width:20px;height:20px;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(220,235,250,.8);font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;transition:all .15s">+</button>`;
  const mkSpacer = () => `<span style="width:20px;flex-shrink:0;display:inline-block"></span>`;

  // Build leaf string list into HTML rows
  const mkLeafRows = (lines, col, indent) =>
    lines.map(n => `<div style="padding:4px 12px 4px ${indent}px;font-size:10.5px;color:rgba(175,205,225,.85);display:flex;align-items:flex-start;gap:5px;border-bottom:1px solid rgba(255,255,255,.03)">
      <span style="color:${col};opacity:.7;flex-shrink:0;margin-top:1px">▸</span>
      <span style="color:rgba(235,248,255,.9)">${n}</span>
    </div>`).join('');

  const bodyHtml = items.map(item => {
    if (item.isGroup) return `<div style="padding:9px 16px 4px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${item.color};border-bottom:1px solid rgba(255,255,255,.1)">${item.text}</div>`;

    const badge = item.badge || item.sub || '';
    const col   = item.color || color || 'var(--accent)';
    const uid1  = 'pd'+(++_pIdx);

    // ── 2-LEVEL: item.children = [{text, sub, detail:[]}]
    if (Array.isArray(item.children) && item.children.length > 0) {
      const childrenHtml = item.children.map(ch => {
        const uid2  = 'pd'+(++_pIdx);
        const chCol = ch.color || col;
        const hasLeaf = Array.isArray(ch.detail) && ch.detail.length > 0;
        const leafBlock = hasLeaf
          ? `<div id="${uid2}" style="display:none;border-bottom:1px solid rgba(255,255,255,.04)">${mkLeafRows(ch.detail, chCol, 52)}</div>`
          : '';
        return `<div style="border-bottom:1px solid rgba(255,255,255,.04)">
          <div style="display:flex;align-items:center;gap:8px;padding:6px 14px 6px 32px">
            ${hasLeaf ? mkTogBtn(uid2, chCol) : mkSpacer()}
            <span style="font-size:11.5px;color:rgba(230,245,255,.92);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ch.text}</span>
            ${ch.sub ? `<span style="background:${chCol}22;color:${chCol};font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;white-space:nowrap;flex-shrink:0">${ch.sub}</span>` : ''}
          </div>
          ${leafBlock}
        </div>`;
      }).join('');
      return `<div style="border-bottom:1px solid rgba(255,255,255,.05)">
        <div style="display:flex;align-items:center;gap:8px;padding:7px 14px">
          ${mkTogBtn(uid1, col)}
          <span style="font-size:12px;color:rgba(240,250,255,.97);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${item.text}</span>
          <span style="background:${col}25;color:${col};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0">${badge}</span>
        </div>
        <div id="${uid1}" style="display:none;border-bottom:1px solid rgba(255,255,255,.06)">${childrenHtml}</div>
      </div>`;
    }

    // ── 1-LEVEL: item.detail = ['string', ...]
    const hasDetail = Array.isArray(item.detail) && item.detail.length > 0;
    const detHtml = hasDetail
      ? `<div id="${uid1}" style="display:none;border-bottom:1px solid rgba(255,255,255,.06)">${mkLeafRows(item.detail, col, 32)}</div>`
      : '';
    return `<div style="border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 14px">
        ${hasDetail ? mkTogBtn(uid1, col) : mkSpacer()}
        <span style="font-size:12px;color:rgba(240,250,255,.97);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${item.text}</span>
        <span style="background:${col}25;color:${col};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0">${badge}</span>
      </div>
      ${detHtml}
    </div>`;
  }).join('');

  p.innerHTML = `
    <div class="hm-resize-grip" id="hm-resize-grip"></div>
    <div class="hm-detail-hd" style="border-left:3px solid ${color||'var(--accent)'}">
      <span style="color:rgba(255,255,255,.97)">${title}</span>
      <span class="hm-detail-close" onclick="this.closest('.hm-detail-panel').classList.remove('open');let bd=document.getElementById('hm-detail-backdrop');if(bd)bd.style.display='none'">✕</span>
    </div>
    <div style="padding:6px 16px 6px;font-size:9px;color:rgba(180,210,230,.7);font-family:var(--font-mono);border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">${totalLine||''}</div>
    <div style="padding:6px 14px 4px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
      <input type="text" placeholder="🔍 Tìm kiếm..." oninput="_hmPanelSearch(this.value)"
        style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:5px 10px;color:rgba(235,248,255,.9);font-size:11px;outline:none;box-sizing:border-box">
    </div>
    <div id="hm-detail-body" style="overflow-y:auto;flex:1;min-height:0;overscroll-behavior:contain">${bodyHtml}</div>`;

  p.classList.add('open');
  _hmOpenPanel(p);
}

function _hmPanelSearch(q) {
  const body = document.getElementById('hm-detail-body');
  if (!body) return;
  const term = (q||'').toLowerCase().trim();
  body.querySelectorAll('[style*="border-bottom"][style*="padding:7px 14px"]').forEach(row => {
    const g = row.closest('div[style*="border-bottom:1px solid rgba(255,255,255,.05)"]');
    if (!g) return;
    const any = !term || g.textContent.toLowerCase().includes(term);
    g.style.display = any ? '' : 'none';
  });
}

// ── LIVE CHIPS RENDERER ──────────────────────────────────────
// Render device chips vào canvas section có id='deviceByType'
// Đồng bộ logic với app.js renderTypeChips()

let _chipAllData   = [];    // toàn bộ rows từ Supabase
let _chipFiltered  = [];    // filtered rows (= _chipAllData khi không filter)
let _selectedChips = new Set(); // chip filter state

function isExcludedChip(pl) {
  if (!pl) return true;
  const n = pl.trim().toUpperCase().replace(/\s+/g, '').normalize('NFC');
  if (n.startsWith('TICHAN') || n.startsWith('TI-CHAN') ||
      n === 'TICHANSỨ' || n === 'TICHÂNSỨ' ||
      n.includes('TICHÂN') || n.includes('TICHAN')) return true;
  if (n === 'HTTĐ' || n === 'HTTD' ||
      n.startsWith('HTTĐ') || n.startsWith('HTTD')) return true;
  return false;
}

function buildChipData(rows) {
  const typeMap = {};
  rows.forEach(d => {
    const pl = (d.Phan_loai_thiet_bi || '').trim();
    if (!pl || isExcludedChip(pl)) return;
    if (!typeMap[pl]) typeMap[pl] = { totalCount: 0, soLuong: 0, hangs: new Set() };
    typeMap[pl].totalCount++;
    typeMap[pl].soLuong += Number(d.So_luong) || 0;
    const h = (d.Hang_san_xuat || '').trim();
    if (h) typeMap[pl].hangs.add(h);
  });
  return typeMap;
}

function renderChipsSection() {
  const chipsItem = layout.find(l => l.type === 'chips');
  if (!chipsItem) return;
  const wrapper = document.querySelector(`.section-wrapper[data-uid="${chipsItem.uid}"]`);
  if (!wrapper) return;
  const preview = wrapper.querySelector('.card-preview');
  if (!preview) return;
  if (!_chipAllData.length) return;

  const fmt = n => Number(n).toLocaleString('vi-VN');

  // Exclude list
  const isExcl = pl => {
    if (!pl) return true;
    const n = pl.trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
    return n.startsWith('TICHAN') || n.includes('TICHÂN') ||
           n === 'HTTD' || n.startsWith('HTTD') ||
           n === 'DAU' || n.startsWith('DẦU') || n.startsWith('DAU');
  };

  // Base rows = filtered or all
  const baseRows = _chipFiltered.length ? _chipFiltered : _chipAllData;

  // Tram linkage: if tram selected via filter → determine cap group
  const selTram = _lf?.tram || '';
  const selCap  = _lf?.cap  || '';
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};

  // Build tramMaxCap to determine which group a tram belongs to
  const tramMaxCap = {};
  _chipAllData.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t)return;
    const cv=String(d.Cap_dien_ap??''); if(!cv||cv==='null')return;
    if(!tramMaxCap[t]||(capPrio[cv]??9)<(capPrio[tramMaxCap[t]]??9)) tramMaxCap[t]=cv;
  });

  // Determine which groups to show based on tram/cap filter linkage
  const HV_CAPS = new Set(['2','1']);       // 220kV, 110kV
  const LV_CAPS = new Set(['3','4','9','6','0']); // 35kV, 22kV, 10kV, 6kV, TT

  // Always show both groups — hide only if group has 0 devices after filtering
  // (Cap filter via dropdown still applies via baseRows, but don't hide whole group by tram cap)
  let showHV = true, showLV = true;
  // Only restrict when user explicitly selects a cap via dropdown
  if (selCap) {
    showHV = HV_CAPS.has(selCap);
    showLV = LV_CAPS.has(selCap);
  }

  // Build chip data per group
  function buildGroupChips(capFilter) {
    const typeMap = {};
    baseRows.forEach(d => {
      const cap = String(d.Cap_dien_ap??'');
      if (!capFilter.has(cap)) return;
      const pl = (d.Phan_loai_thiet_bi||'').trim();
      if (!pl || isExcl(pl)) return;
      if (!typeMap[pl]) typeMap[pl] = { soLuong:0, totalCount:0 };
      typeMap[pl].soLuong    += Number(d.So_luong)||0;
      typeMap[pl].totalCount += 1;
    });
    return typeMap;
  }

  // Total from ALL data (for /total display)
  function buildGroupTotal(capFilter) {
    const typeMap = {};
    _chipAllData.forEach(d => {
      const cap = String(d.Cap_dien_ap??'');
      if (!capFilter.has(cap)) return;
      const pl = (d.Phan_loai_thiet_bi||'').trim();
      if (!pl || isExcl(pl)) return;
      if (!typeMap[pl]) typeMap[pl] = { soLuong:0 };
      typeMap[pl].soLuong += Number(d.So_luong)||0;
    });
    return typeMap;
  }

  const hvMap  = buildGroupChips(HV_CAPS);
  const lvMap  = buildGroupChips(LV_CAPS);
  const hvAll  = buildGroupTotal(HV_CAPS);
  const lvAll  = buildGroupTotal(LV_CAPS);

  // Sort by soLuong desc, active chips first
  function sortTypes(map) {
    return Object.entries(map).sort((a,b) => {
      const aA = _selectedChips.has(a[0]) ? 1:0, bA = _selectedChips.has(b[0]) ? 1:0;
      if (bA!==aA) return bA-aA;
      return (b[1].soLuong||0) - (a[1].soLuong||0);
    });
  }

  function chipHtml(type, info, allInfo) {
    const isActive = _selectedChips.has(type);
    const cur = info.soLuong||0;
    const tot = allInfo?.[type]?.soLuong||cur;
    const isFiltered = cur !== tot;
    const safeType = type.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    return `<div class="device-chip${isActive?' active':''}"
      title="${type} — ${fmt(cur)}${isFiltered?'/'+fmt(tot):''}TB"
      data-chip-type="${safeType}"
      onmousedown="this._md=true" onmousemove="this._md=false"
      onmouseup="if(this._md){event.stopPropagation();lytChipClick(this)}">
      <div class="device-chip-header">
        <span class="device-chip-name">${type}</span>
        <span class="device-chip-count">${isActive?'<i class="fas fa-check" style="font-size:8px;margin-right:2px"></i>':''}${fmt(cur)}${isFiltered?'<span class="device-chip-total">/'+fmt(tot)+'</span>':''}</span>
      </div>
    </div>`;
  }

  const numTypes = Object.keys(hvMap).length + Object.keys(lvMap).length;
  const totalSL  = [...Object.values(hvMap),...Object.values(lvMap)].reduce((s,v)=>s+(v.soLuong||0),0);

  let html = `<div class="chips-header-row">
    <span class="chips-active-info${_selectedChips.size>0?' visible':''}" id="lyt_chipsInfo">
      ${_selectedChips.size>0?`<i class="fas fa-filter"></i> Đang lọc: ${[..._selectedChips].join(', ')}`:''}
    </span>
    <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${numTypes} loại · ${fmt(totalSL)} thiết bị</span>
    <button class="chips-reset-btn" id="lyt_chipsReset"
      style="display:${_selectedChips.size>0?'inline-flex':'none'}"
      onclick="lytChipReset()">
      <i class="fas fa-times-circle"></i> Bỏ lựa chọn
    </button>
  </div>`;

  // Group HV
  if (showHV && Object.keys(hvMap).length) {
    const hvTotal = Object.values(hvMap).reduce((s,v)=>s+(v.soLuong||0),0);
    html += `<div style="font-size:9px;font-weight:800;color:#ff9100;letter-spacing:.08em;margin:10px 0 6px;display:flex;align-items:center;gap:8px">
      <span style="width:8px;height:8px;border-radius:50%;background:#ff9100;flex-shrink:0"></span>
      220kV – 110kV
      <span style="font-weight:400;color:var(--text-muted)">${Object.keys(hvMap).length} loại · ${fmt(hvTotal)} thiết bị</span>
    </div><div class="device-chips-grid">`;
    sortTypes(hvMap).forEach(([t,info]) => { html += chipHtml(t, info, hvAll); });
    html += `</div>`;
  }

  // Group LV
  if (showLV && Object.keys(lvMap).length) {
    const lvTotal = Object.values(lvMap).reduce((s,v)=>s+(v.soLuong||0),0);
    html += `<div style="font-size:9px;font-weight:800;color:#00c8ff;letter-spacing:.08em;margin:14px 0 6px;display:flex;align-items:center;gap:8px">
      <span style="width:8px;height:8px;border-radius:50%;background:#00c8ff;flex-shrink:0"></span>
      35kV – 22kV – 10kV – 6kV
      <span style="font-weight:400;color:var(--text-muted)">${Object.keys(lvMap).length} loại · ${fmt(lvTotal)} thiết bị</span>
    </div><div class="device-chips-grid">`;
    sortTypes(lvMap).forEach(([t,info]) => { html += chipHtml(t, info, lvAll); });
    html += `</div>`;
  }

  // No data for selected filter
  if (!showHV && !showLV) {
    html += `<div style="color:var(--text-muted);font-size:11px;padding:20px;text-align:center">Không có thiết bị cho bộ lọc hiện tại</div>`;
  }

  preview.innerHTML = html;
}


function lytChipClick(el) {
  const type = el.dataset.chipType;
  if (!type) return;
  lytChipToggle(type);
}

function lytChipToggle(type) {
  // Toggle selection
  if (_selectedChips.has(type)) _selectedChips.delete(type);
  else _selectedChips.add(type);

  // Re-filter
  if (_selectedChips.size === 0) {
    _chipFiltered = [..._chipAllData];
  } else {
    _chipFiltered = _chipAllData.filter(d => {
      const pl = (d.Phan_loai_thiet_bi || '').trim();
      return _selectedChips.has(pl);
    });
  }
  renderChipsSection();
  renderChartsSection();
  renderTimelineSection();          // ← cập nhật timeline khi filter thay đổi
  if (_chipAllData.length > 0) _recomputeStatsWithFilter();

  // Show detail panel — same style as stats card panel
  lytChipShowDetail(type);
}

function lytChipShowDetail(type) {
  const baseRows = _chipAllData;
  // ── Thứ tự cấp điện áp: 220→110→35→22→10→6→TT ──
  const capPrio  = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const capColor = {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
  const capLbl   = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const tramMaxCap = {};
  baseRows.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t)return;
    const cv=String(d.Cap_dien_ap??''); if(!cv||cv==='null')return;
    if(!tramMaxCap[t]||(capPrio[cv]??9)<(capPrio[tramMaxCap[t]]??9)) tramMaxCap[t]=cv;
  });
  const typeRows = baseRows.filter(d => (d.Phan_loai_thiet_bi||'').trim() === type);
  if (!typeRows.length) return;
  const byTram = {};
  typeRows.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t)return;
    if(!byTram[t]) byTram[t]={ qty:0, ngans:new Set(), rows:[] };
    byTram[t].qty += Number(d.So_luong)||1;
    byTram[t].rows.push(d);
    if(d.Ngan_thiet_bi) byTram[t].ngans.add(d.Ngan_thiet_bi);
  });
  // ── Natural sort: E1.1 < E1.2 < E1.5 < E1.10 (không phải alphabet) ──
  const tramList = Object.keys(byTram).sort((a,b) => {
    const pa=capPrio[tramMaxCap[a]]??9, pb=capPrio[tramMaxCap[b]]??9;
    return pa!==pb ? pa-pb : a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
  });

  const items = [];
  const byC = {};
  tramList.forEach(t=>{ const cv=tramMaxCap[t]||'?'; if(!byC[cv])byC[cv]=[]; byC[cv].push(t); });
  // Thứ tự cấp điện áp: 220 → 110 → 35 → 22 → 10 → 6 → TT
  ['2','1','3','4','9','6','0'].forEach(cap => {
    const arr=byC[cap]; if(!arr?.length)return;
    items.push({ isGroup:true, text:`── ${capLbl[cap]||cap} (${arr.length} trạm) ──`, color:capColor[cap]||'#888' });
    arr.forEach(t => {
      const info = byTram[t];
      const allNgans = [...info.ngans].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
      // ── Build hierarchy 3 level: Trạm → Nhóm Ngăn → ngăn cụ thể (đồng nhất với TBA 220kV/110kV) ──
      // tRows là toàn bộ rows của trạm (không chỉ rows của loại đang chọn) để phân loại đúng
      const tRowsAll = _chipAllData.filter(r => (r.Tram||'').trim() === t);
      const NGAN_GROUPS = [
        { label:'Ngăn ĐZ',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn ĐZ' },
        { label:'Ngăn MBA',          fn: r=>lytIsMBARow(r) },
        { label:'Ngăn XT',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn XT' },
        { label:'Ngăn LL',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn LL' },
        { label:'Ngăn Tụ bù (TBN)', fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn TBN'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
        { label:'Ngăn Tự dùng (TD)',fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='NgănTD'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase()==='MBATD') },
        { label:'Ngăn Kháng',        fn: r=>{
          const loai = lytNormalizeNganLoai(r.Loai_ngan_lo);
          const pl   = (r.Phan_loai_thiet_bi||'').trim();
          return loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng';
        }},
      ];
      // Chỉ build children nếu có ngăn của loại type này
      const catSet = new Set();
      const children = [];
      // Filter các ngăn THUỘC loại type đang chọn
      const ngansOfType = new Set();
      info.rows.forEach(r => {
        const ng = (r.Ngan_thiet_bi||'').trim();
        if (ng) ngansOfType.add(ng);
      });
      NGAN_GROUPS.forEach(g => {
        // Chỉ lấy ngăn vừa thuộc nhóm này VỪA chứa thiết bị loại type
        const gNgans = [...new Set(
          tRowsAll.filter(g.fn).map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean)
        )].filter(n => ngansOfType.has(n))
          .sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
        if (!gNgans.length) return;
        gNgans.forEach(n => catSet.add(n));
        children.push({
          text: g.label,
          sub: `${gNgans.length} ngăn`,
          color: capColor[tramMaxCap[t]] || '#888',
          detail: gNgans
        });
      });
      // Ngăn khác — của type này nhưng không thuộc nhóm nào
      const uncat = [...ngansOfType].filter(n => !catSet.has(n))
        .sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
      if (uncat.length) {
        children.push({
          text: 'Ngăn khác',
          sub: `${uncat.length} ngăn`,
          color: capColor[tramMaxCap[t]] || '#888',
          detail: uncat
        });
      }
      items.push({
        text: t,
        badge: `${info.qty.toLocaleString('vi-VN')} TB`,
        sub: `${allNgans.length} ngăn`,
        color: capColor[tramMaxCap[t]] || '#888',
        children: children.length ? children : null,
        detail: children.length ? null : allNgans  // fallback nếu không phân nhóm được
      });
    });
  });
  const totalQty = typeRows.reduce((s,d)=>s+(Number(d.So_luong)||1),0);

  // Build MBA/Trạm breakdown sub-section for MBA, MBATD, MBATN types
  const mbaTypes = new Set(['MBA','MBATD','MBATN','MBA_TU','MBATN']);
  let mbaSection = null;
  if (mbaTypes.has(type.trim().toUpperCase()) || type.toUpperCase().includes('MBA')) {
    const mbaRows = typeRows;
    const tramMbaMap = {};
    mbaRows.forEach(d => {
      const t=(d.Tram||'').trim(); if(!t)return;
      if(!tramMbaMap[t]) tramMbaMap[t]=[];
      tramMbaMap[t].push(d);
    });
    // Build summary: Tram + each MBA name + qty
    mbaSection = { type, tramMbaMap, capColor, capLbl, capPrio, tramMaxCap };
  }

  _lytShowDetailPanel(`🔌 ${type}`, 'var(--accent)',
    `${totalQty.toLocaleString('vi-VN')} thiết bị · ${tramList.length} trạm`, items, mbaSection);
}


function _chipDetailSearch(val) {
  const q = (val||'').toLowerCase().trim();
  const body = document.getElementById('hm-detail-body');
  if (!body) return;
  body.querySelectorAll('.hm-detail-row').forEach(row => {
    const show = !q || (row.dataset.search||'').includes(q);
    row.style.display = show ? '' : 'none';
    const next = row.nextElementSibling;
    if (next?.classList.contains('hm-detail-sub-list')) next.style.display = show ? '' : 'none';
  });
  body.querySelectorAll('.hm-detail-group').forEach(g => {
    let sib=g.nextElementSibling, any=false;
    while(sib&&!sib.classList.contains('hm-detail-group')){ if(sib.classList.contains('hm-detail-row')&&sib.style.display!=='none')any=true; sib=sib.nextElementSibling; }
    g.style.display = any||!q ? '' : 'none';
  });
}

function lytChipReset() {
  _selectedChips.clear();
  _chipFiltered = [..._chipAllData];
  renderChipsSection();
  renderChartsSection();
  _recomputeStatsWithFilter();
}

// ── Helper: build grouped ngăn by type for a tram ──────────────
function _buildTramNganGroups(tramName, tRows, allNgans) {
  const NGAN_GROUPS = [
    { label:'Ngăn ĐZ',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn ĐZ' },
    { label:'Ngăn MBA',          fn: r=>lytIsMBARow(r) },
    { label:'Ngăn XT',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn XT' },
    { label:'Ngăn LL',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn LL' },
    { label:'Ngăn Tụ bù (TBN)', fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn TBN'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
    { label:'Ngăn Tự dùng (TD)',fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='NgănTD'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase()==='MBATD') },
    { label:'Ngăn Kháng',        fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn Kháng' },
  ];
  const catSet = new Set();
  const result = [];
  NGAN_GROUPS.forEach(g => {
    const gNgans = [...new Set(tRows.filter(g.fn).map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))].sort();
    if (!gNgans.length) return;
    gNgans.forEach(n=>catSet.add(n));
    result.push(`${g.label}: ${gNgans.length} ngăn → ${gNgans.join(', ')}`);
  });
  const uncat = allNgans.filter(n=>!catSet.has(n)).sort();
  if (uncat.length) result.push(`Ngăn khác: ${uncat.length} → ${uncat.join(', ')}`);
  return result;
}

// ── Stats card click — hiện detail panel bên phải ──────────────
// ════════════════════════════════════════════════════════════════
// Helper chung: Build hierarchy 3 cấp Trạm → Loại ngăn → Tên ngăn
// Dùng cho tất cả panel detail (TBA, MBA, Ngăn XX, Tổng thiết bị...)
//
// Args:
//   trams          : array trạm cần hiển thị (đã sort theo cấp + tên)
//   tramMaxCap     : map { tram → cap }  (vd: 'E1.1' → '1')
//   capColors      : map { cap → color } (LYT_CAP_COLORS)
//   capLbls        : map { cap → '110kV' }
//   getNgansForTram: function(tram) → Set/Array tên ngăn THUỘC loại đang xem
//                                     (vd: chỉ ngăn có MBA)
//
// Returns: items[] sẵn sàng cho _lytShowDetailPanel
// ════════════════════════════════════════════════════════════════
function _lytBuildHierarchy(trams, tramMaxCap, capColors, capLbls, getNgansForTram) {
  // Group trạm theo cấp điện áp
  const byCap = {};
  trams.forEach(t => {
    const cap = tramMaxCap[t] || '?';
    if (!byCap[cap]) byCap[cap] = [];
    byCap[cap].push(t);
  });

  // Thứ tự cấp điện áp: 220 → 110 → 35 → 22 → 10 → 6 → TT
  const CAP_ORDER = ['2','1','3','4','9','6','0'];
  const items = [];

  // 7 nhóm ngăn chuẩn (cùng logic với code TBA 220kV/110kV)
  const NGAN_GROUPS = [
    { label:'Ngăn ĐZ',           fn: r => lytNormalizeNganLoai(r.Loai_ngan_lo) === 'Ngăn ĐZ' },
    { label:'Ngăn MBA',          fn: r => lytIsMBARow(r) },
    { label:'Ngăn XT',           fn: r => lytNormalizeNganLoai(r.Loai_ngan_lo) === 'Ngăn XT' },
    { label:'Ngăn LL',           fn: r => lytNormalizeNganLoai(r.Loai_ngan_lo) === 'Ngăn LL' },
    { label:'Ngăn Tụ bù (TBN)', fn: r => lytNormalizeNganLoai(r.Loai_ngan_lo) === 'Ngăn TBN' ||
                                          ((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
    { label:'Ngăn Tự dùng (TD)',fn: r => lytNormalizeNganLoai(r.Loai_ngan_lo) === 'NgănTD' ||
                                          ((r.Phan_loai_thiet_bi||'').trim().toUpperCase() === 'MBATD') },
    { label:'Ngăn Kháng',        fn: r => {
        const loai = lytNormalizeNganLoai(r.Loai_ngan_lo);
        const pl   = (r.Phan_loai_thiet_bi||'').trim();
        return loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng';
    }},
  ];

  CAP_ORDER.forEach(cap => {
    const arr = byCap[cap];
    if (!arr?.length) return;

    // Sort trạm theo natural order (E1.1, E1.2, E1.5, E1.10...)
    arr.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

    // Header nhóm cấp điện áp
    items.push({
      isGroup: true,
      text: `── ${capLbls[cap] || cap} (${arr.length} trạm) ──`,
      color: capColors[cap] || '#888'
    });

    // Từng trạm
    arr.forEach(t => {
      // Lấy ngăn của trạm THUỘC loại đang xem (từ caller)
      const ngansOfType = new Set(getNgansForTram(t));
      if (!ngansOfType.size) return;

      // Lấy tất cả rows của trạm để phân loại đúng từng ngăn vào nhóm nào
      const tRowsAll = _chipAllData.filter(r => (r.Tram||'').trim() === t);
      const tColor = capColors[cap] || '#888';

      // Build children: mỗi child = 1 nhóm ngăn
      const children = [];
      const usedNgans = new Set();

      NGAN_GROUPS.forEach(g => {
        // Ngăn vừa thuộc nhóm này VỪA chứa thiết bị loại đang xem
        const gNgans = [...new Set(
          tRowsAll.filter(g.fn).map(r => (r.Ngan_thiet_bi||'').trim()).filter(Boolean)
        )].filter(n => ngansOfType.has(n))
          .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

        if (!gNgans.length) return;
        gNgans.forEach(n => usedNgans.add(n));
        children.push({
          text:  g.label,
          sub:   `${gNgans.length} ngăn`,
          color: tColor,
          detail: gNgans,
        });
      });

      // Ngăn còn lại không thuộc nhóm nào → gom vào "Ngăn khác"
      const otherNgans = [...ngansOfType].filter(n => !usedNgans.has(n))
        .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));
      if (otherNgans.length) {
        children.push({
          text:  'Ngăn khác',
          sub:   `${otherNgans.length} ngăn`,
          color: tColor,
          detail: otherNgans,
        });
      }

      items.push({
        text:  t,
        sub:   `${ngansOfType.size} ngăn`,
        color: tColor,
        children,
      });
    });
  });

  return items;
}

function lytStatsCardClick(label, color) {
  // Guard: data chưa load
  if (!_chipAllData || !_chipAllData.length) {
    if (typeof showToast === 'function') showToast('⏳ Dữ liệu chưa tải xong, vui lòng thử lại...');
    return;
  }

  const rows    = (_chipFiltered && _chipFiltered.length ? _chipFiltered : _chipAllData);
  const capLbl  = {'0':'TT','1':'110kV','2':'220kV','3':'35kV','4':'22kV','6':'6kV','9':'10kV'};
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};

  // Build maxCap map
  const tramMaxCap = {};
  _chipAllData.forEach(d => {
    const t = (d.Tram||'').trim(); if (!t) return;
    const c = String(d.Cap_dien_ap??'');
    if (!c || c==='null') return;
    if (!tramMaxCap[t] || (capPrio[c]??99) < (capPrio[tramMaxCap[t]]??99)) tramMaxCap[t] = c;
  });

  const filteredTrams = [...new Set(rows.map(d=>(d.Tram||'').trim()).filter(Boolean))];
  filteredTrams.sort((a,b) => {
    const pa = capPrio[tramMaxCap[a]]??9, pb = capPrio[tramMaxCap[b]]??9;
    return pa!==pb ? pa-pb : a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
  });

  let title = label;
  let items = [];
  let totalLine = '';

  switch (label) {
    case 'Tổng số TBA': {
      title = '🏢 Tổng số TBA';
      const byMaxCap = {};
      filteredTrams.forEach(t => {
        const mc = tramMaxCap[t] || '?';
        if (!byMaxCap[mc]) byMaxCap[mc] = [];
        byMaxCap[mc].push(t);
      });
      // ── Đồng bộ với TBA 220kV: mỗi trạm có children là các nhóm ngăn ──
      const scope_tba = lytBuildScopedNganSets(rows, _chipAllData);
      const NGAN_GROUPS_TBA = [
        { label:'Ngăn ĐZ',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn ĐZ' },
        { label:'Ngăn MBA',          fn: r=>lytIsMBARow(r) },
        { label:'Ngăn XT',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn XT' },
        { label:'Ngăn LL',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn LL' },
        { label:'Ngăn Tụ bù (TBN)', fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn TBN'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
        { label:'Ngăn Tự dùng (TD)',fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='NgănTD'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase()==='MBATD') },
        { label:'Ngăn Kháng',        fn: r=>{
          const loai = lytNormalizeNganLoai(r.Loai_ngan_lo);
          const pl   = (r.Phan_loai_thiet_bi||'').trim();
          return loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng';
        }},
      ];
      // Thứ tự cấp: 220 → 110 → 35 → 22 → 10 → 6 → TT
      ['2','1','3','4','9','6','0'].forEach(cap => {
        const arr = byMaxCap[cap]; if (!arr||!arr.length) return;
        // Natural sort các trạm trong cùng cấp
        arr.sort((a,b) => a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
        items.push({ text: `── ${capLbl[cap]||cap} (${arr.length} trạm) ──`, isGroup: true, color: LYT_CAP_COLORS[cap]||'#888' });
        arr.forEach(t => {
          const tRowsT = scope_tba.scopedRows.filter(r=>(r.Tram||'').trim()===t);
          const allNgansT = [...new Set(tRowsT.map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))];
          const catSetT = new Set();
          const childrenT = [];
          NGAN_GROUPS_TBA.forEach(g => {
            const gNgans = [...new Set(tRowsT.filter(g.fn).map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))]
              .sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
            if (!gNgans.length) return;
            gNgans.forEach(n => catSetT.add(n));
            childrenT.push({ text: g.label, sub: `${gNgans.length} ngăn`, color: LYT_CAP_COLORS[cap]||'#888', detail: gNgans });
          });
          const uncatT = allNgansT.filter(n=>!catSetT.has(n))
            .sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
          if (uncatT.length) childrenT.push({ text: 'Ngăn khác', sub: `${uncatT.length} ngăn`, color: LYT_CAP_COLORS[cap]||'#888', detail: uncatT });
          items.push({
            text: t,
            sub: `${allNgansT.length} ngăn · ${capLbl[cap]||cap}`,
            color: LYT_CAP_COLORS[cap]||'#888',
            children: childrenT.length ? childrenT : null
          });
        });
      });
      totalLine = `${filteredTrams.length} trạm`;
      break;
    }
    case 'TBA 220kV': {
      title = '⚡ TBA 220kV';
      const list_220 = filteredTrams.filter(t => tramMaxCap[t] === '2');
      const scope_220 = lytBuildScopedNganSets(rows, _chipAllData);
      const NGAN_GROUPS__220 = [
        { label:'Ngăn ĐZ',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn ĐZ' },
        { label:'Ngăn MBA',          fn: r=>lytIsMBARow(r) },
        { label:'Ngăn XT',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn XT' },
        { label:'Ngăn LL',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn LL' },
        { label:'Ngăn Tụ bù (TBN)', fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn TBN'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
        { label:'Ngăn Tự dùng (TD)',fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='NgănTD'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase()==='MBATD') },
        { label:'Ngăn Kháng',        fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn Kháng' },
      ];
      list_220.forEach(t => {
        const tRows_220 = scope_220.scopedRows.filter(r=>(r.Tram||'').trim()===t);
        const allNgans_220 = [...new Set(tRows_220.map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))];
        // Build 2-level children: each group is a child with its ngăn as detail
        const catSet_220 = new Set();
        const children_220 = [];
        NGAN_GROUPS__220.forEach(g => {
          const gNgans = [...new Set(tRows_220.filter(g.fn).map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))].sort();
          if (!gNgans.length) return;
          gNgans.forEach(n => catSet_220.add(n));
          children_220.push({ text: g.label, sub: `${gNgans.length} ngăn`, color: LYT_CAP_COLORS['2'], detail: gNgans });
        });
        // Uncategorized ngăn
        const uncat_220 = allNgans_220.filter(n=>!catSet_220.has(n)).sort();
        if (uncat_220.length) children_220.push({ text: 'Ngăn khác', sub: `${uncat_220.length} ngăn`, color: LYT_CAP_COLORS['2'], detail: uncat_220 });
        items.push({ text: t, sub: `${allNgans_220.length} ngăn`, color: LYT_CAP_COLORS['2'], children: children_220 });
      });
      totalLine = `${list_220.length} trạm`;
      break;
    }
    case 'TBA 110kV': {
      title = '⚡ TBA 110kV';
      const list_110 = filteredTrams.filter(t => tramMaxCap[t] === '1');
      const scope_110 = lytBuildScopedNganSets(rows, _chipAllData);
      const NGAN_GROUPS__110 = [
        { label:'Ngăn ĐZ',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn ĐZ' },
        { label:'Ngăn MBA',          fn: r=>lytIsMBARow(r) },
        { label:'Ngăn XT',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn XT' },
        { label:'Ngăn LL',           fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn LL' },
        { label:'Ngăn Tụ bù (TBN)', fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn TBN'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase().includes('TBN')) },
        { label:'Ngăn Tự dùng (TD)',fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='NgănTD'||((r.Phan_loai_thiet_bi||'').trim().toUpperCase()==='MBATD') },
        { label:'Ngăn Kháng',        fn: r=>lytNormalizeNganLoai(r.Loai_ngan_lo)==='Ngăn Kháng' },
      ];
      list_110.forEach(t => {
        const tRows_110 = scope_110.scopedRows.filter(r=>(r.Tram||'').trim()===t);
        const allNgans_110 = [...new Set(tRows_110.map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))];
        // Build 2-level children: each group is a child with its ngăn as detail
        const catSet_110 = new Set();
        const children_110 = [];
        NGAN_GROUPS__110.forEach(g => {
          const gNgans = [...new Set(tRows_110.filter(g.fn).map(r=>(r.Ngan_thiet_bi||'').trim()).filter(Boolean))].sort();
          if (!gNgans.length) return;
          gNgans.forEach(n => catSet_110.add(n));
          children_110.push({ text: g.label, sub: `${gNgans.length} ngăn`, color: LYT_CAP_COLORS['1'], detail: gNgans });
        });
        // Uncategorized ngăn
        const uncat_110 = allNgans_110.filter(n=>!catSet_110.has(n)).sort();
        if (uncat_110.length) children_110.push({ text: 'Ngăn khác', sub: `${uncat_110.length} ngăn`, color: LYT_CAP_COLORS['1'], detail: uncat_110 });
        items.push({ text: t, sub: `${allNgans_110.length} ngăn`, color: LYT_CAP_COLORS['1'], children: children_110 });
      });
      totalLine = `${list_110.length} trạm`;
      break;
    }
    case 'Tổng số ngăn': {
      title = '▦ Tổng số ngăn';
      const nganScope2 = lytBuildScopedNganSets(rows, _chipAllData);

      // Build per-tram, per-type ngan counts
      const nganTypes = [
        { key:'dz',    label:'Ngăn ĐZ',        set: nganScope2.dz    },
        { key:'mba',   label:'Ngăn MBA',        set: nganScope2.mba   },
        { key:'xt',    label:'Ngăn Xuất tuyến', set: nganScope2.xt    },
        { key:'ll',    label:'Ngăn LL',         set: nganScope2.ll    },
        { key:'td',    label:'Ngăn Tự dùng',    set: nganScope2.td,   meta: nganScope2.tdMeta   },
        { key:'tbn',   label:'Ngăn Tụ bù',      set: nganScope2.tbn,  meta: nganScope2.tbnMeta  },
        { key:'khang', label:'Ngăn Kháng',      set: nganScope2.khang },
      ];

      const byTram = {};
      nganScope2.total.forEach(k => {
        const [tram, ngan] = k.split('|||'); if(!tram||!ngan) return;
        if(!byTram[tram]) byTram[tram] = { total:new Set(), types:{} };
        byTram[tram].total.add(ngan);
      });
      nganTypes.forEach(({ key, label, set, meta }) => {
        set.forEach(k => {
          const [tram, ngan] = k.split('|||'); if(!tram||!ngan) return;
          if(!byTram[tram]) byTram[tram] = { total:new Set(), types:{} };
          if(!byTram[tram].types[label]) byTram[tram].types[label] = [];
          const status = meta ? (meta.get(k) === 'chua_khai_thac' ? ' (chưa khai thác)' : '') : '';
          byTram[tram].types[label].push(ngan + status);
        });
        // Also add "chưa khai thác" entries for td/tbn
        if (meta) {
          meta.forEach((v, k) => {
            if (v !== 'chua_khai_thac') return;
            const [tram, ngan] = k.split('|||'); if(!tram||!ngan) return;
            if(!byTram[tram]) byTram[tram] = { total:new Set(), types:{} };
            if(!byTram[tram].types[label]) byTram[tram].types[label] = [];
            // Check if already added
            if (!byTram[tram].types[label].some(x=>x.startsWith(ngan))) {
              byTram[tram].types[label].push(ngan + ' (chưa khai thác)');
            }
          });
        }
      });

      let total = 0;
      filteredTrams.filter(t => byTram[t]).forEach(t => {
        const cnt = byTram[t].total.size; total += cnt;
        // Build detail: group by ngan type
        const detail = Object.entries(byTram[t].types)
          .sort((a,b) => a[0].localeCompare(b[0],'vi'))
          .map(([typeLbl, ngans]) => {
            const activeNgans = ngans.filter(n => !n.includes('chưa khai thác'));
            const inactive = ngans.filter(n => n.includes('chưa khai thác'));
            let line = `${typeLbl}: ${activeNgans.length} ngăn`;
            if (activeNgans.length) line += ` (${activeNgans.slice(0,5).join(', ')}${activeNgans.length>5?'…':''})`;
            if (inactive.length) line += ` · ${inactive.length} chưa khai thác`;
            return line;
          });
        items.push({
          text:   t,
          sub:    `${cnt} ngăn`,
          color:  LYT_CAP_COLORS[tramMaxCap[t]]||'#888',
          detail,
        });
      });
      totalLine = `${total} ngăn / ${items.length} trạm`;
      break;
    }
    case 'Ngăn đường dây': {
      title = '↔ Ngăn Đường Dây';
      const nganScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      nganScope.dz.forEach(key => {
        const [tram, ngan] = key.split('|||');
        if (!tram || !ngan) return;
        if (!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      const total = showTrams.reduce((s, t) => s + byTram[t].size, 0);
      totalLine = `${total} ngăn ĐZ · ${showTrams.length} trạm`;
      break;
    }
    case 'MBA': case 'Ngăn MBA': {
      title = '🔧 MBA';
      const nganScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      nganScope.mba.forEach(key => {
        const [tram, ngan] = key.split('|||');
        if (!tram || !ngan) return;
        if (!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      const total = showTrams.reduce((s, t) => s + byTram[t].size, 0);
      totalLine = `${total} ngăn MBA · ${showTrams.length} trạm`;
      break;
    }
    case 'Ngăn XT': case 'Ngăn xuất tuyến': case 'Ngăn xuất tuyến (XT)': {
      title = '↗ Ngăn Xuất Tuyến (XT)';
      const nganScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      nganScope.xt.forEach(key => {
        const [tram, ngan] = key.split('|||');
        if (!tram || !ngan) return;
        if (!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      const total = showTrams.reduce((s, t) => s + byTram[t].size, 0);
      totalLine = `${total} ngăn XT · ${showTrams.length} trạm`;
      break;
    }
    case 'Ngăn liên lạc (LL)': {
      title = '⇄ Ngăn Liên Lạc (LL)';
      const nganScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      nganScope.ll.forEach(key => {
        const [tram, ngan] = key.split('|||');
        if (!tram || !ngan) return;
        if (!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      const total = showTrams.reduce((s, t) => s + byTram[t].size, 0);
      totalLine = `${total} ngăn LL · ${showTrams.length} trạm`;
      break;
    }
    case 'Ngăn tụ bù (TBN)': {
      title = '🔋 Ngăn Tụ Bù (TBN)';
      const _tbnScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      let totalActive = 0, totalInactive = 0;
      _tbnScope.tbnAll.forEach(key => {
        const [tram, ngan] = key.split('|||'); if(!tram||!ngan) return;
        if(!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
        const ckhai = (_tbnScope.tbnMeta?.get(key)||'') === 'chua_khai_thac';
        if (ckhai) totalInactive++; else totalActive++;
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      totalLine = `${totalActive} ngăn TBN · ${totalInactive} chưa khai thác · ${showTrams.length} trạm`;
      break;
    }
    case 'Ngăn tự dùng (TD)': {
      title = '🔌 Ngăn Tự Dùng (TD)';
      const _tdScope = lytBuildScopedNganSets(rows, _chipAllData);
      const byTram = {};
      let totalActive = 0, totalInactive = 0;
      _tdScope.tdAll.forEach(key => {
        const [tram, ngan] = key.split('|||'); if(!tram||!ngan) return;
        if(!byTram[tram]) byTram[tram] = new Set();
        byTram[tram].add(ngan);
        const ck = (_tdScope.tdMeta?.get(key)||'') === 'chua_khai_thac';
        if (ck) totalInactive++; else totalActive++;
      });
      const showTrams = filteredTrams.filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      totalLine = `${totalActive} ngăn TD · ${totalInactive} chưa khai thác · ${showTrams.length} trạm`;
      break;
    }
    case 'Ngăn kháng': {
      title = '🧲 Ngăn Kháng';
      const khangSource = _chipAllData.length ? _chipAllData : rows;
      const byTram = {};
      khangSource.forEach(d => {
        const t = (d.Tram||'').trim(); if(!t) return;
        const ng = (d.Ngan_thiet_bi||'').trim(); if(!ng) return;
        const loai = lytNormalizeNganLoai(d.Loai_ngan_lo);
        const pl   = (d.Phan_loai_thiet_bi||'').trim();
        if (loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng') {
          if (!byTram[t]) byTram[t] = new Set();
          byTram[t].add(ng);
        }
      });
      if (!Object.keys(byTram).length) {
        items.push({ text: 'Không tìm thấy Ngăn Kháng', sub: 'Kiểm tra Loai_ngan_lo hoặc Phan_loai_thiet_bi', color: '#ff9100' });
        totalLine = 'Không có dữ liệu';
        break;
      }
      const showTrams = (filteredTrams.length ? filteredTrams : Object.keys(byTram)).filter(t => byTram[t]);
      items = _lytBuildHierarchy(showTrams, tramMaxCap, LYT_CAP_COLORS, capLbl,
        (t) => byTram[t] || new Set());
      const total = showTrams.reduce((s, t) => s + byTram[t].size, 0);
      totalLine = `${total} ngăn Kháng · ${showTrams.length} trạm`;
      break;
    }
    case 'Tổng số thiết bị': {
      title = '📦 Tổng số thiết bị';
      const byType = {};
      rows.forEach(r => {
        const pl = (r.Phan_loai_thiet_bi||'Khác').trim();
        if (!byType[pl]) byType[pl] = { qty: 0, trams: {} };
        byType[pl].qty += Number(r.So_luong)||1;
        const t = (r.Tram||'').trim();
        if (t) {
          if (!byType[pl].trams[t]) byType[pl].trams[t] = [];
          byType[pl].trams[t].push(r);
        }
      });
      const sorted = Object.entries(byType).sort((a,b)=>a[0].localeCompare(b[0],'vi'));
      const total  = sorted.reduce((s,[,v]) => s + v.qty, 0);
      sorted.forEach(([pl, v]) => {
        const tramList = Object.entries(v.trams).sort((a,b)=>a[0].localeCompare(b[0],'vi'));
        // Use dominant cap for type color (most common cap among trạm)
        const capCounts = {};
        tramList.forEach(([t]) => { const c = tramMaxCap[t]||'1'; capCounts[c]=(capCounts[c]||0)+1; });
        const domCap = Object.entries(capCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'1';
        const typeColor = LYT_CAP_COLORS[domCap]||'#18ffff';
        // Build 2-level children: each child = 1 trạm with devices as leaf detail
        const children = tramList.map(([t, rs]) => {
          const cap    = tramMaxCap[t]||'';
          const capTag = cap ? ` [${capLbl[cap]||cap}]` : '';
          // Leaf: each device name A-Z, deduplicated
          const devNames = [...new Set(
            rs.map(r=>(r.Ten_thiet_bi||r.Ngan_thiet_bi||r.Phan_loai_thiet_bi||'').trim()).filter(Boolean)
          )].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
          const qty = rs.reduce((s,r)=>s+(Number(r.So_luong)||1),0);
          return {
            text: `${t}${capTag}`,
            sub:  `${qty} TB`,
            color: LYT_CAP_COLORS[cap]||typeColor,
            detail: devNames,
          };
        });
        items.push({
          text:     pl,
          sub:      `${v.qty.toLocaleString('vi-VN')} TB · ${tramList.length} trạm`,
          color:    typeColor,
          children,
        });
      });
      totalLine = `${total.toLocaleString('vi-VN')} thiết bị · ${sorted.length} loại`;
      break;
    }
    case 'Tổng công suất': {
      title = '⚡ Tổng công suất MBA';
      // Build per-tram per-ngan MBA data (deduplicated by Tram+Ngan)
      const byTram2 = {};
      const mbaSeenCS = new Map(); // avoid double-count
      rows.forEach(r => {
        const t   = (r.Tram||'').trim(); if (!t) return;
        const pl  = (r.Phan_loai_thiet_bi||'').trim();
        const cap = String(r.Cap_dien_ap??'');
        if (pl !== 'MBA' || (cap !== '1' && cap !== '2')) return;
        const ng  = (r.Ngan_thiet_bi||'').trim();
        const csKey = t + '|||' + ng;
        const cs = Number(r.Cong_suat)||0;
        if (!byTram2[t]) byTram2[t] = { cs:0, cap, ngans:{} };
        // Deduplicate per ngan (take max)
        if (!byTram2[t].ngans[ng]) byTram2[t].ngans[ng] = { cs:0, name: r.Ten_thiet_bi||ng };
        if (cs > byTram2[t].ngans[ng].cs) byTram2[t].ngans[ng].cs = cs;
      });
      // Compute tram totals from deduped ngans
      Object.values(byTram2).forEach(v => {
        v.cs = Object.values(v.ngans).reduce((s,ng)=>s+ng.cs, 0);
      });
      let total2 = 0;
      filteredTrams.filter(t => byTram2[t]).forEach(t => {
        const { cs, cap, ngans } = byTram2[t];
        total2 += cs;
        if (cs <= 0) return;
        // Build detail: each MBA ngan with its power
        const detail = Object.entries(ngans)
          .filter(([,v]) => v.cs > 0)
          .sort((a,b) => b[1].cs - a[1].cs)
          .map(([ng, v]) => `${ng}${v.name && v.name!==ng?' · '+v.name:''} — ${v.cs.toLocaleString('vi-VN')} MVA`);
        items.push({
          text:   t,
          sub:    `${cs.toLocaleString('vi-VN')} MVA`,
          color:  LYT_CAP_COLORS[cap]||'#888',
          detail,
        });
      });
      totalLine = `${total2.toLocaleString('vi-VN')} MVA tổng / ${items.length} trạm`;
      break;
    }
    case 'Công nghệ thiết bị TBA': {
      title = '🏗️ Công nghệ thiết bị TBA';
      const techMap = {};
      rows.forEach(r => {
        const tech = (r.Cong_nghe||r.Loai_cong_nghe||'').trim() || 'AIS';
        if (!techMap[tech]) techMap[tech] = { qty: 0, trams: new Set() };
        techMap[tech].qty += 1;
        if (r.Tram) techMap[tech].trams.add((r.Tram||'').trim());
      });
      const techColors = { AIS:'#00c8ff', GIS:'#b388ff', HGIS:'#18ffff', KCK:'#00e676' };
      Object.entries(techMap).sort((a,b)=>b[1].qty-a[1].qty).forEach(([tech, v]) => {
        items.push({ text: tech, sub: `${v.trams.size} trạm`, color: techColors[tech]||'#ff9100' });
      });
      totalLine = `${filteredTrams.length} trạm · ${Object.keys(techMap).length} loại công nghệ`;
      break;
    }
    default:
      // Card không hỗ trợ drill-down — thử hiển thị tổng quan
      items.push({ text: label, sub: 'Không có dữ liệu chi tiết', color: color||'var(--accent)' });
      totalLine = '';
      break;
  }

  if (!items.length) {
    items.push({ text: 'Không có dữ liệu', sub: 'Vui lòng kiểm tra kết nối Supabase', color: '#ff5252' });
    totalLine = '0 bản ghi';
  }

  // Delegate to the standard panel function (_lytShowDetailPanel)
  _lytShowDetailPanel(title, color || 'var(--accent)', totalLine, items, null);
}

function lytNormalizeNganLoai(v) {
  const raw = normalizeSearchText(v);
  // 'raw' đã bỏ dấu + lowercase + trim, nhưng CÒN khoảng trắng
  // nên cần kiểm tra cả variant có space và không space
  if (raw === 'ngan dz'    || raw === 'ngandz'    || raw === 'ngan duong day') return 'Ngăn ĐZ';
  if (raw === 'ngan xt'    || raw === 'nganxt'    || raw === 'ngan xuat tuyen' || raw === 'xuat tuyen') return 'Ngăn XT';
  if (raw === 'ngan mba'   || raw === 'nganmba')   return 'Ngăn MBA';
  if (raw === 'ngan ll'    || raw === 'nganll'    || raw === 'ngan lien lac')  return 'Ngăn LL';
  if (raw === 'ngan tbn'   || raw === 'ngantbn'   || raw === 'ngan tu bu')     return 'Ngăn TBN';
  if (raw === 'ngantd'     || raw === 'ngan td'   || raw === 'ngan tu dung')   return 'NgănTD';
  if (raw === 'ngan khang' || raw === 'ngankhang')                             return 'Ngăn Kháng';
  return String(v || '').trim();
}

function lytIsMBARow(d) {
  // Đếm theo Phan_loai_thiet_bi = 'MBA' exact (bỏ MBATD, MBA,...)
  const pl = (d?.Phan_loai_thiet_bi || '').trim();
  return pl === 'MBA';
}

function lytBuildScopedNganSets(activeRows, sourceRows = _chipAllData) {
  const rows = Array.isArray(activeRows) ? activeRows : [];
  const fallbackRows = Array.isArray(sourceRows) && sourceRows.length ? sourceRows : rows;
  const filteredTrams = new Set(rows.map(d => (d.Tram || '').trim()).filter(Boolean));
  const scopedRows = filteredTrams.size
    ? fallbackRows.filter(d => filteredTrams.has((d.Tram || '').trim()))
    : fallbackRows;

  const buildSet = predicate => {
    const out = new Set();
    scopedRows.filter(predicate).forEach(d => {
      const tram = (d.Tram || '').trim();
      const ngan = (d.Ngan_thiet_bi || '').trim();
      if (tram && ngan) out.add(tram + '|||' + ngan);
    });
    return out;
  };

  // Tổng ngăn: loại HTTĐ
  const isHTTD = d => {
    const n = (d.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
    return n === 'HTTĐ' || n === 'HTTD' || n.startsWith('HTTD');
  };

  // ── Build nganKey sets with extended TD / TBN logic ──

  // Ngăn Tự dùng (TD):
  // 1. Loai_ngan_lo là "NgănTD" → luôn tính
  // 2. Trong ngăn đó có thiết bị có Phan_loai_thiet_bi chứa 'MBATD' → cũng tính là ngăn TD
  // 3. Ngăn Loai_ngan_lo là "NgănTD" nhưng không có MBATD trong ngăn → gán tag "chưa khai thác" và KHÔNG đếm vào total
  const _tdNganKeys = new Map(); // key → 'active' | 'chua_khai_thac'
  const _tbnNganKeys = new Map(); // key → 'active' | 'chua_khai_thac'

  scopedRows.forEach(d => {
    const tram = (d.Tram || '').trim();
    const ngan = (d.Ngan_thiet_bi || '').trim();
    if (!tram || !ngan) return;
    const k = tram + '|||' + ngan;
    const pl = (d.Phan_loai_thiet_bi || '').trim().toUpperCase().replace(/\s+/g,'');
    const loai = lytNormalizeNganLoai(d.Loai_ngan_lo);

    // Tự dùng: Loai_ngan_lo = NgănTD hoặc có MBATD trong ngăn
    const hasMBATD = pl === 'MBATD' || pl.includes('MBATD');
    const isLoaiTD = loai === 'NgănTD';
    if (isLoaiTD || hasMBATD) {
      // Nếu có MBATD thực sự → active; ngăn TD mà không có MBATD → chua_khai_thac
      const prev = _tdNganKeys.get(k) || 'chua_khai_thac';
      if (hasMBATD) {
        _tdNganKeys.set(k, 'active');
      } else if (!_tdNganKeys.has(k)) {
        _tdNganKeys.set(k, 'chua_khai_thac');
      }
    }

    // Tụ bù (TBN): Loai_ngan_lo = 'Ngăn TBN' hoặc có thiết bị TBN/tụ bù
    const hasTBNDev = pl === 'TBN' || pl === 'TUBÙ' || pl === 'TUBU' || pl.includes('TBN');
    const isLoaiTBN = loai === 'Ngăn TBN';
    if (isLoaiTBN || hasTBNDev) {
      const prev2 = _tbnNganKeys.get(k) || 'chua_khai_thac';
      if (hasTBNDev) {
        _tbnNganKeys.set(k, 'active');
      } else if (!_tbnNganKeys.has(k)) {
        _tbnNganKeys.set(k, 'chua_khai_thac');
      }
    }
  });

  // Build active-only sets (for counting) and full sets (for display)
  const tdActiveSet = new Set([..._tdNganKeys.entries()].filter(([,v])=>v==='active').map(([k])=>k));
  const tdAllSet    = new Set(_tdNganKeys.keys());     // for panel display (incl. chưa khai thác)
  const tbnActiveSet = new Set([..._tbnNganKeys.entries()].filter(([,v])=>v==='active').map(([k])=>k));
  const tbnAllSet    = new Set(_tbnNganKeys.keys());

  return {
    filteredTrams,
    scopedRows,
    total:  buildSet(d => !isHTTD(d)),
    dz:     buildSet(d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn ĐZ'),
    mba:    buildSet(d => lytIsMBARow(d)),
    xt:     buildSet(d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn XT'),
    ll:     buildSet(d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'Ngăn LL'),
    tbn:    tbnActiveSet,       // chỉ đếm ngăn có TBN thực sự
    tbnAll: tbnAllSet,           // gồm cả "chưa khai thác" (dùng cho panel)
    tbnMeta: _tbnNganKeys,       // 'active' | 'chua_khai_thac'
    td:     tdActiveSet,         // chỉ đếm ngăn có MBATD thực sự
    tdAll:  tdAllSet,
    tdMeta: _tdNganKeys,
    // ── Fix bug Ngăn Kháng (sync với logic panel detail dòng ~4639):
    // Phải check cả Phan_loai_thiet_bi='K' hoặc 'Kháng' vì có TB không có Loai_ngan_lo
    khang:  buildSet(d => {
      const loai = lytNormalizeNganLoai(d.Loai_ngan_lo);
      const pl   = (d.Phan_loai_thiet_bi||'').trim();
      return loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng';
    }),
  };
}

// Cache cho tối ưu #5: skip re-render nếu data không đổi
let _recomputeStatsLastHash = '';

function _recomputeStatsWithFilter() {
  // ── Tối ưu #5: skip re-render nếu input không đổi ──
  // Tính hash từ filter state + data length (cách nhanh)
  const quickHash = `${_chipFiltered.length}|${_chipAllData.length}|${JSON.stringify(_lf)}|${[..._selectedChips].sort().join(',')}`;
  if (quickHash === _recomputeStatsLastHash) {
    return;  // Không có gì thay đổi, không cần recompute
  }
  _recomputeStatsLastHash = quickHash;

  // Recompute stats from _chipFiltered and update stat cards
  // KEY 1: TBA count uses maxCap from ALL rows (_chipAllData), not filtered rows
  // Ví dụ: thiết bị 110kV ở trạm 220kV vẫn tính là trạm 220kV
  // KEY 2: Count "ngăn" on the full station scope, not only filtered device rows,
  // để tránh hụt số ngăn khi chip chỉ lọc theo một loại thiết bị con trong cùng trạm.
  const rows = _chipFiltered.length ? _chipFiltered : _chipAllData;
  const statsItem = layout.find(l => l.type === 'stats');
  if (!statsItem) return;
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—';

  const tf = d => d.Tram || '';

  function isExclDev(pl) {
    if (!pl) return true;
    const n = (pl||'').trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
    if (n === 'THM') return true;
    if (n === 'RL')  return true;
    if (n.startsWith('TICHAN') || n.includes('TICHÂN')) return true;
    if (n === 'HTTĐ' || n === 'HTTD' || n.startsWith('HTTD')) return true;
    if (n === 'DẦU' || n === 'DAU' || n.startsWith('DẦU') || n.startsWith('DAU')) return true;
    return false;
  }

  // Build maxCap map from ALL rows (not filtered) — trạm 220kV stays 220kV
  // regardless of which device type is selected in chips
  const tramMaxCap = {};
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  _chipAllData.forEach(d => {
    const tram = tf(d); if (!tram) return;
    const cap  = String(d.Cap_dien_ap);
    if (cap === 'null' || cap === 'undefined') return;
    const cur = tramMaxCap[tram];
    if (!cur || (capPrio[cap]??99) < (capPrio[cur]??99)) tramMaxCap[tram] = cap;
  });

  // Stations that appear in filtered rows
  const nganScope = lytBuildScopedNganSets(rows, _chipAllData);
  const filteredTrams = nganScope.filteredTrams;
  const totalTBA = filteredTrams.size;
  // 220kV: trạm trong filtered có maxCap=2
  const n220 = [...filteredTrams].filter(t => tramMaxCap[t] === '2').length;
  // 110kV: trạm trong filtered có maxCap=1 (không có maxCap=2)
  const n110 = [...filteredTrams].filter(t => tramMaxCap[t] === '1').length;
  const totalDevices = rows.filter(d=>!isExclDev(d.Phan_loai_thiet_bi)).reduce((s,d)=>s+(Number(d.So_luong)||0),0);
  // Tổng công suất: deduplicate MBA theo Tram+Ngan → tránh đếm 2 lần
  const _mbaCSMap = new Map();
  rows.forEach(d => {
    const pl  = (d.Phan_loai_thiet_bi || '').trim();
    const cap = String(d.Cap_dien_ap ?? '');
    if (pl !== 'MBA' || !d.Tram || !d.Ngan_thiet_bi || (cap !== '1' && cap !== '2')) return;
    const key = d.Tram + '|||' + d.Ngan_thiet_bi;
    const cs = Number(d.Cong_suat) || 0;
    if (cs > (_mbaCSMap.get(key) || 0)) _mbaCSMap.set(key, cs);
  });
  const tongCS = [..._mbaCSMap.values()].reduce((s, cs) => s + cs, 0);

  // Update cards values and push to DOM immediately (bypasses RAF delay)
  statsItem.props.cards.forEach(card => {
    switch (card.label) {
      case 'Tổng số TBA':       card.value = fmt(totalTBA); break;
      case 'TBA 220kV':         card.value = fmt(n220); card.ratioValue = pct(n220,totalTBA); break;
      case 'TBA 110kV':         card.value = fmt(n110); card.ratioValue = pct(n110,totalTBA); break;
      case 'Tổng số thiết bị':  card.value = fmt(totalDevices); break;
      case 'Tổng số ngăn':      card.value = fmt(nganScope.total.size); break;
      case 'Ngăn đường dây':    card.value = fmt(nganScope.dz.size); break;
      case 'MBA': case 'Ngăn MBA': card.value = fmt(nganScope.mba.size); break;
      case 'Ngăn XT': case 'Ngăn xuất tuyến': case 'Ngăn xuất tuyến (XT)':
                                card.value = fmt(nganScope.xt.size); break;
      case 'Ngăn liên lạc (LL)':  card.value = fmt(nganScope.ll.size); break;
      case 'Ngăn tụ bù (TBN)':    card.value = fmt(nganScope.tbn.size); break;
      case 'Ngăn tự dùng (TD)':   card.value = fmt(nganScope.td.size); break;
      case 'Ngăn kháng':           card.value = fmt(nganScope.khang.size); break;
      case 'Tổng công suất (MVA)': case 'Tổng công suất':
                                card.value = fmt(Math.round(tongCS)); break;
    }
  });

  // ── Cập nhật Công nghệ TBA theo filter ──
  (function() {
    const { tech220, tech110, tech22 } = lytComputeTech(rows);
    const statsItem2 = layout.find(l => l.type === 'stats');
    if (!statsItem2) return;
    const techCard = statsItem2.props.cards.find(c => c.chartType === 'tech' || (c.label||'').includes('Công nghệ'));
    if (!techCard) return;
    techCard.tech220 = { ...tech220 };
    techCard.tech110 = { ...tech110 };
    techCard.tech22  = { ...tech22  };
  })();

  // Update tech chart DOM trực tiếp (không chờ RAF)
  (function() {
    const si = layout.find(l => l.type === 'stats');
    if (!si) return;
    const tc = si.props.cards.find(c => c.chartType === 'tech');
    if (!tc) return;
    const uid = si.uid;
    const ci  = si.props.cards.indexOf(tc);
    const el  = document.getElementById(`tc_${uid}_${ci}`);
    if (!el) return;
    const rowEl = document.getElementById(`tr_${uid}_${ci}`);
    if (!rowEl) return;
    // Re-render tech rows bằng cách gọi lại logic buildHVSection + buildLVSection
    // Đơn giản: trigger scheduleCanvasRender ngay
    scheduleCanvasRender(uid);
  })();

  // Cập nhật DOM trực tiếp — KHÔNG chờ RAF để tránh flash giá trị cũ
  const statsWrapper = document.querySelector(`.section-wrapper[data-uid="${statsItem.uid}"]`);
  if (statsWrapper) {
    statsItem.props.cards.forEach((card, ci) => {
      const valEl = statsWrapper.querySelector(`[data-uid="${statsItem.uid}"][data-ci="${ci}"][data-field="value"]`);
      if (valEl && card.value !== undefined) valEl.textContent = card.value;
      if (card.ratioValue !== undefined) {
        const ratioEl = statsWrapper.querySelector(`#icc_${statsItem.uid}_${ci} .ic-ratio`);
        if (ratioEl) ratioEl.textContent = card.ratioValue;
      }
    });
  }

  scheduleCanvasRender(statsItem.uid);
}

const LYT_CAP_LABEL  = {'0':'TT','1':'110kV','2':'220kV','3':'35kV','4':'22kV','6':'6kV','9':'10kV'};
const LYT_CAP_ORDER  = ['2','1','3','4','9','6','0'];
const LYT_CAP_COLORS = {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
const LYT_TECH_COLORS = {AIS:'#00c8ff', GIS:'#b388ff', HGIS:'#18ffff', HGIS_AIS:'#ff9100'};
// ── Cache version v7: bump khi structure/logic thay đổi ──
// v6 → v7: fix logic đếm Ngăn Kháng (sync 3 điều kiện với panel detail)
// Bump version → user tự động fetch lại data mới, không phải bấm "Tải lại"
const LYT_DATA_CACHE_KEY = 'evn_supabase_rows_cache_v7';
const LYT_DATA_CACHE_META_KEY = 'evn_supabase_rows_cache_meta_v7';
// ── Tối ưu #8: tăng cache TTL từ 30 phút lên 24 giờ ──
// Data điện lực rất ít thay đổi (vài ngày 1 lần) → cache 24h an toàn.
// Khi cần force refresh: bấm nút "Tải lại" trên dashboard hoặc xóa localStorage.
const LYT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000; // 24 giờ
const LYT_FETCH_BATCH_SIZE = 1000;
const LYT_FETCH_CONCURRENCY = 4;

function lytReadRowsCache() {
  try {
    const raw = localStorage.getItem(LYT_DATA_CACHE_KEY);
    if (!raw) return null;
    const rows = JSON.parse(raw);
    const meta = JSON.parse(localStorage.getItem(LYT_DATA_CACHE_META_KEY) || '{}');
    if (!Array.isArray(rows) || !rows.length) return null;
    return { rows, meta };
  } catch (err) {
    console.warn('lytReadRowsCache failed', err);
    return null;
  }
}

function lytWriteRowsCache(rows) {
  try {
    const payload = JSON.stringify(rows);
    if (payload.length <= 4500000) {
      localStorage.setItem(LYT_DATA_CACHE_KEY, payload);
      localStorage.setItem(LYT_DATA_CACHE_META_KEY, JSON.stringify({ ts: Date.now(), count: rows.length, partial: false }));
      return { ok: true, partial: false, count: rows.length };
    }

    const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
    const compactRows = [...rows].sort((a, b) => {
      const pa = capPrio[String(a.Cap_dien_ap)] ?? 99;
      const pb = capPrio[String(b.Cap_dien_ap)] ?? 99;
      if (pa !== pb) return pa - pb;
      return (Number(b.So_luong) || 0) - (Number(a.So_luong) || 0);
    }).slice(0, 2000);
    const compactPayload = JSON.stringify(compactRows);
    if (compactPayload.length > 4500000) {
      localStorage.removeItem(LYT_DATA_CACHE_KEY);
      localStorage.setItem(LYT_DATA_CACHE_META_KEY, JSON.stringify({ ts: Date.now(), count: 0, partial: true, cacheDisabled: true }));
      showToast('⚠ Cache đầy — dữ liệu không được lưu cục bộ');
      return { ok: false, partial: true, count: 0 };
    }
    localStorage.setItem(LYT_DATA_CACHE_KEY, compactPayload);
    localStorage.setItem(LYT_DATA_CACHE_META_KEY, JSON.stringify({ ts: Date.now(), count: compactRows.length, partial: true, originalCount: rows.length }));
    showToast('⚠ Cache đầy — chỉ lưu cục bộ bản rút gọn để mở nhanh lần sau');
    return { ok: true, partial: true, count: compactRows.length };
  } catch (err) {
    console.warn('lytWriteRowsCache failed', err);
    showToast('⚠ Không lưu được cache cục bộ');
    return { ok: false, partial: false, count: 0 };
  }
}

function renderLiveSectionSkeletons() {
  const chipsItem  = layout.find(l => l.type === 'chips');
  const chartsItem = layout.find(l => l.type === 'charts');

  // Chips: ok thay thế card-preview (renderChipsSection sẽ rebuild hoàn toàn)
  if (chipsItem) {
    const chipsPrev = document.querySelector(`.section-wrapper[data-uid="${chipsItem.uid}"] .card-preview`);
    if (chipsPrev) chipsPrev.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">${Array.from({length:6}).map(()=>'<div class="live-skeleton live-skeleton-chip"></div>').join('')}</div>`;
  }

  // Charts: KHÔNG xoá card-preview (sẽ mất lytChartMain_uid)
  // Chỉ cập nhật nội dung bên trong lytChartMain nếu tồn tại
  // Nếu không tồn tại: tạo lại structure đúng cấu trúc để renderChartsSection dùng được
  if (chartsItem) {
    const uid = chartsItem.uid;
    const skeletonRows = `<div class="live-skeleton" style="height:34px;margin-bottom:10px"></div>
      ${Array.from({length:4}).map((_,i)=>`<div class="live-skeleton live-skeleton-bar" style="width:${[96,88,79,67][i]}%"></div>`).join('')}
      <div class="live-skeleton" style="height:180px;margin-top:10px"></div>`;

    let mainEl = document.getElementById('lytChartMain_' + uid);
    if (mainEl) {
      // Element tồn tại → chỉ thay nội dung, giữ nguyên DOM container
      mainEl.innerHTML = `<div style="padding:8px"><div class="hm-sub-bar" style="margin-bottom:12px"><i class="fas fa-spinner fa-spin" style="color:var(--accent)"></i> Đang tải dữ liệu…</div>${skeletonRows}</div>`;
    } else {
      // Element không tồn tại → cần rebuild toàn bộ card-preview với đúng structure
      const chartsPrev = document.querySelector(`.section-wrapper[data-uid="${uid}"] .card-preview`);
      if (chartsPrev) {
        chartsPrev.innerHTML = `<div class="lyt-charts-wrap" id="lytChartsWrap_${uid}">
          <div id="lytChartMain_${uid}" style="min-height:60px;padding:8px">
            <div class="hm-sub-bar" style="margin-bottom:12px"><i class="fas fa-spinner fa-spin" style="color:var(--accent)"></i> Đang tải dữ liệu…</div>
            ${skeletonRows}
          </div>
        </div>`;
      }
    }
  }
}

// ── Tính công nghệ TBA từ bất kỳ tập rows nào ─────────────────
// Tách thành hàm riêng để dùng được ở cả cache path và full-fetch path
function lytComputeTech(rows) {
  function classifyHV(typeSet) {
    const arr = [...typeSet];
    const hasGIS  = arr.some(t => t === 'GIS');
    const hasHGIS = arr.some(t => t === 'HGIS');
    const hasMC   = arr.some(t => t === 'MC');
    if (hasHGIS && hasMC) return 'HGIS_AIS';
    if (hasGIS  && hasMC) return 'HGIS_AIS';
    if (hasHGIS) return 'HGIS';
    if (hasGIS)  return 'GIS';
    return 'AIS';
  }
  function classifyLV(typeSet) {
    const arr = [...typeSet];
    const hasGIS  = arr.some(t => t === 'GIS');
    const hasHGIS = arr.some(t => t === 'HGIS');
    const hasMC   = arr.some(t => t === 'MC');
    if ((hasHGIS || hasGIS) && hasMC) return 'GIS_KCK';
    if (hasHGIS || hasGIS) return 'GIS';
    return 'KCK';
  }

  const tramCapTypes = {};
  rows.forEach(d => {
    const tram = (d.Tram || '').trim();
    const cap  = String(d.Cap_dien_ap ?? '');
    const pl   = (d.Phan_loai_thiet_bi || '').trim().toUpperCase();
    if (!tram || !pl || cap === 'null' || cap === 'undefined' || cap === '') return;
    if (!tramCapTypes[tram]) tramCapTypes[tram] = {};
    if (!tramCapTypes[tram][cap]) tramCapTypes[tram][cap] = new Set();
    tramCapTypes[tram][cap].add(pl);
  });

  const tech220 = { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const tech110 = { AIS:0, GIS:0, HGIS:0, HGIS_AIS:0 };
  const tech22  = { GIS:0, KCK:0, GIS_KCK:0 };
  const counted = new Set();

  Object.entries(tramCapTypes).forEach(([tram, capMap]) => {
    const effCap = capMap['2'] ? '2' : capMap['1'] ? '1' : null;
    if (effCap && !counted.has(tram)) {
      counted.add(tram);
      const cls = classifyHV(capMap[effCap]);
      if (effCap === '2') tech220[cls] = (tech220[cls]||0) + 1;
      else                tech110[cls] = (tech110[cls]||0) + 1;
    }
    const lvCaps = ['4','3'].filter(c => capMap[c]);
    if (lvCaps.length > 0) {
      const lvTypes = new Set();
      lvCaps.forEach(cap => capMap[cap].forEach(t => lvTypes.add(t)));
      const cls = classifyLV(lvTypes);
      tech22[cls] = (tech22[cls]||0) + 1;
    }
  });

  return { tech220, tech110, tech22 };
}

// Cập nhật card Công nghệ TBA trong layout với kết quả từ lytComputeTech
function lytApplyTechToCard(tech220, tech110, tech22) {
  const statsItem = layout.find(l => l.type === 'stats');
  if (!statsItem) return;
  const techCard = statsItem.props.cards.find(c => {
    const k = (c.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').trim();
    return k.includes('cong nghe') || c.chartType === 'tech';
  });
  if (!techCard) return;
  techCard.chartType = 'tech';
  techCard.tech220 = { ...tech220 };
  techCard.tech110 = { ...tech110 };
  techCard.tech22  = { ...tech22  };
  // Trigger re-render chỉ stats section
  scheduleCanvasRender(statsItem.uid);
}

async function loadStatsFromSupabase() {
  renderLiveSectionSkeletons();
  const cached = lytReadRowsCache();
  const cacheAge = cached?.meta?.ts ? (Date.now() - cached.meta.ts) : Number.POSITIVE_INFINITY;
  const isFreshCache = cacheAge < LYT_CACHE_FRESH_MS;

  // ── Cache validation triệt để: check row count từ server ──
  // Nếu count khác với cache → data đã thay đổi → invalidate cache
  let serverCount = null;
  let cacheValid = true;
  if (cached?.rows?.length) {
    try {
      const sbCheck = window.supabase.createClient(_SB_URL, _SB_KEY);
      const { count } = await sbCheck.from('TongHopThietBi').select('*', { count: 'exact', head: true });
      serverCount = count;
      const cachedCount = cached.meta?.count || cached.rows.length;
      if (count != null && count !== cachedCount) {
        console.log(`[cache] Server có ${count} rows, cache có ${cachedCount} → invalidate`);
        cacheValid = false;
      }
    } catch (e) {
      console.warn('[cache] Không check được server count, dùng cache:', e);
    }
  }

  if (cached?.rows?.length && cacheValid) {
    _chipAllData = cached.rows;
    _chipFiltered = [...cached.rows];
    _selectedChips.clear();
    _recomputeStatsWithFilter();
    // Tính Công nghệ TBA từ cache (không được tính trong _recomputeStatsWithFilter)
    const { tech220, tech110, tech22 } = lytComputeTech(cached.rows);
    lytApplyTechToCard(tech220, tech110, tech22);
    setTimeout(() => { renderChipsSection(); renderChartsSection(); renderTimelineSection(); renderLiveFilterSection(); }, 50);
    showToast(`⚡ Dùng cache cục bộ (${cached.rows.length.toLocaleString('vi-VN')} dòng)`);
    if (isFreshCache) return;
  } else if (!cacheValid) {
    // Cache invalid → xóa luôn
    try {
      localStorage.removeItem(LYT_DATA_CACHE_KEY);
      localStorage.removeItem(LYT_DATA_CACHE_META_KEY);
    } catch(_) {}
    showToast('🔄 Phát hiện dữ liệu mới — đang tải lại...');
  } else {
    showToast('⏳ Đang tải dữ liệu từ Supabase...');
  }
  try {
    // Dùng cách tải của app.js: supabaseClient tạo 1 lần, vòng while đơn giản
    const supabaseClient = window.supabase.createClient(_SB_URL, _SB_KEY);
    const TABLE_NAME = 'TongHopThietBi';
    const batchSize  = 1000;

    // Các cột cần cho stats, chips, filter, timeline
    const NEEDED_COLS = 'Tram,Cap_dien_ap,Phan_loai_thiet_bi,Ten_thiet_bi,So_luong,Ngan_thiet_bi,Loai_ngan_lo,Cong_suat,Nam_san_xuat,Nam_van_hanh,Hang_san_xuat,Ly_lich,Thong_so,Doi,Kieu';

    // Fetch tuần tự — y hệt app.js fetchData()
    // ── PARALLEL FETCH (Tối ưu #2): tải song song thay vì tuần tự ──
    // Trước: 18 batch × ~300ms = ~5-6 giây
    // Sau:  song song max ~1 giây
    let allRows = [];
    try {
      // Lấy tổng số rows trước (head:true → chỉ trả count, không trả data)
      const { count, error: countErr } = await supabaseClient
        .from(TABLE_NAME)
        .select('*', { count: 'exact', head: true });

      if (countErr || !count) throw new Error('Không lấy được tổng số rows');

      const numBatches = Math.ceil(count / batchSize);
      console.log(`[loadStats] Tải song song ${numBatches} batches (${count} rows)`);

      // Tải song song tất cả batch
      const batchPromises = Array.from({ length: numBatches }, (_, i) =>
        supabaseClient
          .from(TABLE_NAME)
          .select(NEEDED_COLS)
          .range(i * batchSize, (i + 1) * batchSize - 1)
      );

      const results = await Promise.all(batchPromises);

      // Gộp kết quả + báo lỗi nếu batch nào fail
      for (const r of results) {
        if (r.error) {
          console.error('[Supabase batch error]', r.error);
          continue;
        }
        if (r.data) allRows.push(...r.data);
      }
    } catch (parallelErr) {
      // Fallback: nếu parallel fail, dùng sequential cũ
      console.warn('[loadStats] Parallel fetch failed, fallback to sequential:', parallelErr);
      allRows = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select(NEEDED_COLS)
          .range(from, from + batchSize - 1);
        if (error) { console.error('[Supabase Error]', error); break; }
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
    }
    if (!allRows.length) { showToast('⚠ Không tải được dữ liệu'); return; }

    const tf = d => d.Tram || '';
    const CAP_LABEL_H = { 0: 'TT', 1: '110kV', 2: '220kV', 3: '35kV', 4: '22kV', 6: '6kV', 9: '10kV' };

    // ── 1. Đếm TBA (req 2, 3, 4) ──
    const allTrams = new Set(allRows.map(tf).filter(Boolean));
    const trams220 = new Set(allRows.filter(d => String(d.Cap_dien_ap) === '2').map(tf).filter(Boolean));
    const trams110only = new Set(allRows.filter(d => String(d.Cap_dien_ap) === '1').map(tf).filter(Boolean));
    const n110 = [...trams110only].filter(t => !trams220.has(t)).length;
    const totalTBA = allTrams.size;
    const n220 = trams220.size;

    // ── 2. Tổng số thiết bị: loại THM, RL, TIchânsứ, HTTĐ, Dầu ──
    function isExclDevH(pl) {
      if (!pl) return true;
      const n = (pl||'').trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
      if (n === 'THM') return true;
      if (n === 'RL')  return true;
      if (n.startsWith('TICHAN') || n.includes('TICHÂN')) return true;
      if (n === 'HTTĐ' || n === 'HTTD' || n.startsWith('HTTD')) return true;
      if (n === 'DẦU' || n === 'DAU' || n.startsWith('DẦU') || n.startsWith('DAU')) return true;
      return false;
    }
    const totalDevices = allRows
      .filter(d => !isExclDevH(d.Phan_loai_thiet_bi))
      .reduce((s, d) => s + (Number(d.So_luong) || 0), 0);

    // ── 3. Tổng công suất: deduplicate MBA theo Tram+Ngan → tránh đếm 2 lần ──
    const _mbaCSMapH = new Map();
    allRows.forEach(d => {
      const pl  = (d.Phan_loai_thiet_bi || '').trim();
      const cap = String(d.Cap_dien_ap ?? '');
      if (pl !== 'MBA' || !d.Tram || !d.Ngan_thiet_bi || (cap !== '1' && cap !== '2')) return;
      const key = d.Tram + '|||' + d.Ngan_thiet_bi;
      const cs = Number(d.Cong_suat) || 0;
      if (cs > (_mbaCSMapH.get(key) || 0)) _mbaCSMapH.set(key, cs);
    });
    const tongCongSuat = [..._mbaCSMapH.values()].reduce((s, cs) => s + cs, 0);

    // ── 4. Ngăn ──
    // Tổng số ngăn: loại HTTĐ
    const nganSet = new Set();
    allRows.forEach(d => {
      if (d.Ngan_thiet_bi && d.Tram) {
        const pl = (d.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
        if (pl==='HTTĐ'||pl==='HTTD'||pl.startsWith('HTTD')) return;
        nganSet.add(d.Tram + '|||' + d.Ngan_thiet_bi);
      }
    });
    const totalNgan = nganSet.size;

    // Ngăn đường dây: Loai_ngan_lo === 'Ngăn ĐZ'
    const nganDLSet = new Set();
    allRows.filter(d => (d.Loai_ngan_lo || '').trim() === 'Ngăn ĐZ')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganDLSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn MBA: đếm unique Ngan_thiet_bi có Phan_loai_thiet_bi = 'MBA' exact
    const nganMBASet = new Set();
    allRows.filter(d => (d.Phan_loai_thiet_bi || '').trim() === 'MBA')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganMBASet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn XT
    const nganXTSet = new Set();
    allRows.filter(d => (d.Loai_ngan_lo || '').trim() === 'Ngăn XT')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganXTSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn liên lạc
    const nganLLSet = new Set();
    allRows.filter(d => (d.Loai_ngan_lo || '').trim() === 'Ngăn LL')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganLLSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn tụ bù
    const nganTBNSet = new Set();
    allRows.filter(d => (d.Loai_ngan_lo || '').trim() === 'Ngăn TBN')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganTBNSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn tự dùng — dùng lytNormalizeNganLoai để xử lý encoding
    const nganTDSet = new Set();
    allRows.filter(d => lytNormalizeNganLoai(d.Loai_ngan_lo) === 'NgănTD')
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganTDSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // Ngăn kháng: Loai_ngan_lo = 'Ngăn Kháng' HOẶC Phan_loai_thiet_bi = 'K' / 'Kháng'
    const nganKhangSet = new Set();
    allRows.filter(d => {
        const loai = lytNormalizeNganLoai(d.Loai_ngan_lo);
        const pl = (d.Phan_loai_thiet_bi || '').trim();
        return loai === 'Ngăn Kháng' || pl === 'K' || pl === 'Kháng';
      })
      .forEach(d => { if (d.Tram && d.Ngan_thiet_bi) nganKhangSet.add(d.Tram + '|||' + d.Ngan_thiet_bi); });

    // ── 5. Công nghệ TBA — dùng lytComputeTech ──
    const { tech220, tech110, tech22 } = lytComputeTech(allRows);

        const statsItem = layout.find(l => l.type === 'stats');
    if (!statsItem) return;

    const fmt = n => Number(n).toLocaleString('vi-VN');
    const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—';

    statsItem.props.cards.forEach(card => {
      switch (card.label) {
        case 'Tổng số TBA':
          card.value = fmt(totalTBA); break;
        case 'TBA 220kV':
          card.value = fmt(n220); card.ratioValue = pct(n220, totalTBA); break;
        case 'TBA 110kV':
          card.value = fmt(n110); card.ratioValue = pct(n110, totalTBA); break;
        case 'Tổng số thiết bị':
          card.value = fmt(totalDevices); break;
        case 'Công nghệ thiết bị TBA':
          card.tech220 = { ...tech220 };
          card.tech110 = { ...tech110 };
          card.tech22  = { ...tech22  };
          card.value = '';
          break;
        case 'Tổng số ngăn':
          card.value = fmt(totalNgan); break;
        case 'Ngăn đường dây':
          card.value = fmt(nganDLSet.size); break;
        case 'MBA': case 'Ngăn MBA':
          card.value = fmt(nganMBASet.size); break;
        case 'Ngăn XT': case 'Ngăn xuất tuyến': case 'Ngăn xuất tuyến (XT)':
          card.value = fmt(nganXTSet.size); break;
        case 'Ngăn liên lạc (LL)':
          card.value = fmt(nganLLSet.size); break;
        case 'Ngăn tụ bù (TBN)':
          card.value = fmt(nganTBNSet.size); break;
        case 'Ngăn tự dùng (TD)':
          card.value = fmt(nganTDSet.size); break;
        case 'Ngăn kháng':
          card.value = fmt(nganKhangSet.size); break;
        case 'Tổng công suất (MVA)': case 'Tổng công suất':
          card.value = fmt(Math.round(tongCongSuat)); break;
      }
    });

    // Lưu allRows cho chips renderer
    _chipAllData  = allRows;
    _chipFiltered = [...allRows];
    _selectedChips.clear();
    lytWriteRowsCache(allRows);

    renderCanvas();
    renderQuickNav();
    // Sau khi canvas render xong, render chips + charts với dữ liệu thực
    setTimeout(() => { renderChipsSection(); renderChartsSection(); renderTimelineSection(); renderLiveFilterSection(); }, 80);
    showToast('✓ Đã cập nhật dữ liệu từ Supabase (' + allRows.length.toLocaleString('vi-VN') + ' dòng)');
  } catch (err) {
    console.error('[Supabase Stats Error]', err);
    showToast('⚠ Lỗi khi tải dữ liệu Supabase');
  }
}

// Xoá toàn bộ draft cũ, luôn dùng freshLayout
try { ['v1','v2','v3','v4','v5','v6','v7','v8'].forEach(v => localStorage.removeItem('evn_layout_editor_draft_v'+v)); } catch(_){}
layout = freshLayout();
normalizeLayoutState();

// Restore light mode preference
try {
  if (localStorage.getItem('evn_light_mode') === '1') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('btnLightMode');
    if (btn) btn.innerHTML = '<i class="fas fa-moon"></i> Chế độ tối';
  }
} catch(_) {}

// ── Dummy block để không phá cấu trúc ──
{
  const validCount = Array.isArray(layout)
    ? layout.filter(i => i && i.type && i.uid && i.props).length
    : 0;
  if (validCount === 0) {
    layout = freshLayout();
    // (should never happen since we just set it above)
    showToast('⚠ Layout trống — đã khôi phục cấu trúc mặc định. Nhấn "Áp dụng" sau khi dữ liệu tải xong.');
  } else if (validCount < layout.length) {
    // Lọc bỏ item null/undefined còn sót
    layout = layout.filter(i => i && i.type && i.uid && i.props);
  }
}

if (!selectedUid && layout[0]) selectedUid = layout[0].uid;
render();
loadStatsFromSupabase();
updateHistoryUI();
setViewMode('edit');

// Connection status simulation
(function() {
  const dot  = document.getElementById('statusDot');
  const txt  = document.getElementById('statusText');
  if (!dot || !txt) return;
  setTimeout(() => {
    dot.className = 'status-dot connected';
    txt.textContent = 'Đã kết nối';
  }, 2200);
})();

/* ═══════════════════════════════════════════════
   SIDEBAR ACCORDION NAV
═══════════════════════════════════════════════ */
function navToggle(parentEl, subId) {
  const sub = document.getElementById(subId);
  if (!sub) return;
  const isOpen = sub.classList.contains('open');

  // Close all other submenus
  document.querySelectorAll('.nav-sub.open').forEach(el => {
    if (el.id !== subId) {
      el.classList.remove('open');
      // reset chevron of parent
      const pid = el.id;
      document.querySelectorAll('.nav-parent').forEach(p => {
        const onclick = p.getAttribute('onclick') || '';
        if (onclick.includes(pid)) p.classList.remove('open');
      });
    }
  });

  if (isOpen) {
    sub.classList.remove('open');
    parentEl.classList.remove('open');
  } else {
    sub.classList.add('open');
    parentEl.classList.add('open');
  }
}

// Thiết bị sub-page routing map
const _tbNavMap = {
  // MBA - Máy biến áp
  'MBA': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,''); return pl.startsWith('MBA'); },
    label:'Máy biến áp (MBA)', icon:'fa-exchange-alt', color:'#10b981',
    dropdowns: ['tram','cap','type','hang','kieu','cong_suat','year','opyr']
  },
  // MC - Máy cắt (MC, GIS, HGIS)
  'MC': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,''); return pl==='MC'||pl.startsWith('MC')||pl==='GIS'||pl==='HGIS'||pl.startsWith('GIS')||pl.startsWith('HGIS'); },
    label:'Máy cắt (MC)', icon:'fa-bolt', color:'#f59e0b',
    dropdowns: ['tram','cap','type','hang','kieu','cong_suat','year','opyr']
  },
  // DCL + FCO - Dao cách ly & Cầu chì tự rơi
  'DCL': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,''); return pl.startsWith('DCL')||pl.startsWith('DAOCACHLY')||pl==='FCO'||pl.startsWith('FCO'); },
    label:'DCL & FCO', icon:'fa-power-off', color:'#00c8ff',
    dropdowns: ['tram','cap','type','hang','kieu','year','opyr']
  },
  // TU, TI - Máy biến điện áp & dòng điện đo lường
  'TU, TI': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,''); return pl.startsWith('TU')||pl.startsWith('TI'); },
    label:'TU, TI đo lường', icon:'fa-tachometer-alt', color:'#8b5cf6',
    dropdowns: ['tram','cap','type','hang','kieu','year','opyr']
  },
  // CSV - Chống sét van
  'CSV': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,''); return pl==='CSV'||pl.startsWith('CSV')||pl.startsWith('CHONGSET'); },
    label:'Chống sét van (CSV)', icon:'fa-shield-alt', color:'#ec4899',
    dropdowns: ['tram','cap','hang','kieu','year','opyr']
  },
  // Cáp - Cáp điện lực
  'Cáp': {
    matchFn: r => { const pl=(r.Phan_loai_thiet_bi||'').trim().normalize('NFC'); return /^[Cc][aáà]/u.test(pl)||pl.toUpperCase().startsWith('CAP'); },
    label:'Cáp điện lực', icon:'fa-project-diagram', color:'#06b6d4',
    dropdowns: ['tram','cap','type','hang','kieu','year','opyr']
  },
};

function navActivate(el) {
  // Remove active from all nav items and sub items
  document.querySelectorAll('.nav-item.active, .nav-sub-item.active').forEach(e => {
    e.classList.remove('active');
  });
  el.classList.add('active');

  // If it's a sub item, mark its parent open too
  const sub = el.closest('.nav-sub');
  if (sub) {
    let prev = sub.previousElementSibling;
    while (prev && !prev.classList.contains('nav-parent')) prev = prev.previousElementSibling;
    if (prev) prev.classList.add('active');
  }

  // Route to Thiết bị / Thí nghiệm / Báo cáo pages
  const text = el.querySelector('span')?.textContent?.trim();
  const tbConf = _tbNavMap[text];
  const tnConf = _tnNavMap[text];
  const bcConf = typeof _bcNavMap !== 'undefined' ? _bcNavMap[text] : null;
  const overlay = document.getElementById('tbPageOverlay');
  const canvas  = document.getElementById('canvasArea');
  const rPanel  = document.querySelector('.props-panel');

  if ((tbConf || tnConf || bcConf) && overlay) {
    if (canvas)  canvas.style.display  = 'none';
    if (rPanel)  rPanel.style.display  = 'none';
    overlay.style.display = 'block';
    if (tbConf)      tbRenderPage(tbConf, text);
    else if (tnConf) tnRenderPage(tnConf, text);
    else             bcRenderPage(bcConf, text);
  } else if (overlay) {
    overlay.style.display = 'none';
    if (canvas)  canvas.style.display  = '';
    if (rPanel)  rPanel.style.display  = '';
  }
}

// ══════════════════════════════════════════════════════════════
// ── MODULE THIẾT BỊ ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
let _tbData      = [];   // full data from Supabase (shared with _chipAllData)
let _tbFiltered  = [];
let _tbPage      = 1;
let _tbPageSize  = 50;
let _tbSortCol   = 'Tram';
let _tbSortAsc   = true;
let _tbSearchQ   = '';
let _tbFCap      = '';
let _tbFType     = '';
let _tbFTram     = '';
let _tbFHang     = '';
let _tbFYear     = '';
let _tbFKieu     = '';
let _tbFOpyr     = '';   // Năm vận hành
let _tbFConf     = null; // current page conf
let _tbConf      = null;

const _tbCapLbl = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
const _tbCapCol = {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};

function _tbAge(r) {
  const y = Number(r.Nam_van_hanh)>1970 ? Number(r.Nam_van_hanh) : (Number(r.Nam_san_xuat)>1970 ? Number(r.Nam_san_xuat) : 0);
  return y > 1970 ? new Date().getFullYear() - y : -1;
}

function _tbIsExcl(pl) {
  if (!pl) return false;
  const n = pl.trim().toUpperCase().replace(/\s+/g,'').normalize('NFC');
  return n.startsWith('TICHAN') || n === 'HTTD' || n.startsWith('HTTD') ||
         n === 'DAU' || n.startsWith('DẦU') || n === 'THM' || n === 'RL';
}

// Inject CSS once
function _tbInjectCSS() {
  if (document.getElementById('tb-module-css')) return;
  const style = document.createElement('style');
  style.id = 'tb-module-css';
  style.textContent = `
    .tb-wrap{padding:0 0 32px}
    .tb-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 14px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:14px}
    .tb-sw{position:relative;flex:1;min-width:180px;max-width:320px}
    .tb-sw i{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;pointer-events:none}
    .tb-si{width:100%;box-sizing:border-box;padding:7px 12px 7px 32px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--text-primary);font-size:11px;outline:none}
    .tb-dd{padding:6px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--text-primary);font-size:11px;cursor:pointer;outline:none}
    .tb-dd:focus{border-color:var(--accent)}
    .tb-btn{padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}
    .tb-btn:hover{background:rgba(255,255,255,.12)}
    .tb-btn-csv{background:rgba(0,230,118,.1);border-color:rgba(0,230,118,.3);color:#00e676}
    .tb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
    .tb-sc{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px}
    .tb-sc .sl{font-size:9px;color:var(--text-muted);margin-bottom:4px}
    .tb-sc .sv{font-size:20px;font-weight:800;font-family:var(--font-mono)}
    .tb-sum{font-size:10px;color:var(--text-muted);font-family:var(--font-mono);padding:0 0 10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .tb-sum b{color:var(--accent)}
    .tb-tw{overflow-x:auto;border-radius:8px;border:1px solid rgba(255,255,255,.07)}
    .tb-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .tb-tbl th{padding:7px 10px;text-align:left;font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);cursor:pointer;white-space:nowrap;background:rgba(255,255,255,.03);user-select:none;position:sticky;top:0;z-index:2}
    .tb-tbl th:hover{color:var(--text-primary)}
    .tb-tbl th.srt{color:var(--accent)}
    .tb-tbl td{padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--text-primary);vertical-align:middle;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tb-tbl tr:hover td{background:rgba(255,255,255,.03)}
    .tb-num{text-align:right;font-family:var(--font-mono)}
    .tb-a0{color:#00e676;font-weight:700;font-family:var(--font-mono)}
    .tb-a1{color:#ffd740;font-weight:700;font-family:var(--font-mono)}
    .tb-a2{color:#ff5252;font-weight:700;font-family:var(--font-mono)}
    .tb-a3{color:var(--text-muted);font-family:var(--font-mono)}
    .tb-pg{display:flex;align-items:center;gap:6px;justify-content:flex-end;padding:10px 0 0;font-size:11px;color:var(--text-muted)}
    .tb-pb{padding:7px 20px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--text-primary);cursor:pointer;font-size:11px;font-weight:500;transition:all .15s;min-width:42px;text-align:center;line-height:1}
    .tb-pb:hover:not(:disabled){background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3)}
    .tb-pb:disabled{opacity:.3;cursor:default}
    .tb-pb.cur{background:var(--accent);border-color:var(--accent);color:#000;font-weight:700}
    .tb-lbl-btn{display:inline-flex;align-items:center;gap:4px;font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.25);cursor:pointer}
    .tb-cap-badge{display:inline-block;padding:1px 6px;border-radius:10px;font-size:9px;font-weight:700}
  `;
  document.head.appendChild(style);
}

// ── FILTER & SORT ─────────────────────────────────────────────
function _tbApply() {
  const q = _tbSearchQ.toLowerCase().trim();
  _tbFiltered = _tbData.filter(r => {
    if (_tbFCap  && String(r.Cap_dien_ap??'') !== _tbFCap)   return false;
    if (_tbFType && (r.Phan_loai_thiet_bi||'').trim() !== _tbFType) return false;
    if (_tbFTram && (r.Tram||'').trim() !== _tbFTram)        return false;
    if (_tbFHang && (r.Hang_san_xuat||'').trim() !== _tbFHang) return false;
    if (_tbFYear && String(r.Nam_san_xuat||'') !== _tbFYear) return false;
    if (_tbFKieu && (r.Kieu||'').trim() !== _tbFKieu)        return false;
    if (_tbFOpyr && String(r.Nam_van_hanh||'') !== _tbFOpyr) return false;
    if (typeof _tbFCongSuat !== 'undefined' && _tbFCongSuat && String(r.Cong_suat||'') !== _tbFCongSuat) return false;
    if (q) {
      const hay = [r.Tram,r.Phan_loai_thiet_bi,r.Ten_thiet_bi,r.Ngan_thiet_bi,r.Hang_san_xuat,r.Thong_so,r.Ly_lich]
        .map(v=>v||'').join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  _tbFiltered.sort((a,b) => {
    let va = _tbSortCol === '_age' ? _tbAge(a) : (a[_tbSortCol]??'');
    let vb = _tbSortCol === '_age' ? _tbAge(b) : (b[_tbSortCol]??'');
    if (typeof va === 'number' && typeof vb === 'number') return _tbSortAsc ? va-vb : vb-va;
    va=String(va).toLowerCase(); vb=String(vb).toLowerCase();
    return _tbSortAsc ? va.localeCompare(vb,'vi') : vb.localeCompare(va,'vi');
  });
  _tbPage = 1;
  // Expose globally for asset module
  window._tbFiltered = _tbFiltered;
}

// ── STATS ─────────────────────────────────────────────────────
function _tbStats(rows) {
  const total = rows.length;
  const gt15  = rows.filter(r => _tbAge(r) >= 15).length;
  const hangs = new Set(rows.map(r=>(r.Hang_san_xuat||'').trim()).filter(Boolean));
  const trams = new Set(rows.map(r=>(r.Tram||'').trim()).filter(Boolean));
  const pct   = total > 0 ? ((gt15/total)*100).toFixed(1) : '0.0';
  const gt15pct = total > 0 ? Math.round((gt15/total)*100) : 0;
  const oldY  = Math.min(...rows.map(r=>{const y=Number(r.Nam_san_xuat);return y>1970?y:9999;}).filter(y=>y<9999));
  const fmt   = n => Number(n).toLocaleString('vi-VN');

  function sc(icon, iconCol, label, valHtml, barPct, barCol, clickKey) {
    return `<div class="tb-sc" style="cursor:pointer;transition:all .15s;position:relative"
      onclick="_tbStatCardClick('${clickKey}')"
      onmouseenter="this.style.borderColor='${barCol}55';this.style.background='rgba(255,255,255,.06)'"
      onmouseleave="this.style.borderColor='';this.style.background=''">
      <div class="sl"><i class="fas ${icon}" style="color:${iconCol};margin-right:4px"></i>${label}</div>
      <div class="sv" style="margin-bottom:6px">${valHtml}</div>
      <div style="height:3px;border-radius:2px;background:rgba(255,255,255,.08)">
        <div style="height:100%;width:${barPct}%;background:${barCol};border-radius:2px;transition:width .4s;box-shadow:0 0 6px ${barCol}55"></div>
      </div>
    </div>`;
  }

  return `<div class="tb-stats">
    ${sc('fa-list','#00c8ff','Tổng bản ghi',`<span style="color:var(--accent)">${fmt(total)}</span>`,100,'#00c8ff','total')}
    ${sc('fa-building','#00e676','Số trạm',`<span style="color:#00e676">${trams.size}</span>`,Math.min(100,trams.size),'#00e676','trams')}
    ${sc('fa-exclamation-triangle','#ff5252','Trên 15 năm VH',`<span style="color:#ff5252">${fmt(gt15)}</span><span style="font-size:10px;font-weight:400;color:var(--text-muted)"> (${pct}%)</span>`,gt15pct,'#ff5252','gt15')}
    ${sc('fa-industry','#ffd740','Hãng SX / Năm cũ nhất',`<span style="color:#ffd740;font-size:15px">${hangs.size} hãng${oldY<9999?' · '+oldY:''}</span>`,Math.min(100,hangs.size*5),'#ffd740','hangs')}
  </div>`;
}

// ── TB STAT CARD CLICK — mở panel chi tiết ───────────────────
function _tbStatCardClick(key) {
  const rows = _tbFiltered.length ? _tbFiltered : _tbData;
  const capPrio = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const capLbl2 = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const capCol2 = {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
  const tramMaxCap = {};
  rows.forEach(d => {
    const t=(d.Tram||'').trim(); if(!t) return;
    const c=String(d.Cap_dien_ap??''); if(!c||c==='null') return;
    if(!tramMaxCap[t]||(capPrio[c]??99)<(capPrio[tramMaxCap[t]]??99)) tramMaxCap[t]=c;
  });
  const nowY=new Date().getFullYear();
  const fmt = n => Number(n).toLocaleString('vi-VN');

  let title='', totalLine='', bodyHtml='';

  if (key === 'total') {
    title = '📋 Danh sách thiết bị';
    const byType = {};
    rows.forEach(r => {
      const pl=(r.Phan_loai_thiet_bi||'Khác').trim();
      byType[pl]=(byType[pl]||0)+(Number(r.So_luong)||1);
    });
    const sorted=Object.entries(byType).sort((a,b)=>b[1]-a[1]);
    totalLine=`${fmt(rows.length)} bản ghi · ${sorted.length} loại`;
    bodyHtml=sorted.map(([pl,sl])=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:10px;color:var(--text-secondary)">${pl}</span>
        <span style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(0,200,255,.1);padding:2px 8px;border-radius:10px">${fmt(sl)}</span>
      </div>`).join('');

  } else if (key === 'trams') {
    title = '🏢 Danh sách trạm';
    const byTram = {};
    rows.forEach(r => {
      const t=(r.Tram||'').trim(); if(!t) return;
      if(!byTram[t]) byTram[t]={count:0,sl:0,cap:tramMaxCap[t]||''};
      byTram[t].count++; byTram[t].sl+=(Number(r.So_luong)||0);
    });
    const sorted=Object.entries(byTram).sort((a,b)=>{
      const pa=capPrio[a[1].cap]??9,pb=capPrio[b[1].cap]??9;
      return pa!==pb?pa-pb:a[0].localeCompare(b[0]);
    });
    totalLine=`${sorted.length} trạm`;
    const capLbl={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
    const capCol={'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
    bodyHtml=sorted.map(([t,info])=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:10px;color:var(--text-secondary)">${t}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${info.cap?`<span style="font-size:9px;font-weight:700;color:${capCol[info.cap]};background:${capCol[info.cap]}18;padding:1px 6px;border-radius:8px">${capLbl[info.cap]||info.cap}</span>`:''}
          <span style="font-size:9px;color:var(--text-muted)">${fmt(info.sl||info.count)} TB</span>
        </div>
      </div>`).join('');

  } else if (key === 'gt15') {
    title = '⚠️ Thiết bị trên 15 năm vận hành';
    const old15=rows.filter(r=>_tbAge(r)>=15).sort((a,b)=>_tbAge(b)-_tbAge(a));
    totalLine=`${fmt(old15.length)} thiết bị · ${old15.length>0?Math.max(...old15.map(r=>_tbAge(r)))+' năm VH lâu nhất':''}`;
    const capLbl={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
    const capCol={'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
    bodyHtml=old15.slice(0,200).map(r=>{
      const age=_tbAge(r); const cap=String(r.Cap_dien_ap??'');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <div>
          <div style="font-size:10px;color:var(--text-secondary)">${r.Ten_thiet_bi||r.Phan_loai_thiet_bi||'—'}</div>
          <div style="font-size:9px;color:var(--text-muted);margin-top:1px">${r.Tram||'—'} ${cap?'· <span style="color:'+capCol[cap]+'">'+capLbl[cap]+'</span>':''}</div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${age>=25?'#ff5252':'#ffd740'};font-family:var(--font-mono)">${age} năm</span>
      </div>`;
    }).join('')+(old15.length>200?`<div style="padding:10px 16px;text-align:center;font-size:9px;color:var(--text-muted)">...và ${old15.length-200} thiết bị khác</div>`:'');

  } else if (key === 'hangs') {
    title = '🏭 Danh sách hãng sản xuất';
    const byHang = {};
    rows.forEach(r => {
      const h=(r.Hang_san_xuat||'').trim(); if(!h) return;
      if(!byHang[h]) byHang[h]={count:0,years:new Set()};
      byHang[h].count+=(Number(r.So_luong)||1);
      const y=Number(r.Nam_san_xuat); if(y>1970) byHang[h].years.add(y);
    });
    const sorted=Object.entries(byHang).sort((a,b)=>b[1].count-a[1].count);
    totalLine=`${sorted.length} hãng`;
    bodyHtml=sorted.map(([h,info])=>{
      const ys=[...info.years].sort((a,b)=>a-b);
      const yrStr=ys.length?`${ys[0]}${ys.length>1?'–'+ys[ys.length-1]:''}`:'-';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:10px;color:var(--text-secondary)">${h} <span style="color:var(--text-muted);font-size:9px">(${yrStr})</span></span>
        <span style="font-size:9px;font-weight:700;color:#ffd740;background:rgba(255,215,64,.1);padding:2px 8px;border-radius:10px">${fmt(info.count)}</span>
      </div>`;
    }).join('');
  }

  // Build items array and delegate to _lytShowDetailPanel
  const colorMap={'total':'#00c8ff','trams':'#00e676','gt15':'#ff5252','hangs':'#ffd740'};
  const col=colorMap[key]||'var(--accent)';
  const items=[];

  if(key==='total'){
    // ── Unified: nhóm theo loại thiết bị → trong mỗi loại dùng hierarchy 3 cấp ──
    const byType={};
    rows.forEach(r=>{
      const pl=(r.Phan_loai_thiet_bi||'Khác').trim();
      if(!byType[pl])byType[pl]={qty:0,trams:{}};
      byType[pl].qty+=(Number(r.So_luong)||1);
      const t=(r.Tram||'').trim();
      if(t){if(!byType[pl].trams[t])byType[pl].trams[t]=[];byType[pl].trams[t].push(r);}
    });

    // Sort theo qty giảm dần (loại nhiều nhất lên đầu)
    const sortedTypes = Object.entries(byType).sort((a,b)=>b[1].qty-a[1].qty);

    sortedTypes.forEach(([pl, v]) => {
      const trams = Object.keys(v.trams);

      // Build children dạng hierarchy 3 cấp: cấp điện áp → trạm → tên ngăn
      const byCap = {};
      trams.forEach(t => {
        const cap = tramMaxCap[t] || '?';
        if (!byCap[cap]) byCap[cap] = [];
        byCap[cap].push(t);
      });

      const CAP_ORDER = ['2','1','3','4','9','6','0'];
      const children = [];

      CAP_ORDER.forEach(cap => {
        const arr = byCap[cap];
        if (!arr?.length) return;
        // Natural sort: E1.1, E1.2, E1.5, E1.10...
        arr.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

        // Header nhóm cấp (level 2 - đứng ngay sau loại TB)
        children.push({
          isGroup: true,
          text: `── ${capLbl2[cap]||cap} (${arr.length} trạm) ──`,
          color: capCol2[cap] || '#888',
        });

        arr.forEach(t => {
          const rs = v.trams[t];
          // Detail: tên ngăn/thiết bị unique
          const devNames = [...new Set(
            rs.map(r => (r.Ngan_thiet_bi || r.Ten_thiet_bi || '').trim()).filter(Boolean)
          )].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));

          children.push({
            text: t,
            sub: `${rs.length} TB`,
            color: capCol2[cap] || '#888',
            detail: devNames,
          });
        });
      });

      items.push({
        text: pl,
        sub: `${fmt(v.qty)} TB · ${trams.length} trạm`,
        color: '#00c8ff',
        children,
      });
    });
  } else if(key==='trams'){
    const byTram={};
    rows.forEach(r=>{const t=(r.Tram||'').trim();if(!t)return;if(!byTram[t])byTram[t]=[];byTram[t].push(r);});
    // Group by cap
    const byCap={};
    Object.entries(byTram).forEach(([t,rs])=>{const cap=tramMaxCap[t]||'?';if(!byCap[cap])byCap[cap]=[];byCap[cap].push([t,rs]);});
    ['2','1','3','4','9','6','0'].forEach(cap=>{
      const arr=byCap[cap];if(!arr||!arr.length)return;
      items.push({isGroup:true,text:`── ${capLbl2[cap]||cap} (${arr.length} trạm) ──`,color:capCol2[cap]||'#888'});
      arr.sort((a,b)=>a[0].localeCompare(b[0],'vi')).forEach(([t,rs])=>{
        const byType2={};rs.forEach(r=>{const pl=(r.Phan_loai_thiet_bi||'?').trim();if(!byType2[pl])byType2[pl]=0;byType2[pl]+=(Number(r.So_luong)||1);});
        const detail=Object.entries(byType2).sort((a,b)=>b[1]-a[1]).map(([pl,n])=>`${pl}: ${fmt(n)} TB`);
        items.push({text:t,badge:`${fmt(rs.length)} TB`,color:capCol2[cap]||'#00e676',detail});
      });
    });
  } else if(key==='gt15'){
    const old15=rows.filter(r=>_tbAge(r)>=15).sort((a,b)=>_tbAge(b)-_tbAge(a));
    const byTram={};
    old15.forEach(r=>{const t=(r.Tram||'').trim();if(!byTram[t])byTram[t]=[];byTram[t].push(r);});
    Object.entries(byTram).sort((a,b)=>{
      const pa=capPrio[tramMaxCap[a[0]]]??9,pb=capPrio[tramMaxCap[b[0]]]??9;
      return pa!==pb?pa-pb:a[0].localeCompare(b[0],'vi');
    }).forEach(([t,rs])=>{
      const cap=tramMaxCap[t]||'';
      const detail=rs.slice(0,20).map(r=>{
        const age=_tbAge(r),nvh=Number(r.Nam_van_hanh)||0;
        return `${(r.Ten_thiet_bi||r.Phan_loai_thiet_bi||'—').trim()}${nvh>1970?' · '+nvh:''} · ${age} năm VH`;
      });
      items.push({text:t,badge:`${rs.length} TB · max ${_tbAge(rs[0])} năm`,color:cap?capCol2[cap]:'#ff5252',detail});
    });
  } else if(key==='hangs'){
    const byHang={};
    rows.forEach(r=>{const h=(r.Hang_san_xuat||'').trim();if(!h)return;if(!byHang[h])byHang[h]={qty:0,years:new Set(),trams:new Set()};byHang[h].qty+=(Number(r.So_luong)||1);const y=Number(r.Nam_san_xuat);if(y>1970)byHang[h].years.add(y);const t=(r.Tram||'').trim();if(t)byHang[h].trams.add(t);});
    Object.entries(byHang).sort((a,b)=>b[1].qty-a[1].qty).forEach(([h,v])=>{
      const ys=[...v.years].sort((a,b)=>a-b);
      const yrStr=ys.length?`${ys[0]}${ys.length>1?'–'+ys[ys.length-1]:''}`:'-';
      const detail=[...v.trams].sort().map(t=>`Trạm ${t}`);
      items.push({text:`${h} (${yrStr})`,badge:`${fmt(v.qty)} TB · ${v.trams.size} trạm`,color:'#ffd740',detail});
    });
  }

  if(!items.length) items.push({text:'Không có dữ liệu',badge:'',color:'#ff5252'});
  _lytShowDetailPanel(title,col,totalLine,items);
}

// ── TABLE ─────────────────────────────────────────────────────
function _tbTable() {
  const start = (_tbPage-1)*_tbPageSize;
  const rows  = _tbFiltered.slice(start, start+_tbPageSize);
  const total = _tbFiltered.length;
  const totalPg = Math.max(1, Math.ceil(total/_tbPageSize));
  const fmt = n => Number(n).toLocaleString('vi-VN');

  // Danh sách loại thiết bị không hiển thị cột Ngăn TB
  const _tbHideNgan = new Set(['MBA','MC','DCL','MBATD','MBATN']);
  const _showNganCol = !(_tbFType && _tbHideNgan.has(_tbFType.trim().toUpperCase())) &&
    !(_tbData && _tbData.length > 0 && _tbData.every(r => _tbHideNgan.has((r.Phan_loai_thiet_bi||'').trim().toUpperCase())));
  const COLS = [
    {k:'Tram',               l:'Trạm',        w:'110px'},
    {k:'Cap_dien_ap',        l:'Cấp ĐA',      w:'68px' },
    {k:'Phan_loai_thiet_bi', l:'Loại TB',     w:'90px' },
    {k:'Ten_thiet_bi',       l:'Tên / KH',    w:'150px'},
    {k:'Kieu',               l:'Kiểu',        w:'80px' },
    ...(_showNganCol ? [{k:'Ngan_thiet_bi', l:'Ngăn TB', w:'120px'}] : []),
    {k:'So_luong',           l:'SL',          w:'46px', cls:'tb-num'},
    {k:'Hang_san_xuat',      l:'Hãng SX',     w:'90px' },
    {k:'Nam_san_xuat',       l:'Năm SX',      w:'58px', cls:'tb-num'},
    {k:'Nam_van_hanh',       l:'Năm VH',      w:'58px', cls:'tb-num'},
    {k:'_age',               l:'Thời gian VH',   w:'70px', cls:'tb-num'},
    {k:'Cong_suat',          l:'CS (MVA)',    w:'68px', cls:'tb-num'},
    {k:'Ly_lich',            l:'Lý lịch',     w:'80px' },
    {k:'Thong_so',           l:'Thông số',    w:'100px'},
  ];

  const thead = COLS.map(col => {
    const srt = _tbSortCol === col.k;
    return `<th style="min-width:${col.w}" class="${srt?'srt':''}" onclick="_tbSort('${col.k}')">
      ${col.l}${srt?`<span style="color:var(--accent)"> ${_tbSortAsc?'↑':'↓'}</span>`:''}
    </th>`;
  }).join('');

  const tbody = rows.map(r => {
    const age = _tbAge(r);
    const ageCls = age<0?'tb-a3':age<10?'tb-a0':age<15?'tb-a1':'tb-a2';
    const cap = String(r.Cap_dien_ap??'');
    const capHtml = `<span class="tb-cap-badge" style="background:${(_tbCapCol[cap]||'#888')}22;color:${_tbCapCol[cap]||'#888'}">${_tbCapLbl[cap]||cap||'—'}</span>`;
    const lyLich = r.Ly_lich
      ? `<span class="tb-lbl-btn" onclick="_tbShowLyLich(${_tbFiltered.indexOf(r)})"><i class="fas fa-file-alt"></i> Xem</span>`
      : '<span style="color:var(--text-muted);font-size:9px">—</span>';

    return `<tr>
      <td style="font-weight:600">${r.Tram||'—'}</td>
      <td>${capHtml}</td>
      <td>${r.Phan_loai_thiet_bi||'—'}</td>
      <td title="${r.Ten_thiet_bi||''}">${r.Ten_thiet_bi||'—'}</td>
      <td title="${r.Kieu||''}">${r.Kieu||'—'}</td>
      ${_showNganCol ? `<td title="${r.Ngan_thiet_bi||''}">${r.Ngan_thiet_bi||'—'}</td>` : ''}
      <td class="tb-num">${r.So_luong??'—'}</td>
      <td title="${r.Hang_san_xuat||''}">${r.Hang_san_xuat||'—'}</td>
      <td class="tb-num">${r.Nam_san_xuat||'—'}</td>
      <td class="tb-num">${r.Nam_van_hanh||'—'}</td>
      <td class="${ageCls}">${age>=0?age:'—'}</td>
      <td class="tb-num">${r.Cong_suat||'—'}</td>
      <td>${lyLich}</td>
      <td title="${r.Thong_so||''}">${r.Thong_so?r.Thong_so.slice(0,30)+(r.Thong_so.length>30?'…':''):'—'}</td>
    </tr>`;
  }).join('');

  // Pagination
  const half=3; let lo=Math.max(1,_tbPage-half), hi=Math.min(totalPg,lo+6); if(hi-lo<6)lo=Math.max(1,hi-6);
  let pgBtns = '';
  if(lo>1) pgBtns+=`<button class="tb-pb" onclick="_tbGoPage(1)">1</button>${lo>2?'…':''}`;
  for(let p=lo;p<=hi;p++) pgBtns+=`<button class="tb-pb${p===_tbPage?' cur':''}" onclick="_tbGoPage(${p})">${p}</button>`;
  if(hi<totalPg) pgBtns+=`${hi<totalPg-1?'…':''}<button class="tb-pb" onclick="_tbGoPage(${totalPg})">${totalPg}</button>`;

  return `${_tbStats(_tbFiltered)}
  <div class="tb-sum"><span>Hiển thị <b>${start+1}–${Math.min(start+_tbPageSize,total)}</b> / <b>${fmt(total)}</b> bản ghi</span></div>
  <div class="tb-tw"><table class="tb-tbl">
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody||'<tr><td colspan="15" style="padding:30px;text-align:center;color:var(--text-muted)">Không có dữ liệu</td></tr>'}</tbody>
  </table></div>
  <div class="tb-pg">
    <button class="tb-pb" ${_tbPage<=1?'disabled':''} onclick="_tbGoPage(${_tbPage-1})">‹</button>
    ${pgBtns}
    <button class="tb-pb" ${_tbPage>=totalPg?'disabled':''} onclick="_tbGoPage(${_tbPage+1})">›</button>
  </div>`;
}

// ── LÝ LỊCH PANEL ─────────────────────────────────────────────
function _tbShowLyLich(idx) {
  const r = _tbFiltered[idx];
  if (!r) return;
  let p = document.getElementById('_tbLyLichPanel');
  if (!p) {
    p = document.createElement('div');
    p.id = '_tbLyLichPanel';
    p.style.cssText = `position:fixed;top:0;right:-420px;width:400px;height:100vh;z-index:9999;
      background:var(--bg-surface,#161b22);border-left:1px solid rgba(255,255,255,.12);
      display:flex;flex-direction:column;transition:right .25s;overflow-y:auto;padding:0;box-sizing:border-box`;
    document.body.appendChild(p);
    const bd=document.createElement('div');
    bd.id='_tbLyLichBd';
    bd.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.4);display:none';
    bd.onclick=()=>{p.style.right='-420px';bd.style.display='none'};
    document.body.appendChild(bd);
  }
  const age=_tbAge(r);const cap=String(r.Cap_dien_ap??'');
  const capCol=_tbCapCol[cap]||'#888'; const capLbl=_tbCapLbl[cap]||cap||'—';
  p.innerHTML=`
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--text-primary)">${r.Ten_thiet_bi||r.Phan_loai_thiet_bi||'—'}</div>
        <div style="font-size:10px;color:var(--accent);margin-top:3px">${r.Tram||''} · <span style="color:${capCol}">${capLbl}</span></div>
      </div>
      <button onclick="document.getElementById('_tbLyLichPanel').style.right='-420px';document.getElementById('_tbLyLichBd').style.display='none'"
        style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px">✕</button>
    </div>
    <div style="padding:14px 20px;flex:1;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        ${[['Loại thiết bị',r.Phan_loai_thiet_bi,'#00c8ff'],['Số lượng',r.So_luong??'—','#00e676'],
           ['Hãng sản xuất',r.Hang_san_xuat,'#ffd740'],['Năm vận hành',r.Nam_van_hanh,'#00c8ff'],
           ['Năm vận hành',r.Nam_van_hanh,'#00c8ff'],['Thời gian VH',age>=0?age+' năm VH':'—',age>=15?'#ff5252':age>=10?'#ffd740':'#00e676'],
           ['Công suất (MVA)',r.Cong_suat,'#b388ff'],['Đội quản lý',r.Doi,'#888']
        ].map(([l,v,col])=>`<div style="background:rgba(255,255,255,.04);border-radius:7px;padding:8px 10px;border:1px solid rgba(255,255,255,.07)">
          <div style="font-size:8.5px;color:var(--text-muted);margin-bottom:3px">${l}</div>
          <div style="font-size:12px;font-weight:700;color:${col}">${v||'—'}</div>
        </div>`).join('')}
      </div>
      ${r.Ngan_thiet_bi?`<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--text-muted);margin-bottom:5px;font-weight:700">NGĂN THIẾT BỊ</div><div style="font-size:11px;color:var(--text-primary);background:rgba(255,255,255,.04);padding:8px 10px;border-radius:6px">${r.Ngan_thiet_bi}</div></div>`:''}
      ${r.Thong_so?`<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--text-muted);margin-bottom:5px;font-weight:700">THÔNG SỐ KỸ THUẬT</div><div style="font-size:10px;color:var(--text-primary);background:rgba(255,255,255,.04);padding:8px 10px;border-radius:6px;white-space:pre-wrap;line-height:1.6">${r.Thong_so}</div></div>`:''}
      ${r.Ly_lich?`<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--text-muted);margin-bottom:5px;font-weight:700">LÝ LỊCH THIẾT BỊ</div><div style="font-size:10px;color:var(--text-primary);background:rgba(255,255,255,.04);padding:8px 10px;border-radius:6px;white-space:pre-wrap;line-height:1.6">${r.Ly_lich}</div></div>`:`<div style="font-size:10px;color:var(--text-muted);padding:16px 0;text-align:center"><i class="fas fa-file-excel" style="margin-right:6px"></i>Chưa có lý lịch thiết bị</div>`}
      ${(typeof _assetSectionHtml==='function')?_assetSectionHtml(idx):''}
      <button onclick="_tbExportOne(${idx})"
        style="width:100%;margin-top:8px;padding:9px;border-radius:7px;border:1px solid rgba(0,230,118,.3);background:rgba(0,230,118,.1);color:#00e676;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-file-export"></i> Xuất lý lịch CSV
      </button>
    </div>`;
  // Store row data on panel for asset module
  p.dataset.assetIdx = idx;
  window._tbCurrentRow = r;
  if (typeof _assetLoadGallery === 'function') setTimeout(() => _assetLoadGallery(idx), 50);
  p.style.right='0';
  document.getElementById('_tbLyLichBd').style.display='block';
}

// ── EXPORT ────────────────────────────────────────────────────
function _tbExportCSV() {
  const rows = _tbFiltered;
  if (!rows.length) return;
  const hdr = ['Trạm','Cấp ĐA','Loại TB','Tên/Ký hiệu','Ngăn TB','Số lượng','Hãng SX','Năm SX','Năm VH','Thời gian VH','CS(MVA)','Lý lịch','Thông số','Đội'].join(',');
  const body = rows.map(r=>{
    const age=_tbAge(r);
    return [r.Tram,_tbCapLbl[String(r.Cap_dien_ap??'')]||r.Cap_dien_ap,r.Phan_loai_thiet_bi,r.Ten_thiet_bi,r.Ngan_thiet_bi,r.So_luong,r.Hang_san_xuat,r.Nam_san_xuat,r.Nam_van_hanh,age>=0?age:'',r.Cong_suat,r.Ly_lich,r.Thong_so,r.Doi]
    .map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',');
  }).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+hdr+'\n'+body],{type:'text/csv;charset=utf-8'}));
  a.download=`EVN_ThietBi_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

function _tbExportOne(idx) {
  const r=_tbFiltered[idx]; if(!r) return;
  const fields=[['Trạm',r.Tram],['Cấp ĐA',_tbCapLbl[String(r.Cap_dien_ap??'')]||r.Cap_dien_ap],['Loại TB',r.Phan_loai_thiet_bi],['Tên/Ký hiệu',r.Ten_thiet_bi],['Ngăn TB',r.Ngan_thiet_bi],['Số lượng',r.So_luong],['Hãng SX',r.Hang_san_xuat],['Năm SX',r.Nam_san_xuat],['Năm VH',r.Nam_van_hanh],['Thời gian VH',_tbAge(r)>=0?_tbAge(r):''],['CS(MVA)',r.Cong_suat],['Thông số',r.Thong_so],['Lý lịch',r.Ly_lich],['Đội',r.Doi]];
  const csv='\uFEFF'+fields.map(([k,v])=>`"${k}","${String(v||'').replace(/"/g,'""')}"`).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`LyLich_${(r.Tram||'TB').replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

// ── CONTROLS ─────────────────────────────────────────────────
function _tbSort(col){if(_tbSortCol===col)_tbSortAsc=!_tbSortAsc;else{_tbSortCol=col;_tbSortAsc=true;}_tbApply();_tbRefreshContent();}
function _tbGoPage(p){const tot=Math.max(1,Math.ceil(_tbFiltered.length/_tbPageSize));_tbPage=Math.max(1,Math.min(p,tot));_tbRefreshContent();}
function _tbOnSearch(v){_tbSearchQ=v||'';_tbApply();_tbRefreshContent();}
let _tbFCongSuat = '';
function _tbOnFilter(k,v){
  if(k==='cap')        _tbFCap=v;
  else if(k==='type')  _tbFType=v;
  else if(k==='tram')  _tbFTram=v;
  else if(k==='hang')  _tbFHang=v;
  else if(k==='year')  _tbFYear=v;
  else if(k==='kieu')  _tbFKieu=v;
  else if(k==='opyr')  _tbFOpyr=v;
  else if(k==='cong_suat') _tbFCongSuat=v;
  _tbApply();_tbRefreshContent();
}
function _tbReset(){
  _tbSearchQ=_tbFCap=_tbFType=_tbFTram=_tbFHang=_tbFYear=_tbFKieu=_tbFOpyr='';
  if(typeof _tbFCongSuat!=='undefined')_tbFCongSuat='';
  // Reset all trigger labels in overlay
  document.querySelectorAll('#tbPageOverlay .hm-tram-trigger-label').forEach(el=>{
    el.textContent = el.dataset.default||el.textContent;
  });
  document.querySelectorAll('#tbPageOverlay .hm-tram-trigger').forEach(el=>{
    el.classList.remove('open'); el.style.borderColor=''; el.style.background=''; el.style.color='';
  });
  const si=document.getElementById('_tbSi');if(si)si.value='';
  _tbApply();_tbRefreshContent();
}
function _tbRefreshContent(){const el=document.getElementById('_tbTableArea');if(el)el.innerHTML=_tbTable();}

// ── RENDER PAGE ───────────────────────────────────────────────
function tbRenderPage(conf, title) {
  _tbInjectCSS();
  _tbConf = conf;
  _tbSortCol='Tram'; _tbSortAsc=true;
  _tbSearchQ=_tbFCap=_tbFType=_tbFTram=_tbFHang=_tbFYear='';

  const overlay = document.getElementById('tbPageOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="tb-wrap">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:32px;height:32px;border-radius:8px;background:${conf.color}22;color:${conf.color};display:flex;align-items:center;justify-content:center">
          <i class="fas ${conf.icon}" style="font-size:14px"></i>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">${title}</div>
          <div style="font-size:10px;color:var(--text-muted)">Dữ liệu trực tiếp từ Supabase · ${new Date().toLocaleDateString('vi-VN')}</div>
        </div>
        <button onclick="navActivate(document.querySelector('.nav-item'))" 
          style="margin-left:auto;padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:10px;cursor:pointer;display:flex;align-items:center;gap:5px">
          <i class="fas fa-arrow-left"></i> Dashboard
        </button>
      </div>
      <div class="tb-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 12px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:12px">
        <div style="position:relative;flex:1;min-width:160px;max-width:280px">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;pointer-events:none"></i>
          <input id="_tbSi" type="text" placeholder="🔍 Tìm trạm, tên TB, ngăn, hãng..."
            style="width:100%;box-sizing:border-box;padding:6px 10px 6px 30px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--text-primary);font-size:11px;outline:none;font-family:var(--font-mono)"
            oninput="_tbOnSearch(this.value)">
        </div>
        <div id="_tbFilterBtns" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
        <button id="_tbResetBtn" onclick="_tbReset()" style="display:none;padding:5px 11px;border-radius:6px;border:1px solid rgba(255,82,82,.3);background:rgba(255,82,82,.1);color:#ff5252;font-size:10px;cursor:pointer;display:none;align-items:center;gap:5px">
          <i class="fas fa-times"></i> Xóa lọc
        </button>
        <button onclick="_tbExportCSV()" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(0,230,118,.3);background:rgba(0,230,118,.1);color:#00e676;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <i class="fas fa-download"></i> CSV
        </button>
      </div>
      <div id="_tbTableArea"><div style="padding:50px;text-align:center;color:var(--text-muted)">
        <i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang tải dữ liệu...
      </div></div>
    </div>`;

  // Load data: use _chipAllData if already loaded, else wait
  const loadAndRender = () => {
    const source = _chipAllData.length > 0 ? _chipAllData : [];
    if (source.length > 0) {
      _tbLoadFromSource(source, conf);
    } else {
      // Poll until data loads (loadStatsFromSupabase is running)
      const poll = setInterval(() => {
        if (_chipAllData.length > 0) {
          clearInterval(poll);
          _tbLoadFromSource(_chipAllData, conf);
        }
      }, 300);
      // Timeout after 30s
      setTimeout(() => clearInterval(poll), 30000);
    }
  };
  loadAndRender();
}

function _tbLoadFromSource(source, conf) {
  // Filter to device types using matchFn or types list
  if (conf.watchMode) {
    _tbData = source.filter(r => _tbAge(r) >= 15 && !_tbIsExcl(r.Phan_loai_thiet_bi));
  } else if (conf.matchFn) {
    _tbData = source.filter(r => conf.matchFn(r));
  } else if (conf.types && conf.types.length > 0) {
    const typeSet = new Set(conf.types.map(t=>t.trim().toLowerCase()));
    _tbData = source.filter(r => typeSet.has((r.Phan_loai_thiet_bi||'').trim().toLowerCase()));
  } else {
    _tbData = source.filter(r => !_tbIsExcl(r.Phan_loai_thiet_bi));
  }

  _tbApply();

  // Build data lists for dropdowns
  const sortVi = (a,b) => a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
  const sortNum = (a,b) => Number(b) - Number(a);
  const tramsAll = [...new Set(_tbData.map(r=>(r.Tram||'').trim()).filter(Boolean))].sort(sortVi);
  const typesAll = [...new Set(_tbData.map(r=>(r.Phan_loai_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
  const hangsAll = [...new Set(_tbData.map(r=>(r.Hang_san_xuat||'').trim()).filter(Boolean))].sort(sortVi);
  const yearsAll = [...new Set(_tbData.map(r=>String(r.Nam_san_xuat||'')).filter(y=>y&&y!=='null'&&y!=='0'))].sort(sortNum);
  const opyrsAll = [...new Set(_tbData.map(r=>String(r.Nam_van_hanh||'')).filter(y=>y&&y!=='null'&&y!=='0'))].sort(sortNum);
  const kieuAll  = [...new Set(_tbData.map(r=>(r.Kieu||'').trim()).filter(Boolean))].sort(sortVi);
  const capAll   = [...new Set(_tbData.map(r=>String(r.Cap_dien_ap??'')).filter(c=>c&&c!=='null'))].sort((a,b)=>({'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6}[a]??9)-({'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6}[b]??9));

  // Build filter buttons using hm-tram-trigger style
  const btnContainer = document.getElementById('_tbFilterBtns');
  if (!btnContainer) { _tbRefreshContent(); return; }

  const dropdowns = conf.dropdowns || ['tram','cap','hang','kieu','year','opyr'];

  // Helper: create a trigger button with lazy-populated dropdown
  function mkDd(key, defaultLbl, items, getId) {
    const uid = '_tbDd_' + key;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = uid + '_btn';
    btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;border-radius:6px;border:1px solid rgba(0,200,255,0.4);background:var(--bg-elevated,#161b22);color:var(--text-primary);font-family:var(--font-mono);font-size:11px;cursor:pointer;outline:none;min-width:120px;white-space:nowrap;transition:border-color .15s';
    btn.onmouseenter = () => { btn.style.borderColor='var(--accent)'; };
    btn.onmouseleave = () => { if(!btn.classList.contains('tb-dd-open')) btn.style.borderColor='rgba(0,200,255,0.4)'; };

    const lbl = document.createElement('span');
    lbl.id = uid + '_lbl';
    lbl.textContent = defaultLbl;
    lbl.dataset.default = defaultLbl;

    const ico = document.createElement('i');
    ico.className = 'fas fa-chevron-down';
    ico.style.fontSize = '8px';
    ico.style.color = 'var(--text-muted)';
    btn.appendChild(lbl); btn.appendChild(ico);

    // Create dropdown list
    const list = document.createElement('div');
    list.id = uid + '_list';
    list.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-surface,#161b22);border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);min-width:180px;max-height:300px;overflow-y:auto;display:none;flex-direction:column;padding:4px 0';

    function populateList() {
      list.innerHTML = '';
      // Search box for tram, hang, type
      if (['tram','hang','type','kieu'].includes(key)) {
        const si = document.createElement('input');
        si.type='text'; si.placeholder='🔍 Tìm...';
        si.style.cssText='margin:6px 8px;padding:4px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--text-primary);font-size:10px;outline:none';
        si.oninput = e => { const q=e.target.value.toLowerCase(); list.querySelectorAll('.tb-dd-item').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'':'none';}); };
        si.onclick = e => e.stopPropagation();
        list.appendChild(si);
      }
      // All option
      function mkItem(val, label) {
        const d = document.createElement('div');
        d.className='tb-dd-item';
        d.style.cssText='padding:6px 14px;cursor:pointer;font-size:11px;color:var(--text-primary);white-space:nowrap;transition:background .1s';
        d.textContent = label;
        d.onmouseenter = ()=>{ d.style.background='rgba(255,255,255,.06)'; };
        d.onmouseleave = ()=>{ d.style.background=''; };
        d.onclick = () => {
          _tbOnFilter(key, val);
          lbl.textContent = val ? label : defaultLbl;
          btn.style.borderColor = val ? 'var(--accent)' : 'rgba(0,200,255,0.4)';
          btn.style.background = val ? 'rgba(0,200,255,.08)' : '';
          btn.style.color = val ? 'var(--accent)' : '';
          btn.classList.toggle('tb-dd-open', !!val);
          ico.style.color = val ? 'var(--accent)' : 'var(--text-muted)';
          list.style.display='none';
          document.removeEventListener('click', outsideClick);
        };
        list.appendChild(d);
        return d;
      }
      mkItem('', defaultLbl);
      items.forEach(it => {
        if (typeof it === 'object') mkItem(it.v, it.l);
        else mkItem(it, it);
      });
    }

    let outsideClick;
    btn.onclick = e => {
      e.stopPropagation();
      if (list.style.display !== 'none') { list.style.display='none'; return; }
      // Position list
      populateList();
      document.body.appendChild(list);
      const r = btn.getBoundingClientRect();
      list.style.display = 'flex';
      list.style.top = (r.bottom + 4) + 'px';
      list.style.left = r.left + 'px';
      // Auto-focus search
      const si = list.querySelector('input');
      if (si) setTimeout(()=>si.focus(), 30);
      outsideClick = ev => { if(!list.contains(ev.target)&&ev.target!==btn){list.style.display='none';document.removeEventListener('click',outsideClick);} };
      setTimeout(()=>document.addEventListener('click', outsideClick), 0);
    };

    return btn;
  }

  // ── CASCADE DROPDOWN SYSTEM ─────────────────────────────────
  // Thứ tự cascade: tram → cap → type → hang → kieu → cong_suat → year → opyr
  // Khi thay đổi một filter, tất cả filter sau đó phải rebuild từ source
  // đã lọc qua các filter trước.

  const _tbDdRefs = {}; // key → {btn, lbl, ico, setItems, reset}
  const _tbCapPrioCasc = {'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
  const _sortViCasc = (a,b) => a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
  const _sortNumCasc = (a,b) => Number(b)-Number(a);

  // Lấy source data đã lọc đến key (không tính key hiện tại)
  function _tbCascadeSource(upToKey) {
    const order = ['tram','cap','type','hang','kieu','cong_suat','year','opyr'];
    const upToIdx = order.indexOf(upToKey);
    let src = _tbData;
    if (_tbFTram && order.indexOf('tram') < upToIdx) src = src.filter(r=>(r.Tram||'').trim()===_tbFTram);
    if (_tbFCap   && order.indexOf('cap')  < upToIdx) src = src.filter(r=>String(r.Cap_dien_ap??'')===_tbFCap);
    if (_tbFType  && order.indexOf('type') < upToIdx) src = src.filter(r=>(r.Phan_loai_thiet_bi||'').trim()===_tbFType);
    if (_tbFHang  && order.indexOf('hang') < upToIdx) src = src.filter(r=>(r.Hang_san_xuat||'').trim()===_tbFHang);
    if (_tbFKieu  && order.indexOf('kieu') < upToIdx) src = src.filter(r=>(r.Kieu||'').trim()===_tbFKieu);
    if (typeof _tbFCongSuat!=='undefined'&&_tbFCongSuat && order.indexOf('cong_suat')<upToIdx) src=src.filter(r=>String(r.Cong_suat||'')===_tbFCongSuat);
    if (_tbFYear  && order.indexOf('year') < upToIdx) src = src.filter(r=>String(r.Nam_san_xuat||'')===_tbFYear);
    if (_tbFOpyr  && order.indexOf('opyr') < upToIdx) src = src.filter(r=>String(r.Nam_van_hanh||'')===_tbFOpyr);
    return src;
  }

  // Rebuild all dropdowns after key (cascade downstream)
  function _tbRebuildAfter(changedKey) {
    const order = ['tram','cap','type','hang','kieu','cong_suat','year','opyr'];
    const changedIdx = order.indexOf(changedKey);
    order.slice(changedIdx + 1).forEach(key => {
      const ref = _tbDdRefs[key];
      if (!ref) return;
      const src = _tbCascadeSource(key);
      let newItems = [];
      if (key==='tram')      newItems = [...new Set(src.map(r=>(r.Tram||'').trim()).filter(Boolean))].sort(_sortViCasc);
      else if (key==='cap')  newItems = [...new Set(src.map(r=>String(r.Cap_dien_ap??'')).filter(c=>c&&c!=='null'))].sort((a,b)=>(_tbCapPrioCasc[a]??9)-(_tbCapPrioCasc[b]??9)).map(cv=>({v:cv,l:_tbCapLbl[cv]||cv}));
      else if (key==='type') newItems = [...new Set(src.map(r=>(r.Phan_loai_thiet_bi||'').trim()).filter(Boolean))].sort(_sortViCasc);
      else if (key==='hang') newItems = [...new Set(src.map(r=>(r.Hang_san_xuat||'').trim()).filter(Boolean))].sort(_sortViCasc);
      else if (key==='kieu') newItems = [...new Set(src.map(r=>(r.Kieu||'').trim()).filter(Boolean))].sort(_sortViCasc);
      else if (key==='cong_suat') newItems = [...new Set(src.map(r=>String(r.Cong_suat||'')).filter(v=>v&&v!=='null'&&v!=='0'))].sort(_sortNumCasc);
      else if (key==='year') newItems = [...new Set(src.map(r=>String(r.Nam_san_xuat||'')).filter(y=>y&&y!=='null'&&y!=='0'))].sort(_sortNumCasc);
      else if (key==='opyr') newItems = [...new Set(src.map(r=>String(r.Nam_van_hanh||'')).filter(y=>y&&y!=='null'&&y!=='0'))].sort(_sortNumCasc);
      ref.setItems(newItems);
      // Auto-reset if current value no longer available
      const curVal = {tram:_tbFTram,cap:_tbFCap,type:_tbFType,hang:_tbFHang,kieu:_tbFKieu,cong_suat:_tbFCongSuat,year:_tbFYear,opyr:_tbFOpyr}[key]||'';
      const available = newItems.map(it=>typeof it==='object'?it.v:it);
      if (curVal && !available.includes(curVal)) {
        _tbOnFilter(key, '');
        ref.reset();
      }
    });
  }

  // Create a cascade-aware dropdown button
  function mkCascadeDd(key, defaultLbl, initItems) {
    let currentItems = initItems;
    const btn = document.createElement('button');
    btn.type='button';
    btn.style.cssText='display:inline-flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:var(--bg-elevated,#161b22);color:var(--text-primary);font-family:var(--font-mono);font-size:11px;cursor:pointer;outline:none;min-width:130px;white-space:nowrap;transition:all .15s';
    const lbl=document.createElement('span'); lbl.textContent=defaultLbl; lbl.dataset.default=defaultLbl;
    const ico=document.createElement('i'); ico.className='fas fa-chevron-down'; ico.style.cssText='font-size:8px;color:var(--text-muted);flex-shrink:0';
    btn.appendChild(lbl); btn.appendChild(ico);
    btn.onmouseenter=()=>{if(!btn._active)btn.style.borderColor='var(--accent)';};
    btn.onmouseleave=()=>{if(!btn._active)btn.style.borderColor='rgba(0,200,255,.4)';};

    btn.setItems = items => { currentItems = items; };
    btn.reset = () => { lbl.textContent=defaultLbl; btn._active=false; btn.style.borderColor='rgba(0,200,255,.4)'; btn.style.background=''; btn.style.color=''; ico.style.color='var(--text-muted)'; };
    _tbDdRefs[key] = btn;

    let oc;
    btn.onclick = e => {
      e.stopPropagation();
      const ex=document.getElementById('_tbDdList');
      if(ex){if(ex.dataset.key===key){ex.remove();return;}ex.remove();}
      const list=document.createElement('div'); list.id='_tbDdList'; list.dataset.key=key;
      list.style.cssText='position:fixed;z-index:9999;background:var(--bg-surface,#161b22);border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.6);min-width:200px;max-height:320px;overflow-y:auto;flex-direction:column;padding:4px 0;display:flex';
      // Search box
      if(['tram','hang','type','kieu'].includes(key)){
        const si=document.createElement('input'); si.type='text'; si.placeholder='🔍 Tìm...';
        si.style.cssText='margin:6px 8px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;outline:none';
        si.oninput=ev=>{const q=ev.target.value.toLowerCase();list.querySelectorAll('.tb-dd-item').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'':'none';});};
        si.onclick=ev=>ev.stopPropagation(); list.appendChild(si);
      }
      function mkI(v,l){
        const d=document.createElement('div'); d.className='tb-dd-item';
        d.style.cssText='padding:7px 14px;cursor:pointer;font-size:11px;color:var(--text-primary);white-space:nowrap;transition:background .1s';
        d.textContent=l;
        d.onmouseenter=()=>{d.style.background='rgba(255,255,255,.07)';}; d.onmouseleave=()=>{d.style.background='';};
        d.onclick=()=>{
          // Reset downstream filters
          _tbOnFilter(key,v);
          lbl.textContent=v?l:defaultLbl; btn._active=!!v;
          btn.style.borderColor=v?'var(--accent)':'rgba(0,200,255,.4)';
          btn.style.background=v?'rgba(0,200,255,.1)':'';
          btn.style.color=v?'var(--accent)':'';
          ico.style.color=v?'var(--accent)':'var(--text-muted)';
          list.remove(); document.removeEventListener('click',oc);
          // Cascade: rebuild all downstream dropdowns
          _tbRebuildAfter(key);
          // Update reset button visibility
          const rb=document.getElementById('_tbResetBtn');
          if(rb) rb.style.display='inline-flex';
        };
        list.appendChild(d);
      }
      mkI('',defaultLbl);
      currentItems.forEach(it=>typeof it==='object'?mkI(it.v,it.l):mkI(it,it));
      document.body.appendChild(list);
      const rb=btn.getBoundingClientRect();
      list.style.top=(rb.bottom+4)+'px'; list.style.left=rb.left+'px';
      const si=list.querySelector('input'); if(si)setTimeout(()=>si.focus(),30);
      oc=ev=>{if(!list.contains(ev.target)&&ev.target!==btn){list.remove();document.removeEventListener('click',oc);}};
      setTimeout(()=>document.addEventListener('click',oc),0);
    };
    return btn;
  }

  btnContainer.innerHTML = '';

  // Tram (always first, shows all tramsAll)
  if (dropdowns.includes('tram')) {
    const initTrams = tramsAll;
    btnContainer.appendChild(mkCascadeDd('tram','— Tất cả trạm ('+tramsAll.length+') —', initTrams));
  }
  // Cấp ĐA
  if (dropdowns.includes('cap')) btnContainer.appendChild(mkCascadeDd('cap','Cấp điện áp', capAll.map(cv=>({v:cv,l:_tbCapLbl[cv]||cv}))));
  // Loại TB
  if (dropdowns.includes('type')) btnContainer.appendChild(mkCascadeDd('type','Loại thiết bị', typesAll));
  // Hãng SX
  if (dropdowns.includes('hang')) btnContainer.appendChild(mkCascadeDd('hang','Hãng sản xuất', hangsAll));
  // Kiểu
  if (dropdowns.includes('kieu') && kieuAll.length > 0) btnContainer.appendChild(mkCascadeDd('kieu','Kiểu', kieuAll));
  // Công suất
  if (dropdowns.includes('cong_suat')) {
    const csAll=[...new Set(_tbData.map(r=>String(r.Cong_suat||'')).filter(v=>v&&v!=='null'&&v!=='0'))].sort(_sortNumCasc);
    if(csAll.length>0) btnContainer.appendChild(mkCascadeDd('cong_suat','Công suất', csAll));
  }
  // Năm SX
  if (dropdowns.includes('year') && yearsAll.length > 0) btnContainer.appendChild(mkCascadeDd('year','Năm SX', yearsAll));
  // Năm VH
  if (dropdowns.includes('opyr') && opyrsAll.length > 0) btnContainer.appendChild(mkCascadeDd('opyr','Năm vận hành', opyrsAll));

  _tbRefreshContent();
}

// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// ── MODULE THÍ NGHIỆM ĐỊNH KỲ — CongTacThiNghiem ─────────────
// Cảnh báo dựa trên Thoi_gian_thi_nghiem_tiep_theo + Han_thi_nghiem
// ══════════════════════════════════════════════════════════════

const _TN_TABLE     = 'CongTacThiNghiem';
const _TN_SB_URL    = 'https://xqqmfmljwycpehfyknoy.supabase.co';
const _TN_SB_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';
const _TN_WARN_DAYS = 30;
const _TN_CACHE_KEY = 'evn_tn_cache_v3';
// ── Tối ưu #8: tăng TN cache từ 15 phút lên 12 giờ ──
const _TN_CACHE_TTL = 12 * 60 * 60 * 1000;

// Nav map
const _tnNavMap = {
  'Thí nghiệm định kỳ':        { mode:'dinhky',  label:'Thí nghiệm định kỳ',  icon:'fa-calendar-check', color:'#00c8ff' },
  'Thí nghiệm đột xuất': { mode:'dotxuat', label:'Thí nghiệm đột xuất (TNĐX)', icon:'fa-bolt',           color:'#f59e0b' },
};

// Báo cáo nav map
const _bcNavMap = {
  'KL theo tháng':    { rpt:'by_month',   label:'Khối lượng TN theo tháng',    icon:'fa-chart-bar',           color:'#00c8ff' },
  'KL theo năm':      { rpt:'by_year',    label:'Khối lượng TN theo năm',       icon:'fa-chart-line',          color:'#10b981' },
  'Thiết bị quá hạn': { rpt:'overdue',    label:'Thiết bị quá hạn thí nghiệm', icon:'fa-exclamation-triangle', color:'#ff5252' },
  'Đặt sớm kế hoạch': { rpt:'early_plan', label:'Thiết bị đặt sớm hơn kế hoạch', icon:'fa-forward',          color:'#f59e0b' },
};

const _tnCapLbl = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
const _tnCapCol = {'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};

// ── ALERT LOGIC ───────────────────────────────────────────────
// Logic:
// 1. Quá hạn     : Thoi_gian_thi_nghiem_tiep_theo < today
// 2. Sắp đến hạn : today ≤ Thoi_gian_thi_nghiem_tiep_theo ≤ today + 30 ngày
// 3. Đặt sớm     : (Thoi_gian_thi_nghiem_tiep_theo - Thoi_gian_thi_nghiem_truoc) < Han_thi_nghiem * 0.85
// 4. Đặt muộn    : (Thoi_gian_thi_nghiem_tiep_theo - Thoi_gian_thi_nghiem_truoc) > Han_thi_nghiem * 1.15
// CSV: bỏ qua tất cả cảnh báo

function _tnIsCSV(row) {
  const pl = (row.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,'');
  return pl === 'CSV' || pl.startsWith('CSV');
}

function _tnAlertStatus(row) {
  if (_tnIsCSV(row)) return { level:'none', label:'CSV', color:'' };

  const today  = new Date(); today.setHours(0,0,0,0);
  const ms     = 86400000;

  // Ngày TN tiếp theo
  const tiepTheo = row.Thoi_gian_thi_nghiem_tiep_theo
    ? new Date(row.Thoi_gian_thi_nghiem_tiep_theo) : null;
  if (tiepTheo) tiepTheo.setHours(0,0,0,0);

  // Ngày TN trước đó
  const truocDo = row.Thoi_gian_thi_nghiem_truoc
    ? new Date(row.Thoi_gian_thi_nghiem_truoc) : null;
  if (truocDo) truocDo.setHours(0,0,0,0);

  // Hạn thí nghiệm (ngày)
  // Han_thi_nghiem tính bằng NĂM → chuyển sang ngày để so sánh
  const hanNam = Number(row.Han_thi_nghiem) || 0;
  const hanTN  = hanNam * 365;

  // Không có ngày tiếp theo
  if (!tiepTheo) return { level:'info', label:'Chưa có ngày TN', color:'#607d8b' };

  const diffDays = Math.round((tiepTheo - today) / ms);

  // 1. Quá hạn: ngày tiếp theo đã qua
  if (diffDays < 0) {
    return { level:'overdue', label:`Quá hạn ${Math.abs(diffDays)} ngày`, color:'#ff5252', diffDays };
  }
  // 2. Sắp đến hạn ≤ 30 ngày
  if (diffDays <= _TN_WARN_DAYS) {
    return { level:'warning', label:`Còn ${diffDays} ngày`, color:'#ffd740', diffDays };
  }

  // 3+4. Kiểm tra độ lệch chu kỳ so với Han_thi_nghiem
  if (truocDo && tiepTheo && hanTN > 0) {
    const interval = Math.round((tiepTheo - truocDo) / ms); // khoảng cách thực tế (ngày)
    const ratio    = interval / hanTN;
    if (ratio < 0.85) {
      return { level:'early', label:`Đặt sớm ${Math.round((1-ratio)*100)}%`, color:'#00c8ff', diffDays, interval, hanTN };
    }
    if (ratio > 1.15) {
      return { level:'late', label:`Đặt muộn ${Math.round((ratio-1)*100)}%`, color:'#ff9100', diffDays, interval, hanTN };
    }
  }
  return { level:'ok', label:`Còn ${diffDays} ngày`, color:'#00e676', diffDays };
}

function _tnAlertBadge(row) {
  const s = _tnAlertStatus(row);
  if (s.level === 'none') return '<span style="font-size:9px;color:var(--text-muted)">CSV</span>';
  const icons = { overdue:'fa-exclamation-triangle', warning:'fa-clock', early:'fa-forward', late:'fa-backward', ok:'fa-check-circle', info:'fa-info-circle' };
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;padding:2px 8px;border-radius:12px;background:${s.color}18;color:${s.color};border:1px solid ${s.color}33;font-weight:600;white-space:nowrap"><i class="fas ${icons[s.level]||'fa-circle'}" style="font-size:7px"></i>${s.label}</span>`;
}

// ── DATA FETCH ────────────────────────────────────────────────
async function _tnFetchData() {
  const sb = window.supabase ? window.supabase.createClient(_TN_SB_URL, _TN_SB_KEY) : null;
  if (!sb) return [];

  // ── Cache + row count check triệt để ──
  let cachedData = null, cachedCount = null;
  try {
    const cached = localStorage.getItem(_TN_CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < _TN_CACHE_TTL && data?.length > 0) {
        cachedData = data;
        cachedCount = data.length;
      }
    }
  } catch(_) {}

  // Nếu có cache, check row count từ server
  if (cachedData) {
    try {
      const { count } = await sb.from(_TN_TABLE).select('*', { count: 'exact', head: true });
      if (count != null && count === cachedCount) {
        return cachedData;  // Cache vẫn match server
      }
      console.log(`[TN cache] Server: ${count} rows, cache: ${cachedCount} → refresh`);
    } catch (e) {
      // Network lỗi → vẫn dùng cache
      return cachedData;
    }
  }

  // ── Tối ưu #7: chỉ SELECT các cột thực sự dùng (thay vì SELECT *) ──
  const TN_COLS = 'Id,Tram,Nhom_thiet_bi,Ngan_thiet_bi,Ten_thiet_bi,Phan_loai_thiet_bi,Cap_dien_ap,So_luong,Don_vi_tinh,Han_thi_nghiem,Thoi_gian_thi_nghiem_truoc,Thoi_gian_thi_nghiem_gan_nhat,Thoi_gian_thi_nghiem_tiep_theo,Lich_dat_lam,Ngay_thi_nghiem,Bien_ban,Ghi_chu,Nam_ke_hoach,Nam_thuc_hien,Doi,Loai_ngan_lo';

  // ── Tối ưu #2: parallel fetch ──
  let allRows = [];
  try {
    const { count } = await sb.from(_TN_TABLE).select('*', { count: 'exact', head: true });
    if (count) {
      const batchSize = 1000;
      const numBatches = Math.ceil(count / batchSize);
      console.log(`[TN] Tải song song ${numBatches} batches (${count} rows)`);

      const promises = Array.from({ length: numBatches }, (_, i) =>
        sb.from(_TN_TABLE).select(TN_COLS).range(i * batchSize, (i + 1) * batchSize - 1)
      );
      const results = await Promise.all(promises);
      for (const r of results) {
        if (r.error) { console.error('[TN batch]', r.error); continue; }
        if (r.data) allRows.push(...r.data);
      }
    }
  } catch (e) {
    // Fallback sequential
    console.warn('[TN] Parallel fail, fallback sequential', e);
    allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb.from(_TN_TABLE).select(TN_COLS).range(from, from + 999);
      if (error) { console.error('[TN]', error); break; }
      if (!data || !data.length) break;
      allRows = allRows.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  try { localStorage.setItem(_TN_CACHE_KEY, JSON.stringify({ ts:Date.now(), data:allRows })); } catch(_) {}
  return allRows;
}

// ── STATE ─────────────────────────────────────────────────────
let _tnRawData=[], _tnAllData=[], _tnFiltered=[], _tnPage=1, _tnPageSize=50;
let _tnSortCol='_alert', _tnSortAsc=true;
let _tnSearchQ='', _tnFCap='', _tnFType='', _tnFTram='', _tnFNhom='', _tnFDoi='', _tnFAlertOnly=false;
let _tnMode='', _tnConf=null;
let _tnDdRefs = {};  // dropdown button refs for cascade update

// ── FILTER & SORT ─────────────────────────────────────────────
function _tnApply() {
  const q = _tnSearchQ.toLowerCase().trim();
  _tnFiltered = _tnAllData.filter(r => {
    if (_tnFCap   && String(r.Cap_dien_ap??'') !== _tnFCap)             return false;
    if (_tnFType  && (r.Phan_loai_thiet_bi||'').trim() !== _tnFType)   return false;
    if (_tnFTram  && (r.Tram||'').trim() !== _tnFTram)                  return false;
    if (_tnFNhom  && (r.Nhom_thiet_bi||'').trim() !== _tnFNhom)        return false;
    if (_tnFDoi   && String(r.Doi||'').trim() !== _tnFDoi)              return false;
    if (_tnFAlertOnly) {
      const lvl = _tnAlertStatus(r).level;
      if (lvl === 'ok' || lvl === 'none') return false;
    }
    if (q) {
      const hay = [(r.Tram||''),(r.Ten_thiet_bi||''),(r.Phan_loai_thiet_bi||''),(r.Nhom_thiet_bi||''),(r.Loai_ngan_lo||'')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const order = { overdue:0, warning:1, late:2, early:3, info:4, ok:5, none:6 };
  _tnFiltered.sort((a, b) => {
    if (_tnSortCol === '_alert') {
      const la = order[_tnAlertStatus(a).level]??9, lb = order[_tnAlertStatus(b).level]??9;
      return _tnSortAsc ? la-lb : lb-la;
    }
    let va=a[_tnSortCol]??'', vb=b[_tnSortCol]??'';
    if (!isNaN(Date.parse(va)) && !isNaN(Date.parse(vb))) {
      return _tnSortAsc ? new Date(va)-new Date(vb) : new Date(vb)-new Date(va);
    }
    va=String(va).toLowerCase(); vb=String(vb).toLowerCase();
    return _tnSortAsc ? va.localeCompare(vb,'vi') : vb.localeCompare(va,'vi');
  });
  _tnPage = 1;
}

// ── STATS ROW ─────────────────────────────────────────────────
function _tnStatClick(lvl) {
  if (lvl) { _tnFAlertOnly=true; _tnAllData_filter(lvl); _tnRefresh(); }
  else      { _tnFAlertOnly=false; _tnApply(); _tnRefresh(); }
  // Mở panel chi tiết
  _tnShowStatPanel(lvl);
}

function _tnShowStatPanel(lvl) {
  const rows = _tnFiltered;
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const fmtD = v => { if(!v) return '—'; const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}); };
  const capLbl={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const capCol={'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};

  const levelConf = {
    '':       {title:'📋 Tổng thiết bị TN', color:'var(--accent)'},
    'overdue':{title:'🚨 Quá hạn TN',       color:'#ff5252'},
    'warning':{title:'⏰ Sắp đến hạn (≤30 ngày)', color:'#ffd740'},
    'late':   {title:'⏪ Đặt muộn >15%',    color:'#ff9100'},
    'early':  {title:'⏩ Đặt sớm',          color:'#00c8ff'},
    'ok':     {title:'✅ Trong hạn',         color:'#00e676'},
  };
  const conf = levelConf[lvl||''] || {title:'Chi tiết', color:'var(--accent)'};
  const srcRows = lvl ? rows.filter(r=>_tnAlertStatus(r).level===lvl) : rows;

  // Group by Tram
  const byTram = {};
  srcRows.forEach(r => {
    const t=(r.Tram||'—').trim();
    if(!byTram[t]) byTram[t]=[];
    byTram[t].push(r);
  });
  const tramKeys = Object.keys(byTram).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));

  const bodyHtml = tramKeys.map(t => {
    const arr = byTram[t];
    const capVal = String(arr[0]?.Cap_dien_ap??'');
    return `<div style="border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="padding:7px 16px 4px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;font-weight:700;color:var(--text-primary)">${t}</span>
        <div style="display:flex;gap:5px;align-items:center">
          ${capVal&&capVal!=='null'?`<span style="font-size:8px;font-weight:700;color:${capCol[capVal]};background:${capCol[capVal]}18;padding:1px 5px;border-radius:6px">${capLbl[capVal]||capVal}</span>`:''}
          <span style="font-size:9px;color:var(--text-muted);background:rgba(255,255,255,.05);padding:1px 6px;border-radius:6px">${arr.length}</span>
        </div>
      </div>
      ${arr.slice(0,5).map(r=>{
        const s=_tnAlertStatus(r);
        return `<div style="padding:4px 24px;font-size:9px;color:var(--text-secondary);display:flex;justify-content:space-between">
          <span>${r.Phan_loai_thiet_bi||'—'} · ${r.Ten_thiet_bi||'—'}</span>
          <span style="color:${s.color};font-family:var(--font-mono)">${fmtD(r.Thoi_gian_thi_nghiem_tiep_theo)}</span>
        </div>`;
      }).join('')}
      ${arr.length>5?`<div style="padding:2px 24px 6px;font-size:8.5px;color:var(--text-muted)">...và ${arr.length-5} thiết bị khác</div>`:''}
    </div>`;
  }).join('');

  let p=document.getElementById('hm-detail-panel');
  if(!p){p=document.createElement('div');p.id='hm-detail-panel';p.className='hm-detail-panel';document.body.appendChild(p);}
  p.innerHTML=`
    <div class="hm-resize-grip"></div>
    <div class="hm-detail-hd" style="border-left:3px solid ${conf.color}">
      <span style="color:${conf.color}">${conf.title}</span>
      <span class="hm-detail-close" onclick="this.closest('.hm-detail-panel').classList.remove('open');let bd=document.getElementById('hm-detail-backdrop');if(bd)bd.style.display='none'">✕</span>
    </div>
    <div style="padding:8px 16px;font-size:9px;color:var(--text-muted);font-family:var(--font-mono);border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">${fmt(srcRows.length)} bản ghi · ${tramKeys.length} trạm</div>
    <div id="hm-detail-body" style="overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain">${bodyHtml||'<div style="padding:24px;text-align:center;color:var(--text-muted)">Không có dữ liệu</div>'}</div>`;
  p.classList.add('open');
  _hmOpenPanel(p);
}

function _tnRowClick(e, row) {
  // Ctrl+click or right-click = open update modal
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    e.preventDefault();
    _tnOpenUpdateModal(row);
    return;
  }
  // Normal click = show mini context menu
  const existing = document.getElementById('_tnRowMenu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = '_tnRowMenu';
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - 100);
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:99990;background:#1a1f2e;border:1px solid rgba(0,200,255,.3);border-radius:8px;padding:6px;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,.5)`;
  menu.innerHTML = `
    <div style="padding:4px 10px 8px;font-size:9px;color:rgba(180,200,220,.6);border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:4px">${row.Tram||'—'} · ${row.Phan_loai_thiet_bi||'—'} · ${row.Ten_thiet_bi||row.Ngan_thiet_bi||'—'}</div>
    <button onclick="document.getElementById('_tnRowMenu')?.remove();_tnOpenUpdateModal(${JSON.stringify(row).replace(/"/g,'&quot;')})" style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:5px;border:none;background:none;color:rgba(235,248,255,.9);font-size:11px;cursor:pointer;text-align:left" onmouseover="this.style.background='rgba(0,200,255,.08)'" onmouseout="this.style.background='none'">
      <i class="fas fa-edit" style="color:var(--accent);width:16px"></i> Đề nghị cập nhật (modal)
    </button>
    <button onclick="document.getElementById('_tnRowMenu')?.remove();openUploadSection({tram:'${row.Tram||''}',ngan:'${row.Ngan_thiet_bi||''}',loaiTb:'${row.Phan_loai_thiet_bi||''}',tenCu:'${row.Ten_thiet_bi||''}',deviceName:'${row.Ten_thiet_bi||''}',slCu:'${row.So_luong||''}',ngayCu:'${row.Ngay_thi_nghiem||''}',date:'${row.Ngay_thi_nghiem?new Date(row.Ngay_thi_nghiem).toISOString().split('T')[0]:''  }'})" style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:5px;border:none;background:none;color:rgba(235,248,255,.9);font-size:11px;cursor:pointer;text-align:left" onmouseover="this.style.background='rgba(0,230,118,.08)'" onmouseout="this.style.background='none'">
      <i class="fas fa-upload" style="color:#00e676;width:16px"></i> Upload ảnh + cập nhật
    </button>`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', function rm(ev){if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('click',rm);}},10));
}

function _tnStats() {
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const f = _tnFiltered;
  const counts = {
    total:   f.length,
    overdue: f.filter(r=>_tnAlertStatus(r).level==='overdue').length,
    warning: f.filter(r=>_tnAlertStatus(r).level==='warning').length,
    late:    f.filter(r=>_tnAlertStatus(r).level==='late').length,
    early:   f.filter(r=>_tnAlertStatus(r).level==='early').length,
    ok:      f.filter(r=>_tnAlertStatus(r).level==='ok').length,
  };
  const cards = [
    ['Tổng',        counts.total,   'var(--accent)', 'rgba(0,200,255,.07)', 'rgba(0,200,255,.2)',   'fa-list',                 '',        counts.total],
    ['Quá hạn',     counts.overdue, '#ff5252',       'rgba(255,82,82,.1)',  'rgba(255,82,82,.3)',   'fa-exclamation-triangle', 'overdue', counts.total],
    ['Sắp đến hạn', counts.warning, '#ffd740',       'rgba(255,215,64,.08)','rgba(255,215,64,.25)', 'fa-clock',                'warning', counts.total],
    ['Đặt muộn',    counts.late,    '#ff9100',       'rgba(255,145,0,.08)', 'rgba(255,145,0,.25)',  'fa-backward',             'late',    counts.total],
    ['Đặt sớm',     counts.early,   '#00c8ff',       'rgba(0,200,255,.07)', 'rgba(0,200,255,.2)',   'fa-forward',              'early',   counts.total],
    ['Trong hạn',   counts.ok,      '#00e676',       'rgba(0,230,118,.07)', 'rgba(0,230,118,.2)',   'fa-check-circle',         'ok',      counts.total],
  ];
  return '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:14px">' +
    cards.map(([l,v,col,bg,brd,ic,lvl,tot]) => {
      const pct = tot > 0 ? Math.round((v / tot) * 100) : (lvl===''?100:0);
      const barPct = lvl==='' ? 100 : (tot > 0 ? Math.round((v / tot) * 100) : 0);
      return '<div style="background:' + bg + ';border:1px solid ' + brd + ';border-radius:8px;padding:9px 12px;cursor:pointer;transition:all .15s" onclick="_tnStatClick(\'' + lvl + '\')" onmouseenter="this.style.transform=\'translateY(-1px)\'" onmouseleave="this.style.transform=\'\'">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
          '<div style="font-size:9px;color:' + col + '"><i class="fas ' + ic + '" style="margin-right:3px"></i>' + l + '</div>' +
          (lvl!=='' ? '<div style="font-size:9px;font-family:var(--font-mono);color:' + col + ';opacity:.7">' + (tot>0?((v/tot*100).toFixed(1)):'0') + '%</div>' : '') +
        '</div>' +
        '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + col + ';margin-bottom:6px">' + fmt(v) + '</div>' +
        '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden">' +
          '<div style="height:100%;border-radius:2px;width:' + barPct + '%;background:' + col + ';transition:width .4s ease;box-shadow:0 0 6px ' + col + '55"></div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
}
function _tnAllData_filter(lvl) {
  _tnFiltered = _tnAllData.filter(r => _tnAlertStatus(r).level === lvl);
  _tnPage = 1;
}

// ── TABLE ─────────────────────────────────────────────────────
function _tnTable() {
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const fmtD = v => {
    if (!v) return '<span style="color:rgba(255,255,255,.2);font-size:9px">—</span>';
    const d = new Date(v); if (isNaN(d)) return v;
    return `<span style="font-family:var(--font-mono);font-size:10px">${d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>`;
  };
  const start=(_tnPage-1)*_tnPageSize, rows=_tnFiltered.slice(start,start+_tnPageSize),
        total=_tnFiltered.length, totPg=Math.max(1,Math.ceil(total/_tnPageSize));

  const COLS = [
    {k:'_alert',                          l:'Trạng thái',          w:'135px'},
    {k:'Tram',                            l:'Trạm',                w:'90px'},
    {k:'Cap_dien_ap',                     l:'Cấp ĐA',              w:'65px'},
    {k:'Nhom_thiet_bi',                   l:'Nhóm TB',             w:'90px'},
    {k:'Phan_loai_thiet_bi',              l:'Loại TB',             w:'85px'},
    {k:'Ten_thiet_bi',                    l:'Tên thiết bị',        w:'130px'},
    {k:'So_luong',                        l:'SL',                  w:'44px', num:1},
    {k:'Han_thi_nghiem',                  l:'Hạn TN (ngày)',       w:'90px', num:1},
    {k:'Thoi_gian_thi_nghiem_truoc',      l:'TN trước đó',         w:'100px'},
    {k:'Thoi_gian_thi_nghiem_tiep_theo',  l:'TN tiếp theo',        w:'100px'},
    {k:'Ngay_thi_nghiem',                 l:'Ngày TN thực tế',     w:'105px'},
    {k:'Dien_ban',                        l:'SFRA',                w:'90px'},
    {k:'Bien_ban',                        l:'Biên bản',            w:'90px'},
    {k:'Ngay_thi_nghiem_dot_xuat',        l:'TN đột xuất',         w:'95px'},
    {k:'Nam_ke_hoach',                    l:'Năm KH',              w:'65px', num:1},
    {k:'Nam_thuc_hien',                   l:'Năm TH',              w:'65px', num:1},
    {k:'Muc_ke_hoach_nam',                l:'Mục KH',              w:'80px'},
    {k:'Ghi_chu',                         l:'Ghi chú',             w:'140px'},
  ];

  const mkTh = c => {
    const s = _tnSortCol === c.k;
    return `<th style="padding:7px 9px;font-size:9px;font-weight:700;color:${s?'var(--accent)':'rgba(200,218,235,.9)'};letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);cursor:pointer;white-space:nowrap;background:rgba(255,255,255,.03);user-select:none;min-width:${c.w};text-align:${c.num?'right':'left'};position:sticky;top:0;z-index:2" onclick="_tnSort('${c.k}')">${c.l}${s?`<span style="color:var(--accent)"> ${_tnSortAsc?'↑':'↓'}</span>`:''}</th>`;
  };

  const tbody = rows.map(r => {
    const s   = _tnAlertStatus(r);
    const cap = String(r.Cap_dien_ap??'');
    const rowBg = s.level==='overdue'?'background:rgba(255,82,82,.04)':s.level==='warning'?'background:rgba(255,215,64,.03)':s.level==='late'?'background:rgba(255,145,0,.03)':'';
    const capBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:9px;font-weight:700;background:${(_tnCapCol[cap]||'#888')}22;color:${_tnCapCol[cap]||'#888'}">${_tnCapLbl[cap]||cap||'—'}</span>`;
    const dateTT = r.Thoi_gian_thi_nghiem_tiep_theo ? new Date(r.Thoi_gian_thi_nghiem_tiep_theo) : null;
    const tiepTheoCell = dateTT
      ? `<span style="font-family:var(--font-mono);font-size:10px;color:${s.level==='overdue'?'#ff5252':s.level==='warning'?'#ffd740':'var(--text-primary)'};font-weight:${s.level!=='ok'&&s.level!=='none'?700:400}">${dateTT.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>`
      : '<span style="color:rgba(255,255,255,.2);font-size:9px">—</span>';

    // Han_thi_nghiem + interval deviation display
    const han = Number(r.Han_thi_nghiem)||0;
    const truoc = r.Thoi_gian_thi_nghiem_truoc ? new Date(r.Thoi_gian_thi_nghiem_truoc) : null;
    const tiep  = dateTT;
    // Han_thi_nghiem tính bằng năm — hiển thị đơn giản
    const hanNgay = han > 0 ? han * 365 : 0;
    const hanDisplay = han > 0
      ? `<span style="font-family:var(--font-mono)">${han} năm</span>`
      : '<span style="color:rgba(255,255,255,.2);font-size:9px">—</span>';

    return `<tr style="border-bottom:1px solid rgba(255,255,255,.04);${rowBg};cursor:pointer" onclick="_tnRowClick(event, ${JSON.stringify(r).replace(/"/g,'&quot;')})">
      <td style="padding:6px 9px">${_tnAlertBadge(r)}</td>
      <td style="padding:6px 9px;font-weight:600">${r.Tram||'—'}</td>
      <td style="padding:6px 9px">${capBadge}</td>
      <td style="padding:6px 9px;font-size:10px">${r.Nhom_thiet_bi||'—'}</td>
      <td style="padding:6px 9px;font-size:10px">${r.Phan_loai_thiet_bi||'—'}</td>
      <td style="padding:6px 9px;font-size:10px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.Ten_thiet_bi||''}">${r.Ten_thiet_bi||'—'}</td>
      <td style="padding:6px 9px;text-align:right;font-family:var(--font-mono)">${r.So_luong??'—'}</td>
      <td style="padding:6px 9px;text-align:right">${hanDisplay}</td>
      <td style="padding:6px 9px">${fmtD(r.Thoi_gian_thi_nghiem_truoc)}</td>
      <td style="padding:6px 9px">${tiepTheoCell}</td>
      <td style="padding:6px 9px">${fmtD(r.Ngay_thi_nghiem)}</td>
      <td style="padding:6px 9px;font-size:10px">${r.Dien_ban||'—'}</td>
      <td style="padding:6px 9px;font-size:10px">${r.Bien_ban||'—'}</td>
      <td style="padding:6px 9px">${fmtD(r.Ngay_thi_nghiem_dot_xuat)}</td>
      <td style="padding:6px 9px;text-align:right;font-family:var(--font-mono);font-size:10px">${r.Nam_ke_hoach||'—'}</td>
      <td style="padding:6px 9px;text-align:right;font-family:var(--font-mono);font-size:10px">${r.Nam_thuc_hien||'—'}</td>
      <td style="padding:6px 9px;font-size:10px">${r.Muc_ke_hoach_nam||'—'}</td>
      <td style="padding:6px 9px;font-size:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.Ghi_chu||''}">${r.Ghi_chu||'—'}</td>
    </tr>`;
  }).join('');

  const half=3; let lo=Math.max(1,_tnPage-half), hi=Math.min(totPg,lo+6); if(hi-lo<6)lo=Math.max(1,hi-6);
  let pg=''; if(lo>1)pg+=`<button class="tb-pb" onclick="_tnGoPage(1)">1</button>${lo>2?'…':''}`;
  for(let p=lo;p<=hi;p++) pg+=`<button class="tb-pb${p===_tnPage?' cur':''}" onclick="_tnGoPage(${p})">${p}</button>`;
  if(hi<totPg) pg+=`${hi<totPg-1?'…':''}<button class="tb-pb" onclick="_tnGoPage(${totPg})">${totPg}</button>`;

  return `${_tnStats()}
  <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);padding:0 0 10px">
    Hiển thị <b style="color:var(--accent)">${start+1}–${Math.min(start+_tnPageSize,total)}</b>/<b style="color:var(--accent)">${fmt(total)}</b>
    ${_tnFAlertOnly?'<span style="color:#ffd740;margin-left:8px"><i class="fas fa-filter"></i> Đang lọc cảnh báo</span>':''}
  </div>
  <div style="overflow-x:auto;border-radius:8px;border:1px solid rgba(255,255,255,.07)">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>${COLS.map(mkTh).join('')}</tr></thead>
      <tbody>${tbody||'<tr><td colspan="18" style="padding:30px;text-align:center;color:var(--text-muted)">Không có dữ liệu</td></tr>'}</tbody>
    </table>
  </div>
  <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;padding:14px 0 0">
    <button class="tb-pb" ${_tnPage<=1?'disabled':''} onclick="_tnGoPage(${_tnPage-1})">‹</button>
    ${pg}
    <button class="tb-pb" ${_tnPage>=totPg?'disabled':''} onclick="_tnGoPage(${_tnPage+1})">›</button>
  </div>`;
}

// ── CONTROLS ─────────────────────────────────────────────────
function _tnSort(c){ if(_tnSortCol===c)_tnSortAsc=!_tnSortAsc;else{_tnSortCol=c;_tnSortAsc=true;} _tnApply();_tnRefresh(); }
function _tnGoPage(p){ const t=Math.max(1,Math.ceil(_tnFiltered.length/_tnPageSize));_tnPage=Math.max(1,Math.min(p,t));_tnRefresh(); }
function _tnRefresh(){ const el=document.getElementById('_tnTableArea');if(el)el.innerHTML=_tnTable(); }
// ── Tối ưu #3: debounce TN search ──
let _tnSearchTimer = null;
function _tnOnSearch(v){
  _tnSearchQ = v || '';
  clearTimeout(_tnSearchTimer);
  _tnSearchTimer = setTimeout(() => {
    _tnApply();
    _tnRefresh();
  }, 250);
}
function _tnOnFilter(k,v){
  if(k==='cap')       _tnFCap=v;
  else if(k==='type') _tnFType=v;
  else if(k==='tram') _tnFTram=v;
  else if(k==='nhom') _tnFNhom=v;
  else if(k==='doi')  _tnFDoi=v;
  _tnApply(); _tnRefresh();
}

function _tnReset(){
  _tnSearchQ=_tnFCap=_tnFType=_tnFTram=_tnFNhom=_tnFDoi='';_tnFAlertOnly=false;
  document.querySelectorAll('#tbPageOverlay .tn-trigger-lbl').forEach(el=>{ el.textContent=el.dataset.default; });
  document.querySelectorAll('#tbPageOverlay .tn-trigger').forEach(el=>{ el.style.cssText=''; });
  const si=document.getElementById('_tnSi');if(si)si.value='';
  _tnApply();_tnRefresh();
}

function _tnExportCSV() {
  const fmtD = v => v ? new Date(v).toLocaleDateString('vi-VN') : '';
  const hdr = 'Trạng thái,Trạm,Cấp ĐA,Nhóm TB,Loại TB,Tên TB,Ngăn,SL,Hạn TN (ngày),TN trước đó,TN tiếp theo,Ngày TN thực tế,Điện bản,Biên bản,TN đột xuất,Năm KH,Năm TH,Mục KH,Đội,Ghi chú';
  const body = _tnFiltered.map(r=>[
    _tnAlertStatus(r).label, r.Tram, _tnCapLbl[String(r.Cap_dien_ap??'')]||r.Cap_dien_ap,
    r.Nhom_thiet_bi, r.Phan_loai_thiet_bi, r.Ten_thiet_bi, r.Loai_ngan_lo, r.So_luong,
    r.Han_thi_nghiem, fmtD(r.Thoi_gian_thi_nghiem_truoc), fmtD(r.Thoi_gian_thi_nghiem_tiep_theo),
    fmtD(r.Ngay_thi_nghiem), r.Dien_ban, r.Bien_ban, fmtD(r.Ngay_thi_nghiem_dot_xuat),
    r.Nam_ke_hoach, r.Nam_thuc_hien, r.Muc_ke_hoach_nam, r.Doi, r.Ghi_chu
  ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+hdr+'\n'+body],{type:'text/csv;charset=utf-8'}));
  a.download=`TNDK_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// ── RENDER PAGE ───────────────────────────────────────────────
function tnRenderPage(conf, title) {
  _tnConf=conf; _tnMode=conf.mode;
  _tnSortCol='Loai_ngan_lo'; _tnSortAsc=true;
  _tnSearchQ=_tnFCap=_tnFType=_tnFTram=_tnFNhom=''; _tnFAlertOnly=false;

  const overlay=document.getElementById('tbPageOverlay');
  if(!overlay) return;

  overlay.innerHTML=`
    <div style="padding:0 0 32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:34px;height:34px;border-radius:8px;background:${conf.color}22;color:${conf.color};display:flex;align-items:center;justify-content:center"><i class="fas ${conf.icon}" style="font-size:15px"></i></div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">${title}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Bảng <span style="color:var(--accent);font-family:var(--font-mono)">CongTacThiNghiem</span> · Cảnh báo: <span style="color:#ffd740">sắp hạn ≤30 ngày</span>, <span style="color:#ff5252">quá hạn</span>, <span style="color:#ff9100">đặt muộn >15%</span>, <span style="color:#00c8ff">đặt sớm</span> · CSV miễn cảnh báo</div>
        </div>
        <button onclick="navActivate(document.querySelector('.nav-item'))" style="margin-left:auto;padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-arrow-left"></i> Dashboard</button>
      </div>

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 0 12px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:12px">
        <div style="position:relative;flex:1;min-width:160px;max-width:280px">
          <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;pointer-events:none"></i>
          <input id="_tnSi" type="text" placeholder="🔍 Tìm trạm, tên TB, ngăn..."
            style="width:100%;box-sizing:border-box;padding:6px 10px 6px 30px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--text-primary);font-size:11px;outline:none;font-family:var(--font-mono)"
            oninput="_tnOnSearch(this.value)">
        </div>
        <div id="_tnFilterBtns" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
        <button onclick="_tnFAlertOnly=!_tnFAlertOnly;_tnApply();_tnRefresh();this.style.background=_tnFAlertOnly?'rgba(255,215,64,.2)':'';this.style.color=_tnFAlertOnly?'#ffd740':'';"
          style="padding:5px 11px;border-radius:6px;border:1px solid rgba(255,215,64,.3);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <i class="fas fa-bell"></i> Chỉ cảnh báo
        </button>
        <button onclick="_tnReset()" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(255,82,82,.3);background:rgba(255,82,82,.1);color:#ff5252;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-times"></i> Xóa lọc</button>
        <button onclick="_tnExportCSV()" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(0,230,118,.3);background:rgba(0,230,118,.1);color:#00e676;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-download"></i> CSV</button>
              ${_authGetSession()?.role==='admin' ? `<button onclick="_tnShowPendingRequests()" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(255,145,0,.3);background:rgba(255,145,0,.1);color:#ff9100;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-clipboard-check"></i> Phê duyệt ${(window._tnPendingRequests||[]).filter(r=>r.trang_thai==='cho_duyet').length ? '<span style="background:#ff5252;color:#fff;border-radius:8px;padding:1px 5px;font-size:8px;margin-left:3px">'+(window._tnPendingRequests||[]).filter(r=>r.trang_thai==='cho_duyet').length+'</span>' : ''}</button>` : ''  }
      </div>

      <div id="_tnTableArea">
        <div style="padding:50px;text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang tải...</div>
      </div>
    </div>`;

  _tnFetchData().then(rows => {
    if (!rows.length) {
      const el=document.getElementById('_tnTableArea');
      if(el) el.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-muted)"><i class="fas fa-database" style="font-size:24px;margin-bottom:10px;display:block;opacity:.3"></i>Bảng CongTacThiNghiem chưa có dữ liệu</div>';
      return;
    }
    _tnRawData = rows;
    if (conf.mode === 'dinhky') {
      _tnAllData = rows.filter(r => !(r.LoaiTN||'').toUpperCase().includes('ĐỘT'));
    } else {
      // TNDX: chỉ lấy thiết bị có ngày trong Ngay_thi_nghiem_dot_xuat
      _tnAllData = rows.filter(r => r.Ngay_thi_nghiem_dot_xuat && String(r.Ngay_thi_nghiem_dot_xuat).trim() !== '');
    }
    if (!_tnAllData.length) _tnAllData = rows;
    _tnApply();

    // Dropdowns
    const sortVi=(a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'});
    const cpPrio={'2':0,'1':1,'3':2,'4':3,'9':4,'6':5,'0':6};
    const trA=[...new Set(_tnAllData.map(r=>(r.Tram||'').trim()).filter(Boolean))].sort(sortVi);
    const tyA=[...new Set(_tnAllData.map(r=>(r.Phan_loai_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
    const nhA=[...new Set(_tnAllData.map(r=>(r.Nhom_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
    const cA  =[...new Set(_tnAllData.map(r=>String(r.Cap_dien_ap??'')).filter(c=>c&&c!=='null'))].sort((a,b)=>(cpPrio[a]??9)-(cpPrio[b]??9));
    const doiA=[...new Set(_tnAllData.map(r=>String(r.Doi||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
    const fc=document.getElementById('_tnFilterBtns');
    if(fc){
      fc.innerHTML='';
      // Reset dropdown refs for this render
      _tnDdRefs = {};

      // Get filtered source for dependent dropdowns (based on current doi+tram selection)
      function _tnDdSource() {
        let src = _tnAllData;
        if (_tnFDoi)  src = src.filter(r => String(r.Doi||'').trim() === _tnFDoi);
        if (_tnFTram) src = src.filter(r => (r.Tram||'').trim() === _tnFTram);
        return src;
      }

      // Rebuild dependent dropdowns — triggered by doi OR tram change
      function _tnRebuildDeps(changedKey) {
        const src = _tnDdSource();
        const newTram = [...new Set(src.map(r=>(r.Tram||'').trim()).filter(Boolean))].sort(sortVi);
        const newCap  = [...new Set(src.map(r=>String(r.Cap_dien_ap??'')).filter(x=>x&&x!=='null'))].sort((a,b)=>(cpPrio[a]??9)-(cpPrio[b]??9));
        const newNhom = [...new Set(src.map(r=>(r.Nhom_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
        const newType = [...new Set(src.map(r=>(r.Phan_loai_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
        // Update items
        if (_tnDdRefs.tram) _tnDdRefs.tram.setItems(newTram);
        if (_tnDdRefs.cap)  _tnDdRefs.cap.setItems(newCap.map(v=>({v,l:_tnCapLbl[v]||v})));
        if (_tnDdRefs.nhom) _tnDdRefs.nhom.setItems(newNhom);
        if (_tnDdRefs.type) _tnDdRefs.type.setItems(newType);
        // Reset downstream selections
        const resetKeys = changedKey==='doi' ? ['tram','cap','nhom','type'] : ['cap','nhom','type'];
        const resetVars = changedKey==='doi' ? ()=>{ _tnFTram=''; _tnFCap=''; _tnFNhom=''; _tnFType=''; }
                                             : ()=>{ _tnFCap=''; _tnFNhom=''; _tnFType=''; };
        resetVars();
        resetKeys.forEach(k=>{ if(_tnDdRefs[k]) _tnDdRefs[k].reset(); });
      }

      function mkTnDd(key, dflt, initItems) {
        let currentItems = initItems;
        const btn = document.createElement('button');
        btn.type='button'; btn.className='tn-trigger';
        btn.style.cssText='display:inline-flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:var(--bg-elevated,#161b22);color:var(--text-primary);font-family:var(--font-mono);font-size:11px;cursor:pointer;outline:none;min-width:130px;white-space:nowrap;transition:all .15s';
        const lbl=document.createElement('span');lbl.className='tn-trigger-lbl';lbl.textContent=dflt;lbl.dataset.default=dflt;
        const ico=document.createElement('i');ico.className='fas fa-chevron-down';ico.style.cssText='font-size:8px;color:var(--text-muted);flex-shrink:0';
        btn.appendChild(lbl);btn.appendChild(ico);
        btn.onmouseenter=()=>{if(!btn._active)btn.style.borderColor='var(--accent)';};
        btn.onmouseleave=()=>{if(!btn._active)btn.style.borderColor='rgba(0,200,255,.4)';};

        // Public API: update items + reset
        btn.setItems = items => { currentItems = items; };
        btn.reset = () => { lbl.textContent=dflt; btn._active=false; btn.style.borderColor='rgba(0,200,255,.4)'; btn.style.background=''; btn.style.color=''; ico.style.color='var(--text-muted)'; };

        let oc;
        btn.onclick = e => {
          e.stopPropagation();
          const ex=document.getElementById('_tnDdList');
          if(ex){if(ex.dataset.key===key){ex.remove();return;}ex.remove();}
          const list=document.createElement('div');list.id='_tnDdList';list.dataset.key=key;
          list.style.cssText='position:fixed;z-index:9999;background:var(--bg-surface,#161b22);border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.6);min-width:200px;max-height:320px;overflow-y:auto;flex-direction:column;padding:4px 0;display:flex';
          // Search box
          const si=document.createElement('input');si.type='text';si.placeholder='🔍 Tìm...';
          si.style.cssText='margin:6px 8px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;outline:none';
          si.oninput=ev=>{const q=ev.target.value.toLowerCase();list.querySelectorAll('.tn-dd-item').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'':'none';});};
          si.onclick=ev=>ev.stopPropagation();
          list.appendChild(si);

          function mkI(v,l){
            const d=document.createElement('div');d.className='tn-dd-item';
            d.style.cssText='padding:7px 14px;cursor:pointer;font-size:11px;color:var(--text-primary);white-space:nowrap;transition:background .1s';
            d.textContent=l;
            d.onmouseenter=()=>{d.style.background='rgba(255,255,255,.07)';};
            d.onmouseleave=()=>{d.style.background='';};
            d.onclick=()=>{
              if(key==='doi')  { _tnFDoi=v;  _tnOnFilter('doi',v);  _tnRebuildDeps('doi'); }
              else if(key==='tram') { _tnFTram=v; _tnOnFilter('tram',v); _tnRebuildDeps('tram'); }
              else { _tnOnFilter(key,v); }
              lbl.textContent=v?l:dflt; btn._active=!!v;
              btn._active=!!v;
              btn.style.borderColor=v?'var(--accent)':'rgba(0,200,255,.4)';
              btn.style.background=v?'rgba(0,200,255,.1)':'';
              btn.style.color=v?'var(--accent)':'';
              ico.style.color=v?'var(--accent)':'var(--text-muted)';
              list.remove();document.removeEventListener('click',oc);
            };
            list.appendChild(d);
          }
          mkI('',dflt);
          currentItems.forEach(it=>typeof it==='object'?mkI(it.v,it.l):mkI(it,it));
          document.body.appendChild(list);
          const rb=btn.getBoundingClientRect();
          list.style.top=(rb.bottom+4)+'px';
          list.style.left=rb.left+'px';
          setTimeout(()=>si.focus(),30);
          oc=ev=>{if(!list.contains(ev.target)&&ev.target!==btn){list.remove();document.removeEventListener('click',oc);}};
          setTimeout(()=>document.addEventListener('click',oc),0);
        };
        _tnDdRefs[key] = btn;
        return btn;
      }

      fc.appendChild(mkTnDd('doi', `— Đội —`, doiA));
      fc.appendChild(mkTnDd('tram',`— Tất cả trạm (${trA.length}) —`, trA));
      fc.appendChild(mkTnDd('cap','Cấp điện áp', cA.map(v=>({v,l:_tnCapLbl[v]||v}))));
      fc.appendChild(mkTnDd('nhom','Nhóm thiết bị', nhA));
      fc.appendChild(mkTnDd('type','Loại thiết bị', tyA));
    }
    _tnRefresh();
  });
}

function _tnSetData(source) {
  _tnAllData = source; _tnApply(); _tnRefresh();
}


// ══════════════════════════════════════════════════════════════
// ── MODULE BÁO CÁO + TNDX ────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// ── SHARED HELPERS ────────────────────────────────────────────
function _bcFmtD(v, short=false) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return v;
  return short
    ? d.toLocaleDateString('vi-VN', {month:'2-digit', year:'numeric'})
    : d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
}

function _bcCapBadge(cap) {
  const col = _tnCapCol[String(cap??'')] || '#888';
  const lbl = _tnCapLbl[String(cap??'')] || String(cap||'—');
  return `<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:9px;font-weight:700;background:${col}22;color:${col}">${lbl}</span>`;
}

function _bcIsCSV(row) {
  const pl = (row.Phan_loai_thiet_bi||'').trim().toUpperCase().replace(/\s+/g,'');
  return pl === 'CSV' || pl.startsWith('CSV');
}

// ── TABLE BUILDER — grouped by Phan_loai_thiet_bi ────────────
function _bcGroupedTable(rows, colDefs) {
  const fmt = n => Number(n).toLocaleString('vi-VN');
  if (!rows.length) return '<div style="padding:30px;text-align:center;color:var(--text-muted)">Không có dữ liệu</div>';

  // Group by Phan_loai_thiet_bi
  const groups = {};
  rows.forEach(r => {
    const key = (r.Phan_loai_thiet_bi||'Khác').trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const sortedKeys = Object.keys(groups).sort((a,b) => a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));

  const thead = `<tr>${colDefs.map(c=>`<th style="padding:7px 10px;font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);white-space:nowrap;min-width:${c.w||'80px'};text-align:${c.num?'right':'left'};position:sticky;top:0;z-index:2">${c.l}</th>`).join('')}</tr>`;

  let html = '';
  sortedKeys.forEach(key => {
    const grpRows = groups[key];
    // Group header
    html += `<tr style="background:rgba(0,200,255,.05);border-top:1px solid rgba(0,200,255,.12)">
      <td colspan="${colDefs.length}" style="padding:6px 12px;font-size:10px;font-weight:800;color:var(--accent)">
        <i class="fas fa-microchip" style="margin-right:6px;font-size:9px"></i>${key}
        <span style="font-weight:400;color:var(--text-muted);margin-left:8px">${fmt(grpRows.length)} bản ghi</span>
      </td>
    </tr>`;
    // Rows
    grpRows.forEach(r => {
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">${colDefs.map(col => {
        if (col.render) return `<td style="padding:5px 10px;${col.num?'text-align:right':''}font-size:10px">${col.render(r)}</td>`;
        const v = r[col.k];
        return `<td style="padding:5px 10px;${col.num?'text-align:right;font-family:var(--font-mono)':''}font-size:10px;max-width:${col.w||'120px'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v||''}">${v||'—'}</td>`;
      }).join('')}</tr>`;
    });
  });

  return `<div style="overflow-x:auto;border-radius:8px;border:1px solid rgba(255,255,255,.07)">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>${thead}</thead>
      <tbody>${html}</tbody>
    </table>
  </div>`;
}

// ── CHART BUILDERS (SVG bar charts) ──────────────────────────
function _bcBarChart(data, title, colorFn) {
  if (!data.length) return '';
  const maxVal = Math.max(...data.map(d=>d.v), 1);
  const BAR_H = 160, BAR_W = Math.max(24, Math.min(48, Math.floor(680 / data.length)));
  const bars = data.map((d,i) => {
    const h = Math.max(2, Math.round((d.v / maxVal) * BAR_H));
    const x = i * (BAR_W + 4);
    const col = colorFn ? colorFn(d) : '#00c8ff';
    return `<g transform="translate(${x}, 0)">
      <rect y="${BAR_H - h}" width="${BAR_W}" height="${h}" fill="${col}" rx="2" opacity=".85"/>
      <text x="${BAR_W/2}" y="${BAR_H + 14}" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="9">${d.label}</text>
      <text x="${BAR_W/2}" y="${BAR_H - h - 4}" text-anchor="middle" fill="${col}" font-size="10" font-weight="700">${d.v}</text>
    </g>`;
  }).join('');
  const totalW = data.length * (BAR_W + 4);
  return `<div style="overflow-x:auto;padding:8px 0">
    <svg width="${totalW}" height="${BAR_H + 40}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0, 10)">${bars}</g>
    </svg>
  </div>`;
}

// ── BÁO CÁO: KL THEO THÁNG ───────────────────────────────────
// State for by-month filters
let _bcFDoi='', _bcFTram='', _bcFMonth='', _bcFYear='', _bcFType='';

function _bcRenderByMonth(conf) {
  const rawData = _tnRawData.length ? _tnRawData : (_tnAllData.length ? _tnAllData : []);
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const sortVi = (a,b) => String(a).localeCompare(String(b),'vi');

  // Build filter option lists from full dataset
  const allDois  = [...new Set(rawData.map(r=>(r.Doi||'').trim()).filter(Boolean))].sort(sortVi);
  const allTrams = [...new Set(rawData.map(r=>(r.Tram||'').trim()).filter(Boolean))].sort(sortVi);
  const allTypes = [...new Set(rawData.map(r=>(r.Phan_loai_thiet_bi||'').trim()).filter(Boolean))].sort(sortVi);
  // Collect all years/months from dates
  const allYears = new Set(), allMonths = new Set();
  rawData.forEach(r => {
    const ds = r.Ngay_thi_nghiem || r.Thoi_gian_thi_nghiem_tiep_theo;
    if (!ds) return;
    const d = new Date(ds); if (isNaN(d)) return;
    allYears.add(d.getFullYear());
    allMonths.add(d.getMonth()+1);
  });
  const yearList  = [...allYears].sort((a,b)=>b-a);
  const monthList = [...allMonths].sort((a,b)=>a-b);

  // Apply active filters
  const data = rawData.filter(r => {
    if (_bcFDoi  && (r.Doi||'').trim() !== _bcFDoi)                            return false;
    if (_bcFTram && (r.Tram||'').trim() !== _bcFTram)                          return false;
    if (_bcFType && (r.Phan_loai_thiet_bi||'').trim() !== _bcFType)            return false;
    const ds = r.Ngay_thi_nghiem || r.Thoi_gian_thi_nghiem_tiep_theo;
    if (_bcFYear || _bcFMonth) {
      if (!ds) return false;
      const d = new Date(ds); if (isNaN(d)) return false;
      if (_bcFYear  && String(d.getFullYear()) !== String(_bcFYear))  return false;
      if (_bcFMonth && String(d.getMonth()+1) !== String(_bcFMonth))  return false;
    }
    return true;
  });

  // Count by month
  const monthMap = {};
  const monthTypeMap = {};
  data.forEach(r => {
    const dateStr = r.Ngay_thi_nghiem || r.Thoi_gian_thi_nghiem_tiep_theo;
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = `T${d.getMonth()+1}/${d.getFullYear()}`;
    if (!monthMap[key]) monthMap[key] = { label, v:0, year:d.getFullYear(), month:d.getMonth()+1 };
    monthMap[key].v++;
    const pl = (r.Phan_loai_thiet_bi||'Khác').trim();
    if (!monthTypeMap[key]) monthTypeMap[key] = {};
    monthTypeMap[key][pl] = (monthTypeMap[key][pl]||0)+1;
  });

  const months = Object.keys(monthMap).sort().map(k=>monthMap[k]);
  const filteredTypes = [...new Set(data.map(r=>(r.Phan_loai_thiet_bi||'Khác').trim()))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
  const COLORS = ['#00c8ff','#00e676','#ffd740','#ff9100','#e040fb','#18ffff','#ff4081','#00bcd4','#8bc34a','#ff5252'];

  const totalDone = data.filter(r=>r.Ngay_thi_nghiem).length;

  // Helper: build styled dropdown
  function mkBcDd(key, dflt, val, items, labelFn) {
    if(!window._bcDdStore)window._bcDdStore={};
    window._bcDdStore[key]={items,dflt};
    const active=!!val;
    const lbl=val?(labelFn?labelFn(val):val):dflt;
    const brd=active?'var(--accent)':'rgba(0,200,255,.4)';
    const bg=active?'rgba(0,200,255,.1)':'var(--bg-elevated)';
    const col=active?'var(--accent)':'var(--text-primary)';
    return `<button data-bckey="${key}" style="display:inline-flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;border-radius:7px;border:1px solid ${brd};background:${bg};color:${col};font-family:var(--font-mono);font-size:11px;cursor:pointer;outline:none;min-width:115px;white-space:nowrap" onclick="event.stopPropagation();_bcBmDropdown(this,'${key}')">
      <span>${lbl}</span><i class="fas fa-chevron-down" style="font-size:8px;opacity:.6;flex-shrink:0"></i>
    </button>`;
  }

  const hasFilter = _bcFDoi||_bcFTram||_bcFYear||_bcFMonth||_bcFType;

  return `
  <!-- Filter toolbar -->
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:12px">
    <i class="fas fa-filter" style="font-size:10px;color:var(--text-muted)"></i>
    ${mkBcDd('doi','— Đội —',_bcFDoi, allDois.map(v=>({v,l:v})), v=>v)}
    ${mkBcDd('tram','— Trạm —',_bcFTram, allTrams.map(v=>({v,l:v})), v=>v)}
    ${mkBcDd('year','Năm',_bcFYear, yearList.map(v=>({v:String(v),l:String(v)})), v=>v)}
    ${mkBcDd('month','Tháng',_bcFMonth, monthList.map(v=>({v:String(v),l:`Tháng ${v}`})), v=>`T${v}`)}
    ${mkBcDd('type','Loại thiết bị',_bcFType, allTypes.map(v=>({v,l:v})), v=>v)}
    ${hasFilter ? `<button onclick="_bcFDoi='';_bcFTram='';_bcFYear='';_bcFMonth='';_bcFType='';bcRenderPage(window._bcLastConf||{rpt:'by_month',icon:'fa-chart-bar',color:'#00c8ff'},'Khối lượng theo tháng')" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(255,82,82,.3);background:rgba(255,82,82,.1);color:#ff5252;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-times"></i> Xóa lọc</button>` : ''}
    <span style="margin-left:auto;font-size:10px;font-family:var(--font-mono);color:var(--text-muted)">${fmt(data.length)} bản ghi</span>
  </div>

  ${(()=>{
    const _nd=new Date(),_ny=_nd.getFullYear(),_nm=_nd.getMonth()+1;
    const _xm=_nm===12?1:_nm+1,_xy=_nm===12?_ny+1:_ny;
    const _tc=rawData.filter(r=>{const ds=r.Thoi_gian_thi_nghiem_tiep_theo;if(!ds)return false;const d=new Date(ds);return d.getFullYear()===_ny&&d.getMonth()+1===_nm;}).length;
    const _nc=rawData.filter(r=>{const ds=r.Thoi_gian_thi_nghiem_tiep_theo;if(!ds)return false;const d=new Date(ds);return d.getFullYear()===_xy&&d.getMonth()+1===_xm;}).length;
    const _sc=(icon,col,bg,brd,lbl,val,pct,key)=>`<div style="background:${bg};border:1px solid ${brd};border-radius:8px;padding:10px 14px;cursor:pointer;transition:all .15s" onclick="_bcStatClick('${key}',rawData)" onmouseenter="this.style.borderColor='${col}'" onmouseleave="this.style.borderColor='${brd}'">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas ${icon}" style="margin-right:4px;color:${col}"></i>${lbl}</div>
      <div style="font-size:22px;font-weight:800;font-family:var(--font-mono);color:${col};margin-bottom:6px">${fmt(val)}</div>
      <div style="height:3px;border-radius:2px;background:rgba(255,255,255,.08)"><div style="height:100%;width:${Math.min(100,pct)}%;background:${col};border-radius:2px;transition:width .4s"></div></div>
    </div>`;
    return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${_sc('fa-database','#00c8ff','rgba(0,200,255,.07)','rgba(0,200,255,.2)','Tổng số thiết bị',rawData.length,100,'total')}
      ${_sc('fa-calendar-check','#00e676','rgba(0,230,118,.07)','rgba(0,230,118,.2)',`Phải TN tháng ${_nm}/${_ny}`,_tc,Math.min(100,_tc/Math.max(rawData.length,1)*1000),'thismon')}
      ${_sc('fa-calendar-plus','#ffd740','rgba(255,215,64,.07)','rgba(255,215,64,.2)',`Phải TN tháng ${_xm}/${_xy}`,_nc,Math.min(100,_nc/Math.max(rawData.length,1)*1000),'nextmon')}
    </div>`;
  })()}

  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:12px">BIỂU ĐỒ KHỐI LƯỢNG THEO THÁNG</div>
    ${_bcBarChart(months.slice(-24), 'Theo tháng', d => {
      const age = new Date().getFullYear() - d.year;
      return age === 0 ? '#00e676' : age === 1 ? '#00c8ff' : '#607d8b';
    })}
  </div>

  <!-- ── MẪU BÁO CÁO KL TN ĐỊNH KỲ THEO PDF ── -->
  ${(()=>{
    const nowY2=new Date().getFullYear(), nowM2=new Date().getMonth()+1;
    // Group by device type + sub-cap: MBA > 220kV, MBA > 110kV, MBA > TD, MC > 110kV, MC > TA...
    // Use Phan_loai_thiet_bi + Cap_dien_ap for rows
    const CAP_LBL = {'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
    const DVT_MAP = {
      'MBA':'máy','MC':'máy','DCL':'bộ','DTD':'bộ','CSV':'bộ','Cáp':'sợi',
      'TU':'máy','TI':'máy','TBN':'quả','MBA điện áp':'máy','GIS':'bộ',
    };
    // Define display order from PDF
    const PDF_ROWS = [
      {type:'MBA',    cap:'2', label:'MBA 220kV',          dvt:'máy'},
      {type:'MBA',    cap:'1', label:'MBA 110kV',          dvt:'máy'},
      {type:'MBA',    cap:'0', label:'MBA Tự dùng (TD)',   dvt:'máy'},
      {type:'MC',     cap:'1', label:'MC 110kV',           dvt:'máy'},
      {type:'MC',     cap:null,label:'MC Trung áp',        dvt:'máy'},
      {type:'GIS',    cap:null,label:'GIS',                dvt:'bộ'},
      {type:'DCL',    cap:'1', label:'DCL 110kV',          dvt:'bộ'},
      {type:'DCL',    cap:null,label:'DCL Trung áp',       dvt:'bộ'},
      {type:'DTD',    cap:'1', label:'DTD 3pha 110kV',     dvt:'bộ'},
      {type:'DTD',    cap:null,label:'DTD 3pha Trung áp',  dvt:'bộ'},
      {type:'CSV',    cap:'1', label:'CSV 110kV',          dvt:'bộ'},
      {type:'CSV',    cap:null,label:'CSV Trung áp',       dvt:'bộ'},
      {type:'Cáp',    cap:null,label:'Cáp lực trung thế',  dvt:'sợi'},
      {type:'TU',     cap:'1', label:'TU 110kV',           dvt:'máy'},
      {type:'TU',     cap:null,label:'TU Trung áp',        dvt:'máy'},
      {type:'TI',     cap:'1', label:'TI 110kV',           dvt:'máy'},
      {type:'TI',     cap:null,label:'TI Trung áp',        dvt:'máy'},
      {type:'TBN',    cap:null,label:'Tụ bù (TBN)',         dvt:'quả'},
    ];

    // For each PDF row, compute: tongDuKien (plan), thang[1..12] (done by month), luyKe, tyLe
    function getPdfRowData(pdfRow) {
      const yearFilter = _bcFYear ? Number(_bcFYear) : nowY2;
      // Plan = Thoi_gian_thi_nghiem_tiep_theo in target year
      // Done = Ngay_thi_nghiem in target year
      const match = r => {
        const pl = (r.Phan_loai_thiet_bi||'').trim();
        if (pl !== pdfRow.type) return false;
        if (pdfRow.cap !== null && String(r.Cap_dien_ap??'') !== pdfRow.cap) return false;
        if (pdfRow.cap === null) {
          // Trung áp = NOT the specific caps above for this type
          const siblingCaps = PDF_ROWS.filter(p=>p.type===pdfRow.type&&p.cap!==null).map(p=>p.cap);
          if (siblingCaps.includes(String(r.Cap_dien_ap??''))) return false;
        }
        return true;
      };
      const planRows = data.filter(r => {
        if (!match(r)) return false;
        const ds = r.Thoi_gian_thi_nghiem_tiep_theo;
        if (!ds) return false;
        const d = new Date(ds);
        return d.getFullYear() === yearFilter;
      });
      const doneRows = data.filter(r => {
        if (!match(r)) return false;
        const ds = r.Ngay_thi_nghiem;
        if (!ds) return false;
        const d = new Date(ds);
        return d.getFullYear() === yearFilter;
      });
      // Count by month (use So_luong if available, else 1)
      const countQty = rows => rows.reduce((s,r)=>s+(Number(r.So_luong)||1),0);
      const tongDuKien = countQty(planRows);
      const byMonth = {};
      for(let m=1;m<=12;m++) byMonth[m]=0;
      doneRows.forEach(r=>{
        const d=new Date(r.Ngay_thi_nghiem);
        const m=d.getMonth()+1;
        byMonth[m]+=(Number(r.So_luong)||1);
      });
      const luyKe = Object.values(byMonth).reduce((s,v)=>s+v,0);
      const tyLe = tongDuKien>0?((luyKe/tongDuKien)*100).toFixed(1)+'%':'—';
      const conLai = Math.max(0, tongDuKien - luyKe);
      return { tongDuKien, byMonth, luyKe, tyLe, conLai };
    }

    const months12 = Array.from({length:12},(_,i)=>i+1);
    const yearFilter2 = _bcFYear ? Number(_bcFYear) : nowY2;

    const thStyle = 'padding:4px 6px;font-size:8.5px;font-weight:700;color:var(--text-muted);border:1px solid rgba(255,255,255,.08);text-align:center;white-space:nowrap;background:rgba(255,255,255,.04)';
    const tdStyle = v => `padding:3px 6px;font-size:9px;font-family:var(--font-mono);border:1px solid rgba(255,255,255,.06);text-align:right;color:${v>0?'rgba(200,230,220,.9)':'rgba(255,255,255,.2)'}`;
    const tdStylePlan = v => `padding:3px 6px;font-size:9px;font-family:var(--font-mono);border:1px solid rgba(255,255,255,.06);text-align:right;color:${v>0?'var(--accent)':'rgba(255,255,255,.2)'}`;
    const tdStylePct = pct => {
      const n = parseFloat(pct);
      const col = isNaN(n)?'rgba(255,255,255,.3)':n>=100?'#00e676':n>=80?'var(--accent)':n>=50?'#ffd740':'#ff5252';
      return `padding:3px 6px;font-size:9px;font-family:var(--font-mono);border:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:${col}`;
    };

    const tableRows = PDF_ROWS.map((row, i) => {
      const d = getPdfRowData(row);
      const monthCells = months12.map(m => {
        const v = d.byMonth[m];
        return `<td style="${tdStyle(v)}">${v||'—'}</td>`;
      }).join('');
      const highlight = d.tongDuKien===0 ? 'opacity:.45' : '';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,.05);${highlight}">
        <td style="padding:3px 6px;font-size:9px;border:1px solid rgba(255,255,255,.06);text-align:center;color:rgba(255,255,255,.4)">${i+1}</td>
        <td style="padding:3px 8px;font-size:9px;border:1px solid rgba(255,255,255,.06);color:rgba(215,230,245,.9);white-space:nowrap">${row.label}</td>
        <td style="padding:3px 6px;font-size:9px;border:1px solid rgba(255,255,255,.06);text-align:center;color:rgba(255,255,255,.4)">${row.dvt}</td>
        <td style="${tdStylePlan(d.tongDuKien)}">${d.tongDuKien||'—'}</td>
        ${monthCells}
        <td style="${tdStylePlan(d.luyKe)}">${d.luyKe||'—'}</td>
        <td style="${tdStylePct(d.tyLe)}">${d.tyLe}</td>
        <td style="${tdStyle(d.conLai)}">${d.conLai||'—'}</td>
      </tr>`;
    }).join('');

    return `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em">
          MẪU KHỐI LƯỢNG TN ĐỊNH KỲ NĂM ${_bcFYear || yearFilter2}
        </div>
        <span style="font-size:9px;color:rgba(0,200,255,.6)">Cập nhật: ${new Date().toLocaleDateString('vi-VN')}</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:9px">
          <thead>
            <tr>
              <th style="${thStyle}" rowspan="2">TT</th>
              <th style="${thStyle}" rowspan="2">Thiết bị TN, kiểm định</th>
              <th style="${thStyle}" rowspan="2">ĐVT</th>
              <th style="${thStyle}" rowspan="2">Tổng số<br>dự kiến</th>
              <th style="${thStyle}" colspan="12">Đã thực hiện trong tháng</th>
              <th style="${thStyle}" rowspan="2">Lũy kế<br>thực hiện</th>
              <th style="${thStyle}" rowspan="2">Tỷ lệ<br>hoàn thành</th>
              <th style="${thStyle}" rowspan="2">Còn lại</th>
            </tr>
            <tr>
              ${months12.map(m=>`<th style="${thStyle}">T${m}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>`;
  })()}
>`;
}

// ── DROPDOWN HANDLER for by-month report ──────────────────────
function _bcBmDropdown(btn, key) {
  const _s=(window._bcDdStore||{})[key]||{items:[],dflt:''};
  const items=_s.items, dflt=_s.dflt;
  const ex = document.getElementById('_bcBmDdList');
  if (ex) { if (ex.dataset.key===key) { ex.remove(); return; } ex.remove(); }
  const list = document.createElement('div');
  list.id = '_bcBmDdList'; list.dataset.key = key;
  list.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-surface,#161b22);border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.6);min-width:200px;max-height:320px;overflow-y:auto;flex-direction:column;padding:4px 0;display:flex';
  // Search
  if (items.length > 8) {
    const si = document.createElement('input'); si.type='text'; si.placeholder='🔍 Tìm...';
    si.style.cssText='margin:6px 8px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:11px;outline:none';
    si.oninput = ev => { const q=ev.target.value.toLowerCase(); list.querySelectorAll('.bc-dd-item').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?'':'none';}); };
    si.onclick = ev => ev.stopPropagation(); list.appendChild(si);
  }
  function mkI(v,l) {
    const d = document.createElement('div'); d.className='bc-dd-item';
    d.style.cssText='padding:7px 14px;cursor:pointer;font-size:11px;color:var(--text-primary);white-space:nowrap;transition:background .1s';
    d.textContent=l;
    d.onmouseenter=()=>{d.style.background='rgba(255,255,255,.07)';}; d.onmouseleave=()=>{d.style.background='';};
    d.onclick = () => {
      if (key==='doi')   _bcFDoi=v;
      else if(key==='tram') _bcFTram=v;
      else if(key==='year') _bcFYear=v;
      else if(key==='month') _bcFMonth=v;
      else if(key==='type') _bcFType=v;
      list.remove(); document.removeEventListener('click',oc);
      const conf = window._bcLastConf||{rpt:'by_month',icon:'fa-chart-bar',color:'#00c8ff'};
      bcRenderPage(conf,'Khối lượng theo tháng');
    };
    list.appendChild(d);
  }
  mkI('',dflt);
  items.forEach(it => typeof it==='object' ? mkI(it.v,it.l) : mkI(it,it));
  document.body.appendChild(list);
  const rb = btn.getBoundingClientRect();
  list.style.top=(rb.bottom+4)+'px'; list.style.left=rb.left+'px';
  let oc; oc=ev=>{if(!list.contains(ev.target)&&ev.target!==btn){list.remove();document.removeEventListener('click',oc);}};
  setTimeout(()=>document.addEventListener('click',oc),0);
}

// ── BÁO CÁO: KL THEO NĂM ─────────────────────────────────────
function _bcRenderByYear(conf) {
  const data = _tnRawData.length ? _tnRawData : _tnAllData;
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const nowY = new Date().getFullYear();

  const yearMap = {};
  const yearTypeMap = {};
  data.forEach(r => {
    const dateStr = r.Ngay_thi_nghiem || r.Thoi_gian_thi_nghiem_tiep_theo;
    if (!dateStr) return;
    const y = new Date(dateStr).getFullYear();
    if (isNaN(y)) return;
    yearMap[y] = (yearMap[y]||0) + 1;
    const pl = (r.Phan_loai_thiet_bi||'Khác').trim();
    if (!yearTypeMap[y]) yearTypeMap[y] = {};
    yearTypeMap[y][pl] = (yearTypeMap[y][pl]||0)+1;
  });

  const years = Object.keys(yearMap).map(Number).sort((a,b)=>a-b);
  const allTypes = [...new Set(data.map(r=>(r.Phan_loai_thiet_bi||'Khác').trim()))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
  const COLORS = ['#00c8ff','#00e676','#ffd740','#ff9100','#b388ff','#18ffff','#ff4081','#00bcd4','#8bc34a','#ff5252'];

  return `
  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:12px">BIỂU ĐỒ KHỐI LƯỢNG THEO NĂM</div>
    ${_bcBarChart(years.map(y=>({label:String(y), v:yearMap[y]})), 'Theo năm', d=>{
      const y = parseInt(d.label);
      return y === nowY ? '#00e676' : y === nowY-1 ? '#00c8ff' : y < nowY-2 ? '#607d8b' : '#ffd740';
    })}
  </div>

  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:10px">CHI TIẾT THEO NĂM × LOẠI THIẾT BỊ</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead><tr style="background:rgba(255,255,255,.03)">
          <th style="padding:6px 10px;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;position:sticky;top:0;min-width:70px">Năm</th>
          ${allTypes.slice(0,15).map((t,i)=>`<th style="padding:6px 10px;font-size:9px;font-weight:700;color:${COLORS[i%COLORS.length]};text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;position:sticky;top:0;white-space:nowrap">${t}</th>`).join('')}
          <th style="padding:6px 10px;font-size:9px;font-weight:700;color:var(--accent);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;position:sticky;top:0">Tổng</th>
        </tr></thead>
        <tbody>${years.slice().reverse().map(y=>{
          const tMap = yearTypeMap[y]||{};
          return `<tr style="border-bottom:1px solid rgba(255,255,255,.04);${y===nowY?'background:rgba(0,230,118,.04)':''}">
            <td style="padding:5px 10px;font-weight:700;font-family:var(--font-mono);color:${y===nowY?'#00e676':y===nowY-1?'var(--accent)':'var(--text-primary)'}">${y}</td>
            ${allTypes.slice(0,15).map((t,i)=>`<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:${tMap[t]?COLORS[i%COLORS.length]:'rgba(255,255,255,.15)'}">${tMap[t]||'—'}</td>`).join('')}
            <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent)">${yearMap[y]}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

// ── BÁO CÁO: THIẾT BỊ QUÁ HẠN ───────────────────────────────
function _bcRenderOverdue(conf) {
  const data = _tnRawData.length ? _tnRawData : _tnAllData;
  const overdueRows = data.filter(r => {
    if (_bcIsCSV(r)) return false;
    return _tnAlertStatus(r).level === 'overdue';
  });

  const fmt = n => Number(n).toLocaleString('vi-VN');
  const colDefs = [
    { k:'Tram', l:'Trạm', w:'90px' },
    { k:'Cap_dien_ap', l:'Cấp ĐA', w:'65px', render: r => _bcCapBadge(r.Cap_dien_ap) },
    { k:'Phan_loai_thiet_bi', l:'Loại TB', w:'90px' },
    { k:'Ten_thiet_bi', l:'Tên thiết bị', w:'130px' },
    { k:'Loai_ngan_lo', l:'Ngăn', w:'120px' },
    { k:'So_luong', l:'SL', w:'44px', num:1 },
    { k:'Han_thi_nghiem', l:'Hạn TN', w:'60px', render: r => r.Han_thi_nghiem ? `${r.Han_thi_nghiem} năm` : '—' },
    { k:'Thoi_gian_thi_nghiem_tiep_theo', l:'Ngày đến hạn', w:'100px',
      render: r => {
        const s = _tnAlertStatus(r);
        return `<span style="color:#ff5252;font-weight:700;font-family:var(--font-mono);font-size:10px">${_bcFmtD(r.Thoi_gian_thi_nghiem_tiep_theo)}</span><span style="color:#ff5252;font-size:9px;margin-left:4px">(${Math.abs(s.diffDays||0)} ngày)</span>`;
      }
    },
    { k:'Ngay_thi_nghiem', l:'Ngày TN thực tế', w:'100px', render: r => `<span style="font-family:var(--font-mono);font-size:10px">${_bcFmtD(r.Ngay_thi_nghiem)}</span>` },
    { k:'Thoi_gian_thi_nghiem_truoc', l:'TN trước đó', w:'95px', render: r => `<span style="font-family:var(--font-mono);font-size:10px">${_bcFmtD(r.Thoi_gian_thi_nghiem_truoc)}</span>` },
    { k:'Ghi_chu', l:'Ghi chú', w:'130px' },
  ];

  return `
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">
    <div style="background:rgba(255,82,82,.1);border:1px solid rgba(255,82,82,.3);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:#ff5252;margin-bottom:4px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Tổng thiết bị quá hạn (trừ CSV)</div>
      <div style="font-size:24px;font-weight:800;font-family:var(--font-mono);color:#ff5252">${fmt(overdueRows.length)}</div>
    </div>
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-microchip" style="margin-right:4px"></i>Số loại thiết bị quá hạn</div>
      <div style="font-size:24px;font-weight:800;font-family:var(--font-mono);color:var(--accent)">${new Set(overdueRows.map(r=>(r.Phan_loai_thiet_bi||'').trim())).size}</div>
    </div>
  </div>
  ${_bcGroupedTable(overdueRows, colDefs)}`;
}

// ── BÁO CÁO: THIẾT BỊ ĐẶT SỚM ───────────────────────────────
function _bcRenderEarlyPlan(conf) {
  const data = _tnRawData.length ? _tnRawData : _tnAllData;
  const earlyRows = data.filter(r => {
    if (_bcIsCSV(r)) return false;
    const s = _tnAlertStatus(r);
    return s.level === 'early';
  });

  const fmt = n => Number(n).toLocaleString('vi-VN');
  const colDefs = [
    { k:'Tram', l:'Trạm', w:'90px' },
    { k:'Cap_dien_ap', l:'Cấp ĐA', w:'65px', render: r => _bcCapBadge(r.Cap_dien_ap) },
    { k:'Phan_loai_thiet_bi', l:'Loại TB', w:'90px' },
    { k:'Ten_thiet_bi', l:'Tên thiết bị', w:'130px' },
    { k:'Loai_ngan_lo', l:'Ngăn', w:'120px' },
    { k:'So_luong', l:'SL', w:'44px', num:1 },
    { k:'Han_thi_nghiem', l:'Hạn TN', w:'60px', render: r => r.Han_thi_nghiem ? `${r.Han_thi_nghiem} năm` : '—' },
    { k:'Thoi_gian_thi_nghiem_truoc', l:'TN gần nhất', w:'100px',
      render: r => `<span style="font-family:var(--font-mono);font-size:10px;color:var(--accent)">${_bcFmtD(r.Thoi_gian_thi_nghiem_truoc)}</span>`
    },
    { k:'Thoi_gian_thi_nghiem_tiep_theo', l:'TN tiếp theo', w:'100px',
      render: r => {
        const s = _tnAlertStatus(r);
        const truoc = r.Thoi_gian_thi_nghiem_truoc ? new Date(r.Thoi_gian_thi_nghiem_truoc) : null;
        const tiep  = r.Thoi_gian_thi_nghiem_tiep_theo ? new Date(r.Thoi_gian_thi_nghiem_tiep_theo) : null;
        const han   = (Number(r.Han_thi_nghiem)||0)*365;
        const interval = truoc && tiep ? Math.round((tiep-truoc)/86400000) : null;
        const ratioStr = interval && han ? `${(interval/365).toFixed(1)} năm / ${r.Han_thi_nghiem} năm` : '';
        return `<span style="font-family:var(--font-mono);font-size:10px">${_bcFmtD(r.Thoi_gian_thi_nghiem_tiep_theo)}</span>
          ${ratioStr?`<span style="font-size:8px;color:#00c8ff;margin-left:4px">↑${ratioStr}</span>`:''}`;
      }
    },
    { k:'Ngay_thi_nghiem', l:'Ngày TN thực tế', w:'100px', render: r => `<span style="font-family:var(--font-mono);font-size:10px">${_bcFmtD(r.Ngay_thi_nghiem)}</span>` },
    { k:'Nam_ke_hoach', l:'Năm KH', w:'60px', num:1 },
    { k:'Ghi_chu', l:'Ghi chú', w:'130px' },
  ];

  return `
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">
    <div style="background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.25);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:#00c8ff;margin-bottom:4px"><i class="fas fa-forward" style="margin-right:4px"></i>Tổng thiết bị đặt sớm</div>
      <div style="font-size:24px;font-weight:800;font-family:var(--font-mono);color:#00c8ff">${fmt(earlyRows.length)}</div>
    </div>
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px"><i class="fas fa-info-circle" style="margin-right:4px"></i>Khoảng cách TN ngắn hơn hạn >15%</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Tính theo (TN tiếp theo − TN trước) < Hạn × 85%</div>
    </div>
  </div>
  ${_bcGroupedTable(earlyRows, colDefs)}`;
}


// ── BC STAT CARD CLICK ────────────────────────────────────────
function _bcStatClick(key, data) {
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const fmtD = v => { if(!v) return '—'; const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}); };
  const rawAll=_tnRawData.length?_tnRawData:(_tnAllData.length?_tnAllData:[]);
  const _cL={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const _cC={'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
  let title='', totalLine='', bodyHtml='', col='var(--accent)';

  if(key==='thismon'||key==='nextmon'){
    const now=new Date(),nowY=now.getFullYear(),nowM=now.getMonth()+1;
    const tM=key==='thismon'?nowM:(nowM===12?1:nowM+1),tY=key==='thismon'?nowY:(nowM===12?nowY+1:nowY);
    col=key==='thismon'?'#00e676':'#ffd740';
    title=`📅 Phải TN tháng ${tM}/${tY}`;
    const filtered=rawAll.filter(r=>{const ds=r.Thoi_gian_thi_nghiem_tiep_theo;if(!ds)return false;const d=new Date(ds);return d.getFullYear()===tY&&d.getMonth()+1===tM;});
    const byType={};
    filtered.forEach(r=>{const tp=(r.Phan_loai_thiet_bi||'Khác').trim(),t=(r.Tram||'—').trim();if(!byType[tp])byType[tp]={total:0,trams:{}};byType[tp].total++;if(!byType[tp].trams[t])byType[tp].trams[t]=[];byType[tp].trams[t].push(r);});
    const types=Object.keys(byType).sort((a,b)=>byType[b].total-byType[a].total);
    totalLine=`${fmt(filtered.length)} thiết bị · ${types.length} loại · ${new Set(filtered.map(r=>(r.Tram||'').trim())).size} trạm`;
    const items2=types.map(tp=>{
      const ti=byType[tp],trams=Object.keys(ti.trams).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}));
      const detail=trams.map(t=>{const rs=ti.trams[t];return `${t} [${_cL[String(rs[0]?.Cap_dien_ap??'')] ||''}] — ${rs.length} TB: ${rs.slice(0,3).map(r=>r.Ten_thiet_bi||r.Ngan_thiet_bi||'—').join(', ')}${rs.length>3?'…':''}`;});
      return {text:tp,badge:`${fmt(ti.total)}`,color:col,detail};
    });
    _lytShowDetailPanel(title,col,totalLine,items2); return;
  }

  if (key === 'total') {
    col='#00c8ff'; title='📋 Tổng bản ghi thí nghiệm';
    const byType={};
    data.forEach(r=>{const pl=(r.Phan_loai_thiet_bi||'Khác').trim(); byType[pl]=(byType[pl]||0)+1;});
    const sorted=Object.entries(byType).sort((a,b)=>b[1]-a[1]);
    totalLine=`${fmt(data.length)} bản ghi · ${sorted.length} loại`;
    bodyHtml=sorted.map(([pl,cnt])=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:10px;color:var(--text-secondary)">${pl}</span>
        <span style="font-size:9px;font-weight:700;color:#00c8ff;background:rgba(0,200,255,.1);padding:2px 8px;border-radius:10px">${fmt(cnt)}</span>
      </div>`).join('');
  } else if (key === 'done') {
    col='#00e676'; title='✅ Đã thí nghiệm (có ngày TN)';
    const done=data.filter(r=>r.Ngay_thi_nghiem).sort((a,b)=>new Date(b.Ngay_thi_nghiem)-new Date(a.Ngay_thi_nghiem));
    totalLine=`${fmt(done.length)} bản ghi có ngày TN`;
    const capCol={'2':'#1565c0','1':'#18ffff','3':'#00e676','4':'#e040fb','9':'#00e676','6':'#00e676','0':'#18ffff'};
    const capLbl={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
    bodyHtml=done.slice(0,150).map(r=>{
      const cap=String(r.Cap_dien_ap??'');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <div>
          <div style="font-size:10px;color:var(--text-secondary)">${r.Ten_thiet_bi||r.Phan_loai_thiet_bi||'—'}</div>
          <div style="font-size:9px;color:var(--text-muted)">${r.Tram||'—'}${cap&&cap!=='null'?' · <span style=\'color:'+capCol[cap]+'\'>'+capLbl[cap]+'</span>':''}</div>
        </div>
        <span style="font-size:9px;color:#00e676;font-family:var(--font-mono)">${fmtD(r.Ngay_thi_nghiem)}</span>
      </div>`;
    }).join('')+(done.length>150?`<div style="padding:8px 16px;text-align:center;font-size:9px;color:var(--text-muted)">...và ${done.length-150} bản ghi khác</div>`:'');
  } else if (key === 'months') {
    col='#ffd740'; title='📅 Các tháng có thí nghiệm';
    const monthMap={};
    data.forEach(r=>{
      const ds=r.Ngay_thi_nghiem||r.Thoi_gian_thi_nghiem_tiep_theo; if(!ds) return;
      const d=new Date(ds); if(isNaN(d)) return;
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const lbl=`Tháng ${d.getMonth()+1}/${d.getFullYear()}`;
      if(!monthMap[k]) monthMap[k]={label:lbl,count:0};
      monthMap[k].count++;
    });
    const sorted=Object.keys(monthMap).sort().reverse().map(k=>({...monthMap[k],key:k}));
    const maxC=Math.max(...sorted.map(m=>m.count),1);
    totalLine=`${sorted.length} tháng · ${fmt(data.length)} bản ghi`;
    bodyHtml=sorted.map(m=>`
      <div style="padding:7px 16px;border-bottom:1px solid rgba(255,255,255,.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:10px;color:var(--text-secondary)">${m.label}</span>
          <span style="font-size:9px;font-weight:700;color:#ffd740">${fmt(m.count)}</span>
        </div>
        <div style="height:2px;border-radius:1px;background:rgba(255,255,255,.08)">
          <div style="height:100%;width:${Math.round(m.count/maxC*100)}%;background:#ffd740;border-radius:1px"></div>
        </div>
      </div>`).join('');
  }

  let p=document.getElementById('hm-detail-panel');
  if(!p){p=document.createElement('div');p.id='hm-detail-panel';p.className='hm-detail-panel';document.body.appendChild(p);}
  p.innerHTML=`
    <div class="hm-resize-grip"></div>
    <div class="hm-detail-hd" style="border-left:3px solid ${col}">
      <span style="color:${col}">${title}</span>
      <span class="hm-detail-close" onclick="this.closest('.hm-detail-panel').classList.remove('open');let bd=document.getElementById('hm-detail-backdrop');if(bd)bd.style.display='none'">✕</span>
    </div>
    <div style="padding:8px 16px;font-size:9px;color:var(--text-muted);font-family:var(--font-mono);border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">${totalLine}</div>
    <div id="hm-detail-body" style="overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain">${bodyHtml||'<div style=\"padding:24px;text-align:center;color:var(--text-muted)\">Không có dữ liệu</div>'}</div>`;
  p.classList.add('open');
  _hmOpenPanel(p);
}
// ── MAIN RENDER BÁOCÁO ────────────────────────────────────────
function bcRenderPage(conf, title) {
  window._bcLastConf = conf; // store for filter reset
  const overlay = document.getElementById('tbPageOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div style="padding:0 0 32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:34px;height:34px;border-radius:8px;background:${conf.color}22;color:${conf.color};display:flex;align-items:center;justify-content:center">
          <i class="fas ${conf.icon}" style="font-size:15px"></i>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">${title}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Nguồn: <span style="color:var(--accent);font-family:var(--font-mono)">CongTacThiNghiem</span> · ${new Date().toLocaleDateString('vi-VN')}</div>
        </div>
        <button onclick="navActivate(document.querySelector('.nav-item'))" style="margin-left:auto;padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary);font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <i class="fas fa-arrow-left"></i> Dashboard
        </button>
      </div>
      <div id="_bcContent"><div style="padding:40px;text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang xử lý dữ liệu...</div></div>
    </div>`;

  // Load data if not already loaded
  const doRender = () => {
    const el = document.getElementById('_bcContent');
    if (!el) return;
    let html = '';
    if (conf.rpt === 'by_month')   html = _bcRenderByMonth(conf);
    else if (conf.rpt === 'by_year') html = _bcRenderByYear(conf);
    else if (conf.rpt === 'overdue') html = _bcRenderOverdue(conf);
    else if (conf.rpt === 'early_plan') html = _bcRenderEarlyPlan(conf);
    el.innerHTML = html || '<div style="padding:30px;text-align:center;color:var(--text-muted)">Không có dữ liệu</div>';
  };

  if (_tnRawData.length || _tnAllData.length) {
    doRender();
  } else {
    _tnFetchData().then(rows => {
      _tnRawData = rows;
      _tnAllData = rows;
      doRender();
    });
  }
}

// ── TNDX — same as TNĐK but filters by dot xuat ──────────────
// tnRenderPage already handles mode:'dotxuat' — no changes needed


/* ════════════════════════════════════════════════════════════════
   PHẦN 2: AUTH + ASSETS + NAS Config (gộp từ inline script 2)
════════════════════════════════════════════════════════════════ */

// AUTH -- Supabase Auth (signInWithPassword)
// Cach su dung:
// 1. Supabase Dashboard > Authentication > Users > Add user (nhap email + password)
// 2. Chay SQL: insert into evn_user_profiles(id,email,name,role) select id,email,'Ten','\'user\'' from auth.users where email='...';
// 3. Hoac dung nut Them tai khoan trong Bang Admin
const _AUTH_SB_URL='https://xqqmfmljwycpehfyknoy.supabase.co';
const _AUTH_SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';
const _AUTH_LOG_KEY='evn_audit_log_v1';
let _authSb=null;
function _getAuthSb(){if(!_authSb&&window.supabase&&window.supabase.createClient)_authSb=window.supabase.createClient(_AUTH_SB_URL,_AUTH_SB_KEY);return _authSb;}
// Khởi tạo _sbClient NGAY khi script load (không đợi DOMContentLoaded/login)
// → các module Asset / TNĐK / Update Requests luôn có _sbClient sẵn sàng
try { window._sbClient = _getAuthSb(); } catch(e) { console.warn('_sbClient init failed:', e); }

// ════════════════════════════════════════════════════════════════
// Tối ưu #16: Error Monitoring - log lỗi tự động vào Supabase
// - Capture lỗi JS không bắt được (window.onerror)
// - Capture promise rejection (unhandledrejection)
// - Throttle: tối đa 1 lỗi/giây để tránh spam DB
// - Filter: bỏ qua lỗi từ extension trình duyệt
// ════════════════════════════════════════════════════════════════

const _errorLogState = {
  lastLogTime: 0,
  recentErrors: new Set(),  // dedup trong 5 giây
};

function _shouldLogError(msg, source) {
  // Bỏ qua extension trình duyệt
  if (source && /\b(chrome-extension|moz-extension|onboarding\.js|edge-extension)\b/i.test(source)) return false;
  // Bỏ qua lỗi từ CDN bên ngoài (jsdelivr, font-awesome, ...) — không phải lỗi mình
  if (source && /\b(cdn\.jsdelivr|cdnjs\.cloudflare|fonts\.googleapis)\b/i.test(source)) return false;
  // Bỏ qua lỗi quá ngắn / không có thông tin
  if (!msg || msg.length < 5) return false;
  // Throttle: 1 lỗi / giây
  const now = Date.now();
  if (now - _errorLogState.lastLogTime < 1000) return false;
  // Dedup: cùng 1 lỗi trong 5 giây → bỏ qua
  const key = msg.slice(0, 100);
  if (_errorLogState.recentErrors.has(key)) return false;
  _errorLogState.recentErrors.add(key);
  setTimeout(() => _errorLogState.recentErrors.delete(key), 5000);
  _errorLogState.lastLogTime = now;
  return true;
}

async function _logError(payload) {
  if (!_shouldLogError(payload.message, payload.source)) return;
  try {
    if (!window._sbClient) return;
    const user = _authCurrentUser();
    await window._sbClient.from('error_logs').insert({
      error_type:  payload.type || 'js_error',
      message:     String(payload.message || '').slice(0, 500),
      stack:       String(payload.stack || '').slice(0, 2000),
      url:         String(payload.source || location.href).slice(0, 300),
      user_id:     user?.id || null,
      user_email:  user?.email || null,
      user_agent:  navigator.userAgent.slice(0, 300),
    });
  } catch (e) {
    // Đừng để error monitoring tự gây error
    console.warn('[errorLog] Failed:', e);
  }
}

// Bắt lỗi JS không catch
window.addEventListener('error', (event) => {
  _logError({
    type:    'js_error',
    message: event.message,
    stack:   event.error?.stack,
    source:  event.filename || event.target?.src,
  });
});

// Bắt promise rejection không catch
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  _logError({
    type:    'promise_rejection',
    message: reason?.message || String(reason),
    stack:   reason?.stack,
    source:  location.href,
  });
});

// Expose helper để code khác có thể log lỗi chủ động
window._logError = _logError;

function _authCurrentUser(){try{return JSON.parse(sessionStorage.getItem('evn_sess_v3'));}catch{return null;}}
function _authSaveSession(u){sessionStorage.setItem('evn_sess_v3',JSON.stringify(u));}
function _authClearSession(){sessionStorage.removeItem('evn_sess_v3');}

/** Alias để tương thích với code dùng _authGetSession() */
function _authGetSession() { return _authCurrentUser(); }

/** Lấy JWT access_token hiện tại, tự refresh qua Supabase nếu cần */
async function _authGetToken() {
  const sb = (typeof _getAuthSb === 'function') ? _getAuthSb() : null;
  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.access_token) {
        const sess = _authCurrentUser();
        if (sess) { sess.access_token = data.session.access_token; _authSaveSession(sess); }
        return data.session.access_token;
      }
    } catch (e) {}
  }
  return _authCurrentUser()?.access_token || '';
}
function _authGetLog(){try{return JSON.parse(localStorage.getItem(_AUTH_LOG_KEY)||'[]');}catch{return[];}}
function _authAddLog(a,d,u){const l=_authGetLog();l.unshift({ts:new Date().toISOString(),user:u||'?',action:a,detail:d});if(l.length>500)l.length=500;try{localStorage.setItem(_AUTH_LOG_KEY,JSON.stringify(l));}catch{}}

async function _authLogin(){
  const em=(document.getElementById('authUser').value||'').trim();
  const pw=document.getElementById('authPass').value||'';
  const errEl=document.getElementById('authErr');
  const btn=document.querySelector('.auth-btn');
  errEl.textContent='';
  if(!em||!pw){errEl.textContent='Vui long nhap day du thong tin';return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Dang dang nhap...';}
  try{
    const sb=_getAuthSb();
    if(!sb)throw new Error('Khong ket noi duoc Supabase');
    const{data,error}=await sb.auth.signInWithPassword({email:em,password:pw});
    if(error){
      const msg=error.message||'';
      if(msg.includes('Invalid login')||msg.includes('invalid_credentials'))errEl.textContent='Email hoac mat khau khong dung';
      else if(msg.includes('Email not confirmed'))errEl.textContent='Email chua xac nhan. Kiem tra hop thu.';
      else errEl.textContent='Loi: '+msg;
      return;
    }
    const u=data.user,meta=u.user_metadata||{};
    const role=meta.role||'user';
    const name=meta.name||meta.full_name||u.email.split('@')[0];
    const sess={id:u.id,email:u.email,username:u.email,name,role,loginAt:new Date().toISOString(),
                access_token:data.session?.access_token||''};
    _authSaveSession(sess);
    window._sbClient = _getAuthSb(); // ← khởi tạo _sbClient ngay sau login
    _authAddLog('LOGIN','Dang nhap thanh cong',sess.email);
    document.getElementById('authOverlay').style.display='none';
    _authInitUserMenu();
    _authApplyRoleUI(role);
    showChangeNotif('success','Dang nhap thanh cong','Xin chao '+name+'!');
    // Load pending requests for admin
    if (role === 'admin') setTimeout(_tnLoadPendingRequests, 500);
    // Xử lý URL approve_pwd nếu có (admin click email)
    setTimeout(() => { try { _checkApprovePwdUrl(); } catch(e){} }, 800);
  }catch(err){
    errEl.textContent='Loi ket noi: '+err.message;
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:6px"></i>Dang nhap';}
  }
}

document.addEventListener('DOMContentLoaded',async()=>{
  ['authUser','authPass'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter')_authLogin();});});
  try{
    const sb=_getAuthSb();
    const{data}=await sb.auth.getSession();
    if(data&&data.session&&data.session.user){
      const u=data.session.user,meta=u.user_metadata||{};
      const role=meta.role||'user';
      const name=meta.name||meta.full_name||u.email.split('@')[0];
      const sess={id:u.id,email:u.email,username:u.email,name,role,
                  access_token:data.session?.access_token||''};
      _authSaveSession(sess);
      window._sbClient = _getAuthSb(); // ← khởi tạo _sbClient khi restore session
      document.getElementById('authOverlay').style.display='none';
      _authInitUserMenu();
      _authApplyRoleUI(role);
      // Xử lý URL approve_pwd nếu có
      setTimeout(() => { try { _checkApprovePwdUrl(); } catch(e){} }, 800);
      return;
    }
  }catch{}
  const sess=_authCurrentUser();
  if(sess){
    window._sbClient = _getAuthSb(); // ← khởi tạo _sbClient từ sessionStorage
    document.getElementById('authOverlay').style.display='none';
    _authInitUserMenu();
    _authApplyRoleUI(sess.role);
    setTimeout(() => { try { _checkApprovePwdUrl(); } catch(e){} }, 800);
  }
});

async function _authLogout(){
  const sess=_authCurrentUser();
  if(sess)_authAddLog('LOGOUT','Da dang xuat',sess.email||sess.username);
  try{const sb=_getAuthSb();if(sb)await sb.auth.signOut();}catch{}
  _authClearSession();
  document.body.classList.remove('user-mode');
  const ca=document.getElementById('canvasArea');
  if(ca){ca.style.gridColumn='';ca.style.padding='';}
  document.getElementById('authOverlay').style.display='flex';
  document.getElementById('authUser').value='';
  document.getElementById('authPass').value='';
  const drop=document.getElementById('userMenuDropdown');
  if(drop)drop.classList.remove('open');
  const wrap=document.getElementById('_userMenuWrap');
  if(wrap)wrap.remove(); setTimeout(function(){ location.reload(); }, 100);
}

function _authInitUserMenu(){
  const sess=_authCurrentUser();if(!sess)return;
  const tb=document.querySelector('.topbar-actions');if(!tb)return;
  const old=document.getElementById('_userMenuWrap');if(old)old.remove();
  const wrap=document.createElement('div');wrap.id='_userMenuWrap';wrap.style.cssText='position:relative;';
  const adminBtn=sess.role==='admin'?'<div class="um-item" onclick="_openAdminPanel()"><i class="fas fa-shield-alt"></i> Bang Admin</div>':'';
  wrap.innerHTML=`<button id="userMenuBtn" onclick="_toggleUserMenu()">
    <i class="fas fa-user-circle"></i>
    <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sess.name}</span>
    <span class="auth-role-badge ${sess.role==='admin'?'auth-role-admin':'auth-role-user'}">${sess.role==='admin'?'ADMIN':'USER'}</span>
    <i class="fas fa-chevron-down" style="font-size:8px;opacity:.6"></i>
  </button>
  <div id="userMenuDropdown">
    <div class="um-header"><div class="um-name">${sess.name}</div><div class="um-email">${sess.email}</div></div>
    <div class="um-item" onclick="_openChangePassword()"><i class="fas fa-key"></i> Doi mat khau</div>
    ${adminBtn}
    ${sess.role==='admin'?'<div class="um-item" onclick="_toggleUserMenu();_nasOpenSettings()"><i class="fas fa-server" style="color:var(--accent)"></i> Cài đặt NAS <span style="font-size:8px;margin-left:4px;padding:1px 5px;border-radius:4px;background:'+(NAS_CONFIG.enabled?'rgba(0,230,118,.15)':'rgba(255,145,0,.15)')+';color:'+(NAS_CONFIG.enabled?'#00e676':'#ff9100')+'">'+(NAS_CONFIG.enabled?'●':'○')+'</span></div>':''}
    <div class="um-sep"></div>
    <div class="um-item danger" onclick="_authLogout()"><i class="fas fa-sign-out-alt"></i> Dang xuat</div>
  </div>`;
  tb.insertBefore(wrap,tb.firstChild);
  document.addEventListener('click',e=>{const d=document.getElementById('userMenuDropdown');if(d&&d.classList.contains('open')&&!wrap.contains(e.target))d.classList.remove('open');});
}
function _toggleUserMenu(){const d=document.getElementById('userMenuDropdown');if(d)d.classList.toggle('open');}

function _openChangePassword(){
  const drop=document.getElementById('userMenuDropdown');if(drop)drop.classList.remove('open');
  const ex=document.getElementById('_changePwModal');if(ex)ex.remove();
  const modal=document.createElement('div');modal.id='_changePwModal';
  modal.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`<div style="background:var(--bg-surface);border:1px solid var(--border-accent);border-radius:14px;padding:28px 32px;width:380px;box-shadow:0 8px 48px rgba(0,0,0,.7)">
    <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin-bottom:8px"><i class="fas fa-key" style="color:var(--accent);margin-right:8px"></i>Doi mat khau</div>
    <div style="font-size:10.5px;color:#ffd740;background:rgba(255,215,64,.07);border:1px solid rgba(255,215,64,.2);border-radius:6px;padding:8px 10px;margin-bottom:16px;line-height:1.5"><i class="fas fa-info-circle" style="margin-right:5px"></i>Yêu cầu sẽ được gửi qua email đến admin để duyệt. Sau khi admin duyệt, mật khẩu mới có hiệu lực.</div>
    <div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Mat khau hien tai</label><input id="_cpCur" type="password" class="auth-input" placeholder="Nhap mat khau dang dung"></div>
    <div style="margin-bottom:12px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Mat khau moi</label><input id="_cpNew" type="password" class="auth-input" placeholder="Toi thieu 6 ky tu"></div>
    <div style="margin-bottom:16px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Xac nhan mat khau moi</label><input id="_cpCfm" type="password" class="auth-input" placeholder="Nhap lai"></div>
    <div id="_cpErr" style="font-size:11px;color:var(--red);min-height:14px;margin-bottom:10px"></div>
    <div style="display:flex;gap:8px">
      <button class="auth-btn" style="flex:1" id="_cpBtn" onclick="_doChangePassword()">Gui yeu cau</button>
      <button onclick="document.getElementById('_changePwModal').remove()" style="flex:0.5;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer">Huy</button>
    </div></div>`;
  document.body.appendChild(modal);
}
async function _doChangePassword(){
  const cur=document.getElementById('_cpCur').value;
  const nw=document.getElementById('_cpNew').value,cf=document.getElementById('_cpCfm').value;
  const er=document.getElementById('_cpErr'),btn=document.getElementById('_cpBtn');
  er.textContent='';
  if(!cur){er.textContent='Nhap mat khau hien tai';return;}
  if(nw.length<6){er.textContent='Mat khau moi it nhat 6 ky tu';return;}
  if(nw!==cf){er.textContent='Xac nhan khong khop';return;}
  if(nw===cur){er.textContent='Mat khau moi phai khac mat khau cu';return;}
  if(btn){btn.disabled=true;btn.textContent='Dang gui yeu cau...';}
  try{
    const token=await _authGetToken();
    if(!token){er.textContent='Phien dang nhap het han, dang nhap lai';return;}
    const url=_AUTH_SB_URL.replace(/\/$/,'')+'/functions/v1/request-password-change';
    const resp=await fetch(url,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+token,
        'apikey':_AUTH_SB_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({current_password:cur,new_password:nw})
    });
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok){er.textContent=data.error||('Loi '+resp.status);return;}
    _authAddLog('PASSWORD_CHANGE_REQUEST','Gui yeu cau doi mat khau',(_authCurrentUser()||{}).email||'');
    document.getElementById('_changePwModal').remove();
    showChangeNotif('success','Da gui yeu cau','Cho admin duyet qua email mtuandat@gmail.com');
  }catch(err){er.textContent='Loi: '+err.message;}
  finally{if(btn){btn.disabled=false;btn.textContent='Gui yeu cau';}}
}

/** Xử lý URL ?approve_pwd=<token>&action=approve|reject khi admin click email */
async function _checkApprovePwdUrl(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('approve_pwd');
  const action=params.get('action');
  if(!token||!['approve','reject'].includes(action))return;

  // Xoá query param khỏi URL ngay (tránh user F5 lặp)
  history.replaceState(null,'',window.location.pathname);

  // Phải đăng nhập admin
  const sess=_authGetSession();
  if(!sess){
    showChangeNotif('error','Can dang nhap','Dang nhap admin de duyet yeu cau');
    return;
  }

  const isAdmin=sess.role==='admin'||sess.email==='mtuandat@gmail.com';
  if(!isAdmin){
    showChangeNotif('error','Khong co quyen','Chi admin duyet duoc yeu cau doi mat khau');
    return;
  }

  // Modal xác nhận
  const ex=document.getElementById('_approvePwdModal');if(ex)ex.remove();
  const modal=document.createElement('div');modal.id='_approvePwdModal';
  modal.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center';
  const isApprove=action==='approve';
  const titleColor=isApprove?'#00e676':'#ff5252';
  const titleIcon=isApprove?'fa-check-circle':'fa-times-circle';
  const titleText=isApprove?'Xac nhan duyet doi mat khau':'Xac nhan tu choi yeu cau';
  modal.innerHTML=`<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:28px 32px;width:400px;box-shadow:0 8px 48px rgba(0,0,0,.7)">
    <div style="font-size:14px;font-weight:800;color:${titleColor};margin-bottom:14px"><i class="fas ${titleIcon}" style="margin-right:8px"></i>${titleText}</div>
    <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">
      Token: <code style="font-size:10.5px;color:var(--text-primary);word-break:break-all">${token}</code>
    </div>
    <div id="_apErr" style="font-size:11px;color:var(--red);min-height:14px;margin-bottom:10px"></div>
    <div style="display:flex;gap:8px">
      <button class="auth-btn" style="flex:1;background:${titleColor}" id="_apBtn" onclick="_doApprovePwd('${token}','${action}')">${isApprove?'Duyet':'Tu choi'}</button>
      <button onclick="document.getElementById('_approvePwdModal').remove()" style="flex:0.5;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer">Bo qua</button>
    </div></div>`;
  document.body.appendChild(modal);
}

async function _doApprovePwd(token,action){
  const er=document.getElementById('_apErr'),btn=document.getElementById('_apBtn');
  er.textContent='';
  if(btn){btn.disabled=true;btn.textContent='Dang xu ly...';}
  try{
    const tk=await _authGetToken();
    if(!tk){er.textContent='Phien hien tai loi, dang nhap lai';return;}
    const url=_AUTH_SB_URL.replace(/\/$/,'')+'/functions/v1/approve-password-change';
    const resp=await fetch(url,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+tk,
        'apikey':_AUTH_SB_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({token,action})
    });
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok){er.textContent=data.error||('Loi '+resp.status);return;}
    _authAddLog('PASSWORD_CHANGE_'+action.toUpperCase(),data.message||'',data.user_email||'');
    document.getElementById('_approvePwdModal').remove();
    showChangeNotif('success',action==='approve'?'Da duyet doi mat khau':'Da tu choi yeu cau',data.message||'');
  }catch(err){er.textContent='Loi: '+err.message;}
  finally{if(btn){btn.disabled=false;btn.textContent=action==='approve'?'Duyet':'Tu choi';}}
}

function _authApplyRoleUI(role){
  if(role==='user'){document.body.classList.add('user-mode');}
  else{document.body.classList.remove('user-mode');}
  // Reset bất kỳ inline style nào trên canvasArea (do version cũ có thể đã set)
  const ca=document.getElementById('canvasArea');
  if(ca){ca.style.gridColumn='';ca.style.padding='';}
}

function _openAdminPanel(){
  const drop=document.getElementById('userMenuDropdown');if(drop)drop.classList.remove('open');
  const sess=_authCurrentUser();
  if(!sess||sess.role!=='admin'){showChangeNotif('error','Khong co quyen','Chi Admin moi truy cap.');return;}
  document.getElementById('adminPanel').classList.add('open');
  _adminTab('users',document.querySelector('.admin-tab'));
}

async function _adminTab(tab,el){
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  const body=document.getElementById('adminBody');if(!body)return;
  const sb=_getAuthSb();
  if(tab==='users'){
    body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Dang tai...</div>';
    const{data:profiles,error}=await sb.from('evn_user_profiles').select('*').order('created_at',{ascending:false});
    if(error){
      body.innerHTML=`<div style="padding:14px;background:rgba(255,82,82,.08);border:1px solid rgba(255,82,82,.2);border-radius:8px;color:#ff5252;font-size:11px;line-height:1.8">
        Loi: ${error.message}<br><b>Chay SQL trong Supabase de tao bang:</b>
        <pre style="margin-top:8px;font-size:9px;color:var(--text-primary);background:rgba(0,0,0,.3);padding:10px;border-radius:6px">create table public.evn_user_profiles (
  id uuid primary key references auth.users(id),
  email text, name text, role text default 'user',
  active boolean default true,
  created_at timestamptz default now()
);
alter table evn_user_profiles enable row level security;
create policy allow_all on evn_user_profiles for all using (true);</pre></div>`;
      return;
    }
    const capColor=r=>r==='admin'?'rgba(255,215,64,.15)':'rgba(0,200,255,.1)';
    const iconCls=r=>r==='admin'?'fa-user-shield':'fa-user';
    const iconCol=r=>r==='admin'?'#ffd740':'var(--accent)';
    const badgeCls=r=>r==='admin'?'auth-role-admin':'auth-role-user';
    body.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:12px;font-weight:700;color:var(--text-primary)">${(profiles||[]).length} tai khoan</span>
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
        </div></div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${(profiles||[]).map(u=>`<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:10px 14px;display:flex;align-items:center;gap:12px">
          <div style="width:34px;height:34px;border-radius:50%;background:${capColor(u.role)};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas ${iconCls(u.role)}" style="color:${iconCol(u.role)}"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${u.name||'—'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${u.email||'—'} - <span class="auth-role-badge ${badgeCls(u.role)}">${u.role==='admin'?'ADMIN':'USER'}</span>${!u.active?'<span style="color:#ff5252;font-size:9px;margin-left:6px">VO HIEU</span>':''}</div>
          </div>
          <button onclick="_adminToggleUser('${u.id}',${!u.active})" style="padding:4px 10px;border-radius:6px;border:1px solid ${u.active?'rgba(255,82,82,.3)':'rgba(0,230,118,.3)'};background:${u.active?'rgba(255,82,82,.07)':'rgba(0,230,118,.07)'};color:${u.active?'#ff5252':'#00e676'};font-size:10px;cursor:pointer">
            <i class="fas ${u.active?'fa-ban':'fa-check'}"></i> ${u.active?'Vo hieu':'Kich hoat'}</button>
        </div>`).join('')}
      </div>`;
  }
  else if(tab==='log'){
    const log=_authGetLog();
    const fmtTs=ts=>{try{return new Date(ts).toLocaleString('vi-VN');}catch{return ts;}};
    const icMap={LOGIN:'fa-sign-in-alt',LOGOUT:'fa-sign-out-alt',CHANGE_PASSWORD:'fa-key',CREATE_USER:'fa-user-plus',TOGGLE_USER:'fa-user-slash'};
    const colMap={LOGIN:'#00e676',LOGOUT:'#ffd740',CHANGE_PASSWORD:'#00c8ff',CREATE_USER:'#b388ff',TOGGLE_USER:'#ff9100'};
    body.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;font-weight:700;color:var(--text-primary)">${log.length} su kien</span>
        <button onclick="localStorage.removeItem('${_AUTH_LOG_KEY}');_adminTab('log',document.querySelectorAll('.admin-tab')[1])" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(255,82,82,.3);background:rgba(255,82,82,.08);color:#ff5252;font-size:10px;cursor:pointer">Xoa log</button>
      </div>
      ${log.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">Chua co nhat ky</div>':
        '<div style="display:flex;flex-direction:column;gap:4px">'+log.slice(0,100).map(e=>`<div style="display:grid;grid-template-columns:130px 110px 1fr;gap:8px;align-items:center;padding:7px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border)">
          <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono)">${fmtTs(e.ts)}</div>
          <div style="display:flex;align-items:center;gap:4px"><i class="fas ${icMap[e.action]||'fa-circle'}" style="font-size:9px;color:${colMap[e.action]||'var(--accent)'}"></i>
            <span style="font-size:9px;color:${colMap[e.action]||'var(--accent)'};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">${e.user}</span></div>
          <div style="font-size:10px;color:var(--text-secondary)">${e.detail||e.action}</div>
        </div>`).join('')+'</div>'}
    `;
  }
  else if(tab==='access'){
    body.innerHTML=`<div style="margin-bottom:12px;padding:12px 14px;background:rgba(0,200,255,.05);border:1px solid rgba(0,200,255,.15);border-radius:8px;font-size:11px;color:var(--text-secondary);line-height:1.9">
      <b style="color:var(--accent);font-size:12px">Cach tao tai khoan moi:</b><br>
      <b>B1:</b> Supabase Dashboard &gt; Authentication &gt; Users &gt; Add user (email + password)<br>
      <b>B2:</b> SQL Editor: <code style="color:var(--accent)">insert into evn_user_profiles(id,email,name,role) select id,email,'Ten','user' from auth.users where email='...';</code><br>
      <b>Hoac nhanh:</b> Dung nut <b>Them tai khoan</b> tab Nguoi dung (tu dong ca 2 buoc)
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span class="auth-role-badge auth-role-admin">ADMIN</span><span style="font-size:12px;font-weight:700;color:var(--text-primary)">Quan tri vien</span></div>
        <div style="font-size:10px;color:var(--text-secondary)">Toan quyen: xem Layout Editor, chinh sua, tao tai khoan, xem log</div>
      </div>
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span class="auth-role-badge auth-role-user">USER</span><span style="font-size:12px;font-weight:700;color:var(--text-primary)">Nguoi dung</span></div>
        <div style="font-size:10px;color:var(--text-secondary)">Chi xem dashboard du lieu, khong thay editor</div>
      </div>
    </div>`;
  }
}

async function _adminToggleUser(uid,newActive){
  const sb=_getAuthSb();
  const{error}=await sb.from('evn_user_profiles').update({active:newActive}).eq('id',uid);
  if(error){showChangeNotif('error','Loi',error.message);return;}
  _authAddLog('TOGGLE_USER','Doi trang thai '+uid);
  showChangeNotif(newActive?'success':'warning',newActive?'Da kich hoat':'Da vo hieu hoa','');
  _adminTab('users',document.querySelector('.admin-tab.active'));
}

function _adminAddUser(){
  const ex=document.getElementById('_addUserModal');if(ex)ex.remove();
  const modal=document.createElement('div');modal.id='_addUserModal';
  modal.style.cssText='position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`<div style="background:var(--bg-surface);border:1px solid var(--border-accent);border-radius:14px;padding:28px 32px;width:420px;box-shadow:0 8px 48px rgba(0,0,0,.8)">
    <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin-bottom:6px"><i class="fas fa-user-plus" style="color:var(--accent);margin-right:8px"></i>Them tai khoan moi</div>
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:18px">Tao Supabase Auth user + ho so nguoi dung cung luc</div>
    <div style="margin-bottom:11px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Ho ten *</label><input id="_auName" type="text" class="auth-input" placeholder="Nguyen Van A"></div>
    <div style="margin-bottom:11px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Email *</label><input id="_auEmail" type="email" class="auth-input" placeholder="nva@evn.vn"></div>
    <div style="margin-bottom:11px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Mat khau * (toi thieu 6 ky tu)</label><input id="_auPw" type="password" class="auth-input" placeholder="Mat khau dang nhap"></div>
    <div style="margin-bottom:16px"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">Vai tro</label>
      <select id="_auRole" class="auth-input" style="cursor:pointer"><option value="user">USER - Nguoi dung</option><option value="admin">ADMIN - Quan tri vien</option></select></div>
    <div id="_auErr" style="font-size:11px;color:var(--red);min-height:14px;margin-bottom:10px"></div>
    <div style="display:flex;gap:8px">
      <button id="_auBtn" class="auth-btn" style="flex:1" onclick="_doAddUser()"><i class="fas fa-save" style="margin-right:5px"></i>Tao tai khoan</button>
      <button onclick="document.getElementById('_addUserModal').remove()" style="flex:0.5;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer">Huy</button>
    </div></div>`;
  document.body.appendChild(modal);
}

async function _doAddUser(){
  const name=(document.getElementById('_auName').value||'').trim();
  const email=(document.getElementById('_auEmail').value||'').trim();
  const pw=document.getElementById('_auPw').value;
  const role=document.getElementById('_auRole').value;
  const er=document.getElementById('_auErr');
  const btn=document.getElementById('_auBtn');
  er.textContent='';
  if(!name||!email||!pw){er.textContent='Vui long dien day du thong tin';return;}
  if(pw.length<6){er.textContent='Mat khau it nhat 6 ky tu';return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Dang tao...';}
  try{
    const sb=_getAuthSb();
    const{data:sd,error:se}=await sb.auth.signUp({email,password:pw,options:{data:{name,role}}});
    if(se){er.textContent=se.message.includes('already registered')?'Email nay da duoc dang ky':'Loi: '+se.message;return;}
    const newId=sd?.user?.id;
    if(newId)await sb.from('evn_user_profiles').upsert([{id:newId,email,name,role,active:true}]);
    _authAddLog('CREATE_USER','Tao tai khoan '+email+' ('+role+')');
    document.getElementById('_addUserModal').remove();
    showChangeNotif('success','Tao tai khoan thanh cong',name+' ('+email+') da tao. Kiem tra email xac nhan neu can.');
    _adminTab('users',document.querySelector('.admin-tab.active'));
  }catch(err){er.textContent='Loi: '+err.message;}
  finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save" style="margin-right:5px"></i>Tao tai khoan';}}
}

function showChangeNotif(type,title,msg,duration){
  const area=document.getElementById('changeNotifArea');if(!area)return;
  const icons={success:'fa-check-circle',warning:'fa-exclamation-triangle',error:'fa-times-circle',info:'fa-info-circle'};
  const colors={success:'#00e676',warning:'#ffd740',error:'#ff5252',info:'#00c8ff'};
  const col=colors[type]||colors.info;
  const notif=document.createElement('div');notif.className='change-notif '+type;
  notif.innerHTML=`<i class="fas ${icons[type]||'fa-info-circle'} cn-icon" style="color:${col}"></i><div class="cn-content"><div class="cn-title" style="color:${col}">${title}</div>${msg?`<div class="cn-msg">${msg}</div>`:''}<div class="cn-time">${new Date().toLocaleTimeString('vi-VN')}</div></div><span class="cn-close" onclick="this.closest('.change-notif').remove()">x</span>`;
  area.appendChild(notif);
  setTimeout(()=>{if(notif.parentNode)notif.remove();},duration||5000);
}
document.getElementById('adminPanel').addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});

// ══════════════════════════════════════════════════════════════
// YÊU CẦU 2: btnUpload addEventListener (per spec)
// Flow: User nhập form + file → Base64 → fetch('/api/submit')
//       → Backend (Supabase Edge Function) decode → NAS WebDAV PUT
//       → Supabase UpdateRequests (status=pending)
//       → Admin approve → update TongHopThietBi / CongTacThiNghiem
// ══════════════════════════════════════════════════════════════

// Cấu hình URL backend (Supabase Edge Function hoặc Node.js)
const BACKEND_URL = (() => {
  // Thử đọc từ Supabase project URL nếu có
  const sbUrl = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') ||
                document.querySelector('[data-sb-url]')?.dataset?.sbUrl || '';
  // Edge Function endpoint: <supabase-url>/functions/v1/upload-tndk
  if (sbUrl) return sbUrl.replace(/\/$/,'') + '/functions/v1/upload-tndk';
  // Fallback: dùng direct NAS nếu không có backend
  return '';
})();

/** Hiển thị uploadSection và reset form */
function openUploadSection(prefill = {}) {
  const sec = document.getElementById('uploadSection');
  if (!sec) return;
  // Prefill from row context nếu được gọi từ _tnRowClick
  if (prefill.deviceName) {
    const di = document.getElementById('deviceNameInput');
    if (di) di.value = prefill.deviceName;
  }
  if (prefill.date) {
    const dd = document.getElementById('dateInput');
    if (dd) dd.value = prefill.date;
  }
  // Store context row for Supabase metadata
  sec.dataset.tram       = prefill.tram       || '';
  sec.dataset.ngan       = prefill.ngan       || '';
  sec.dataset.loaiTb     = prefill.loaiTb     || '';
  sec.dataset.tenCu      = prefill.tenCu      || '';
  sec.dataset.slCu       = prefill.slCu       || '';
  sec.dataset.ngayCu     = prefill.ngayCu     || '';
  // Update NAS status
  _uploadUpdateNasStatus();
  // Show section
  sec.style.display = 'block';
  document.getElementById('deviceNameInput')?.focus();
}

function _uploadUpdateNasStatus() {
  const el = document.getElementById('uploadNasStatus');
  if (!el) return;
  if (NAS_CONFIG.enabled) {
    el.style.color = '#00e676';
    el.innerHTML = `● NAS đã kết nối (<b>${NAS_CONFIG.baseUrl}</b>) — ảnh sẽ được tải lên <code>${NAS_CONFIG.photoPath}</code>`;
  } else if (BACKEND_URL) {
    el.style.color = 'rgba(0,200,255,.8)';
    el.innerHTML = `● Backend: <b>${BACKEND_URL.replace(/https?:\/\/[^/]+/, '…')}</b> — ảnh tải qua Supabase Edge Function`;
  } else {
    el.style.color = '#ff9100';
    el.innerHTML = '⚠ NAS chưa cấu hình — ảnh sẽ không được lưu. <a onclick="_nasOpenSettings()" style="color:var(--accent);cursor:pointer;text-decoration:underline">Cấu hình NAS</a>';
  }
}

function _uploadFileSelected() {
  const inp = document.getElementById('fileInput');
  const lbl = document.getElementById('uploadFileLbl');
  const f = inp?.files?.[0];
  if (!f) return;
  const mb = (f.size/1024/1024).toFixed(1);
  if (parseFloat(mb) > 10) {
    if (lbl) lbl.innerHTML = '<span style="color:#ff5252">⚠ File quá lớn (' + mb + 'MB) — tối đa 10MB</span>';
    inp.value = '';
    return;
  }
  if (lbl) lbl.innerHTML = `<span style="color:#00e676">✅ ${f.name}</span> <span style="color:rgba(180,200,220,.5)">${mb}MB</span>`;
}

// ── CORE: btnUpload click handler (per spec) ──────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btnUpload = document.getElementById('btnUpload');
  if (!btnUpload) return;

  btnUpload.addEventListener('click', async () => {
    const fileEl      = document.getElementById('fileInput');
    const deviceName  = document.getElementById('deviceNameInput')?.value?.trim();
    const quantity    = parseInt(document.getElementById('quantityInput')?.value || '0', 10);
    const date        = document.getElementById('dateInput')?.value;
    const note        = document.getElementById('uploadNoteInput')?.value?.trim();
    const statusEl    = document.getElementById('uploadStatus');
    const sec         = document.getElementById('uploadSection');

    // Reset status
    if (statusEl) { statusEl.style.color = '#ffd740'; statusEl.textContent = ''; }

    // ── Validate (per spec) ──
    if (!fileEl?.files?.length) { if(statusEl){statusEl.textContent='Chưa chọn file';} return; }
    if (!deviceName)             { if(statusEl){statusEl.textContent='Chưa nhập tên thiết bị';} return; }
    if (!quantity || quantity <= 0){ if(statusEl){statusEl.textContent='Số lượng không hợp lệ';} return; }
    if (!date)                   { if(statusEl){statusEl.textContent='Chưa chọn ngày TN';} return; }
    if (!note)                   { if(statusEl){statusEl.textContent='Chưa nhập lý do cập nhật';} return; }

    const file = fileEl.files[0];
    btnUpload.disabled = true;
    btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    if (statusEl) { statusEl.style.color = '#ffd740'; statusEl.textContent = 'Đang xử lý...'; }

    // ── BƯỚC 1: Encode file Base64 (per spec: FileReader.readAsDataURL) ──
    let fileBase64 = '', photoUrl = '', photoPath = '';
    if (file) {
      fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:...;base64,
        reader.onerror = reject;
        reader.readAsDataURL(file); // per spec
      });
    }

    // ── BƯỚC 2: Gửi lên backend (per spec: fetch POST với JSON body) ──
    // Backend = Supabase Edge Function hoặc Node.js server
    // Backend sẽ: decode Base64 → HTTP PUT lên NAS WebDAV → return file URL
    let uploadSuccess = false;
    if (BACKEND_URL && fileBase64) {
      if (statusEl) statusEl.textContent = 'Đang tải ảnh lên NAS qua backend...';
      try {
        const response = await fetch(BACKEND_URL, {   // per spec: fetch('https://YOUR_BACKEND_URL/api/submit')
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({                       // per spec: JSON body
            deviceName,
            quantity,
            date,
            fileName:   file.name,
            fileBase64,                                // per spec: Base64
            mimeType:   file.type,
            // Context metadata
            tram:     sec?.dataset?.tram     || '',
            ngan:     sec?.dataset?.ngan     || '',
            loaiTb:   sec?.dataset?.loaiTb   || '',
            note,
          })
        });
        const result = await response.json();
        if (result.success) {
          photoUrl  = result.fileUrl  || '';
          photoPath = result.filePath || '';
          uploadSuccess = true;
        } else {
          throw new Error(result.error || 'Backend trả lỗi không xác định');
        }
      } catch (err) {
        console.error('Backend upload error:', err);
        // Fallback: thử direct WebDAV nếu backend không available
        if (NAS_CONFIG.enabled && file) {
          if (statusEl) statusEl.textContent = 'Backend lỗi — thử direct NAS WebDAV...';
          try {
            const tramFolder = `${NAS_CONFIG.photoPath}/${(sec?.dataset?.tram||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_')}`;
            await nasMkdir(tramFolder);
            const prefix = `${deviceName.replace(/\s/g,'_')}_${(sec?.dataset?.tram||'').replace(/\s/g,'_')}`;
            const r2 = await nasUploadFile(file, tramFolder, prefix);
            photoUrl = r2.url; photoPath = r2.path;
            uploadSuccess = true;
          } catch(e2) { console.warn('Direct NAS also failed:', e2); }
        }
        if (!uploadSuccess) {
          // Cho phép gửi đề nghị không kèm ảnh
          const skip = confirm(`Không tải được ảnh lên:\n${err.message}\n\nBấm OK để gửi đề nghị KHÔNG có ảnh.`);
          if (!skip) {
            btnUpload.disabled = false;
            btnUpload.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi cập nhật';
            if (statusEl) { statusEl.style.color='#ff5252'; statusEl.textContent='Đã hủy'; }
            return;
          }
        }
      }
    } else if (NAS_CONFIG.enabled && file) {
      // Không có backend → dùng direct WebDAV (NAS_CONFIG đã cấu hình)
      if (statusEl) statusEl.textContent = 'Đang tải ảnh lên NAS WebDAV...';
      try {
        const tramFolder = `${NAS_CONFIG.photoPath}/${(sec?.dataset?.tram||'upload').replace(/[^a-zA-Z0-9_-]/g,'_')}`;
        await nasMkdir(tramFolder);
        const r3 = await nasUploadFile(file, tramFolder, deviceName.replace(/\s/g,'_'));
        photoUrl = r3.url; photoPath = r3.path;
        uploadSuccess = true;
      } catch(e3) { console.warn('Direct NAS failed:', e3); }
    }

    // ── BƯỚC 3: Insert metadata + file URL vào Supabase UpdateRequests ──
    // per spec: status = 'pending' (mapped to 'cho_duyet')
    if (statusEl) statusEl.textContent = 'Đang lưu đề nghị vào Supabase...';
    const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    const request = {
      tram:           sec?.dataset?.tram    || '',
      ngan_thiet_bi:  sec?.dataset?.ngan    || '',
      loai_tb:        sec?.dataset?.loaiTb  || '',
      ten_cu:         sec?.dataset?.tenCu   || '',
      ten_moi:        deviceName,
      so_luong_cu:    sec?.dataset?.slCu ? Number(sec.dataset.slCu) : null,
      so_luong_moi:   quantity,
      ngay_tn_cu:     sec?.dataset?.ngayCu  || null,
      ngay_tn_moi:    date,
      ghi_chu:        note,
      photo_path:     photoPath || null,
      photo_url:      photoUrl  || null,   // URL NAS trả về
      nguoi_gui:      sess?.email || 'anonymous',
      trang_thai:     'cho_duyet',          // per spec: status = 'pending'
      created_at:     new Date().toISOString(),
    };

    try {
      if (window._sbClient) {
        const { error } = await window._sbClient.from('tn_update_requests').insert([request]);
        if (error) throw error;
      } else {
        (window._tnPendingRequests = window._tnPendingRequests || []).push({...request, id: Date.now()+'_local'});
      }

      // ── THÀNH CÔNG ──
      if (statusEl) {
        statusEl.style.color = '#00e676';
        statusEl.textContent = photoUrl
          ? '✅ Upload thành công! Đang chờ admin phê duyệt.'   // per spec
          : '✅ Đề nghị đã gửi (không kèm ảnh). Đang chờ admin phê duyệt.';
      }
      // Reset form sau 2.5s
      setTimeout(() => {
        ['fileInput','deviceNameInput','quantityInput','dateInput','uploadNoteInput']
          .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
        const lbl = document.getElementById('uploadFileLbl');
        if (lbl) lbl.textContent = 'Kéo thả hoặc nhấp để chọn ảnh';
        if (statusEl) statusEl.textContent = '';
      }, 2500);

    } catch(e) {
      console.error('Supabase insert error:', e);
      if (statusEl) {
        statusEl.style.color = '#ff5252';
        statusEl.textContent = 'Upload thất bại: ' + (e.message || 'unknown error'); // per spec
      }
    }

    btnUpload.disabled = false;
    btnUpload.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi cập nhật';
  });
});

// ══════════════════════════════════════════════════════
// CONFIG: NAS Synology
// Đặt URL NAS của bạn tại đây
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// NAS SYNOLOGY — WEBDAV CONFIG
// Sơ đồ: User → HTTP PUT (Base64) → NAS WebDAV → Return URL
//         → Insert metadata + URL vào Supabase
// ══════════════════════════════════════════════════════
const NAS_CONFIG = (() => {
  let cfg = {
    baseUrl:   '',                  // VD: 'https://192.168.1.13:5006'
    webdavPath:'',                  // Root WebDAV (rỗng nếu base đã có /)
    bbtnPath:  '/BBTN',             // Cấu trúc: BBTN/Đơn vị/Năm/Trạm/File
    photoPath: '/TNDK',             // Thư mục ảnh TNĐK
    username:  '',                  // Tài khoản NAS
    password:  '',                  // Mật khẩu NAS
    enabled:   false,
  };
  try {
    const saved = localStorage.getItem('evn_nas_cfg');
    if (saved) Object.assign(cfg, JSON.parse(saved));
  } catch(e) {}
  return cfg;
})();

/** Trả về full URL của file trên NAS WebDAV */
function nasFileUrl(path) {
  if (!NAS_CONFIG.baseUrl || !path) return '';
  return NAS_CONFIG.baseUrl.replace(/\/$/,'') + path;
}

/** Authorization header cho WebDAV Basic Auth */
function nasAuthHeader() {
  if (!NAS_CONFIG.username) return {};
  const cred = btoa(NAS_CONFIG.username + ':' + NAS_CONFIG.password);
  return { 'Authorization': 'Basic ' + cred };
}

/**
 * Upload file lên NAS Synology qua WebDAV
 * Theo diagram: Encode file → HTTP PUT → NAS trả URL
 * @param {File} file - File cần upload
 * @param {string} folder - Thư mục đích trên NAS (vd: NAS_CONFIG.photoPath)
 * @param {string} [prefix] - Prefix cho tên file
 * @returns {Promise<{url:string, path:string}>}
 */
async function nasUploadFile(file, folder, prefix='') {
  if (!NAS_CONFIG.baseUrl || !NAS_CONFIG.enabled) {
    throw new Error('NAS chưa được cấu hình hoặc chưa bật. Vào Cài đặt NAS để cấu hình.');
  }
  const ext  = file.name.split('.').pop();
  const ts   = Date.now();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${prefix}_${ts}_${safe}`;
  const destPath = `${folder.replace(/\/$/,'')}/${fileName}`;
  const destUrl  = nasFileUrl(destPath);

  // Read file as ArrayBuffer
  const buf = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });

  // HTTP PUT to WebDAV
  const resp = await fetch(destUrl, {
    method:  'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'ngrok-skip-browser-warning': 'true',
      ...nasAuthHeader(),
    },
    body: buf,
    credentials: 'omit',  // avoid CORS preflight caching issues
  });

  if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
    let msg = `HTTP ${resp.status}`;
    try { msg += ' — ' + (await resp.text()).slice(0,200); } catch(e2){}
    throw new Error('NAS upload thất bại: ' + msg);
  }
  return { url: destUrl, path: destPath };
}

/**
 * Tạo thư mục trên NAS WebDAV nếu chưa tồn tại
 */
async function nasMkdir(folderPath) {
  if (!NAS_CONFIG.baseUrl) return;
  const url = nasFileUrl(folderPath);
  try {
    await fetch(url, {
      method: 'MKCOL',
      headers: { 'ngrok-skip-browser-warning': 'true', ...nasAuthHeader() },
      credentials: 'omit',
    });
  } catch(e) { /* ignore — folder may already exist */ }
}

/** Lưu NAS config vào localStorage */
function nasSaveConfig(cfg) {
  Object.assign(NAS_CONFIG, cfg);
  NAS_CONFIG.enabled = !!(cfg.baseUrl && cfg.username);
  try { localStorage.setItem('evn_nas_cfg', JSON.stringify(NAS_CONFIG)); } catch(e){}
}

/** Test kết nối WebDAV */
async function nasTestConnection() {
  if (!NAS_CONFIG.baseUrl) return { ok: false, msg: 'Chưa nhập URL NAS' };
  try {
    const url = nasFileUrl(NAS_CONFIG.webdavPath || '/webdav');
    const resp = await fetch(url, {
      method: 'OPTIONS',
      headers: nasAuthHeader(),
      credentials: 'omit',
      signal: AbortSignal.timeout(5000),
    });
    // WebDAV trả 200/207 khi thành công
    if (resp.ok || resp.status === 207) return { ok: true, msg: 'Kết nối thành công ✓' };
    if (resp.status === 401) return { ok: false, msg: 'Sai tài khoản/mật khẩu (401)' };
    if (resp.status === 404) return { ok: false, msg: 'Đường dẫn WebDAV không tồn tại (404)' };
    return { ok: false, msg: `HTTP ${resp.status}` };
  } catch(e) {
    if (e.name === 'AbortError') return { ok: false, msg: 'Timeout — kiểm tra URL và network' };
    if (e.message?.includes('CORS')) return { ok: false, msg: 'CORS blocked — cần enable CORS trên NAS hoặc dùng proxy' };
    return { ok: false, msg: e.message || 'Lỗi kết nối' };
  }
}

// ══════════════════════════════════════════════════════
// MODULE: QUẢN LÝ BBTN (với NAS link)
// ══════════════════════════════════════════════════════

/** Quay về Dashboard từ BBTN */
function _bbtnBackToDashboard() {
  const dashboardNav = Array.from(document.querySelectorAll('.nav-item'))
    .find(el => (el.querySelector('span')?.textContent || '').trim() === 'Dashboard');
  if (dashboardNav) {
    dashboardNav.click();
  } else {
    const ov = document.getElementById('tbPageOverlay');
    const cv = document.getElementById('canvasArea');
    const rp = document.querySelector('.props-panel');
    if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; }
    if (cv) cv.style.display = '';
    if (rp) rp.style.display = '';
    if (typeof render === 'function') render();
  }
}

/** Populate Đội/Năm/Trạm dropdowns từ data Supabase */
function _bbtnPopulateFilters() {
  const data = (Array.isArray(_chipAllData) && _chipAllData.length) ? _chipAllData
              : (Array.isArray(_tnAllData) && _tnAllData.length) ? _tnAllData : [];
  if (!data.length) return;

  // Đội
  const dois = [...new Set(data.map(d => (d.Doi||'').trim()).filter(Boolean).filter(d => !d.includes('\uFFFD')))]
    .sort((a,b) => a.localeCompare(b,'vi',{numeric:true}));
  const selDoi = document.getElementById('_bbtnSelDoi');
  if (selDoi) {
    selDoi.innerHTML = '<option value="">— Đội —</option>' + dois.map(d => `<option value="${d}">${d}</option>`).join('');
    if (window._bbtnFilter.doi) selDoi.value = window._bbtnFilter.doi;
  }

  // Năm: lấy từ Nam_van_hanh + Nam_san_xuat (chỉ các năm gần đây)
  const curYear = new Date().getFullYear();
  const years = [];
  for (let y = curYear; y >= curYear - 5; y--) years.push(y);
  const selNam = document.getElementById('_bbtnSelNam');
  if (selNam) {
    selNam.innerHTML = '<option value="">— Năm —</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    if (window._bbtnFilter.nam) selNam.value = window._bbtnFilter.nam;
  }

  // Trạm: filter theo Đội nếu có
  _bbtnPopulateTrams();
}

/** Populate Trạm dropdown - cascaded theo Đội */
function _bbtnPopulateTrams() {
  const data = (Array.isArray(_chipAllData) && _chipAllData.length) ? _chipAllData : [];
  const doi = window._bbtnFilter.doi;
  let trams = data;
  if (doi) trams = trams.filter(d => (d.Doi||'').trim() === doi);
  const tramList = [...new Set(trams.map(d => (d.Tram||'').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,'vi',{numeric:true}));
  const selTram = document.getElementById('_bbtnSelTram');
  if (selTram) {
    selTram.innerHTML = '<option value="">— Trạm —</option>' + tramList.map(t => `<option value="${t}">${t}</option>`).join('');
    if (window._bbtnFilter.tram && tramList.includes(window._bbtnFilter.tram)) selTram.value = window._bbtnFilter.tram;
    else window._bbtnFilter.tram = '';
  }
}

/** Khi 1 dropdown thay đổi */
function _bbtnFilterChange(field, value) {
  window._bbtnFilter[field] = value;
  // Đội đổi → reset Trạm và populate lại
  if (field === 'doi') {
    window._bbtnFilter.tram = '';
    _bbtnPopulateTrams();
  }
  _bbtnFilterApply();
}

/** Áp filter — re-render items đang hiển thị */
function _bbtnFilterApply() {
  const search = document.getElementById('_bbtnSearch')?.value || '';
  window._bbtnFilter.search = search.trim().toLowerCase();
  // Re-render với items hiện tại nếu có
  if (window._bbtnLastItems) {
    _bbtnRenderItems(window._bbtnLastItems, window._bbtnLastPath, window._bbtnLastRoot, window._bbtnLastDepth);
  }
}

/** Xoá tất cả filter */
function _bbtnFilterClear() {
  window._bbtnFilter = { doi: '', nam: '', tram: '', search: '' };
  const sb = document.getElementById('_bbtnSearch'); if (sb) sb.value = '';
  const sd = document.getElementById('_bbtnSelDoi'); if (sd) sd.value = '';
  const sn = document.getElementById('_bbtnSelNam'); if (sn) sn.value = '';
  _bbtnPopulateTrams();
  _bbtnFilterApply();
}

/** Toggle chọn 1 thư mục Trạm */
function _bbtnToggleSelect(folderName) {
  if (!folderName) return;
  if (window._bbtnSelected.has(folderName)) window._bbtnSelected.delete(folderName);
  else window._bbtnSelected.add(folderName);
  _bbtnUpdateZipBtn();
}

/** Cập nhật trạng thái nút Tải ZIP */
function _bbtnUpdateZipBtn() {
  const cnt = window._bbtnSelected.size;
  const btn = document.getElementById('_bbtnZipBtn');
  const cntEl = document.getElementById('_bbtnSelCnt');
  if (cntEl) cntEl.textContent = '(' + cnt + ')';
  if (btn) {
    btn.disabled = cnt === 0;
    btn.style.opacity = cnt === 0 ? '.4' : '1';
  }
}

/** Tải ZIP các trạm đã chọn */
async function _bbtnDownloadSelectedZip() {
  if (typeof JSZip === 'undefined') {
    showChangeNotif('error', 'Lỗi', 'JSZip chưa được tải, refresh trang lại');
    return;
  }
  const sel = Array.from(window._bbtnSelected);
  if (!sel.length) return;

  const currentPath = (window._bbtnState && window._bbtnState.path) || (NAS_CONFIG.bbtnPath || '/BBTN');
  const btn = document.getElementById('_bbtnZipBtn');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Liệt kê file...'; }

  // Helper: gom toàn bộ file trong các trạm (đệ quy 1 cấp đủ vì BBTN/.../Trạm/<file>)
  async function _collectFiles() {
    const all = [];   // { folder, relPath, name }
    for (const folderName of sel) {
      const folderPath = currentPath.replace(/\/$/, '') + '/' + folderName;
      try {
        const items = await _bbtnPropfind(folderPath);
        (items || []).filter(it => !it.isFolder).forEach(f => {
          all.push({ folder: folderName, relPath: f.relativePath || '', name: f.name || 'file' });
        });
      } catch (e) { console.warn('[ZIP] list folder', folderName, e); }
    }
    return all;
  }

  // Concurrency limit để không vắt kiệt ngrok
  async function _runPool(items, limit, worker) {
    const results = []; let idx = 0;
    const workers = Array.from({ length: limit }, async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await worker(items[i], i);
      }
    });
    await Promise.all(workers);
    return results;
  }

  try {
    const allFiles = await _collectFiles();
    if (!allFiles.length) throw new Error('Không có file trong các trạm đã chọn');

    const zip = new JSZip();
    let done = 0, errCount = 0;
    const total = allFiles.length;
    const updateBtn = () => {
      if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tải ${done}/${total}…`;
    };
    updateBtn();

    await _runPool(allFiles, 3, async (f) => {
      try {
        const token = await _authGetToken();
        const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/bbtn-download'
                  + '?path=' + encodeURIComponent(f.relPath);
        const resp = await _bbtnFetchEdge(url, token, { timeoutMs: 90_000, maxRetries: 1 });
        const blob = await resp.blob();
        zip.file(f.folder + '/' + f.name, blob);
      } catch (e) {
        errCount++; console.warn('[ZIP] file error', f.name, e);
      } finally {
        done++; updateBtn();
      }
    });

    const ok = total - errCount;
    if (ok === 0) throw new Error('Không tải được file nào');

    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang nén ZIP...';
    showChangeNotif('info', 'Đang nén ZIP...', ok + '/' + total + ' file');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }});
    const blobUrl = URL.createObjectURL(blob);
    const fileName = 'BBTN_' + sel.length + 'tram_' + new Date().toISOString().slice(0,10) + '.zip';
    const a = document.createElement('a'); a.href = blobUrl; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    showChangeNotif('success', 'Đã tải ZIP', ok + ' file' + (errCount ? ', ' + errCount + ' lỗi' : ''));
    window._bbtnSelected.clear();
    if (window._bbtnLastItems) _bbtnRenderItems(window._bbtnLastItems, window._bbtnLastPath, window._bbtnLastRoot, window._bbtnLastDepth);
  } catch (err) {
    console.error('[ZIP]', err);
    showChangeNotif('error', 'Lỗi tải ZIP', err.message || 'Vui lòng thử lại');
  } finally {
    if (btn) { btn.disabled = window._bbtnSelected.size === 0; btn.innerHTML = orig; _bbtnUpdateZipBtn(); }
  }
}

function _bbtnRenderPage() {
  const overlay = document.getElementById('tbPageOverlay');
  if (!overlay) return;

  // Init filter & selection state
  if (!window._bbtnFilter) window._bbtnFilter = { doi: '', nam: '', tram: '', search: '' };
  if (!window._bbtnSelected) window._bbtnSelected = new Set();

  // Initial render (loading + path breadcrumb)
  overlay.innerHTML = `<div style="padding:0 0 32px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,215,64,.15);color:#ffd740;display:flex;align-items:center;justify-content:center"><i class="fas fa-folder-open" style="font-size:15px"></i></div>
      <div>
        <div style="font-size:16px;font-weight:800;color:rgba(240,250,255,.97)">Quản lý Biên bản thí nghiệm (BBTN)</div>
        <div style="font-size:10px;color:rgba(180,200,220,.65);margin-top:3px">Trình duyệt thư mục NAS Synology • Cấu trúc: <code style="color:var(--accent);font-size:9.5px">BBTN/Đơn vị/Năm/Trạm/File</code></div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button onclick="_bbtnBackToDashboard()" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(140,160,180,.3);background:rgba(255,255,255,.04);color:rgba(220,232,245,.85);font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-arrow-left"></i> Dashboard</button>
        <button onclick="_bbtnRefresh()" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(0,200,255,.3);background:rgba(0,200,255,.08);color:var(--accent);font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-sync-alt"></i> Tải lại</button>
        ${(_authGetSession()?.role==='admin') ? `<button onclick="_nasOpenSettings()" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(255,215,64,.3);background:rgba(255,215,64,.08);color:#ffd740;font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-cog"></i> Cài đặt NAS</button>` : ''}
      </div>
    </div>

    <!-- Filter bar -->
    <div id="_bbtnFilterBar" style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:12px;flex-wrap:wrap">
      <div style="position:relative;flex:1;min-width:220px">
        <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:rgba(180,200,220,.4);font-size:10px"></i>
        <input id="_bbtnSearch" type="text" placeholder="Tìm theo tên thư mục/file..." oninput="_bbtnFilterApply()" style="width:100%;padding:7px 10px 7px 30px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:rgba(235,248,255,.92);font-size:11px;outline:none">
      </div>
      <select id="_bbtnSelDoi" onchange="_bbtnFilterChange('doi', this.value)" style="padding:7px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:rgba(235,248,255,.92);font-size:11px;min-width:160px;cursor:pointer">
        <option value="">— Đội —</option>
      </select>
      <select id="_bbtnSelNam" onchange="_bbtnFilterChange('nam', this.value)" style="padding:7px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:rgba(235,248,255,.92);font-size:11px;min-width:100px;cursor:pointer">
        <option value="">— Năm —</option>
      </select>
      <select id="_bbtnSelTram" onchange="_bbtnFilterChange('tram', this.value)" style="padding:7px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:rgba(235,248,255,.92);font-size:11px;min-width:140px;cursor:pointer">
        <option value="">— Trạm —</option>
      </select>
      <button onclick="_bbtnFilterClear()" style="padding:7px 11px;border-radius:6px;border:1px solid rgba(255,82,82,.3);background:rgba(255,82,82,.08);color:#ff5252;font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-times"></i> Xoá lọc</button>
      <button id="_bbtnZipBtn" onclick="_bbtnDownloadSelectedZip()" disabled style="padding:7px 13px;border-radius:6px;border:1px solid rgba(0,230,118,.3);background:rgba(0,230,118,.08);color:#00e676;font-size:10.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;opacity:.4"><i class="fas fa-file-archive"></i> Tải ZIP <span id="_bbtnSelCnt">(0)</span></button>
    </div>

    <div id="_bbtnBreadcrumb" style="display:flex;align-items:center;gap:6px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:14px;font-size:11px;color:rgba(200,220,235,.85);flex-wrap:wrap"></div>
    <div id="_bbtnContent" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;min-height:240px"></div>
  </div>`;

  // Init state
  if (!window._bbtnState) window._bbtnState = { path: '', stack: [] };
  _bbtnPopulateFilters();
  _bbtnLoadPath(NAS_CONFIG.bbtnPath || '/BBTN');
}

/**
 * Load 1 directory level từ NAS WebDAV
 * Dùng PROPFIND Depth: 1 để lấy danh sách file/folder
 * Hiển thị breadcrumb + grid card cho mỗi item
 */
async function _bbtnLoadPath(path) {
  const cont   = document.getElementById('_bbtnContent');
  const crumb  = document.getElementById('_bbtnBreadcrumb');
  if (!cont) return;
  window._bbtnState.path = path;

  // Render breadcrumb từ path (BBTN/Đơn vị/Năm/Trạm)
  const rootPath = NAS_CONFIG.bbtnPath || '/BBTN';
  const segments = path.replace(rootPath,'').split('/').filter(Boolean);
  const labels   = ['Đơn vị', 'Năm', 'Trạm', 'Thư mục'];
  let crumbHtml  = `<i class="fas fa-server" style="color:rgba(180,200,220,.5)"></i>
    <a onclick="_bbtnLoadPath('${rootPath.replace(/'/g,"\\'")}')" style="color:var(--accent);cursor:pointer;font-weight:600;text-decoration:none">BBTN</a>`;
  let cumulative = rootPath;
  segments.forEach((seg, i) => {
    cumulative += '/' + seg;
    const isLast = i === segments.length - 1;
    crumbHtml += `<span style="color:rgba(180,200,220,.4)">/</span>
      <span style="font-size:9px;color:rgba(180,200,220,.5);text-transform:uppercase">${labels[i]||''}:</span>
      ${isLast ? `<span style="color:rgba(240,250,255,.95);font-weight:600">${seg}</span>`
               : `<a onclick="_bbtnLoadPath('${cumulative.replace(/'/g,"\\'")}')" style="color:rgba(0,200,255,.85);cursor:pointer;text-decoration:none">${seg}</a>`}`;
  });
  if (crumb) crumb.innerHTML = crumbHtml;

  // Loading state
  cont.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(180,200,220,.6)">
    <i class="fas fa-spinner fa-spin" style="font-size:20px;color:var(--accent);margin-bottom:8px;display:block"></i>
    Đang tải danh sách từ NAS...
  </div>`;

  // User dùng Edge Function — không cần NAS config ở client.
  // Bỏ check NAS_CONFIG, lỗi sẽ xuất hiện rõ trong catch nếu có vấn đề.

  // Fetch directory listing via WebDAV PROPFIND (qua Edge Function)
  try {
    const items = await _bbtnPropfind(path);
    // Lưu để filter có thể re-render
    window._bbtnLastItems = items;
    window._bbtnLastPath = path;
    window._bbtnLastRoot = rootPath;
    window._bbtnLastDepth = segments.length;
    _bbtnRenderItems(items, path, rootPath, segments.length);
  } catch (err) {
    console.error('BBTN load error:', err);
    const msg       = err.message || 'Unknown error';
    const isAuthErr = msg.includes('hết hạn') || msg.includes('đăng nhập');
    const isTimeout = /NAS_TIMEOUT|CLIENT_TIMEOUT|abort/i.test(msg);
    const isNotFound= /NOT_FOUND|404|không tồn tại/i.test(msg);

    let title, hint, action;
    if (isAuthErr) {
      title = 'Phiên đăng nhập hết hạn';
      hint  = 'Đăng nhập lại để tiếp tục.';
      action= '<button onclick="_authLogout()" style="padding:8px 18px;border-radius:7px;border:none;background:#ff5252;color:#fff;font-weight:700;cursor:pointer;font-size:11.5px">Đăng nhập lại</button>';
    } else if (isTimeout) {
      title = 'NAS phản hồi quá lâu';
      hint  = 'ngrok tunnel có thể đang cold-start hoặc NAS quá tải. Bấm Thử lại — lần thứ 2 thường nhanh hơn.';
      action= `<button onclick="_bbtnInvalidateCache('${path.replace(/'/g,"\\'")}');_bbtnLoadPath('${path.replace(/'/g,"\\'")}')" style="padding:8px 18px;border-radius:7px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:11.5px"><i class="fas fa-sync-alt"></i> Thử lại</button>`;
    } else if (isNotFound) {
      title = 'Thư mục không tồn tại trên NAS';
      hint  = 'Đường dẫn không đúng hoặc folder vừa bị xóa.';
      action= `<button onclick="_bbtnLoadPath('${rootPath.replace(/'/g,"\\'")}')" style="padding:8px 18px;border-radius:7px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:11.5px"><i class="fas fa-home"></i> Về trang chủ BBTN</button>`;
    } else {
      title = 'Không tải được danh sách BBTN';
      hint  = 'Kiểm tra kết nối hoặc liên hệ admin nếu lỗi vẫn tiếp tục.';
      action= `<button onclick="_bbtnInvalidateCache('${path.replace(/'/g,"\\'")}');_bbtnLoadPath('${path.replace(/'/g,"\\'")}')" style="padding:8px 18px;border-radius:7px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:11.5px"><i class="fas fa-sync-alt"></i> Thử lại</button>`;
    }

    cont.innerHTML = `<div style="padding:40px;text-align:center">
      <i class="fas fa-times-circle" style="font-size:28px;color:#ff5252;margin-bottom:12px;display:block"></i>
      <div style="font-size:13px;color:rgba(240,250,255,.9);font-weight:600;margin-bottom:6px">${title}</div>
      <div style="font-size:10.5px;color:rgba(180,200,220,.65);margin-bottom:8px;font-family:var(--font-mono);word-break:break-word;max-width:560px;margin-left:auto;margin-right:auto">${msg}</div>
      <div style="font-size:10.5px;color:rgba(255,145,0,.75);max-width:480px;margin:8px auto 14px;line-height:1.6">${hint}</div>
      ${action}
    </div>`;
  }
}

/**
 * WebDAV PROPFIND request - lấy danh sách items trong thư mục
 * Returns: [{ name, isFolder, size, modified, href, fullUrl }]
 */
function _bbtnBuildEdgeError(status, text, fallback) {
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}

  if (status === 401) return new Error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
  if (status === 403) return new Error('Không có quyền truy cập thư mục này');

  const code = data?.code ? '[' + data.code + '] ' : '';
  const msg = data?.error || data?.detail || text || fallback || ('HTTP ' + status);
  const detail = data?.detail && data?.detail !== msg ? ' — ' + data.detail : '';
  return new Error(code + String(msg + detail).slice(0, 500));
}

// ── Retry + cache infrastructure cho Edge Function ─────────────
// Lý do: ngrok free có cold-start 3-5s, NAS PROPFIND lớn 10-30s
//   → cần timeout rộng tay + retry 1 lần khi gặp timeout/lỗi mạng.
const _bbtnListCache = new Map();   // path → { ts, items }
const _BBTN_LIST_TTL = 300_000;      // 5 phút — navigate giữa folder cùng level nhanh, tránh fetch lại NAS
let   _bbtnInflight  = new Map();    // path → Promise (chống double-fetch)

function _bbtnSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function _bbtnFetchEdge(edgeUrl, token, options = {}) {
  const timeoutMs   = options.timeoutMs   || 45_000;   // tăng từ 20s
  const maxRetries  = options.maxRetries  ?? 1;        // mặc định 1 lần retry
  const retryDelay  = options.retryDelay  || 1500;

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(edgeUrl, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'Authorization': 'Bearer ' + token,
          'apikey': _AUTH_SB_KEY,
          // Bypass ngrok HTML interstitial NẾU Edge Function chạy ra ngrok trực tiếp;
          // header này vô hại với Supabase nhưng được forward bởi Edge Function của ta.
          'ngrok-skip-browser-warning': 'true',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => resp.statusText || '');
        const err = _bbtnBuildEdgeError(resp.status, txt, resp.statusText);
        // Retry chỉ với 5xx & 408 & 504 (lỗi tạm thời)
        if (attempt < maxRetries && (resp.status >= 500 || resp.status === 408 || resp.status === 504)) {
          lastErr = err;
          await _bbtnSleep(retryDelay * (attempt + 1));
          continue;
        }
        throw err;
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      const isAbort   = err?.name === 'AbortError';
      const isNetwork = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      // Chỉ retry với timeout & network — không retry với lỗi nghiệp vụ (401/403/parse...)
      if (attempt < maxRetries && (isAbort || isNetwork)) {
        lastErr = isAbort
          ? new Error('[CLIENT_TIMEOUT] Phiên đầu NAS phản hồi chậm — đang thử lại...')
          : err;
        await _bbtnSleep(retryDelay * (attempt + 1));
        continue;
      }
      if (isAbort) throw new Error('[CLIENT_TIMEOUT] NAS phản hồi quá lâu sau ' + Math.round(timeoutMs/1000) + 's — kiểm tra ngrok tunnel & WebDAV');
      throw err;
    }
  }
  throw lastErr || new Error('Edge Function lỗi không xác định');
}

async function _bbtnPropfind(path, opts = {}) {
  // ── Cache hit (trừ khi force refresh) ─────────────────
  if (!opts.noCache) {
    const cached = _bbtnListCache.get(path);
    if (cached && (Date.now() - cached.ts) < _BBTN_LIST_TTL) {
      return cached.items;
    }
  }
  // ── Dedupe đồng thời (cùng path đang fetch → chờ chung) ─
  if (_bbtnInflight.has(path)) return _bbtnInflight.get(path);

  const token = await _authGetToken();
  if (!token) throw new Error('Chưa đăng nhập hoặc phiên hết hạn');

  const edgeUrl = _AUTH_SB_URL.replace(/\/$/, '')
    + '/functions/v1/bbtn-list'
    + '?path=' + encodeURIComponent(path);

  const p = (async () => {
    try {
      // Timeout 50s + 1 retry → tổng có thể 100s nếu ngrok cold start.
      const resp = await _bbtnFetchEdge(edgeUrl, token, { timeoutMs: 50_000, maxRetries: 1 });
      const json = await resp.json();
      if (json.error) throw _bbtnBuildEdgeError(200, JSON.stringify(json), 'Lỗi bbtn-list');
      const items = json.items || [];
      _bbtnListCache.set(path, { ts: Date.now(), items });
      return items;
    } finally {
      _bbtnInflight.delete(path);
    }
  })();
  _bbtnInflight.set(path, p);
  return p;
}

// Cho phép xóa cache (gọi từ _bbtnRefresh)
function _bbtnInvalidateCache(path) {
  if (path) _bbtnListCache.delete(path);
  else _bbtnListCache.clear();
}
window._bbtnInvalidateCache = _bbtnInvalidateCache;

/**
 * Render danh sách items (folder + file)
 * Folders → click vào _bbtnLoadPath
 * Files (PDF, DOC, image) → click mở trong tab mới
 */
function _bbtnRenderItems(items, path, rootPath, depth) {
  const cont = document.getElementById('_bbtnContent');
  if (!cont) return;

  // Lọc file hệ thống / file admin với user thường
  const isAdmin = _authGetSession()?.role === 'admin';
  if (!isAdmin) {
    const SYSTEM_FILE_PATTERNS = [
      /^cloudflared/i,        // cloudflared binary
      /^\./,                   // hidden files (.DS_Store, .git, ...)
      /^thumbs\.db$/i,        // Windows thumbnail cache
      /^desktop\.ini$/i,      // Windows folder config
      /\.tmp$/i, /\.bak$/i,   // temp/backup
      /^@eaDir$/i,            // Synology metadata
    ];
    items = items.filter(it => !SYSTEM_FILE_PATTERNS.some(re => re.test(it.name || '')));
  }

  // Áp filter từ filter bar (search/đội/năm/trạm) — match theo tên thư mục/file
  const flt = window._bbtnFilter || {};
  const filterTokens = [];
  if (flt.search) filterTokens.push(flt.search.toLowerCase());
  if (flt.doi) filterTokens.push(flt.doi.toLowerCase());
  if (flt.nam) filterTokens.push(String(flt.nam).toLowerCase());
  if (flt.tram) filterTokens.push(flt.tram.toLowerCase());
  if (filterTokens.length) {
    items = items.filter(it => {
      const nm = (it.name || '').toLowerCase();
      // Match nếu CHỨA bất kỳ token nào (OR) — UX dễ chịu hơn AND
      return filterTokens.some(tok => nm.includes(tok));
    });
  }

  const fmtSize = b => {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/1024/1024).toFixed(1) + ' MB';
  };
  const fmtDate = d => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  };
  const folders = items.filter(it => it.isFolder);
  const files   = items.filter(it => !it.isFolder);

  if (!items.length) {
    cont.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(180,200,220,.55)">
      <i class="fas fa-folder-open" style="font-size:28px;margin-bottom:10px;display:block;opacity:.4"></i>
      Thư mục trống
    </div>`;
    return;
  }

  // Get folder type label based on depth
  const folderTypes = ['Đơn vị', 'Năm', 'Trạm', 'Loại tài liệu', 'Thư mục con'];
  const folderTypeLbl = folderTypes[depth] || 'Thư mục';

  // Build grid
  let html = '<div style="padding:14px">';
  if (folders.length) {
    html += `<div style="font-size:10px;font-weight:700;color:rgba(180,200,220,.7);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">
      <i class="fas fa-folder" style="color:#ffd740;margin-right:6px"></i>${folderTypeLbl} (${folders.length})
    </div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:18px">';
    // Khi đang ở level mà folder con là Trạm (depth=2: BBTN/Đơn vị/Năm/[Trạm]), enable checkbox để chọn nhiều
    const isTramLevel = depth >= 2;
    folders.forEach(f => {
      const newPath = path.replace(/\/$/,'') + '/' + f.name;
      const safeName = f.name.replace(/'/g,"\\'");
      const isSelected = window._bbtnSelected && window._bbtnSelected.has(f.name);
      const checkboxHtml = isTramLevel
        ? `<div onclick="event.stopPropagation();_bbtnToggleSelect('${safeName}');this.querySelector('input').checked=!this.querySelector('input').checked;this.parentElement.style.borderColor=this.querySelector('input').checked?'#00e676':'rgba(255,215,64,.18)'" style="display:flex;align-items:center;cursor:pointer">
            <input type="checkbox" ${isSelected?'checked':''} style="width:16px;height:16px;cursor:pointer;accent-color:#00e676">
          </div>`
        : '';
      const borderCol = isSelected ? '#00e676' : 'rgba(255,215,64,.18)';
      const bgCol = isSelected ? 'rgba(0,230,118,.06)' : 'rgba(255,215,64,.04)';
      html += `<div style="padding:14px 16px;border-radius:9px;border:1px solid ${borderCol};background:${bgCol};transition:all .15s;display:flex;align-items:center;gap:10px">
        ${checkboxHtml}
        <div onclick="_bbtnLoadPath('${newPath.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;min-width:0"
          onmouseover="this.parentElement.style.borderColor='${isSelected?'#00e676':'rgba(255,215,64,.5)'}'"
          onmouseout="this.parentElement.style.borderColor='${borderCol}'">
          <i class="fas fa-folder" style="font-size:20px;color:#ffd740;flex-shrink:0"></i>
          <div style="min-width:0;flex:1">
            <div style="font-size:11.5px;font-weight:700;color:rgba(240,250,255,.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
            <div style="font-size:9px;color:rgba(180,200,220,.55);margin-top:2px">${fmtDate(f.modified)}</div>
          </div>
          <i class="fas fa-chevron-right" style="font-size:10px;color:rgba(180,200,220,.4);flex-shrink:0"></i>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  if (files.length) {
    html += `<div style="font-size:10px;font-weight:700;color:rgba(180,200,220,.7);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">
      <i class="fas fa-file" style="color:#00c8ff;margin-right:6px"></i>Tài liệu (${files.length})
    </div>`;
    html += `<div style="border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.06)">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:rgba(255,255,255,.04)">
          <th style="padding:8px 12px;text-align:left;font-size:9.5px;color:rgba(200,218,235,.9);font-weight:700;letter-spacing:.05em">Tên file</th>
          <th style="padding:8px 12px;text-align:right;font-size:9.5px;color:rgba(200,218,235,.9);font-weight:700;letter-spacing:.05em">Dung lượng</th>
          <th style="padding:8px 12px;text-align:right;font-size:9.5px;color:rgba(200,218,235,.9);font-weight:700;letter-spacing:.05em">Sửa đổi</th>
          <th style="padding:8px 12px;text-align:center;font-size:9.5px;color:rgba(200,218,235,.9);font-weight:700;letter-spacing:.05em">Hành động</th>
        </tr></thead>
        <tbody>`;
    files.forEach((f, i) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const iconMap = { pdf:['fa-file-pdf','#ff5252'], doc:['fa-file-word','#1565c0'], docx:['fa-file-word','#1565c0'],
                        xls:['fa-file-excel','#00e676'], xlsx:['fa-file-excel','#00e676'],
                        png:['fa-file-image','#e040fb'], jpg:['fa-file-image','#e040fb'], jpeg:['fa-file-image','#e040fb'],
                        zip:['fa-file-archive','#ffd740'], rar:['fa-file-archive','#ffd740'] };
      const [iconCls, iconCol] = iconMap[ext] || ['fa-file','#90a4ae'];
      const safeRelPath = (f.relativePath||'').replace(/'/g,"\\'");
      html += `<tr style="border-top:1px solid rgba(255,255,255,.04);${i%2?'background:rgba(255,255,255,.015)':''}">
        <td style="padding:7px 12px;color:rgba(235,248,255,.92)">
          <i class="fas ${iconCls}" style="color:${iconCol};margin-right:8px;width:14px;text-align:center"></i>${f.name}
        </td>
        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:rgba(180,200,220,.75);font-size:10px">${fmtSize(f.size)}</td>
        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:rgba(180,200,220,.65);font-size:10px">${fmtDate(f.modified)}</td>
        <td style="padding:7px 12px;text-align:center;white-space:nowrap">
          <button onclick="_bbtnViewFile('${safeRelPath}',false)" style="padding:3px 9px;border-radius:5px;border:1px solid rgba(0,200,255,.3);background:rgba(0,200,255,.08);color:var(--accent);font-size:9.5px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-right:4px"><i class="fas fa-eye"></i> Xem</button>
          <button onclick="_bbtnViewFile('${safeRelPath}',true)" style="padding:3px 9px;border-radius:5px;border:1px solid rgba(0,230,118,.3);background:rgba(0,230,118,.08);color:#00e676;font-size:9.5px;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><i class="fas fa-download"></i> Tải</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  html += '</div>';
  cont.innerHTML = html;
}

function _bbtnRefresh() {
  const path = window._bbtnState?.path || NAS_CONFIG.bbtnPath || '/BBTN';
  _bbtnInvalidateCache(path);  // bỏ cache → ép fetch lại từ NAS
  _bbtnLoadPath(path);
}

function _bbtnCopyLink(url) {
  navigator.clipboard?.writeText(url).then(
    () => showChangeNotif('success', 'Đã sao chép link', url.length>60 ? url.substring(0,57)+'...' : url),
    () => showChangeNotif('error', 'Không sao chép được', '')
  );
}

/**
 * Xem hoặc tải file BBTN qua Supabase Edge Function bbtn-download
 * User chỉ cần đăng nhập — không cần NAS config, không lộ NAS URL/credentials
 *
 * NB: timeout 120s + 1 retry; file lớn (PDF scan 20MB) qua ngrok có thể chậm
 *     nhưng Edge Function ta đã stream nên không bị memory bound.
 *
 * Quan trọng: window.open() phải gọi NGAY khi user click (sync), vì user activation
 *     chỉ giữ qua 1 task. Async fetch xong thì activation đã hết → browser block popup.
 */
async function _bbtnViewFile(relativePath, forceDownload) {
  if (!relativePath) { showChangeNotif('error','Lỗi','Không có đường dẫn file'); return; }
  const fileName = decodeURIComponent(relativePath.split('/').pop() || 'file');

  // ── Mở tab NGAY (sync) để giữ user activation ──
  // Phải làm trước khi await bất kỳ promise nào.
  let tab = null;
  if (!forceDownload) {
    tab = window.open('about:blank', '_blank');
    if (tab) {
      // Hiển thị loading trong tab mới trong khi đợi fetch
      try {
        tab.document.write('<!doctype html><title>Đang tải ' + fileName + '...</title>' +
          '<style>body{font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;' +
          'align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}' +
          '.s{width:32px;height:32px;border:3px solid #30363d;border-top-color:#58a6ff;' +
          'border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}' +
          '@keyframes s{to{transform:rotate(360deg)}}</style>' +
          '<div><div class="s"></div>Đang tải file...<br><small style="opacity:.6">' + fileName + '</small></div>');
      } catch (_) { /* same-origin restrict */ }
    } else {
      // Popup bị chặn từ đầu → tự động fallback sang download
      showChangeNotif('warn', 'Popup bị chặn — đang tải về', fileName);
      forceDownload = true;
    }
  }

  if (forceDownload) showChangeNotif('info', 'Đang tải file...', fileName);

  try {
    const token = await _authGetToken();
    if (!token) { showChangeNotif('error','Chưa đăng nhập','Vui lòng đăng nhập lại'); if (tab) tab.close(); return; }

    const edgeBase = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/bbtn-download';
    const url = edgeBase + '?path=' + encodeURIComponent(relativePath) + (forceDownload ? '&download=1' : '');

    // 120s + 1 retry → đủ cho file PDF 20MB qua ngrok cold tunnel
    const resp = await _bbtnFetchEdge(url, token, { timeoutMs: 120_000, maxRetries: 1 });
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (forceDownload) {
      const a = document.createElement('a');
      a.href = blobUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      showChangeNotif('success', 'Đang tải xuống', fileName);
    } else {
      // Tab đã mở từ đầu — set location tới blob
      tab.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  } catch (err) {
    console.error('[_bbtnViewFile]', err);
    if (tab && !tab.closed) tab.close();
    showChangeNotif('error', 'Lỗi tải file', err.message || 'Vui lòng thử lại');
  }
}

function _bbtnExportMonth(mk){const m=(window._bbtnByMonth||{})[mk];if(m)_bbtnDoExport(m.rows,'BBTN_'+mk);}
function _bbtnExportAll(){_bbtnDoExport(window._bbtnCompleted||[],'BBTN_ToanBo');}
function _bbtnDoExport(rows,filename){
  const capLbl={'2':'220kV','1':'110kV','3':'35kV','4':'22kV','9':'10kV','6':'6kV','0':'TT'};
  const esc=v=>'"'+(String(v||'').replace(/"/g,'""'))+'"';
  const fD=v=>{if(!v)return'';const d=new Date(v);return isNaN(d)?v:d.toLocaleDateString('vi-VN');};
  const hdr='Trạm,Cấp ĐA,Loại TB,Tên/KH,Ngăn TB,Ngày TN,Hạn TN,TN tiếp theo';
  const body=rows.map(r=>[r.Tram,capLbl[String(r.Cap_dien_ap??'')]||r.Cap_dien_ap,r.Phan_loai_thiet_bi,r.Ten_thiet_bi,r.Ngan_thiet_bi,fD(r.Ngay_thi_nghiem),r.Han_thi_nghiem,fD(r.Thoi_gian_thi_nghiem_tiep_theo)].map(esc).join(','));
  const csv='\uFEFF'+[hdr,...body].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=filename+'.csv';a.click();
}
// ── Cài đặt NAS — mở modal cấu hình đầy đủ ─────────────
function _bbtnConfigNAS() { _nasOpenSettings(); }

function _nasOpenSettings() {
  const existing = document.getElementById('_nasSettingsModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = '_nasSettingsModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px)';

  const f = NAS_CONFIG;
  modal.innerHTML = `<div style="background:#1a1f2e;border:1px solid rgba(0,200,255,.3);border-radius:12px;padding:24px;width:min(560px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:15px;font-weight:800;color:rgba(240,250,255,.97)"><i class="fas fa-server" style="color:var(--accent);margin-right:8px"></i>Cài đặt NAS Synology</div>
        <div style="font-size:10px;color:rgba(180,200,220,.6);margin-top:3px">Kết nối qua WebDAV Protocol</div>
      </div>
      <button onclick="document.getElementById('_nasSettingsModal').remove()" style="background:none;border:none;color:rgba(200,220,235,.6);font-size:18px;cursor:pointer">✕</button>
    </div>

    <!-- Connection status -->
    <div id="_nas_status" style="margin-bottom:16px;padding:8px 12px;border-radius:7px;background:rgba(255,255,255,.04);font-size:11px;color:rgba(180,200,220,.7)">
      ${f.enabled ? '<span style="color:#00e676">● Đã kết nối — ' + f.baseUrl + '</span>' : '● Chưa cấu hình'}
    </div>

    <div style="display:grid;gap:12px">
      <div>
        <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">URL NAS <span style="color:rgba(255,82,82,.8)">*</span></label>
        <input id="_nas_url" type="text" value="${f.baseUrl||''}" placeholder="http://192.168.1.100:5005 hoặc https://nas.domain.vn"
          style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
        <div style="font-size:9px;color:rgba(180,200,220,.5);margin-top:3px">Port mặc định WebDAV Synology: 5005 (HTTP) / 5006 (HTTPS)</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Tên đăng nhập NAS <span style="color:rgba(255,82,82,.8)">*</span></label>
          <input id="_nas_user" type="text" value="${f.username||''}" placeholder="admin"
            style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Mật khẩu</label>
          <div style="position:relative">
            <input id="_nas_pass" type="password" value="${f.password||''}" placeholder="••••••••"
              style="width:100%;padding:8px 30px 8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
            <button onclick="const i=document.getElementById('_nas_pass');i.type=i.type==='password'?'text':'password'" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(180,200,220,.6);cursor:pointer;padding:0"><i class="fas fa-eye"></i></button>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Thư mục BBTN</label>
          <input id="_nas_bbtn" type="text" value="${f.bbtnPath||'/webdav/EVNHANOI/BBTN'}" placeholder="/webdav/EVNHANOI/BBTN"
            style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Thư mục ảnh TNĐK</label>
          <input id="_nas_photo" type="text" value="${f.photoPath||'/webdav/EVNHANOI/TNDK'}" placeholder="/webdav/EVNHANOI/TNDK"
            style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
        </div>
      </div>

      <!-- Hướng dẫn -->
      <details style="margin-top:4px">
        <summary style="font-size:10px;color:rgba(0,200,255,.7);cursor:pointer;user-select:none">ℹ️ Hướng dẫn bật WebDAV trên Synology</summary>
        <div style="margin-top:8px;padding:10px;background:rgba(0,0,0,.2);border-radius:7px;font-size:10px;color:rgba(180,200,220,.75);line-height:1.7">
          1. Mở <b>DSM > Control Panel > File Services > WebDAV</b><br>
          2. Tích <b>Enable WebDAV</b> (port 5005) hoặc <b>WebDAV HTTPS</b> (port 5006)<br>
          3. Tạo Shared Folder tên <b>EVNHANOI</b> → tạo sub-folder <b>BBTN</b>, <b>TNDK</b><br>
          4. Cấp quyền Read/Write cho user NAS vào folder trên<br>
          5. Nếu dùng từ mạng ngoài: cần port-forward hoặc QuickConnect/DDNS<br>
          <span style="color:rgba(255,215,64,.7)">⚠ CORS: Nếu bị lỗi CORS, bật <b>Reverse Proxy</b> trên NAS và thêm header Access-Control-Allow-Origin</span>
        </div>
      </details>
    </div>

    <div style="display:flex;gap:8px;margin-top:20px;align-items:center">
      <button onclick="_nasTestAndShow()" id="_nas_test_btn" style="padding:8px 16px;border-radius:7px;border:1px solid rgba(0,200,255,.3);background:rgba(0,200,255,.08);color:var(--accent);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px"><i class="fas fa-plug"></i> Kiểm tra kết nối</button>
      <div style="flex:1"></div>
      <button onclick="document.getElementById('_nasSettingsModal').remove()" style="padding:8px 16px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:none;color:rgba(200,218,235,.8);cursor:pointer;font-size:11px">Hủy</button>
      <button onclick="_nasSaveAndClose()" style="padding:8px 18px;border-radius:7px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:6px"><i class="fas fa-save"></i> Lưu cấu hình</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

async function _nasTestAndShow() {
  const btn = document.getElementById('_nas_test_btn');
  const statusEl = document.getElementById('_nas_status');
  // Read current form values
  const testCfg = {
    baseUrl:   document.getElementById('_nas_url')?.value?.trim() || '',
    username:  document.getElementById('_nas_user')?.value?.trim() || '',
    password:  document.getElementById('_nas_pass')?.value || '',
    webdavPath: document.getElementById('_nas_bbtn')?.value?.split('/').slice(0,2).join('/') || '/webdav',
  };
  if (!testCfg.baseUrl) { if(statusEl) statusEl.innerHTML='<span style="color:#ff9100">⚠ Nhập URL NAS trước</span>'; return; }
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...'; }
  // Temporarily apply for test
  const prevCfg = {...NAS_CONFIG};
  Object.assign(NAS_CONFIG, testCfg);
  const result = await nasTestConnection();
  Object.assign(NAS_CONFIG, prevCfg); // restore
  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-plug"></i> Kiểm tra kết nối'; }
  if (statusEl) statusEl.innerHTML = result.ok
    ? `<span style="color:#00e676">● ${result.msg}</span>`
    : `<span style="color:#ff5252">✗ ${result.msg}</span>`;
}

function _nasSaveAndClose() {
  const baseUrl  = document.getElementById('_nas_url')?.value?.trim() || '';
  const username = document.getElementById('_nas_user')?.value?.trim() || '';
  const password = document.getElementById('_nas_pass')?.value || '';
  const bbtnPath = document.getElementById('_nas_bbtn')?.value?.trim() || '/webdav/EVNHANOI/BBTN';
  const photoPath= document.getElementById('_nas_photo')?.value?.trim() || '/webdav/EVNHANOI/TNDK';
  nasSaveConfig({ baseUrl, username, password, bbtnPath, photoPath,
                  webdavPath: bbtnPath.split('/').slice(0,2).join('/') || '/webdav' });
  document.getElementById('_nasSettingsModal')?.remove();
  showChangeNotif('success', 'Đã lưu cấu hình NAS',
    baseUrl ? `${baseUrl} · User: ${username}` : 'Đã xóa cấu hình NAS');
  if (typeof _bbtnRenderPage === 'function') _bbtnRenderPage();
}

// ══════════════════════════════════════════════════════
// FIX 4: TNĐK - User Update Request System
// User clicks row → modal form to request update
// Admin approves/rejects in panel
// Data stored in Supabase table: tn_update_requests
// ══════════════════════════════════════════════════════

// Pending requests state (in-memory + Supabase)
window._tnPendingRequests = [];

async function _tnLoadPendingRequests() {
  if (!window._sbClient) return;
  try {
    const { data } = await window._sbClient
      .from('tn_update_requests')
      .select('*')
      .order('created_at', { ascending: false });
    window._tnPendingRequests = data || [];
  } catch(e) { console.warn('loadPending:', e); }
}

// ── Row click: open update request modal ──────────────
function _tnOpenUpdateModal(row) {
  const fmtD = v => { if(!v)return'';const d=new Date(v);return isNaN(d)?v:d.toISOString().split('T')[0]; };
  const existing = { Ten_thiet_bi: row.Ten_thiet_bi||'', So_luong: row.So_luong||'', Ngay_thi_nghiem: fmtD(row.Ngay_thi_nghiem) };
  const modal = document.createElement('div');
  modal.id = '_tnUpdateModal';
  modal.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(4px)';
  modal.innerHTML=`<div style="background:#1a1f2e;border:1px solid rgba(0,200,255,.3);border-radius:12px;padding:24px;width:min(520px,90vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:15px;font-weight:800;color:rgba(240,250,255,.97)">📝 Đề nghị cập nhật thiết bị</div>
        <div style="font-size:10px;color:rgba(180,200,220,.7);margin-top:3px">${row.Tram||'—'} · ${row.Phan_loai_thiet_bi||'—'} · ${row.Ngan_thiet_bi||row.Ten_thiet_bi||'—'}</div>
      </div>
      <button onclick="document.getElementById('_tnUpdateModal').remove()" style="background:none;border:none;color:rgba(200,220,235,.6);font-size:18px;cursor:pointer;padding:4px">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Tên thiết bị (hiện: ${row.Ten_thiet_bi||'—'})</label>
        <input id="_req_ten" type="text" value="${existing.Ten_thiet_bi}" placeholder="Tên thiết bị mới..."
          style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Số lượng (hiện: ${row.So_luong||'—'})</label>
        <input id="_req_sl" type="number" value="${existing.So_luong}" placeholder="Số lượng..."
          style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
      </div>
    </div>
    <div style="margin-bottom:16px">
      <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Ngày TN thực tế (hiện: ${row.Ngay_thi_nghiem ? new Date(row.Ngay_thi_nghiem).toLocaleDateString('vi-VN') : '—'})</label>
      <input id="_req_ngay" type="date" value="${existing.Ngay_thi_nghiem}"
        style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box">
    </div>
    <div style="margin-bottom:16px">
      <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">Lý do / Ghi chú đề nghị cập nhật *</label>
      <textarea id="_req_note" rows="3" placeholder="Mô tả lý do cập nhật..."
        style="width:100%;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:rgba(235,248,255,.9);font-size:11.5px;outline:none;box-sizing:border-box;resize:vertical"></textarea>
    </div>
    <div style="margin-bottom:20px">
      <label style="font-size:10px;color:rgba(180,200,220,.8);display:block;margin-bottom:5px">
        Hình ảnh thiết bị
        ${NAS_CONFIG.enabled
          ? '<span style=\"color:#00e676;margin-left:4px\">● NAS đã kết nối — sẽ tải lên WebDAV</span>'
          : '<span style=\"color:#ff9100;margin-left:4px\">⚠ NAS chưa cấu hình — <a onclick=\"_nasOpenSettings()\" style=\"color:var(--accent);cursor:pointer;text-decoration:underline\">Cấu hình NAS</a></span>'}
      </label>
      <div style="border:2px dashed ${NAS_CONFIG.enabled?'rgba(0,230,118,.3)':'rgba(255,145,0,.25)'};border-radius:8px;padding:16px;text-align:center;cursor:pointer;background:${NAS_CONFIG.enabled?'rgba(0,230,118,.03)':'rgba(255,145,0,.03)'}" onclick="document.getElementById('_req_photo').click()">
        <i class="fas fa-cloud-upload-alt" style="font-size:20px;color:rgba(0,200,255,.5);margin-bottom:6px"></i>
        <div style="font-size:11px;color:rgba(180,200,220,.7)" id="_req_photo_lbl">
          ${NAS_CONFIG.enabled ? 'Nhấp để chọn ảnh → tải lên NAS WebDAV' : 'Nhấp để chọn ảnh (JPG, PNG, max 10MB)'}
        </div>
        <input type="file" id="_req_photo" accept="image/*" style="display:none" onchange="_tnPhotoSelected(this)">
      </div></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button onclick="document.getElementById('_tnUpdateModal').remove()" style="padding:8px 18px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:none;color:rgba(200,218,235,.8);cursor:pointer;font-size:12px">Hủy</button>
      <button onclick="_tnSubmitRequest(${JSON.stringify(row).replace(/"/g,'&quot;')})" style="padding:8px 18px;border-radius:7px;border:none;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px"><i class="fas fa-paper-plane"></i> Gửi đề nghị</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function _tnPhotoSelected(input) {
  const f = input.files[0]; if (!f) return;
  const lbl = document.getElementById('_req_photo_lbl');
  const mb = (f.size/1024/1024).toFixed(1);
  if (mb > 10) {
    showChangeNotif('error','File quá lớn', `${mb}MB — tối đa 10MB`);
    input.value = '';
    if (lbl) lbl.innerHTML = 'Nhấp để chọn ảnh (JPG, PNG, max 10MB)';
    return;
  }
  const dest = NAS_CONFIG.enabled
    ? `→ NAS: ${NAS_CONFIG.photoPath.split('/').slice(-1)[0]}/<trạm>/`
    : '(NAS chưa cấu hình)';
  if (lbl) lbl.innerHTML = `<span style="color:#00e676">✅ ${f.name}</span> <span style="color:rgba(180,200,220,.6)">${mb}MB ${dest}</span>`;
}

async function _tnSubmitRequest(origRow) {
  const ten   = document.getElementById('_req_ten')?.value?.trim();
  const sl    = document.getElementById('_req_sl')?.value?.trim();
  const ngay  = document.getElementById('_req_ngay')?.value?.trim();
  const note  = document.getElementById('_req_note')?.value?.trim();
  const photo = document.getElementById('_req_photo')?.files?.[0];

  if (!note) { showChangeNotif('error','Thiếu thông tin','Vui lòng nhập lý do đề nghị cập nhật'); return; }
  if (!ten && !sl && !ngay && !photo) { showChangeNotif('error','Thiếu thông tin','Vui lòng cập nhật ít nhất một trường'); return; }

  const btn = document.querySelector('#_tnUpdateModal button[onclick*="_tnSubmitRequest"]');
  const setLoading = (msg) => { if (btn) { btn.disabled=true; btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> ${msg}`; }};
  const setIdle    = () => { if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Gửi đề nghị'; }};

  setLoading('Đang xử lý...');

  // ── BƯỚC 1: Upload ảnh lên NAS WebDAV ──────────────────
  // Theo diagram: User → HTTP PUT (binary) → NAS → return URL
  let photoNasUrl  = '';
  let photoNasPath = '';
  if (photo) {
    if (!NAS_CONFIG.enabled) {
      // NAS chưa cấu hình → hỏi user có muốn cấu hình không
      const go = confirm('Ảnh không thể tải lên vì NAS chưa được cấu hình.\nBấm OK để mở Cài đặt NAS ngay, hoặc Cancel để gửi không kèm ảnh.');
      if (go) { setIdle(); document.getElementById('_tnUpdateModal')?.remove(); _nasOpenSettings(); return; }
    } else {
      setLoading('Đang tải ảnh lên NAS...');
      try {
        // Tạo thư mục nếu chưa có
        const tramFolder = `${NAS_CONFIG.photoPath}/${(origRow.Tram||'').replace(/[^a-zA-Z0-9_-]/g,'_')}`;
        await nasMkdir(tramFolder);
        // Upload file → HTTP PUT → NAS trả 201/204 khi thành công
        const prefix = `${(origRow.Tram||'').replace(/\s/g,'_')}_${(origRow.Ngan_thiet_bi||'').replace(/\s/g,'_')}`;
        const result  = await nasUploadFile(photo, tramFolder, prefix);
        photoNasUrl   = result.url;
        photoNasPath  = result.path;
        showChangeNotif('success','Ảnh đã tải lên NAS', result.path.split('/').pop());
      } catch(e) {
        console.error('NAS upload error:', e);
        const skip = confirm(`Không tải được ảnh lên NAS:\n${e.message}\n\nBấm OK để gửi đề nghị KHÔNG có ảnh, Cancel để hủy.`);
        if (!skip) { setIdle(); return; }
      }
    }
  }

  // ── BƯỚC 2: Lưu metadata + URL vào Supabase ─────────────
  // Theo diagram: Insert metadata & file URL → Supabase UpdateRequests
  setLoading('Đang lưu đề nghị...');
  const sess = _authGetSession();
  const request = {
    tram:              origRow.Tram              || '',
    ngan_thiet_bi:     origRow.Ngan_thiet_bi     || '',
    loai_tb:           origRow.Phan_loai_thiet_bi|| '',
    ten_cu:            origRow.Ten_thiet_bi       || '',
    ten_moi:           ten  || null,
    so_luong_cu:       origRow.So_luong           || null,
    so_luong_moi:      sl   ? Number(sl)  : null,
    ngay_tn_cu:        origRow.Ngay_thi_nghiem    || null,
    ngay_tn_moi:       ngay || null,
    ghi_chu:           note,
    photo_path:        photoNasPath               || null,  // path trên NAS
    photo_url:         photoNasUrl                || null,  // full URL có thể xem
    nguoi_gui:         sess?.email                || 'anonymous',
    trang_thai:        'cho_duyet',
    created_at:        new Date().toISOString(),
  };

  try {
    if (window._sbClient) {
      const { error } = await window._sbClient.from('tn_update_requests').insert([request]);
      if (error) throw error;
    } else {
      (window._tnPendingRequests = window._tnPendingRequests||[]).push({...request, id: Date.now()+'_local'});
    }
    document.getElementById('_tnUpdateModal')?.remove();
    showChangeNotif('success','Đã gửi đề nghị cập nhật',
      photoNasUrl ? 'Kèm ảnh từ NAS · Admin sẽ phê duyệt' : 'Admin sẽ xem xét và phê duyệt');
  } catch(e) {
    console.error('Supabase insert error:', e);
    showChangeNotif('error','Lỗi lưu đề nghị', e.message||'');
    setIdle();
  }
}

// ── Admin: Phê duyệt panel ──────────────────────────
async function _tnShowPendingRequests() {
  await _tnLoadPendingRequests();
  const reqs = window._tnPendingRequests || [];
  const fmtD = v => v ? new Date(v).toLocaleDateString('vi-VN') : '—';
  const pending = reqs.filter(r=>r.trang_thai==='cho_duyet');
  const modal = document.createElement('div');
  modal.id = '_tnAdminModal';
  modal.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(4px)';
  const rows_html = pending.length ? pending.map((r,i)=>`<tr style="border-bottom:1px solid rgba(255,255,255,.06)">
    <td style="padding:7px 10px;font-size:10px;color:rgba(235,248,255,.9);font-weight:600">${r.tram}</td>
    <td style="padding:7px 10px;font-size:10px;color:rgba(210,230,245,.85)">${r.ngan_thiet_bi}</td>
    <td style="padding:7px 10px;font-size:10px;color:rgba(210,230,245,.85)">${r.loai_tb}</td>
    <td style="padding:7px 10px;font-size:10px">
      ${r.ten_moi?`<div><span style="color:rgba(180,200,215,.6);font-size:9px">Tên:</span> <span style="color:rgba(255,215,64,.9)">${r.ten_moi}</span> <span style="color:rgba(150,170,190,.5)">(cũ: ${r.ten_cu||'—'})</span></div>`:''}
      ${r.so_luong_moi!=null?`<div><span style="color:rgba(180,200,215,.6);font-size:9px">SL:</span> <span style="color:#00e676">${r.so_luong_moi}</span> <span style="color:rgba(150,170,190,.5)">(cũ: ${r.so_luong_cu||'—'})</span></div>`:''}
      ${r.ngay_tn_moi?`<div><span style="color:rgba(180,200,215,.6);font-size:9px">Ngày TN:</span> <span style="color:#00c8ff">${fmtD(r.ngay_tn_moi)}</span></div>`:''}
    </td>
    <td style="padding:7px 10px;font-size:10px;color:rgba(200,220,235,.7)">${r.ghi_chu}</td>
    <td style="padding:7px 10px;font-size:10px">
      ${r.photo_url ? `<a href="${r.photo_url}" target="_blank" style="color:var(--accent);font-size:9px;display:flex;align-items:center;gap:4px"><i class="fas fa-image"></i> Xem ảnh</a>` : '<span style="color:rgba(180,200,220,.4)">—</span>'}
    </td>
    <td style="padding:7px 10px;font-size:10px;color:rgba(180,200,215,.6)">${r.nguoi_gui}<br>${fmtD(r.created_at)}</td>
    <td style="padding:7px 10px">
      <div style="display:flex;gap:5px">
        <button onclick="_tnApproveRequest('${r.id||i}',true,${JSON.stringify(r).replace(/"/g,'&quot;')})" style="padding:3px 10px;border-radius:5px;border:none;background:#00e676;color:#000;font-size:9px;font-weight:700;cursor:pointer">✓ Duyệt</button>
        <button onclick="_tnApproveRequest('${r.id||i}',false,${JSON.stringify(r).replace(/"/g,'&quot;')})" style="padding:3px 10px;border-radius:5px;border:none;background:#ff5252;color:#fff;font-size:9px;font-weight:700;cursor:pointer">✗ Từ chối</button>
      </div>
    </td>
  </tr>`).join('') : `<tr><td colspan="7" style="padding:30px;text-align:center;color:rgba(180,200,220,.6)">Không có đề nghị chờ duyệt</td></tr>`;

  modal.innerHTML=`<div style="background:#1a1f2e;border:1px solid rgba(0,200,255,.3);border-radius:12px;padding:24px;width:min(900px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div style="font-size:15px;font-weight:800;color:rgba(240,250,255,.97)">🔐 Phê duyệt đề nghị cập nhật TNĐK <span style="font-size:12px;font-weight:400;color:${pending.length?'#ff9100':'#00e676'}">(${pending.length} chờ duyệt)</span></div>
      <button onclick="document.getElementById('_tnAdminModal').remove()" style="background:none;border:none;color:rgba(200,220,235,.6);font-size:18px;cursor:pointer">✕</button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)">
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Trạm</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Ngăn</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Loại TB</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Thay đổi đề nghị</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Lý do</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:left">Người gửi</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700;text-align:center">Ảnh NAS</th>
          <th style="padding:7px 10px;font-size:9px;color:rgba(200,218,235,.9);font-weight:700">Hành động</th>
        </tr></thead>
        <tbody>${rows_html}</tbody>
      </table>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e=>{if(e.target===modal)modal.remove();});
}

async function _tnApproveRequest(reqId, approved, reqData) {
  const action = approved ? 'da_duyet' : 'tu_choi';
  const reason = approved ? '' : (prompt('Lý do từ chối (tùy chọn):') || '');
  try {
    if (window._sbClient && reqData.id) {
      // Update request status
      await window._sbClient.from('tn_update_requests').update({ trang_thai: action, admin_note: reason }).eq('id', reqData.id);
      // If approved, update CongTacThiNghiem + TongHopThietBi
        if (approved) {
          const updates = {};
          if (reqData.ten_moi)        updates.Ten_thiet_bi     = reqData.ten_moi;
          if (reqData.so_luong_moi)   updates.So_luong         = reqData.so_luong_moi;
          if (reqData.ngay_tn_moi)    updates.Ngay_thi_nghiem  = reqData.ngay_tn_moi;
          if (reqData.photo_url)      updates.photo_url        = reqData.photo_url;
          if (Object.keys(updates).length) {
            await window._sbClient.from('CongTacThiNghiem').update(updates)
              .eq('Tram', reqData.tram).eq('Ngan_thiet_bi', reqData.ngan_thiet_bi).eq('Phan_loai_thiet_bi', reqData.loai_tb);
            if (reqData.ten_moi || reqData.so_luong_moi) {
              const tb2 = {};
              if (reqData.ten_moi)      tb2.Ten_thiet_bi = reqData.ten_moi;
              if (reqData.so_luong_moi) tb2.So_luong     = reqData.so_luong_moi;
              await window._sbClient.from('TongHopThietBi').update(tb2)
                .eq('Tram', reqData.tram).eq('Ngan_thiet_bi', reqData.ngan_thiet_bi).eq('Phan_loai_thiet_bi', reqData.loai_tb).limit(1);
            }
          }
      }
    } else {
      // Local fallback
      const idx = (window._tnPendingRequests||[]).findIndex(r=>r===reqData);
      if (idx>=0) window._tnPendingRequests[idx].trang_thai = action;
    }
    document.getElementById('_tnAdminModal')?.remove();
    showChangeNotif(approved?'success':'info', approved?'Đã duyệt và cập nhật dữ liệu':'Đã từ chối đề nghị', '');
    if (approved && typeof _tnFetchData === 'function') _tnFetchData();
  } catch(e) {
    showChangeNotif('error','Lỗi xử lý', e.message||'');
  }
}

// NavExtMap for BBTN
// Define which nav items each role can access
// Phương án C: User được vào tất cả menu (xem-only).
// Chỉ chặn các trang admin/editor (Layout editor đã bị ẩn UI bởi CSS user-mode).
const _navUserBlocked = []; // để rỗng = không chặn page nào với user

const _navExtMapBBTN = {
  'Quản lý BBTN': _bbtnRenderPage,
  'Upload TNĐK': () => {
    // Show uploadSection, hide overlay/canvas
    const ov=document.getElementById('tbPageOverlay');
    const cv=document.getElementById('canvasArea');
    const rp=document.querySelector('.props-panel');
    const sec=document.getElementById('uploadSection');
    if(ov){ov.style.display='none';}
    if(cv){cv.style.display='none';}
    if(rp){rp.style.display='none';}
    if(sec){sec.style.display='block'; if(typeof _uploadUpdateNasStatus==='function')_uploadUpdateNasStatus();}
  },
};
(function(){
  const orig = window.navActivate;
  window.navActivate = function(el) {
    const text = (el.querySelector('span')?.textContent||el.textContent||'').trim();
    // Role gate: user bị chặn các page trong _navUserBlocked
    const sess = (typeof _authGetSession==='function') ? _authGetSession() : null;
    if (sess?.role === 'user' && _navUserBlocked.includes(text)) {
      if (typeof showChangeNotif === 'function') showChangeNotif('warn','Truy cập bị giới hạn','Tính năng này chỉ dành cho admin');
      return;
    }
    if (_navExtMapBBTN[text]) {
      document.querySelectorAll('.nav-item.active,.nav-sub-item.active').forEach(e=>e.classList.remove('active'));
      el.classList.add('active');
      const ov=document.getElementById('tbPageOverlay'),cv=document.getElementById('canvasArea'),rp=document.querySelector('.props-panel');
      if(ov){if(cv)cv.style.display='none';if(rp)rp.style.display='none';ov.style.display='block';}
      const _handler=_navExtMapBBTN[text];
      if(_tnRawData.length||_tnAllData.length){_handler();}
      else{if(ov)ov.innerHTML='<div style="padding:40px;text-align:center;color:rgba(180,200,220,.6)"><i class="fas fa-spinner fa-spin" style="color:var(--accent);margin-right:8px"></i>Đang tải...</div>';if(typeof _tnFetchData==='function')_tnFetchData().then(()=>_handler());}
      return;
    }
    // Đóng upload section nếu đang mở (khi navigate sang trang khác)
    const uploadSec = document.getElementById('uploadSection');
    if (uploadSec && uploadSec.style.display !== 'none') uploadSec.style.display = 'none';

    // Khi quay về Dashboard hoặc page khác: clear overlay BBTN content + restore canvas
    if (text === 'Dashboard') {
      const ov=document.getElementById('tbPageOverlay'),cv=document.getElementById('canvasArea'),rp=document.querySelector('.props-panel');
      if(ov){ov.style.display='none'; ov.innerHTML='';}  // clear BBTN content để không tốn memory
      if(cv){cv.style.display='';}
      if(rp){rp.style.display='';}
      // Re-render dashboard để đảm bảo state đúng
      document.querySelectorAll('.nav-item.active,.nav-sub-item.active').forEach(e=>e.classList.remove('active'));
      el.classList.add('active');
      if (typeof render === 'function') render();
      return;
    }

    if(orig) orig.call(this,el);
  };
})();


// ═══════════════════════════════════════════════════════════════
// MODULE: ASSET ATTACHMENTS (Ảnh & Tài liệu thiết bị)
// 
// Tích hợp vào panel _tbShowLyLich — áp dụng cho TẤT CẢ loại thiết bị
// (MBA, MC, DCL, TU, TI, CSV, Cáp, MBATD, ...) miễn là panel mở qua
// _tbShowLyLich (tức là Bảng "Lý lịch chi tiết" trong sidebar Thiết bị).
//
// Phụ thuộc:
//   - _AUTH_SB_URL, _AUTH_SB_KEY, _authGetToken(), _authGetSession()
//   - window._sbClient (Supabase JS client)
//   - window._tbFiltered (đã expose ở _lfApply)
//   - window._tbCurrentRow (đã set ở _tbShowLyLich)
// ═══════════════════════════════════════════════════════════════

/** Lấy row hiện tại từ _tbFiltered[idx] hoặc fallback _tbCurrentRow */
function _assetGetRow(idx) {
  if (window._tbFiltered && window._tbFiltered[idx]) return window._tbFiltered[idx];
  if (window._tbCurrentRow) return window._tbCurrentRow;
  try { if (typeof _tbFiltered !== 'undefined' && _tbFiltered[idx]) return _tbFiltered[idx]; } catch(e){}
  return null;
}

/** Tạo asset_key (định danh thiết bị) từ 5 trường */
function makeAssetKey(r) {
  return [
    r.Tram,
    r.Cap_dien_ap,
    r.Phan_loai_thiet_bi,
    r.Ten_thiet_bi,
    r.Ngan_thiet_bi
  ]
    .map(v => String(v || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, ''))
    .join('__');
}

/** Section HTML cho ảnh & tài liệu (inject vào _tbShowLyLich) */
function _assetSectionHtml(idx) {
  return `
  <div id="_assetSection_${idx}" style="margin-top:14px;border-top:1px solid rgba(255,255,255,.07);padding-top:14px">
    <div style="font-size:9px;color:var(--text-muted);margin-bottom:8px;font-weight:700;letter-spacing:.5px">
      ẢNH & TÀI LIỆU ĐÍNH KÈM
    </div>
    <div id="_assetGallery_${idx}" style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px 0">
        <i class="fas fa-spinner fa-spin" style="margin-right:5px"></i>Đang tải...
      </div>
    </div>

    <!-- Form upload -->
    <div style="background:rgba(0,230,118,.04);border:1px dashed rgba(0,230,118,.3);
                border-radius:7px;padding:10px;margin-top:8px">
      <input type="file" id="_assetFile_${idx}" style="display:none"
             accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
             onchange="_assetFileChosen(${idx})">
      <button onclick="document.getElementById('_assetFile_${idx}').click()"
        style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(0,230,118,.3);
               background:rgba(0,230,118,.08);color:#00e676;cursor:pointer;font-size:11px;
               margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-paperclip"></i> Chọn ảnh hoặc tài liệu
      </button>
      <div id="_assetFileLbl_${idx}" style="font-size:10px;color:rgba(180,200,220,.6);
                                            text-align:center;margin-bottom:6px;min-height:14px">
        Chưa chọn file
      </div>
      <input id="_assetNote_${idx}" type="text" placeholder="Ghi chú (vd: Ảnh tem, Biên bản TN T6/2025...)"
        style="width:100%;padding:7px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.12);
               background:rgba(255,255,255,.04);color:rgba(235,248,255,.9);font-size:10.5px;
               outline:none;box-sizing:border-box;margin-bottom:6px">
      <button id="_assetBtn_${idx}" onclick="_assetDoUpload(${idx})"
        style="width:100%;padding:8px;border-radius:6px;border:none;background:#00e676;
               color:#000;font-weight:700;cursor:pointer;font-size:11px;
               display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-upload"></i> Tải lên NAS
      </button>
      <div id="_assetStatus_${idx}" style="font-size:10px;margin-top:6px;
                                            min-height:14px;text-align:center"></div>
    </div>
  </div>`;
}

/** Khi user chọn file → hiện tên + size */
function _assetFileChosen(idx) {
  const inp = document.getElementById('_assetFile_' + idx);
  const lbl = document.getElementById('_assetFileLbl_' + idx);
  const f = inp?.files?.[0];
  if (!f || !lbl) return;
  const mb = (f.size / 1024 / 1024).toFixed(1);
  // Đồng bộ với _assetDoUpload (40MB) và Edge Function asset-upload (40MB)
  const max = 40;
  if (parseFloat(mb) > max) {
    lbl.innerHTML = `<span style="color:#ff5252">⚠ File quá lớn (${mb}MB) — tối đa ${max}MB</span>`;
    inp.value = '';
    return;
  }
  const isImg = f.type.startsWith('image/');
  lbl.innerHTML = `<span style="color:${isImg ? '#00e676' : '#0096ff'}">
    <i class="fas fa-${isImg ? 'image' : 'file-alt'}"></i> ${f.name}</span>
    <span style="color:rgba(180,200,220,.5)"> · ${mb}MB</span>`;
}

/** Load gallery (ảnh + tài liệu đã có) từ Supabase */
// ════════════════════════════════════════════════════════════════
// Tối ưu #12: Lazy load gallery thumbnails
// - IntersectionObserver chỉ load ảnh khi scroll tới
// - Cache blob URL trong Map để mở lại không phải tải lại
// - Auto cleanup blob URL khi tab đóng
// ════════════════════════════════════════════════════════════════

const _assetThumbCache = new Map();  // id → blobUrl
let _assetThumbObserver = null;

async function _assetFetchThumb(id) {
  // Cache hit
  if (_assetThumbCache.has(id)) return _assetThumbCache.get(id);

  try {
    const token = await _authGetToken();
    if (!token) return null;

    const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/asset-download?id=' + id;
    // 30s timeout cho thumb — ngrok cold start có thể 5-8s đầu
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 30_000);
    const resp = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': _AUTH_SB_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tid));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    _assetThumbCache.set(id, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn('[thumb] Failed to load id=' + id, e);
    return null;
  }
}

function _assetSetupLazyThumbs(container) {
  // Tìm tất cả ảnh chưa load trong container
  const lazyImgs = container.querySelectorAll('img[data-asset-thumb]');
  if (!lazyImgs.length) return;

  // Init observer (chỉ 1 lần)
  if (!_assetThumbObserver) {
    _assetThumbObserver = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        _assetThumbObserver.unobserve(img);  // load 1 lần thôi

        const id = parseInt(img.dataset.assetThumb, 10);
        if (!id) return;

        const blobUrl = await _assetFetchThumb(id);
        if (blobUrl) {
          img.src = blobUrl;
        } else {
          // Fail → hiện icon fallback đã có sẵn (xử lý bởi onerror)
          img.dispatchEvent(new Event('error'));
        }
      });
    }, {
      // Bắt đầu load khi ảnh còn cách viewport 100px
      rootMargin: '100px',
      threshold: 0.01,
    });
  }

  // Observe từng ảnh
  lazyImgs.forEach(img => _assetThumbObserver.observe(img));
}

// Cleanup blob URLs khi tab đóng (tránh memory leak)
window.addEventListener('beforeunload', () => {
  _assetThumbCache.forEach(url => {
    try { URL.revokeObjectURL(url); } catch(_) {}
  });
  _assetThumbCache.clear();
});

async function _assetLoadGallery(idx) {
  const r = _assetGetRow(idx);
  if (!r) {
    console.warn('[_assetLoadGallery] Không lấy được row data');
    return;
  }
  const gEl = document.getElementById('_assetGallery_' + idx);
  if (!gEl || !window._sbClient) return;

  const assetKey = makeAssetKey(r);

  try {
    const { data, error } = await window._sbClient
      .from('equipment_attachments')
      .select('*')
      .eq('asset_key', assetKey)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      gEl.innerHTML = `<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px 0">
        <i class="fas fa-folder-open" style="margin-right:5px"></i>Chưa có ảnh/tài liệu nào
      </div>`;
      return;
    }

    const photos = data.filter(d => d.file_type === 'image');
    const docs   = data.filter(d => d.file_type === 'document');
    const sess   = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    const isAdmin = sess?.role === 'admin';
    const myEmail = sess?.email;
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    const canDeleteFile = (f) => {
      if (isAdmin) return true;
      if (f.uploaded_by_email !== myEmail) return false;
      const created = new Date(f.created_at).getTime();
      return (now - created) < THREE_DAYS;
    };

    let html = '';

    if (photos.length) {
      html += `<div style="font-size:10px;color:rgba(0,230,118,.7);margin-bottom:5px;font-weight:600">
        <i class="fas fa-camera" style="margin-right:4px"></i>Ảnh hiện trường (${photos.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">`;
      photos.forEach(p => {
        const canDel = canDeleteFile(p);
        const tooltip = `${p.file_name}\n${p.note ? p.note + '\n' : ''}Upload: ${p.uploaded_by_email || '?'}\n${new Date(p.created_at).toLocaleString('vi-VN')}`;
        // ── Tối ưu #12: Lazy load thumbnail thật ──
        // <img data-asset-id="..."> rỗng ban đầu, src được set khi cuộn tới (IntersectionObserver)
        // Khi load lỗi: ẩn img, hiện icon fallback bên dưới
        html += `<div style="position:relative;width:78px;border:1px solid rgba(0,230,118,.2);
                             border-radius:6px;overflow:hidden;background:rgba(0,0,0,.3)"
                      title="${tooltip.replace(/"/g, '&quot;')}">
          <div style="width:78px;height:60px;background:rgba(0,230,118,.05);
                      display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative"
               onclick="_assetView(${p.id})">
            <img data-asset-thumb="${p.id}"
                 style="width:100%;height:100%;object-fit:cover;display:none"
                 onload="this.style.display='block';this.nextElementSibling.style.display='none'"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                 alt="">
            <div class="asset-thumb-fallback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
              <i class="fas fa-image" style="font-size:18px;color:rgba(0,230,118,.4)"></i>
            </div>
          </div>
          <div style="padding:3px 4px;font-size:8.5px;color:rgba(180,200,220,.65);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer"
               onclick="_assetView(${p.id})">${p.file_name}</div>
          ${canDel ? `<button onclick="event.stopPropagation();_assetDelete(${p.id},${idx})"
                              title="Xóa"
                              style="position:absolute;top:2px;right:2px;width:18px;height:18px;
                                     border-radius:50%;border:none;background:rgba(255,82,82,.85);
                                     color:#fff;font-size:9px;cursor:pointer;line-height:1;padding:0;
                                     display:flex;align-items:center;justify-content:center">✕</button>` : ''}
        </div>`;
      });
      html += '</div>';
    }

    if (docs.length) {
      html += `<div style="font-size:10px;color:rgba(0,150,255,.7);margin-bottom:5px;font-weight:600">
        <i class="fas fa-file-alt" style="margin-right:4px"></i>Tài liệu (${docs.length})
      </div>`;
      docs.forEach(d => {
        const canDel = canDeleteFile(d);
        const ext = (d.file_name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        const icon = ext === '.pdf' ? 'fa-file-pdf'
                   : ext.match(/\.docx?$/) ? 'fa-file-word'
                   : ext.match(/\.xlsx?$/) ? 'fa-file-excel'
                   : ext.match(/\.pptx?$/) ? 'fa-file-powerpoint' : 'fa-file';
        const tooltip = `${d.file_name}\n${d.note ? d.note + '\n' : ''}Upload: ${d.uploaded_by_email || '?'}\n${new Date(d.created_at).toLocaleString('vi-VN')}`;
        html += `<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;
                             border-radius:6px;border:1px solid rgba(0,150,255,.15);
                             background:rgba(0,150,255,.04);margin-bottom:4px"
                      title="${tooltip.replace(/"/g, '&quot;')}">
          <i class="fas ${icon}" style="color:#0096ff;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;overflow:hidden;cursor:pointer" onclick="_assetView(${d.id})">
            <div style="font-size:10.5px;color:rgba(235,248,255,.9);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.file_name}</div>
            ${d.note ? `<div style="font-size:9px;color:rgba(180,200,220,.55);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.note}</div>` : ''}
          </div>
          <button onclick="_assetView(${d.id})" title="Mở"
            style="background:none;border:none;color:rgba(0,150,255,.7);cursor:pointer;font-size:11px;padding:2px 5px">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${canDel ? `<button onclick="_assetDelete(${d.id},${idx})" title="Xóa"
            style="background:none;border:none;color:rgba(255,82,82,.7);cursor:pointer;font-size:11px;padding:2px 5px">
            <i class="fas fa-trash"></i></button>` : ''}
        </div>`;
      });
    }

    gEl.innerHTML = html;

    // ── Tối ưu #12: kích hoạt lazy load thumbnails ──
    // IntersectionObserver chỉ tải ảnh khi scroll tới (tiết kiệm băng thông)
    _assetSetupLazyThumbs(gEl);

  } catch (e) {
    console.error('[_assetLoadGallery]', e);
    gEl.innerHTML = `<div style="font-size:10px;color:#ff5252;text-align:center;padding:8px 0">
      ✗ Lỗi tải dữ liệu: ${e.message}
    </div>`;
  }
}

/** Upload file (ảnh hoặc tài liệu) */
async function _assetDoUpload(idx) {
  const r = _assetGetRow(idx);
  if (!r) {
    alert('Không lấy được thông tin thiết bị. Vui lòng đóng panel và mở lại.');
    return;
  }
  const inp = document.getElementById('_assetFile_' + idx);
  const note = document.getElementById('_assetNote_' + idx)?.value?.trim() || '';
  const statusEl = document.getElementById('_assetStatus_' + idx);
  const btn = document.getElementById('_assetBtn_' + idx);

  if (!inp?.files?.length) {
    if (statusEl) { statusEl.style.color = '#ff9100'; statusEl.textContent = '⚠ Chưa chọn file'; }
    return;
  }
  const file = inp.files[0];
  const fileType = file.type.startsWith('image/') ? 'image' : 'document';

  // Limit kích thước file để tránh kẹt Edge Function (Supabase free = 50MB max)
  const MAX_MB = 40;
  if (file.size > MAX_MB * 1024 * 1024) {
    if (statusEl) { statusEl.style.color = '#ff5252'; statusEl.textContent = `✗ File quá lớn (${(file.size/1024/1024).toFixed(1)}MB) — tối đa ${MAX_MB}MB`; }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  if (statusEl) { statusEl.style.color = '#ffd740'; statusEl.textContent = 'Đang upload lên NAS...'; }

  try {
    const token = await _authGetToken();
    if (!token) throw new Error('Chưa đăng nhập — vui lòng login lại');

    // ── Dùng multipart/form-data (binary) thay Base64 ─
    //   Giảm 33% kích thước → upload nhanh hơn, ít tốn RAM Edge Function.
    const fd = new FormData();
    fd.append('assetKey',    makeAssetKey(r));
    fd.append('tram',        r.Tram || '');
    fd.append('capDienAp',   String(r.Cap_dien_ap ?? ''));
    fd.append('loaiThietBi', r.Phan_loai_thiet_bi || '');
    fd.append('tenThietBi',  r.Ten_thiet_bi || '');
    fd.append('nganThietBi', r.Ngan_thiet_bi || '');
    fd.append('fileName',    file.name);
    fd.append('mimeType',    file.type || 'application/octet-stream');
    fd.append('fileSize',    String(file.size));
    fd.append('fileType',    fileType);
    fd.append('note',        note);
    fd.append('file',        file, file.name);   // ← binary stream

    const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/asset-upload';
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 120_000);  // 2 phút cho file 25MB qua ngrok
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        // KHÔNG đặt Content-Type → browser tự thêm boundary cho multipart
        'Authorization': 'Bearer ' + token,
        'apikey': _AUTH_SB_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      body: fd,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tid));

    let result;
    try { result = await resp.json(); }
    catch (_) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} — ${(txt || resp.statusText).slice(0,200)}`);
    }
    if (!resp.ok || !result.success) throw new Error(result?.error || `HTTP ${resp.status}`);

    if (statusEl) {
      statusEl.style.color = '#00e676';
      statusEl.textContent = `✅ Upload thành công! ${fileType === 'image' ? 'Ảnh' : 'Tài liệu'} đã lưu trên NAS.`;
    }

    inp.value = '';
    document.getElementById('_assetFileLbl_' + idx).textContent = 'Chưa chọn file';
    document.getElementById('_assetNote_' + idx).value = '';

    setTimeout(() => _assetLoadGallery(idx), 300);

  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Quá thời gian chờ (120s) — kiểm tra ngrok/NAS' : (e.message || 'Lỗi không xác định');
    if (statusEl) { statusEl.style.color = '#ff5252'; statusEl.textContent = '✗ ' + msg; }
    console.error('[_assetDoUpload]', e);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-upload"></i> Tải lên NAS';
}

/** Xem/tải file qua proxy asset-download */
async function _assetView(id) {
  try {
    const token = await _authGetToken();
    if (!token) {
      alert('Chưa đăng nhập');
      return;
    }
    const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/asset-download?id=' + id;
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 90_000);
    const resp = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': _AUTH_SB_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tid));
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${txt.slice(0,100)}`);
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    (window._friendlyAlert || alert)('Không mở được file: ' + (e?.name === 'AbortError' ? 'Quá lâu (>90s)' : (window._friendlyError ? window._friendlyError(e) : e.message)));
    console.error('[_assetView]', e);
  }
}

/** Soft delete file (set active=false) */
async function _assetDelete(id, idx) {
  if (!confirm('Xóa file này?\n\nLưu ý: Sau khi xóa, file vẫn còn trên NAS nhưng sẽ ẩn khỏi dashboard.')) return;
  try {
    const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    const { error } = await window._sbClient
      .from('equipment_attachments')
      .update({
        active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: sess?.id || null,
      })
      .eq('id', id);
    if (error) throw error;
    _assetLoadGallery(idx);
  } catch (e) {
    (window._friendlyAlert || alert)('Lỗi xóa: ' + (window._friendlyError ? window._friendlyError(e) : e.message));
    console.error('[_assetDelete]', e);
  }
}

// ── Expose globally cho inline handlers ──
window.makeAssetKey      = makeAssetKey;
window._assetSectionHtml = _assetSectionHtml;
window._assetFileChosen  = _assetFileChosen;
window._assetLoadGallery = _assetLoadGallery;
window._assetDoUpload    = _assetDoUpload;
window._assetView        = _assetView;
window._assetDelete      = _assetDelete;



/* ════════════════════════════════════════════════════════════════
   ROUND 3 — Service Worker + Realtime + Offline Indicator
════════════════════════════════════════════════════════════════ */

// ── Service Worker registration ──────────────────────────────
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('[SW] Đã đăng ký');

      // Auto reload khi có version mới
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Có version mới đang chờ activate
            _showUpdateNotification();
          }
        });
      });
    }).catch((err) => console.warn('[SW] Đăng ký lỗi:', err));

    // Reload trang khi worker mới active
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

function _showUpdateNotification() {
  const existing = document.getElementById('_swUpdateBanner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = '_swUpdateBanner';
  banner.style.cssText = `
    position:fixed;top:8px;left:50%;transform:translateX(-50%);
    background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;
    padding:10px 16px;border-radius:10px;font-size:12px;z-index:99999;
    box-shadow:0 4px 20px rgba(0,0,0,.5);display:flex;align-items:center;gap:10px;
    border:1px solid rgba(255,255,255,.15)
  `;
  banner.innerHTML = `
    <i class="fas fa-sync-alt" style="animation:spin 2s linear infinite"></i>
    <span>Phiên bản mới — bấm để cập nhật</span>
    <button onclick="_swApplyUpdate()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">Cập nhật</button>
    <button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:14px;padding:0 4px">×</button>
  `;
  document.body.appendChild(banner);
}

function _swApplyUpdate() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) reg.waiting.postMessage('skipWaiting');
    });
  }
}
window._swApplyUpdate = _swApplyUpdate;

// ── Offline / Online indicator ────────────────────────────────
function _updateOnlineStatus() {
  const isOnline = navigator.onLine;
  let badge = document.getElementById('_offlineBadge');

  if (!isOnline) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = '_offlineBadge';
      badge.style.cssText = `
        position:fixed;bottom:10px;left:10px;z-index:99999;
        background:rgba(255,82,82,.95);color:#fff;
        padding:8px 14px;border-radius:8px;font-size:11px;
        display:flex;align-items:center;gap:6px;
        box-shadow:0 4px 12px rgba(0,0,0,.4);
        animation:pulse 2s ease-in-out infinite
      `;
      badge.innerHTML = '<i class="fas fa-wifi-slash"></i> Mất kết nối — đang dùng cache';
      document.body.appendChild(badge);
    }
  } else {
    if (badge) {
      badge.style.background = 'rgba(0,230,118,.95)';
      badge.innerHTML = '<i class="fas fa-wifi"></i> Đã kết nối lại';
      setTimeout(() => badge?.remove(), 2000);
    }
  }
}
window.addEventListener('online', _updateOnlineStatus);
window.addEventListener('offline', _updateOnlineStatus);
// Check ngay khi load
setTimeout(_updateOnlineStatus, 1000);

// ── Realtime subscription cho TongHopThietBi & CongTacThiNghiem ──
// Khi admin INSERT/UPDATE/DELETE → tất cả user thấy ngay
let _realtimeChannels = [];
function _setupRealtimeSync() {
  if (!window._sbClient) {
    setTimeout(_setupRealtimeSync, 1000);
    return;
  }

  try {
    // Subscribe TongHopThietBi changes
    const ch1 = window._sbClient
      .channel('tonghop-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'TongHopThietBi' },
        (payload) => {
          console.log('[Realtime] TongHopThietBi thay đổi:', payload.eventType);
          // Invalidate cache để lần load tới fetch mới
          try {
            localStorage.removeItem(LYT_DATA_CACHE_KEY);
            localStorage.removeItem(LYT_DATA_CACHE_META_KEY);
          } catch(_) {}
          _showRealtimeToast('🔄 Dữ liệu thiết bị đã được cập nhật');
        }
      )
      .subscribe();
    _realtimeChannels.push(ch1);

    // Subscribe CongTacThiNghiem changes
    const ch2 = window._sbClient
      .channel('congtac-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'CongTacThiNghiem' },
        (payload) => {
          console.log('[Realtime] CongTacThiNghiem thay đổi:', payload.eventType);
          try { localStorage.removeItem(_TN_CACHE_KEY); } catch(_) {}
          _showRealtimeToast('🔄 Dữ liệu TNĐK đã được cập nhật');
        }
      )
      .subscribe();
    _realtimeChannels.push(ch2);

    console.log('[Realtime] Đã subscribe TongHopThietBi & CongTacThiNghiem');
  } catch (e) {
    console.warn('[Realtime] Setup failed:', e);
  }
}

// Toast hiển thị khi có realtime update — không spam (1 toast / 10 giây)
let _lastRealtimeToastTime = 0;
function _showRealtimeToast(msg) {
  const now = Date.now();
  if (now - _lastRealtimeToastTime < 10000) return;
  _lastRealtimeToastTime = now;

  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;top:60px;right:10px;z-index:99998;
    background:rgba(0,230,118,.95);color:#000;font-weight:600;
    padding:10px 16px;border-radius:8px;font-size:12px;
    box-shadow:0 4px 14px rgba(0,0,0,.3);
    animation:slideInRight .3s ease-out
  `;
  toast.innerHTML = `
    ${msg}
    <button onclick="forceReloadData();this.parentElement.remove()"
            style="margin-left:10px;background:rgba(0,0,0,.2);border:none;color:#000;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:600">
      Tải lại
    </button>
    <button onclick="this.parentElement.remove()"
            style="margin-left:4px;background:transparent;border:none;color:rgba(0,0,0,.6);cursor:pointer;font-size:14px;padding:0 4px">
      ×
    </button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

// Bắt đầu subscribe sau khi auth ready
setTimeout(_setupRealtimeSync, 2000);

// Cleanup channels khi tab đóng (tránh memory leak Supabase)
window.addEventListener('beforeunload', () => {
  _realtimeChannels.forEach(ch => {
    try { window._sbClient?.removeChannel(ch); } catch(_) {}
  });
});

// CSS animations cho indicators
(function injectRealtimeCss() {
  const css = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    @keyframes slideInRight { from{transform:translateX(120%)} to{transform:translateX(0)} }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// ━━ CSV UPLOAD + CHATBOT (appended via apply-csv-chat-patch-v1.sh) ━━
// ════════════════════════════════════════════════════════════════
// UI Patch v3 — CSV Upload + Chatbot floating button
//
// File này được APPEND vào CUỐI app.js qua script apply-csv-chat-patch.sh
//
// Cung cấp:
//   1. Trang admin "Upload CSV" với 2 tab (TongHopThietBi, CongTacThiNghiem)
//      - Drag & drop hoặc chọn file
//      - Preview row count + tên cột
//      - Note input
//      - Confirm replace
//      - History list view (12 version gần nhất)
//      - Restore button (TODO sau)
//   2. Floating chat button góc phải dưới (admin only)
//   3. Chat panel với markdown lite
// ════════════════════════════════════════════════════════════════

(() => {
  // ──────────────────────────────────────────────────────
  // PART 1: CSV PARSER (vanilla, không cần lib)
  // ──────────────────────────────────────────────────────
  function parseCSV(text) {
    // Loại BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let cur = '', row = [], inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i+1];
      if (inQuote) {
        if (c === '"' && n === '"') { cur += '"'; i++; }
        else if (c === '"') inQuote = false;
        else cur += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\r' && n === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; }
        else if (c === '\n' || c === '\r') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else cur += c;
      }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    if (rows.length === 0) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(c => c && c.trim()))
      .map(r => {
        const o = {};
        headers.forEach((h, i) => o[h] = r[i] ?? '');
        return o;
      });
  }

  // ──────────────────────────────────────────────────────
  // PART 2: CSV UPLOAD MODAL
  // ──────────────────────────────────────────────────────
  let _uploadState = { rows: null, fileName: '', fileSize: 0, table: '' };

  function _openCsvUpload(targetTable) {
    _uploadState = { rows: null, fileName: '', fileSize: 0, table: targetTable };
    
    const ex = document.getElementById('_csvUploadModal');
    if (ex) ex.remove();
    
    const modal = document.createElement('div');
    modal.id = '_csvUploadModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center';
    
    const tableLabel = targetTable === 'TongHopThietBi' ? 'Tổng hợp thiết bị' : 'Công tác thí nghiệm';
    
    modal.innerHTML = '<div style="background:var(--bg-surface,#1a2332);border:1px solid rgba(0,200,255,.3);border-radius:14px;padding:24px;width:560px;max-width:90vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,.8)">' +
      '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:6px"><i class="fas fa-upload" style="color:#00c8ff;margin-right:8px"></i>Upload CSV — ' + tableLabel + '</div>' +
      '<div style="font-size:11px;color:#888;margin-bottom:16px;background:rgba(255,145,0,.08);border:1px solid rgba(255,145,0,.2);border-radius:6px;padding:8px 11px;line-height:1.5">' +
      '<i class="fas fa-info-circle" style="color:#ff9100;margin-right:5px"></i>' +
      '<b>Workflow:</b> Data hiện tại sẽ được lưu vào lịch sử trước, rồi bị thay thế bằng data mới. Có thể tra cứu lại data cũ qua chatbot hoặc SQL.' +
      '</div>' +
      '<div id="_csvDropArea" style="border:2px dashed rgba(0,200,255,.4);border-radius:10px;padding:32px 16px;text-align:center;margin-bottom:14px;cursor:pointer;transition:all .2s">' +
      '<i class="fas fa-file-csv" style="font-size:32px;color:#00c8ff;margin-bottom:8px"></i>' +
      '<div style="color:#fff;font-size:13px;margin-bottom:4px">Kéo thả file CSV vào đây</div>' +
      '<div style="color:#888;font-size:11px">hoặc click để chọn</div>' +
      '<input type="file" id="_csvFileInput" accept=".csv" style="display:none">' +
      '</div>' +
      '<div id="_csvPreview" style="display:none;background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.2);border-radius:7px;padding:11px 13px;margin-bottom:12px;font-size:12px;color:#cdd"></div>' +
      '<div style="margin-bottom:14px">' +
      '<label style="font-size:11px;color:#bcc;display:block;margin-bottom:4px">Ghi chú (tùy chọn — vd "Q1 2026", "Sửa lỗi mã trạm")</label>' +
      '<input id="_csvNote" type="text" maxlength="500" class="auth-input" placeholder="Mô tả ngắn cho lần upload này" style="width:100%;padding:8px 11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#fff;font-size:12px;box-sizing:border-box">' +
      '</div>' +
      '<div id="_csvErr" style="font-size:11px;color:#ff5252;min-height:14px;margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:8px">' +
      '<button id="_csvSubmitBtn" disabled style="flex:1;padding:11px;border-radius:8px;border:none;background:linear-gradient(135deg,#00c8ff,#00e676);color:#000;font-weight:700;font-size:13px;cursor:not-allowed;opacity:.5">' +
      '<i class="fas fa-cloud-upload-alt" style="margin-right:5px"></i>Thay thế dữ liệu</button>' +
      '<button onclick="document.getElementById(\'_csvUploadModal\').remove()" style="flex:0.5;padding:11px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#bcc;font-size:13px;cursor:pointer">Huỷ</button>' +
      '</div>' +
      '</div>';
    
    document.body.appendChild(modal);

    const dropArea = document.getElementById('_csvDropArea');
    const fileInput = document.getElementById('_csvFileInput');
    const submitBtn = document.getElementById('_csvSubmitBtn');

    dropArea.onclick = () => fileInput.click();
    dropArea.ondragover = (e) => { e.preventDefault(); dropArea.style.background = 'rgba(0,200,255,.1)'; };
    dropArea.ondragleave = () => { dropArea.style.background = ''; };
    dropArea.ondrop = (e) => {
      e.preventDefault();
      dropArea.style.background = '';
      if (e.dataTransfer.files.length > 0) _handleCsvFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) _handleCsvFile(e.target.files[0]);
    };

    submitBtn.onclick = _submitCsvUpload;
  }

  async function _handleCsvFile(file) {
    const errEl = document.getElementById('_csvErr');
    const previewEl = document.getElementById('_csvPreview');
    const submitBtn = document.getElementById('_csvSubmitBtn');
    
    errEl.textContent = '';

    if (!file.name.toLowerCase().endsWith('.csv')) {
      errEl.textContent = 'File phải có extension .csv';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      errEl.textContent = 'File quá lớn (>20MB)';
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        errEl.textContent = 'CSV không có data row nào';
        return;
      }

      _uploadState.rows = rows;
      _uploadState.fileName = file.name;
      _uploadState.fileSize = file.size;

      const colKeys = Object.keys(rows[0]);
      previewEl.style.display = 'block';
      previewEl.innerHTML = '<div style="margin-bottom:6px"><b style="color:#00c8ff">📄 File:</b> ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)</div>' +
        '<div style="margin-bottom:6px"><b style="color:#00c8ff">📊 Rows:</b> ' + rows.length.toLocaleString() + '</div>' +
        '<div style="margin-bottom:4px"><b style="color:#00c8ff">🔑 Columns (' + colKeys.length + '):</b></div>' +
        '<div style="font-family:ui-monospace,monospace;font-size:10.5px;color:#bcc;background:rgba(0,0,0,.25);padding:6px;border-radius:5px;max-height:80px;overflow-y:auto">' + colKeys.join(', ') + '</div>';

      submitBtn.disabled = false;
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.opacity = '1';
    } catch (e) {
      errEl.textContent = 'Lỗi parse CSV: ' + e.message;
    }
  }

  async function _submitCsvUpload() {
    const errEl = document.getElementById('_csvErr');
    const submitBtn = document.getElementById('_csvSubmitBtn');
    const noteEl = document.getElementById('_csvNote');
    errEl.textContent = '';

    if (!_uploadState.rows || _uploadState.rows.length === 0) {
      errEl.textContent = 'Chưa chọn file';
      return;
    }

    if (!confirm('Bạn CHẮC CHẮN thay thế dữ liệu hiện tại trong bảng ' + _uploadState.table + '?\n\nData cũ sẽ được lưu vào lịch sử (có thể tra cứu lại).\nData mới: ' + _uploadState.rows.length + ' rows.')) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

    try {
      const token = await _authGetToken();
      if (!token) { errEl.textContent = 'Phiên hết hạn'; return; }

      const endpoint = _uploadState.table === 'TongHopThietBi' 
        ? 'csv-replace-thietbi' 
        : 'csv-replace-congtactn';
      
      const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/' + endpoint;
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': _AUTH_SB_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: _uploadState.rows,
          note: noteEl.value || '',
          csv_file_name: _uploadState.fileName,
          csv_size: _uploadState.fileSize,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        errEl.textContent = data.error || ('Lỗi ' + resp.status);
        return;
      }

      document.getElementById('_csvUploadModal').remove();
      alert('✅ ' + (data.message || 'Upload thành công'));
      if (typeof showChangeNotif === 'function') {
        showChangeNotif('success', 'Upload CSV thành công', 'Version ' + data.version_id + ' — ' + data.inserted_rows + ' rows');
      }
    } catch (e) {
      errEl.textContent = 'Lỗi: ' + e.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt" style="margin-right:5px"></i>Thay thế dữ liệu';
    }
  }

  // ──────────────────────────────────────────────────────
  // PART 3: CHATBOT (floating button + panel)
  // ──────────────────────────────────────────────────────
  const CHAT_ENDPOINT = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/chat-query';
  let _chatPanelOpen = false;
  let _chatBusy = false;

  const style = document.createElement('style');
  style.textContent = '#_chatFab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#00e676,#00b8d4);box-shadow:0 4px 16px rgba(0,230,118,.4);cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s;border:none;color:#000}#_chatFab:hover{transform:scale(1.08)}#_chatFab i{font-size:22px}#_chatPanel{position:fixed;bottom:92px;right:24px;width:380px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 120px);background:rgba(15,20,25,.96);backdrop-filter:blur(12px);border:1px solid rgba(0,230,118,.25);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none;flex-direction:column;z-index:9999}#_chatPanel.open{display:flex}#_chatHeader{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center}#_chatHeader h3{margin:0;font-size:14px;color:#00e676;font-weight:700}#_chatClose{background:none;border:none;color:#9ab;cursor:pointer;font-size:18px}#_chatMessages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px}.chat-msg{max-width:88%;padding:9px 13px;border-radius:12px;font-size:12.5px;line-height:1.5;word-wrap:break-word}.chat-msg.user{align-self:flex-end;background:rgba(0,200,255,.18);color:#eef}.chat-msg.assistant{align-self:flex-start;background:rgba(0,230,118,.1);color:#dff;border-left:2px solid #00e676}.chat-msg.error{background:rgba(255,82,82,.15);color:#fbb}.chat-tools{font-size:9.5px;color:#789;margin-top:4px;font-family:ui-monospace,monospace}#_chatInput{width:100%;padding:9px 12px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#eef;font-size:12.5px;outline:none;box-sizing:border-box}#_chatInputRow{padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,.08)}#_chatHints{padding:0 14px 8px}#_chatHints .hint{display:inline-block;padding:4px 10px;margin:3px 2px;background:rgba(0,150,255,.12);color:#aee;border-radius:12px;font-size:10.5px;cursor:pointer;border:1px solid rgba(0,150,255,.2)}';
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.id = '_chatFab';
  fab.title = 'Trợ lý AI';
  fab.innerHTML = '<i class="fas fa-comment-dots"></i>';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = '_chatPanel';
  panel.innerHTML = '<div id="_chatHeader"><div><h3>🤖 Trợ lý AI EVN Hà Nội</h3><div style="font-size:10px;color:rgba(180,200,220,.6)">Gemini 2.5 Flash — tra cứu live + lịch sử</div></div><button id="_chatClose">✕</button></div>' +
    '<div id="_chatMessages"></div>' +
    '<div id="_chatHints">' +
    '<span class="hint" data-q="Có bao nhiêu MBA EEMC?">📊 Đếm MBA EEMC</span>' +
    '<span class="hint" data-q="Trạm E1.24 có những thiết bị nào?">📍 E1.24</span>' +
    '<span class="hint" data-q="Liệt kê các version đã upload">📜 Lịch sử upload</span>' +
    '<span class="hint" data-q="NAS có OK không?">⚙️ NAS</span>' +
    '</div>' +
    '<div id="_chatInputRow"><input id="_chatInput" type="text" placeholder="Hỏi gì đó..." maxlength="2000"></div>';
  document.body.appendChild(panel);

  function _escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});
  }
  function _renderMd(text) {
    var h = _escapeHtml(text);
    h = h.replace(/`([^`]+?)`/g, '<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-size:11px">$1</code>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/^[\-•] (.+)$/gm, '<li>$1</li>');
    if (h.indexOf('<li>') >= 0) h = h.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul style="margin:4px 0;padding-left:20px">$1</ul>');
    h = h.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return h;
  }

  function _addMessage(role, text, toolInfo) {
    var msgs = document.getElementById('_chatMessages');
    var el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.innerHTML = _renderMd(text);
    if (toolInfo && toolInfo.length) {
      var tools = document.createElement('div');
      tools.className = 'chat-tools';
      tools.textContent = '🔧 ' + toolInfo.map(function(t){return t.name;}).join(' · ');
      el.appendChild(tools);
    }
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function _addTyping() {
    var msgs = document.getElementById('_chatMessages');
    var el = document.createElement('div');
    el.id = '_chatTyping';
    el.className = 'chat-msg assistant';
    el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang suy nghĩ...';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function _removeTyping() {
    var el = document.getElementById('_chatTyping');
    if (el) el.remove();
  }

  async function _sendChat(question) {
    if (_chatBusy) return;
    if (!question || !question.trim()) return;
    question = question.trim();
    _chatBusy = true;
    _addMessage('user', question);
    document.getElementById('_chatInput').value = '';
    var hints = document.getElementById('_chatHints');
    if (hints) hints.style.display = 'none';
    _addTyping();

    try {
      var token = await _authGetToken();
      if (!token) throw new Error('Chưa đăng nhập');

      var resp = await _authedFetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });
      _removeTyping();
      var data = await resp.json();
      if (!resp.ok) {
        _addMessage('error', '❌ ' + (data.error || ('HTTP ' + resp.status)));
      } else {
        _addMessage('assistant', data.answer || '(Không có nội dung)', data.toolCalls);
      }
    } catch (e) {
      _removeTyping();
      _addMessage('error', '❌ Lỗi: ' + e.message);
    } finally {
      _chatBusy = false;
    }
  }

  fab.addEventListener('click', function() {
    _chatPanelOpen = !_chatPanelOpen;
    panel.classList.toggle('open', _chatPanelOpen);
    if (_chatPanelOpen) {
      var msgs = document.getElementById('_chatMessages');
      if (!msgs.hasChildNodes()) {
        _addMessage('assistant', 'Xin chào! Tôi là trợ lý AI EVN Hà Nội. Tôi có thể tra cứu:\n- 📊 Thống kê thiết bị hiện tại\n- 🔍 Chi tiết thiết bị, vị trí, serial\n- 📜 **Lịch sử các version đã upload**\n- ⚙️ Tình trạng NAS\n\nBấm gợi ý dưới hoặc gõ câu hỏi.');
      }
      setTimeout(function(){ var i = document.getElementById('_chatInput'); if (i) i.focus(); }, 100);
    }
  });
  document.getElementById('_chatClose').addEventListener('click', function() {
    _chatPanelOpen = false;
    panel.classList.remove('open');
  });
  document.getElementById('_chatInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _sendChat(e.target.value);
    }
  });
  document.getElementById('_chatHints').addEventListener('click', function(e) {
    if (e.target.classList.contains('hint')) {
      _sendChat(e.target.getAttribute('data-q'));
    }
  });

  // ──────────────────────────────────────────────────────
  // PART 4: Show FAB + Upload buttons only for admin
  // ──────────────────────────────────────────────────────
  async function _checkAdminFeatures() {
    try {
      var token = await _authGetToken();
      if (!token) return;
      // Lấy user qua /auth/v1/user trực tiếp (không cần _authGetCurrentUser)
      var userResp = await fetch(_AUTH_SB_URL + '/auth/v1/user', {
        headers: { 'Authorization': 'Bearer ' + token, 'apikey': _AUTH_SB_KEY },
      });
      if (!userResp.ok) return;
      var user = await userResp.json();
      if (!user || !user.id) return;
      // Check admin role
      var profResp = await fetch(_AUTH_SB_URL + '/rest/v1/evn_user_profiles?id=eq.' + user.id + '&select=role', {
        headers: { 'Authorization': 'Bearer ' + token, 'apikey': _AUTH_SB_KEY },
      });
      var rows = profResp.ok ? await profResp.json() : [];
      var isAdmin = (rows[0] && rows[0].role === 'admin')
                  || user.email === 'admin@example.com'
                  || (user.user_metadata && user.user_metadata.role === 'admin');
      if (isAdmin) {
        document.getElementById('_chatFab').style.display = 'flex';
      }
    } catch (e) { console.warn('[_checkAdminFeatures]', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_checkAdminFeatures, 1000); });
  } else {
    setTimeout(_checkAdminFeatures, 1000);
  }

  // Expose globally
  window._openCsvUpload = _openCsvUpload;
})();


// ━━ _authedFetch (auto-refresh JWT khi 401) ━━
async function _authedFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  
  async function _refreshAccessToken() {
    try {
      const authKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
      if (!authKey) return null;
      const session = JSON.parse(localStorage.getItem(authKey));
      const refreshToken = session && session.refresh_token;
      if (!refreshToken) return null;
      console.log('[_authedFetch] Refreshing JWT...');
      const resp = await fetch(_AUTH_SB_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': _AUTH_SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) { console.warn('[_authedFetch] Refresh failed:', resp.status); return null; }
      const data = await resp.json();
      const newSession = {
        ...session,
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_at: Math.floor(Date.now()/1000) + (data.expires_in || 3600),
        expires_in: data.expires_in,
      };
      localStorage.setItem(authKey, JSON.stringify(newSession));
      console.log('[_authedFetch] Token refreshed OK');
      return data.access_token;
    } catch (e) { console.warn('[_authedFetch] Refresh error:', e.message); return null; }
  }
  
  let token = await _authGetToken();
  const headers1 = Object.assign({}, options.headers, {
    'Authorization': 'Bearer ' + token,
    'apikey': _AUTH_SB_KEY,
  });
  let resp = await fetch(url, Object.assign({}, options, { headers: headers1 }));
  
  if (resp.status === 401) {
    const newToken = await _refreshAccessToken();
    if (newToken) {
      const headers2 = Object.assign({}, options.headers, {
        'Authorization': 'Bearer ' + newToken,
        'apikey': _AUTH_SB_KEY,
      });
      resp = await fetch(url, Object.assign({}, options, { headers: headers2 }));
      console.log('[_authedFetch] Retried after refresh:', resp.status);
    }
  }
  return resp;
}

// ━━ TNDK UI MODULE (appended via apply-tndk-ui.sh) ━━
// ════════════════════════════════════════════════════════════════
// TNDK UI Patch — Báo cáo, theo dõi kết quả thực hiện module
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
//     <span>Báo cáo, theo dõi kết quả thực hiện</span>
//   </a>
//
// Và đăng ký vào _navExtMapBBTN:
//   'Báo cáo, theo dõi kết quả thực hiện': _tndkRenderPage,
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
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px"><h2 style="margin:0"><i class="fas fa-clipboard-check"></i> Báo cáo, theo dõi kết quả thực hiện</h2><button onclick="navActivate(document.querySelector('.nav-item'))" style="padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:var(--text-primary,#eef);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-arrow-left"></i> Dashboard</button></div>
      
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
    _navExtMapBBTN['Báo cáo, theo dõi kết quả thực hiện'] = _tndkRenderPage;
    _navExtMapBBTN['Báo cáo, theo dõi kết quả thực hiện'] = _tndkRenderPage;
    _navExtMapBBTN['Báo cáo kết quả'] = _tndkRenderPage;
  }
  
  console.log('[TNDK] Module loaded');
})();

// ━━ SECURITY PATCH v2 MINIMAL (appended) ━━
// ════════════════════════════════════════════════════════════════
// security-patch-v2.js — MINIMAL SAFE
//
// Chỉ frontend, KHÔNG đụng RLS/DB:
//   1. Watermark mờ overlay (email + thời gian)
//   2. Disable Ctrl+S, Ctrl+P, Ctrl+U
//   3. Block @media print
//   4. Audit log (chỉ chạy nếu bảng access_log tồn tại — fail silently)
//
// FIX so với v1:
//   - Dùng _authCurrentUser (đúng tên hàm trong app.js)
//   - Lấy email từ JWT nếu helper fail
//   - Ctrl+S dùng capture:true để bắt trước browser
//   - Audit log retry nhẹ, không lock UI
// ════════════════════════════════════════════════════════════════

(() => {
  'use strict';

  const SB_URL = (typeof _AUTH_SB_URL !== 'undefined') ? _AUTH_SB_URL : 'https://xqqmfmljwycpehfyknoy.supabase.co';
  const SB_KEY = (typeof _AUTH_SB_KEY !== 'undefined') ? _AUTH_SB_KEY : '';

  let _logBuffer = [];
  let _logFlushTimer = null;
  let _auditLogEnabled = true;  // sẽ tự tắt nếu DB không có bảng

  // ───────────────────────────────────────────────────
  // AUTH HELPERS — dùng đúng tên hàm có trong app.js
  // ───────────────────────────────────────────────────
  async function _getToken() {
    if (typeof _authGetToken === 'function') {
      try { return await _authGetToken(); } catch (_) { return null; }
    }
    return null;
  }

  async function _getEmail() {
    // Cách 1: dùng _authCurrentUser (xác minh có trong app.js)
    if (typeof _authCurrentUser === 'function') {
      try {
        const u = await _authCurrentUser();
        if (u?.email) return u.email;
      } catch (_) {}
    }

    // Cách 2: parse từ JWT token
    try {
      const token = await _getToken();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload?.email) return payload.email;
      }
    } catch (_) {}

    // Cách 3: từ localStorage trực tiếp
    try {
      const keys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
      for (const k of keys) {
        const v = JSON.parse(localStorage.getItem(k));
        const email = v?.user?.email || v?.currentSession?.user?.email;
        if (email) return email;
      }
    } catch (_) {}

    return '';
  }

  // ───────────────────────────────────────────────────
  // AUDIT LOG (batch + async, fail silent)
  // ───────────────────────────────────────────────────
  function logAction(action, resource, details) {
    if (!_auditLogEnabled) return;
    _logBuffer.push({ action, resource, details, timestamp: Date.now() });

    if (!_logFlushTimer) _logFlushTimer = setTimeout(_flushLogs, 5000);
    if (_logBuffer.length >= 20) {
      clearTimeout(_logFlushTimer);
      _logFlushTimer = null;
      _flushLogs();
    }
  }

  async function _flushLogs() {
    _logFlushTimer = null;
    if (_logBuffer.length === 0) return;
    if (!_auditLogEnabled) { _logBuffer = []; return; }

    const batch = _logBuffer.splice(0);
    const token = await _getToken();
    if (!token) {
      // Chưa login → bỏ qua, không log
      return;
    }

    // Gửi từng log qua RPC (nếu fail, tắt feature, không lặp lại)
    let firstError = null;
    for (const entry of batch) {
      try {
        const res = await fetch(SB_URL + '/rest/v1/rpc/log_user_action', {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_action: entry.action,
            p_resource: entry.resource || null,
            p_details: entry.details || null,
          }),
        });
        if (!res.ok && res.status === 404) {
          // Function không tồn tại → tắt feature
          _auditLogEnabled = false;
          console.warn('[Security] Audit log disabled: RPC log_user_action not found in DB');
          return;
        }
      } catch (e) {
        if (!firstError) firstError = e;
      }
    }
  }

  window.logAction = logAction;
  window.addEventListener('beforeunload', _flushLogs);

  // ───────────────────────────────────────────────────
  // WATERMARK OVERLAY
  // ───────────────────────────────────────────────────
  async function _injectWatermark() {
    const email = await _getEmail();
    if (!email) return; // chưa login, retry sau

    if (!document.getElementById('_security_wm_style')) {
      const style = document.createElement('style');
      style.id = '_security_wm_style';
      style.textContent = `
        #_security_watermark {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 99998;
          opacity: 0.06;
          user-select: none;
          overflow: hidden;
        }
        #_security_watermark .wm-line {
          position: absolute;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          transform: rotate(-25deg);
          text-shadow: 0 0 2px rgba(0,0,0,0.5);
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    let overlay = document.getElementById('_security_watermark');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_security_watermark';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';

    const now = new Date();
    const stamp = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN').slice(0,5);
    const text = `${email} • ${stamp} • EVN HÀ NỘI`;

    const cols = 8;
    const rows = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const span = document.createElement('div');
        span.className = 'wm-line';
        span.textContent = text;
        span.style.left = (c * 14 - 5) + '%';
        span.style.top = (r * 12 - 2) + '%';
        overlay.appendChild(span);
      }
    }

    // Refresh timestamp mỗi 60s
    setTimeout(_injectWatermark, 60000);
  }

  // ───────────────────────────────────────────────────
  // DISABLE Ctrl+S, Ctrl+P, Ctrl+U
  // Dùng capture:true để bắt TRƯỚC browser default
  // ───────────────────────────────────────────────────
  function _setupKeyBlocker() {
    document.addEventListener('keydown', (e) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + S
      if (ctrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _showWarning('Tính năng lưu trang đã bị vô hiệu hóa');
        logAction('blocked_ctrl_s');
        return false;
      }

      // Ctrl/Cmd + P
      if (ctrlOrCmd && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _showWarning('Tính năng in trang đã bị vô hiệu hóa');
        logAction('blocked_ctrl_p');
        return false;
      }

      // Ctrl + U: View source
      if (ctrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        logAction('blocked_view_source');
        return false;
      }

      // PrintScreen: chỉ warn (không thể block thật)
      if (e.key === 'PrintScreen') {
        _showWarning('⚠️ Phát hiện chụp màn hình');
        logAction('print_screen');
      }
    }, true);  // ← CAPTURE PHASE: bắt trước mọi handler khác
  }

  // ───────────────────────────────────────────────────
  // PRINT BLOCKER
  // ───────────────────────────────────────────────────
  function _injectPrintBlocker() {
    if (document.getElementById('_security_print_blocker')) return;
    const style = document.createElement('style');
    style.id = '_security_print_blocker';
    style.textContent = `
      @media print {
        body * { display: none !important; visibility: hidden !important; }
        body::before {
          content: '⚠️ TRANG NÀY KHÔNG ĐƯỢC PHÉP IN';
          display: block !important;
          visibility: visible !important;
          font-size: 24px;
          color: red;
          text-align: center;
          padding: 100px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ───────────────────────────────────────────────────
  // TOAST
  // ───────────────────────────────────────────────────
  function _showWarning(msg) {
    let toast = document.getElementById('_security_toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '_security_toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: rgba(255, 82, 82, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        z-index: 99999;
        opacity: 0;
        transition: all 0.3s ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, 3000);
  }

  // ───────────────────────────────────────────────────
  // HOOK NAV để log
  // ───────────────────────────────────────────────────
  function _hookNavActivation() {
    if (typeof window.navActivate !== 'function') return;
    if (window.navActivate._securityHooked) return;
    const orig = window.navActivate;
    window.navActivate = function(el) {
      try {
        const text = el?.querySelector?.('span')?.textContent?.trim() || el?.textContent?.trim() || '';
        if (text) logAction('navigate', text);
      } catch (_) {}
      return orig.apply(this, arguments);
    };
    window.navActivate._securityHooked = true;
  }

  // ───────────────────────────────────────────────────
  // INIT
  // ───────────────────────────────────────────────────
  function _init() {
    _setupKeyBlocker();
    _injectPrintBlocker();
    setTimeout(_hookNavActivation, 2000);

    // Poll login để inject watermark
    let waited = 0;
    const POLL_INTERVAL = 1000;
    const MAX_WAIT = 60000;
    const poll = setInterval(async () => {
      waited += POLL_INTERVAL;
      const email = await _getEmail();
      if (email) {
        clearInterval(poll);
        /* _injectWatermark(); disabled by user */
        logAction('session_active', null, {
          ua: navigator.userAgent.slice(0, 100),
          screen: `${screen.width}x${screen.height}`,
        });
      } else if (waited >= MAX_WAIT) {
        clearInterval(poll);
      }
    }, POLL_INTERVAL);

    console.log('[Security] Patch v2 (MINIMAL) loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  window._securityDebug = {
    flushLogs: _flushLogs,
    logBuffer: () => _logBuffer.slice(),
    injectWatermark: _injectWatermark,
    getEmail: _getEmail,
    auditEnabled: () => _auditLogEnabled,
  };
})();

// ━━━━ BBTN OCR UI (Phase 3) ━━━━
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
      sfra: '🔬 SFRA (chỉ MBA)',
      tiet_dien: '📏 Tiết diện (chỉ Cáp)',
    sfra: '🔬 SFRA (chỉ MBA)',
    tiet_dien: '📏 Tiết diện (chỉ Cáp)',
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
              <div class="bbtn-upload-hint">Hỗ trợ JPG, PNG, PDF — max 50MB/file (file >20MB dùng File API, chậm hơn). Có thể chọn nhiều file.</div>
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
      if (f.size > 50 * 1024 * 1024) {
        _toast(`File ${f.name}: quá lớn (>50MB)`, 'warn');
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

    // Concurrency 1 + delay 3s/file để tránh 429 Gemini Free tier (20 req/min)
    const CONCURRENCY = 1;
    const DELAY_MS = 3000;
    let __completed = 0;
    function _updateProgress() {
      const pct = Math.round((__completed / files.length) * 100);
      if (progressText) progressText.textContent = `Đã OCR ${__completed}/${files.length} file...`;
      if (progressFill) progressFill.style.width = pct + '%';
    }
    async function _processOne(file) {
      try {
        const b64 = await _fileToBase64(file);
        const res = await fetch(OCR_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SB_KEY,
            'Authorization': token ? 'Bearer ' + token : '',
          },
          body: JSON.stringify({ file_base64: b64, mime_type: file.type, file_name: file.name }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          _toast(`OCR ${file.name} fail: ${data.error || res.status}`, 'error');
          return;
        }
        const items = data.items || [];
        for (const item of items) {
          _ocrPreviewItems.push({
            item,
            fileInfo: { name: file.name, size: file.size, type: file.type },
            fileBase64: b64,
            selected: true,
          });
        }
        _toast(`✅ ${file.name}: ${items.length} thiết bị`, 'success');
      } catch (err) {
        _toast(`OCR ${file.name} error: ${err.message}`, 'error');
        console.error(err);
      } finally {
        __completed++;
        _updateProgress();
      }
    }
    _updateProgress();
    const queue = [...files];
    const inflight = new Set();
    while (queue.length > 0 || inflight.size > 0) {
      while (inflight.size < CONCURRENCY && queue.length > 0) {
        const file = queue.shift();
        const p = _processOne(file);
        inflight.add(p);
        p.finally(() => inflight.delete(p));
      }
      if (inflight.size > 0) {
        await Promise.race(inflight);
        if (queue.length > 0) await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
    // Dedupe theo loai + ten + tram (giữ item đầu tiên)
    const _seen = new Set();
    _ocrPreviewItems = _ocrPreviewItems.filter(it => {
      const key = `${(it.item?.ten_thiet_bi||'').toLowerCase().replace(/\s+/g,'')}|${(it.item?.tram||'').toLowerCase().replace(/\s+/g,'')}`;
      if (_seen.has(key)) return false;
      _seen.add(key);
      return true;
    });

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
          sfra: it.sfra,
          tiet_dien: it.tiet_dien,
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
          // V54: hiển thị friendly cho user
          if (window._friendlyAlert) {
            window._friendlyAlert('Lưu thiết bị thất bại: ' + errText);
          }
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

// ━━━━ Lớp 2: Upload Button MutationObserver (DEPRECATED by Lớp 5) ━━━━
(function() {
  if (window._bbtnButtonObserverInstalled) return;
  window._bbtnButtonObserverInstalled = true;
  function _tryInjectBtn() {
    const overlay = document.getElementById('tbPageOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    // Lớp 5 sẽ override behavior này — chỉ inject khi ở Quản lý BBTN OCR
    const isMgmtPage = overlay.querySelector('#bbtnFilterTram');
    if (!isMgmtPage) return;
    if (overlay.querySelector('#bbtnUploadOcrBtn')) return;
    const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    if (sess?.role !== 'admin') return;
    const exportBtn = overlay.querySelector('#bbtnMgmtBtnExport');
    if (!exportBtn) return;
    const btn = document.createElement('button');
    btn.id = 'bbtnUploadOcrBtn';
    btn.type = 'button';
    btn.onclick = function() { window._bbtnOcrOpenModal(); };
    btn.style.cssText = 'padding:7px 14px;border-radius:7px;border:1px solid rgba(0,200,255,.4);background:linear-gradient(135deg,rgba(0,200,255,.15),rgba(0,136,255,.15));color:#00c8ff;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-right:8px';
    btn.innerHTML = '<i class="fas fa-file-import"></i> Upload BBTN OCR';
    exportBtn.parentNode.insertBefore(btn, exportBtn);
  }
  function _install() {
    const overlay = document.getElementById('tbPageOverlay');
    if (!overlay) { setTimeout(_install, 500); return; }
    const observer = new MutationObserver(_tryInjectBtn);
    observer.observe(overlay, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    _tryInjectBtn();
    console.log('[BBTN] Button observer installed (Mgmt only)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _install);
  else _install();
})();

// ━━━━ BBTN Management Page (Export Excel) ━━━━
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
        ? `<a href="javascript:void(0)" onclick="_bbtnMgmtOpenFile('${_esc(r.file_url)}')" style="color:#00c8ff;text-decoration:none;font-size:14px" title="Xem file BBTN"><i class="fas fa-file-pdf"></i></a>`
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
        'SFRA (MBA)': r.sfra === true ? '' : (r.sfra === false ? '' : ''),
        'Tiết diện (Cáp)': r.tiet_dien || '',
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

// ━━━━ Lớp 5: Custom click handler cho menu Quản lý BBTN OCR ━━━━
// _navExtMapBBTN là const trong IIFE → window.* không truy cập được
// Workaround: gắn onclick trực tiếp vào DOM element
(function() {
  function _register() {
    if (typeof window._bbtnMgmtRenderPage !== 'function') {
      setTimeout(_register, 300); return;
    }
    const menu = document.getElementById('bbtnMgmtMenu');
    if (!menu) { setTimeout(_register, 300); return; }
    menu.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.nav-item.active,.nav-sub-item.active').forEach(el => el.classList.remove('active'));
      menu.classList.add('active');
      const ov = document.getElementById('tbPageOverlay');
      const cv = document.getElementById('canvasArea');
      const rp = document.querySelector('.props-panel');
      if (ov) { if (cv) cv.style.display='none'; if (rp) rp.style.display='none'; ov.style.display='block'; }
      window._bbtnMgmtRenderPage();
      return false;
    };
    console.log('[BBTN] Mgmt menu click handler installed');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _register);
  else setTimeout(_register, 500);
})();

// ━━━━ BBTN: Open file with signed URL (private bucket) ━━━━
(function() {
  if (window._bbtnMgmtOpenFile) return;
  
  window._bbtnMgmtOpenFile = async function(fileUrl) {
    try {
      if (!fileUrl || fileUrl.startsWith('pending://')) {
        alert('File chưa upload xong, vui lòng đợi');
        return;
      }
      const m = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?bbtn-files\/(.+)$/);
      if (!m) {
        alert('URL file không hợp lệ: ' + fileUrl);
        return;
      }
      const path = decodeURIComponent(m[1]);
      
      // Lấy token: ưu tiên _sbClient, fallback localStorage
      let token = null;
      const sbUrl = 'https://xqqmfmljwycpehfyknoy.supabase.co';
      const sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcW1mbWxqd3ljcGVoZnlrbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODM4MDQsImV4cCI6MjA4Nzg1OTgwNH0.J_z0cFqq_Yet-n2X2L_VREdkcAqbkRFpYUp-ti3Fukc';
      
      // Cách 1: từ Supabase client
      try {
        if (window._sbClient && window._sbClient.auth) {
          const { data: { session } } = await window._sbClient.auth.getSession();
          token = session?.access_token || null;
        }
      } catch (e) { console.warn('_sbClient.auth.getSession failed:', e); }
      
      // Cách 2: từ localStorage (Supabase lưu session ở đây)
      if (!token) {
        try {
          const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.includes('-auth-token'));
          if (key) {
            const stored = JSON.parse(localStorage.getItem(key));
            token = stored?.access_token || null;
          }
        } catch (e) { console.warn('localStorage token failed:', e); }
      }
      
      // Cách 3: gọi _authToken nếu có
      if (!token && typeof _authToken === 'function') {
        try { token = await _authToken(); } catch (e) {}
      }
      
      if (!token) {
        alert('Không tìm thấy token đăng nhập. Hãy đăng nhập lại.');
        return;
      }
      
      // Encode từng segment (KHÔNG encode '/' để giữ path structure)
      const pathSafe = path.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`${sbUrl}/storage/v1/object/sign/bbtn-files/${pathSafe}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': sbKey,
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ expiresIn: 600 }),
      });
      
      if (!res.ok) {
        const errText = await res.text();
        alert('Lỗi tạo URL ký (status ' + res.status + '): ' + errText.slice(0, 200));
        return;
      }
      
      const data = await res.json();
      const signedPath = data.signedURL || data.signedUrl || '';
      if (!signedPath) {
        alert('Response không có signed URL: ' + JSON.stringify(data));
        return;
      }
      
      const fullUrl = signedPath.startsWith('http') 
        ? signedPath 
        : `${sbUrl}/storage/v1${signedPath}`;
      
      window.open(fullUrl, '_blank');
    } catch (err) {
      alert('Lỗi: ' + err.message);
      console.error('[BBTN OpenFile]', err);
    }
  };
  
  console.log('[BBTN] _bbtnMgmtOpenFile installed');
})();

// ━━━━ PMIS Compare CSS injection ━━━━
(function() {
  if (document.getElementById('pmisCompareStyle')) return;
  const style = document.createElement('style');
  style.id = 'pmisCompareStyle';
  style.textContent = `/* ━━━━ PMIS Compare Module CSS ━━━━ */

.pmis-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7); 
  z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.pmis-modal-card {
  background: #1e2530; 
  border-radius: 10px;
  width: 95%; max-width: 1400px; 
  max-height: 92vh;
  display: flex; flex-direction: column;
  box-shadow: 0 10px 50px rgba(0,0,0,0.5);
}
.pmis-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 15px 20px; border-bottom: 1px solid #2c3744;
}
.pmis-modal-title {
  color: #00c8ff; font-weight: 600; font-size: 17px;
}
.pmis-modal-close {
  background: rgba(255,255,255,0.1); border: none;
  color: #fff; width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; font-size: 14px;
}
.pmis-modal-close:hover { background: rgba(255,82,82,0.3); }
.pmis-modal-body {
  flex: 1; overflow: auto; padding: 20px;
}

/* Upload zone */
.pmis-upload-zone {
  border: 2px dashed #2c3744; border-radius: 10px;
  padding: 30px; cursor: pointer; transition: border-color 0.2s;
}
.pmis-upload-zone:hover { border-color: #00c8ff; }

.pmis-btn-primary {
  background: #00c8ff; color: #000; border: none;
  padding: 10px 22px; border-radius: 5px; font-weight: 600;
  cursor: pointer; font-size: 14px;
}
.pmis-btn-primary:hover { background: #00b3e6; }

/* Progress */
.pmis-progress-wrap {
  padding: 40px; text-align: center;
}
.pmis-progress-bar {
  width: 100%; height: 8px; background: rgba(255,255,255,0.1);
  border-radius: 4px; overflow: hidden; margin-bottom: 15px;
}
.pmis-progress-fill {
  height: 100%; background: linear-gradient(90deg, #00c8ff, #4caf50);
  width: 100%;
  animation: pmis-pulse 2s infinite;
}
@keyframes pmis-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.pmis-progress-text { color: #aaa; font-size: 13px; }

/* Tabs */
.pmis-tabs {
  display: flex; gap: 5px; border-bottom: 1px solid #2c3744;
  margin-bottom: 20px; flex-wrap: wrap;
}
.pmis-tab {
  background: transparent; border: none;
  color: #aaa; padding: 10px 16px;
  cursor: pointer; font-size: 12px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.pmis-tab:hover { color: #fff; }
.pmis-tab.active {
  color: #00c8ff;
  border-bottom-color: #00c8ff;
  font-weight: 600;
}

/* KPI Cards */
.pmis-kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}
.pmis-kpi {
  background: rgba(0,200,255,0.08); padding: 15px; border-radius: 8px;
  border-left: 3px solid #00c8ff;
}
.pmis-kpi-label {
  color: #aaa; font-size: 11px; text-transform: uppercase;
  margin-bottom: 8px;
}
.pmis-kpi-value {
  color: #fff; font-size: 22px; font-weight: 700;
}

/* Groups */
.pmis-group-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px; margin-top: 12px;
}
.pmis-group {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px;
}
.pmis-group-icon { font-size: 18px; }
.pmis-group-label { flex: 1; color: #ddd; font-size: 12px; }
.pmis-group-count { color: #fff; font-weight: 700; font-size: 15px; }

/* Table */
.pmis-table-wrap { max-height: 60vh; overflow: auto; border: 1px solid #2c3744; border-radius: 6px; }
.pmis-table {
  width: 100%; border-collapse: collapse;
  font-size: 12px; color: #ddd;
}
.pmis-table thead {
  background: #243140; position: sticky; top: 0; z-index: 1;
}
.pmis-table th {
  text-align: left; padding: 10px 12px;
  color: #fff; font-weight: 600;
  border-bottom: 2px solid #1a242f;
}
.pmis-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #2c3744;
}
.pmis-table tbody tr:hover { background: rgba(0,200,255,0.05); }

/* Input */
.pmis-input {
  background: #fff !important;
  color: #000 !important;
  border: 1px solid #d0d7de;
  padding: 8px 12px; border-radius: 4px;
  width: 250px; font-size: 13px;
}
.pmis-input:focus { outline: 2px solid #00c8ff; }

/* Menu sidebar */
.pmis-menu:hover {
  background: rgba(0,200,255,0.1) !important;
}`;
  document.head.appendChild(style);
  console.log('[PMIS Compare] CSS injected');
})();

// ━━━━ PMIS Compare Module (Core) ━━━━
// ════════════════════════════════════════════════════════════════
// PMIS COMPARE MODULE — So sánh PMIS vs Đồng bộ EVN Hà Nội
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
      const res = await fetch(`${SB_URL}/rest/v1/TongHopThietBi?select=Tram,Ten_thiet_bi,Phan_loai_thiet_bi,Cap_dien_ap,Ngan_thiet_bi&offset=${offset}&limit=${BATCH}`, { headers });
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
      nhom: '',
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

// ━━━━ PMIS Compare Module (UI) ━━━━
// ════════════════════════════════════════════════════════════════
// PMIS COMPARE UI MODULE — Inject menu + Modal + Render results
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._pmisCompareUiLoaded) return;
  window._pmisCompareUiLoaded = true;

  // ────────────────────────────────────────────────────────────
  // Natural sort cho tên trạm (E1.2 < E1.10 < E10.1)
  // ────────────────────────────────────────────────────────────
  function _natSort(a, b) {
    a = String(a || '');
    b = String(b || '');
    // Split thành phần số và chữ
    const ax = a.split(/(\d+)/).filter(Boolean);
    const bx = b.split(/(\d+)/).filter(Boolean);
    for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
      const an = parseInt(ax[i]);
      const bn = parseInt(bx[i]);
      if (!isNaN(an) && !isNaN(bn)) {
        if (an !== bn) return an - bn;
      } else {
        const cmp = ax[i].localeCompare(bx[i]);
        if (cmp !== 0) return cmp;
      }
    }
    return ax.length - bx.length;
  }
  function _sortByTramLoai(rows) {
    return rows.slice().sort((a, b) => {
      const t = _natSort(a.tram, b.tram);
      if (t !== 0) return t;
      return String(a.loai || '').localeCompare(String(b.loai || ''));
    });
  }
  window._pmisNatSort = _natSort;
  window._pmisSortByTramLoai = _sortByTramLoai;
  
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
    menu.innerHTML = `<i class="fas fa-balance-scale" style="margin-right:8px"></i> <span>📊 So sánh PMIS vs Đồng bộ</span>`;
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
            So sánh PMIS vs Đồng bộ
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
        <button class="pmis-tab" data-tab="missing"><i class="fas fa-exclamation-triangle"></i> Thiếu Đồng bộ (${groups.N1.length})</button>
        <button class="pmis-tab" data-tab="extra"><i class="fas fa-plus-circle"></i> Thừa Đồng bộ (${groups.N2.length})</button>
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
          <div class="pmis-kpi"><div class="pmis-kpi-label">Tổng Đồng bộ</div><div class="pmis-kpi-value">${dbStats.total.toLocaleString()}</div></div>
          <div class="pmis-kpi"><div class="pmis-kpi-label">Khớp được</div><div class="pmis-kpi-value" style="color:#4caf50">${matchResults.tier3.matched.length.toLocaleString()} (${matchPct}%)</div></div>
          <div class="pmis-kpi"><div class="pmis-kpi-label">Số trạm</div><div class="pmis-kpi-value">${pmisStats.trams}</div></div>
        </div>
        
        <h3 style="color:#fff;margin-top:25px">7 nhóm sai khác</h3>
        <div class="pmis-group-grid">
          <div class="pmis-group" data-group="N1"><span class="pmis-group-icon" style="color:#ff5252">❌</span> <span class="pmis-group-label">N1: Thiếu Đồng bộ</span><span class="pmis-group-count">${groups.N1.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N2"><span class="pmis-group-icon" style="color:#ff9100">➕</span> <span class="pmis-group-label">N2: Thừa Đồng bộ</span><span class="pmis-group-count">${groups.N2.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N3"><span class="pmis-group-icon" style="color:#fbc02d">⚖️</span> <span class="pmis-group-label">N3: Lệch số lượng</span><span class="pmis-group-count">${groups.N3.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N4"><span class="pmis-group-icon" style="color:#9c27b0">🔢</span> <span class="pmis-group-label">N4: Lệch serial</span><span class="pmis-group-count">${groups.N4.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N5"><span class="pmis-group-icon" style="color:#03a9f4">🏭</span> <span class="pmis-group-label">N5: Lệch hãng</span><span class="pmis-group-count">${groups.N5.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N6"><span class="pmis-group-icon" style="color:#00bcd4">📦</span> <span class="pmis-group-label">N6: Lệch kiểu</span><span class="pmis-group-count">${groups.N6.length.toLocaleString()}</span></div>
          <div class="pmis-group" data-group="N7"><span class="pmis-group-icon" style="color:#607d8b">❓</span> <span class="pmis-group-label">N7: Thiếu info</span><span class="pmis-group-count">${groups.N7.length.toLocaleString()}</span></div>
        </div>
        
        <h3 style="color:#fff;margin-top:25px">Phân bố theo loại</h3>
        <table class="pmis-table">
          <thead><tr><th>Loại</th><th>PMIS</th><th>Đồng bộ</th><th>Chênh lệch</th></tr></thead>
          <tbody>
            ${_renderTypeBreakdown(pmisStats.byType, dbStats.byType)}
          </tbody>
        </table>
      `;
    } else if (tab === 'tier1') {
      const rows = _sortByTramLoai(Object.values(matchResults.tier1));
      c.innerHTML = `
        <div style="margin-bottom:10px"><input type="text" id="t1Filter" placeholder="Lọc trạm..." class="pmis-input" oninput="window._pmisFilterT1(this.value)"></div>
        <div class="pmis-table-wrap">
          <table class="pmis-table" id="pmisT1Table">
            <thead><tr><th>Trạm</th><th>Loại</th><th>Cấp ĐA</th><th>PMIS</th><th>Đồng bộ</th><th>Chênh lệch</th></tr></thead>
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
        .sort((a,b) => {
          const t = _natSort(a.tram, b.tram);
          if (t !== 0) return t;
          const c = String(a.cap_dien_ap||'').localeCompare(String(b.cap_dien_ap||''));
          if (c !== 0) return c;
          return String(a.ngan_lo||'').localeCompare(String(b.ngan_lo||''));
        })
        .slice(0, 500);
      c.innerHTML = `
        <p style="color:#aaa">Hiển thị 500 ngăn lộ có chênh lệch cao nhất.</p>
        <div class="pmis-table-wrap">
          <table class="pmis-table">
            <thead><tr><th>Trạm</th><th>Cấp ĐA</th><th>Ngăn lộ</th><th>Loại</th><th>PMIS</th><th>Đồng bộ</th><th>Δ</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td>${_esc(r.tram)}</td><td>${_esc(r.cap_dien_ap)}</td><td>${_esc(r.ngan_lo)}</td><td>${_esc(r.loai)}</td><td>${r.pmis}</td><td>${r.db}</td><td style="color:${r.pmis>r.db?'#ff5252':'#ff9100'}">${r.pmis-r.db}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      `;
    } else if (tab === 'missing') {
      c.innerHTML = _renderDeviceList(groups.N1, 'Thiết bị có trong PMIS nhưng KHÔNG có trong Đồng bộ', true);
    } else if (tab === 'extra') {
      c.innerHTML = _renderDeviceList(groups.N2, 'Thiết bị có trong Đồng bộ nhưng KHÔNG có trong PMIS', false);
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
            So_sanh_hang_model, Thiet_bi_PMIS_chua_co_DongBo, DongBo_chua_co_PMIS,<br>
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
          <thead><tr><th>Trạm</th><th>Tên</th><th>Loại</th><th>Score</th><th>PMIS serial</th><th>Đồng bộ serial</th><th>PMIS hãng</th><th>Đồng bộ hãng</th></tr></thead>
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

// ━━━━ PMIS Compare Module (Export) ━━━━
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
      ['CHỈ TIÊU', 'PMIS', 'Đồng bộ', 'Chênh lệch'],
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
    const tramRows = [['Trạm', 'Có trong PMIS', 'Có trong Đồng bộ', 'TB PMIS', 'TB Đồng bộ', 'Chênh lệch']];
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
    const ws3rows = [['Trạm', 'PMIS', 'Đồng bộ', 'Chênh lệch', 'Mức ưu tiên']];
    Object.entries(tramAgg).sort((a,b) => window._pmisNatSort ? window._pmisNatSort(a[0], b[0]) : a[0].localeCompare(b[0])).forEach(([t, c]) => {
      const diff = c.pmis - c.db;
      const priority = Math.abs(diff) > 50 ? 'CAO' : Math.abs(diff) > 10 ? 'TRUNG BÌNH' : 'THẤP';
      ws3rows.push([t, c.pmis, c.db, diff, priority]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws3rows), 'Tong_hop_theo_tram');
    
    // ── Sheet 4: Tong_hop_theo_loai_TB ──
    const allTypes = new Set([...Object.keys(pmisStats.byType), ...Object.keys(dbStats.byType)]);
    const ws4rows = [['Loại thiết bị', 'PMIS', 'Đồng bộ', 'Chênh lệch']];
    [...allTypes].sort().forEach(t => {
      ws4rows.push([t, pmisStats.byType[t] || 0, dbStats.byType[t] || 0, (pmisStats.byType[t] || 0) - (dbStats.byType[t] || 0)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws4rows), 'Tong_hop_theo_loai_TB');
    
    // ── Sheet 5: So_sanh_tram_loai_capdienap ──
    const ws5rows = [['Trạm', 'Loại', 'Cấp điện áp', 'PMIS', 'Đồng bộ', 'Chênh lệch']];
    Object.values(matchResults.tier1).sort((a,b) => {
      const t = window._pmisNatSort ? window._pmisNatSort(a.tram, b.tram) : a.tram.localeCompare(b.tram);
      if (t !== 0) return t;
      return String(a.loai||'').localeCompare(String(b.loai||''));
    }).forEach(r => {
      ws5rows.push([r.tram, r.loai, r.cap_dien_ap, r.pmis, r.db, r.diff]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws5rows), 'So_sanh_tram_loai_capdienap');
    
    // ── Sheet 6: So_sanh_ngan_lo ──
    const ws6rows = [['Trạm', 'Cấp ĐA', 'Ngăn lộ', 'Loại', 'PMIS', 'Đồng bộ', 'Chênh lệch']];
    Object.values(matchResults.tier2).filter(r => r.pmis !== r.db).sort((a,b) => {
      const t = window._pmisNatSort ? window._pmisNatSort(a.tram, b.tram) : a.tram.localeCompare(b.tram);
      if (t !== 0) return t;
      const c = String(a.cap_dien_ap||'').localeCompare(String(b.cap_dien_ap||''));
      if (c !== 0) return c;
      return String(a.ngan_lo||'').localeCompare(String(b.ngan_lo||''));
    }).slice(0, 5000).forEach(r => {
      ws6rows.push([r.tram, r.cap_dien_ap, r.ngan_lo, r.loai, r.pmis, r.db, r.pmis - r.db]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws6rows), 'So_sanh_ngan_lo');
    
    // ── Sheet 7: So_sanh_serial ──
    const ws7rows = [['Trạm', 'Tên TB', 'Loại', 'PMIS Serial', 'Đồng bộ Serial', 'Match score']];
    groups.N4.slice(0, 5000).forEach(c => {
      ws7rows.push([c.pmis.tram, c.pmis.ten_thiet_bi, c.pmis.loai_thiet_bi, c.pmis.so_che_tao||'', c.db.so_che_tao||'', c.score]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws7rows), 'So_sanh_serial');
    
    // ── Sheet 8: So_sanh_hang_model ──
    const ws8rows = [['Trạm', 'Tên TB', 'Loại', 'PMIS Hãng', 'Đồng bộ Hãng', 'PMIS Kiểu', 'Đồng bộ Kiểu']];
    const hangModelDiffs = [...groups.N5, ...groups.N6].slice(0, 5000);
    hangModelDiffs.forEach(c => {
      ws8rows.push([c.pmis.tram, c.pmis.ten_thiet_bi, c.pmis.loai_thiet_bi, c.pmis.hang_san_xuat||'', c.db.hang_san_xuat||'', c.pmis.kieu||'', c.db.kieu||'']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws8rows), 'So_sanh_hang_model');
    
    // ── Sheet 9: Thiet_bi_PMIS_chua_co_DongBo ──
    const ws9rows = [['Trạm', 'Ngăn lộ', 'Tên TB', 'Loại', 'Cấp ĐA', 'Serial', 'Hãng', 'Năm SX', 'Kiểu']];
    groups.N1.slice(0, 10000).forEach(d => {
      ws9rows.push([d.tram, d.ngan_lo||'', d.ten_thiet_bi, d.loai_thiet_bi, d.cap_dien_ap, d.so_che_tao||'', d.hang_san_xuat||'', d.nam_san_xuat||'', d.kieu||'']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws9rows), 'PMIS_chua_co_DongBo');
    
    // ── Sheet 10: DongBo_chua_co_PMIS ──
    const ws10rows = [['Trạm', 'Ngăn lộ', 'Tên TB', 'Loại', 'Cấp ĐA']];
    groups.N2.slice(0, 10000).forEach(d => {
      ws10rows.push([d.tram, d.ngan_lo||'', d.ten_thiet_bi, d.loai_thiet_bi, d.cap_dien_ap]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws10rows), 'DongBo_chua_co_PMIS');
    
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// V54: USER-FRIENDLY ERROR MESSAGES
// Convert technical errors → human-readable Vietnamese messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  if (window._friendlyError) return;
  
  const ERROR_PATTERNS = [
    // Database errors
    { match: /PGRST204|column.*does not exist|schema cache/i,
      friendly: '⚙️ Hệ thống cần được cập nhật.\n\nVui lòng liên hệ admin IT để chạy migration database.' },
    
    // Rate limiting
    { match: /429|Quota exceeded|rate.?limit/i,
      friendly: '⏳ Hệ thống đang quá tải.\n\nVui lòng đợi 1 phút rồi thử lại. Nếu vẫn lỗi, có thể đã hết quota OCR ngày hôm nay.' },
    
    // File access
    { match: /InvalidSignature/i,
      friendly: '🔒 Link file đã hết hạn (10 phút).\n\nVui lòng refresh trang (F5) rồi click lại để tạo link mới.' },
    
    // Network
    { match: /Network|Failed to fetch|NetworkError|ERR_NETWORK/i,
      friendly: '📡 Mất kết nối internet.\n\nVui lòng kiểm tra wifi/mạng rồi thử lại.' },
    
    // Auth
    { match: /401|Unauthorized|JWT expired|Token.*expired/i,
      friendly: '🔐 Phiên đăng nhập đã hết hạn.\n\nVui lòng đăng xuất và đăng nhập lại.' },
    
    { match: /403|Forbidden|RLS|policy|permission/i,
      friendly: '🚫 Bạn không có quyền thực hiện thao tác này.\n\nLiên hệ admin để được cấp quyền.' },
    
    // Server errors
    { match: /500|502|503|Bad Gateway|Edge Function.*error/i,
      friendly: '🛠️ Hệ thống đang gặp lỗi tạm thời.\n\nĐợi 1-2 phút rồi thử lại. Nếu vẫn không được, báo admin IT.' },
    
    { match: /504|timeout|timed out/i,
      friendly: '⏱️ Yêu cầu quá lâu, hệ thống tự hủy.\n\nThử lại với ít dữ liệu hơn hoặc đợi mạng ổn định.' },
    
    // File errors
    { match: /File too large|exceed.*size|too big/i,
      friendly: '📦 File quá lớn (tối đa 50MB).\n\nVui lòng nén hoặc tách file nhỏ hơn trước khi upload.' },
    
    { match: /Invalid file type|unsupported format/i,
      friendly: '📄 Định dạng file không hỗ trợ.\n\nChỉ chấp nhận: JPG, PNG, PDF cho BBTN; XLSX/XLSB cho PMIS.' },
    
    // OCR specific
    { match: /Gemini.*empty|OCR.*0 thiết bị|extract.*empty/i,
      friendly: '🔍 OCR không đọc được nội dung.\n\nKiểm tra: file có rõ nét? Định dạng đúng BBTN EVN?' },
    
    { match: /JSON.*parse|Unexpected token/i,
      friendly: '📋 Hệ thống nhận dữ liệu không đúng định dạng.\n\nĐợi 1 phút và thử lại.' },
  ];
  
  window._friendlyError = function(err) {
    const raw = String(err?.message || err?.error || err || 'Lỗi không xác định');
    
    // Skip nếu raw đã là Vietnamese (đã được làm thân thiện)
    if (/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(raw) && raw.length < 200) {
      return raw;
    }
    
    for (const p of ERROR_PATTERNS) {
      if (p.match.test(raw)) {
        return p.friendly;
      }
    }
    
    // Fallback
    return '⚠️ Có lỗi xảy ra:\n\n' + (raw.length > 250 ? raw.substring(0, 250) + '...' : raw);
  };
  
  // Helper alert với friendly message
  window._friendlyAlert = function(err) {
    alert(window._friendlyError(err));
  };
  
  console.log('[V54] _friendlyError installed');
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// V54: BBTN OCR PROGRESS WITH ETA
// Hiển thị thời gian còn lại khi upload nhiều file
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  if (window._bbtnOcrEtaInstalled) return;
  window._bbtnOcrEtaInstalled = true;
  
  // Theo dõi text của progress element, tự inject ETA
  const observerTarget = () => document.getElementById('bbtnOcrProgressText');
  
  let _startTime = null;
  let _lastCompleted = 0;
  
  // Track when OCR starts
  const interval = setInterval(() => {
    const el = observerTarget();
    if (!el) return;
    
    const text = el.textContent || '';
    const match = text.match(/Đã OCR (\d+)\/(\d+) file/);
    if (!match) {
      _startTime = null;
      _lastCompleted = 0;
      return;
    }
    
    const completed = parseInt(match[1]);
    const total = parseInt(match[2]);
    
    if (completed === 0 || !_startTime) {
      _startTime = Date.now();
      _lastCompleted = 0;
      return;
    }
    
    if (completed === total) {
      // Done
      el.innerHTML = `✅ Hoàn thành ${total} file. Vui lòng kiểm tra preview bên dưới...`;
      return;
    }
    
    // Calculate ETA
    if (completed > _lastCompleted) {
      _lastCompleted = completed;
    }
    
    const elapsedSec = (Date.now() - _startTime) / 1000;
    const avgPerFile = elapsedSec / completed;
    const remaining = total - completed;
    const etaSec = Math.round(remaining * avgPerFile);
    
    let etaText = '';
    if (etaSec > 90) etaText = `~${Math.round(etaSec / 60)} phút`;
    else if (etaSec > 10) etaText = `~${etaSec} giây`;
    else if (etaSec > 0) etaText = `gần xong`;
    
    if (etaText && !text.includes('Còn')) {
      el.innerHTML = `Đã OCR ${completed}/${total} file... <span style="color:#ffd54f">Còn ${etaText}</span>`;
    }
  }, 1000); // check mỗi 1 giây
  
  console.log('[V54] BBTN OCR ETA installed');
})();
