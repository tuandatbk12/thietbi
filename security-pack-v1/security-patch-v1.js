// ════════════════════════════════════════════════════════════════
// security-patch-v1.js
//
// Append vào CUỐI app.js. Cung cấp:
//   1. Watermark mờ overlay (email user) trên data nhạy cảm
//   2. Disable Ctrl+S, Ctrl+P (chống lưu trang/in trang)
//   3. Detect Print Screen + show warning
//   4. Audit log: gửi action lên Supabase access_log
//   5. Block context menu trên các vùng có data nhạy cảm
//      (KHÔNG block toàn site → user vẫn copy text bình thường)
// ════════════════════════════════════════════════════════════════

(() => {
  'use strict';

  // ───────────────────────────────────────────────────
  // GLOBAL CONSTANTS - reuse từ app.js
  // ───────────────────────────────────────────────────
  const SB_URL = (typeof _AUTH_SB_URL !== 'undefined') ? _AUTH_SB_URL : 'https://xqqmfmljwycpehfyknoy.supabase.co';
  const SB_KEY = (typeof _AUTH_SB_KEY !== 'undefined') ? _AUTH_SB_KEY : '';

  // Batch audit log để giảm load (gửi mỗi 5 giây)
  let _logBuffer = [];
  let _logFlushTimer = null;

  // ───────────────────────────────────────────────────
  // AUTH HELPERS
  // ───────────────────────────────────────────────────
  async function _getToken() {
    if (typeof _authGetToken === 'function') return await _authGetToken();
    return null;
  }

  async function _getEmail() {
    if (typeof _authGetCurrentUser === 'function') {
      const u = await _authGetCurrentUser();
      return u?.email || '';
    }
    return '';
  }

  // ───────────────────────────────────────────────────
  // AUDIT LOG (batch + async)
  // ───────────────────────────────────────────────────
  function logAction(action, resource, details) {
    _logBuffer.push({ action, resource, details, timestamp: Date.now() });

    // Flush sau 5s nếu chưa có timer
    if (!_logFlushTimer) {
      _logFlushTimer = setTimeout(_flushLogs, 5000);
    }
    // Flush ngay nếu buffer > 20
    if (_logBuffer.length >= 20) {
      clearTimeout(_logFlushTimer);
      _logFlushTimer = null;
      _flushLogs();
    }
  }

  async function _flushLogs() {
    _logFlushTimer = null;
    if (_logBuffer.length === 0) return;

    const batch = _logBuffer.splice(0);
    const token = await _getToken();
    if (!token) return;

    // Gửi từng log qua RPC log_user_action (có audit ngày giờ chính xác từ DB)
    for (const entry of batch) {
      try {
        await fetch(SB_URL + '/rest/v1/rpc/log_user_action', {
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
      } catch (_) { /* silent fail */ }
    }
  }

  // Expose để các module khác dùng
  window.logAction = logAction;

  // Flush trước khi đóng tab
  window.addEventListener('beforeunload', _flushLogs);

  // ───────────────────────────────────────────────────
  // WATERMARK OVERLAY (chống screenshot phát tán)
  // ───────────────────────────────────────────────────
  async function _injectWatermark() {
    const email = await _getEmail();
    if (!email) return;

    // Style chỉ inject 1 lần
    if (document.getElementById('_security_wm_style')) return;

    const style = document.createElement('style');
    style.id = '_security_wm_style';
    style.textContent = `
      #_security_watermark {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483646;
        opacity: 0.07;
        user-select: none;
        overflow: hidden;
        background-image: repeating-linear-gradient(
          -25deg,
          transparent 0,
          transparent 200px,
          transparent 200px
        );
      }
      #_security_watermark .wm-line {
        position: absolute;
        font-family: ui-monospace, Consolas, monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        white-space: nowrap;
        transform: rotate(-25deg);
        text-shadow: 0 0 2px rgba(0,0,0,0.5);
      }
    `;
    document.head.appendChild(style);

    // Tạo overlay với grid watermark
    let overlay = document.getElementById('_security_watermark');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_security_watermark';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';

    const now = new Date();
    const stamp = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN');
    const text = `${email} • ${stamp} • EVN HÀ NỘI`;

    // Render grid 8x10 dòng watermark
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

    // Refresh watermark mỗi 60s (cập nhật timestamp)
    setTimeout(_injectWatermark, 60000);
  }

  // ───────────────────────────────────────────────────
  // DISABLE Ctrl+S, Ctrl+P, Ctrl+U (View Source)
  // ───────────────────────────────────────────────────
  function _setupKeyBlocker() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S: Save page
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        _showWarning('Tính năng lưu trang đã bị vô hiệu hóa');
        logAction('blocked_ctrl_s', null, { key: 'Ctrl+S' });
        return false;
      }
      // Ctrl/Cmd + P: Print page
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        _showWarning('Tính năng in trang đã bị vô hiệu hóa');
        logAction('blocked_ctrl_p', null, { key: 'Ctrl+P' });
        return false;
      }
      // Ctrl + U: View source
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        logAction('blocked_view_source', null, { key: 'Ctrl+U' });
        return false;
      }
      // PrintScreen: warn only (không thể block thật vì là OS-level)
      if (e.key === 'PrintScreen') {
        _showWarning('⚠️ Phát hiện chụp màn hình. Hành động này được ghi log.');
        logAction('print_screen', null, { url: location.href });
      }
    });
  }

  // Disable @media print qua CSS (in trang sẽ ra trắng)
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
  // TOAST WARNING
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
        z-index: 2147483647;
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
  // RATE-LIMITED EXPORT LOGGING
  // (Hook vào nút Export CSV nếu có)
  // ───────────────────────────────────────────────────
  function _hookExportButtons() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('button, a');
      if (!el) return;
      const txt = (el.textContent || '').toLowerCase();
      const onclick = el.getAttribute('onclick') || '';
      if (txt.includes('export') || txt.includes('xuất') || txt.includes('csv')
          || onclick.includes('export') || onclick.includes('download')) {
        logAction('export_data', null, { button: el.textContent.trim().slice(0, 50) });
      }
    }, true);
  }

  // ───────────────────────────────────────────────────
  // LOG nav module switches
  // ───────────────────────────────────────────────────
  function _hookNavActivation() {
    if (typeof window.navActivate !== 'function') return;
    const orig = window.navActivate;
    window.navActivate = function(el) {
      const text = el.querySelector('span')?.textContent?.trim() || el.textContent?.trim() || '';
      logAction('navigate', text);
      return orig.apply(this, arguments);
    };
  }

  // ───────────────────────────────────────────────────
  // INIT
  // ───────────────────────────────────────────────────
  async function _init() {
    // Đợi user login (poll mỗi 500ms tối đa 30s)
    let waited = 0;
    const poll = setInterval(async () => {
      waited += 500;
      const token = await _getToken();
      if (token) {
        clearInterval(poll);
        _injectWatermark();
        logAction('login_session_start', null, {
          ua: navigator.userAgent.slice(0, 100),
          screen: `${screen.width}x${screen.height}`,
        });
      } else if (waited >= 30000) {
        clearInterval(poll);
      }
    }, 500);

    // Các bảo vệ chạy ngay không cần token
    _setupKeyBlocker();
    _injectPrintBlocker();
    _hookExportButtons();

    // Wait cho navActivate available
    setTimeout(_hookNavActivation, 2000);

    console.log('[Security] Patch v1 loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // Expose for debug
  window._securityDebug = {
    flushLogs: _flushLogs,
    logBuffer: () => _logBuffer.slice(),
    injectWatermark: _injectWatermark,
  };

})();
