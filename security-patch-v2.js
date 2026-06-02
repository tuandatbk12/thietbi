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
        _injectWatermark();
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
