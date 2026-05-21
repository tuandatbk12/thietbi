// ════════════════════════════════════════════════════════════════
// Edge Function: nas-health-check
// 1. Test connectivity tới NAS (PROPFIND Depth: 0 nhanh nhất)
// 2. Ghi 1 row vào public.nas_health_log cho mỗi lần check
// 3. Trả JSON kết quả về client (cho dashboard badge / uptime monitor)
//
// View nas_health_summary aggregate 24h từ table này.
//
// PUBLIC endpoint — không cần JWT. Không lộ NAS URL/credentials.
//
// Schema giả định cho nas_health_log:
//   - status         text       NOT NULL    -- 'ok'|'timeout'|'auth_failed'|'unreachable'|'partial'
//   - detail         text       NULL
//   - latency_ms     integer    NULL
//   - nas_reachable  boolean    NULL
//   - nas_auth       boolean    NULL
//   - bbtn_ok        boolean    NULL
//   - asset_ok       boolean    NULL
//   - checked_at     timestamptz DEFAULT now()
// Nếu schema khác → insert sẽ fail nhưng health check vẫn return OK.
// ════════════════════════════════════════════════════════════════

import {
  jsonResponse, handlePreflight,
} from '../_shared/cors.ts';
import {
  getNasConfig, nasUrl, nasAuthHeader, timeoutSignal,
  getServiceRoleKey, NasConfig,
} from '../_shared/nas.ts';

interface HealthResult {
  ok: boolean;
  status: string;
  detail: string;
  latencyMs: number;
  nasReachable: boolean;
  nasAuth: boolean;
  bbtnAccessible: boolean;
  assetAccessible: boolean;
  checkedAt: string;
  error?: string;
}

async function quickProbe(cfg: NasConfig, path: string, timeoutMs = 20_000): Promise<{
  reachable: boolean;
  authOk: boolean;
  found: boolean;
  status: number;
}> {
  try {
    const resp = await fetch(nasUrl(cfg, path), {
      method: 'PROPFIND',
      headers: {
        ...nasAuthHeader(cfg),
        'Depth': '0',
        'Content-Type': 'application/xml',
      },
      signal: timeoutSignal(timeoutMs),
    });
    try { await resp.body?.cancel(); } catch (_) { /* ignore */ }
    return {
      reachable: true,
      authOk:    resp.status !== 401 && resp.status !== 403,
      found:     resp.status === 207 || resp.status === 200,
      status:    resp.status,
    };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.warn('[health] probe failed', path, msg);
    return { reachable: false, authOk: false, found: false, status: 0 };
  }
}

/** Ghi 1 row vào nas_health_log — defensive, không throw.
 *  Schema thực tế (đã verify):
 *    id, status, detail, response_ms, nas_url, alert_sent, checked_at
 */
async function writeHealthLog(result: HealthResult): Promise<void> {
  try {
    const sbUrl  = Deno.env.get('SUPABASE_URL');
    const srvKey = getServiceRoleKey();
    if (!sbUrl || !srvKey) {
      console.warn('[health] skip log — missing SUPABASE_URL/SECRET_KEYS');
      return;
    }
    const resp = await fetch(`${sbUrl.replace(/\/+$/, '')}/rest/v1/nas_health_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${srvKey}`,
        'apikey': srvKey,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        status:      result.status,                 // 'ok'|'timeout'|'auth_failed'|'unreachable'|'partial'|'error'
        detail:      result.detail || null,
        response_ms: result.latencyMs,              // ← schema dùng response_ms (KHÔNG phải latency_ms)
        nas_url:     Deno.env.get('NAS_BASE_URL') ?? null,
        // alert_sent giữ default false (cron job khác xử lý alert)
        // checked_at giữ default now()
      }),
      signal: timeoutSignal(5_000),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn(`[health] log insert HTTP ${resp.status}:`, txt.slice(0, 300));
    }
  } catch (e) {
    console.warn('[health] log insert error:', (e as Error)?.message ?? e);
  }
}

function classifyStatus(r: Omit<HealthResult, 'ok'|'status'|'detail'>): { status: string; detail: string } {
  if (!r.nasReachable) {
    return { status: 'timeout', detail: `NAS không phản hồi sau ${Math.round(r.latencyMs/1000)}s — kiểm tra ngrok tunnel & WebDAV` };
  }
  if (!r.nasAuth) {
    return { status: 'auth_failed', detail: 'NAS từ chối Basic Auth — kiểm tra NAS_USERNAME/NAS_PASSWORD' };
  }
  if (!r.bbtnAccessible && !r.assetAccessible) {
    return { status: 'unreachable', detail: 'Cả 2 folder BBTN và TNDK không truy cập được' };
  }
  if (!r.bbtnAccessible || !r.assetAccessible) {
    const which = !r.bbtnAccessible ? 'BBTN' : 'TNDK';
    return { status: 'partial', detail: `Folder ${which} không truy cập được` };
  }
  return { status: 'ok', detail: 'NAS hoạt động bình thường' };
}

