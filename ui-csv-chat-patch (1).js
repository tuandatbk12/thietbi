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
  style.textContent = '#_chatFab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#00e676,#00b8d4);box-shadow:0 4px 16px rgba(0,230,118,.4);cursor:pointer;z-index:9998;display:none;align-items:center;justify-content:center;transition:transform .2s;border:none;color:#000}#_chatFab:hover{transform:scale(1.08)}#_chatFab i{font-size:22px}#_chatPanel{position:fixed;bottom:92px;right:24px;width:380px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 120px);background:rgba(15,20,25,.96);backdrop-filter:blur(12px);border:1px solid rgba(0,230,118,.25);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none;flex-direction:column;z-index:9999}#_chatPanel.open{display:flex}#_chatHeader{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center}#_chatHeader h3{margin:0;font-size:14px;color:#00e676;font-weight:700}#_chatClose{background:none;border:none;color:#9ab;cursor:pointer;font-size:18px}#_chatMessages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px}.chat-msg{max-width:88%;padding:9px 13px;border-radius:12px;font-size:12.5px;line-height:1.5;word-wrap:break-word}.chat-msg.user{align-self:flex-end;background:rgba(0,200,255,.18);color:#eef}.chat-msg.assistant{align-self:flex-start;background:rgba(0,230,118,.1);color:#dff;border-left:2px solid #00e676}.chat-msg.error{background:rgba(255,82,82,.15);color:#fbb}.chat-tools{font-size:9.5px;color:#789;margin-top:4px;font-family:ui-monospace,monospace}#_chatInput{width:100%;padding:9px 12px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#eef;font-size:12.5px;outline:none;box-sizing:border-box}#_chatInputRow{padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,.08)}#_chatHints{padding:0 14px 8px}#_chatHints .hint{display:inline-block;padding:4px 10px;margin:3px 2px;background:rgba(0,150,255,.12);color:#aee;border-radius:12px;font-size:10.5px;cursor:pointer;border:1px solid rgba(0,150,255,.2)}';
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

      var resp = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': _AUTH_SB_KEY,
        },
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
      var me = (typeof _authGetCurrentUser === 'function') ? await _authGetCurrentUser() : null;
      if (!me) return;
      var resp = await fetch(_AUTH_SB_URL + '/rest/v1/evn_user_profiles?id=eq.' + me.id + '&select=role', {
        headers: { 'Authorization': 'Bearer ' + token, 'apikey': _AUTH_SB_KEY },
      });
      var rows = await resp.json();
      if (rows[0] && rows[0].role === 'admin') {
        document.getElementById('_chatFab').style.display = 'flex';
        // Show upload CSV buttons (will be triggered manually from admin panel)
      }
    } catch (e) { /* */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_checkAdminFeatures, 1000); });
  } else {
    setTimeout(_checkAdminFeatures, 1000);
  }

  // Expose globally
  window._openCsvUpload = _openCsvUpload;
})();