Deno.serve(async (req: Request) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return jsonResponse({ error: 'Chỉ chấp nhận GET/HEAD' }, 405);
  }

  // ── DEBUG MODE: ?debug=1 thử nhiều method, trả error chi tiết ──
  const url = new URL(req.url);
  if (url.searchParams.get('debug') === '1') {
    const cfg = getNasConfig();
    const tests: Array<Record<string, unknown>> = [];
    for (const m of [
      { method: 'HEAD',     path: '/' },
      { method: 'OPTIONS',  path: '/' },
      { method: 'GET',      path: '/' },
      { method: 'PROPFIND', path: '/' },
      { method: 'PROPFIND', path: cfg.bbtnRoot },
    ]) {
      const t0 = Date.now();
      try {
        const headers: Record<string, string> = { ...nasAuthHeader(cfg) };
        if (m.method === 'PROPFIND') {
          headers['Depth'] = '0';
          headers['Content-Type'] = 'application/xml';
        }
        const resp = await fetch(nasUrl(cfg, m.path), {
          method: m.method,
          headers,
          signal: timeoutSignal(15_000),
        });
        try { await resp.body?.cancel(); } catch (_) { /* ignore */ }
        tests.push({
          method: m.method,
          path: m.path,
          status: resp.status,
          elapsedMs: Date.now() - t0,
          ok: true,
        });
      } catch (e) {
        tests.push({
          method: m.method,
          path: m.path,
          error: (e as Error)?.name + ': ' + ((e as Error)?.message ?? String(e)),
          elapsedMs: Date.now() - t0,
          ok: false,
        });
      }
    }
    return jsonResponse({
      debugMode: true,
      nasBaseUrl: cfg.baseUrl,
      tests,
      checkedAt: new Date().toISOString(),
    });
  }

  const startedAt = Date.now();
  let result: HealthResult = {
    ok: false,
    status: 'unreachable',
    detail: '',
    latencyMs: 0,
    nasReachable: false,
    nasAuth: false,
    bbtnAccessible: false,
    assetAccessible: false,
    checkedAt: new Date().toISOString(),
  };

  try {
    const cfg = getNasConfig();

    // ── Sequential probes thay vì parallel ───────────────
    //   Lý do: ngrok-free có rate limit khá khắt khe (~40 req/phút),
    //   3 PROPFIND song song dễ bị throttle → cả 3 timeout cùng lúc.
    //   Sequential cho phép ngrok handle từng request gọn gàng.
    // ── Timeout 20s mỗi probe ────────────────────────────
    //   Path Supabase Edge (US/EU) → ngrok-free.dev → NAS Việt Nam
    //   có thể mất 5-15s lần đầu cold-start. 8s quá ngắn.
    const root  = await quickProbe(cfg, '/',            20_000);
    const bbtn  = root.reachable
      ? await quickProbe(cfg, cfg.bbtnRoot,   20_000)
      : { reachable: false, authOk: false, found: false, status: 0 };
    const asset = root.reachable
      ? await quickProbe(cfg, cfg.assetsRoot, 20_000)
      : { reachable: false, authOk: false, found: false, status: 0 };

    result.nasReachable    = root.reachable;
    result.nasAuth         = root.authOk;
    result.bbtnAccessible  = bbtn.found;
    result.assetAccessible = asset.found;
    result.latencyMs       = Date.now() - startedAt;

    const cls = classifyStatus(result);
    result.status = cls.status;
    result.detail = cls.detail;
    result.ok = result.status === 'ok';
  } catch (e) {
    result.latencyMs = Date.now() - startedAt;
    result.error  = (e as Error)?.message ?? String(e);
    result.status = 'error';
    result.detail = result.error;
  }

  // Ghi log fire-and-forget — không trì hoãn response
  writeHealthLog(result).catch(_ => { /* already logged */ });

  if (req.method === 'HEAD') {
    return new Response(null, {
      status: result.ok ? 200 : 503,
      headers: {
        'X-Health-Ok':       String(result.ok),
        'X-Health-Status':   result.status,
        'X-Health-Latency':  String(result.latencyMs),
        'Cache-Control':     'no-store',
      },
    });
  }

  return jsonResponse(result, result.ok ? 200 : 503, {
    'Cache-Control': 'no-store',
  });
});
