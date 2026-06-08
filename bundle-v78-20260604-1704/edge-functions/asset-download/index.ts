// ════════════════════════════════════════════════════════════════
// Edge Function: asset-download
// GET ?id=<equipment_attachments.id>
// Tra DB lấy nas_path → stream từ NAS WebDAV về client.
// ════════════════════════════════════════════════════════════════

import {
  corsHeaders, errorResponse, handlePreflight, jsonResponse,
} from '../_shared/cors.ts';
import {
  getNasConfig, nasUrl, nasAuthHeader, nasFetch,
  requireUser, getServiceRoleKey, HttpError,
} from '../_shared/nas.ts';

function inferContentType(filename: string, fallback: string | null): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    'pdf' : 'application/pdf',
    'jpg' : 'image/jpeg', 'jpeg': 'image/jpeg',
    'png' : 'image/png',  'gif' : 'image/gif', 'webp': 'image/webp',
    'doc' : 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' : 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' : 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] ?? (fallback || 'application/octet-stream');
}

Deno.serve(async (req: Request) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    if (req.method !== 'GET') return errorResponse('Chỉ chấp nhận GET', 405);

    await requireUser(req);

    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get('id') ?? '', 10);
    if (!id || isNaN(id)) return errorResponse('Thiếu/sai tham số id', 400);

    // 1. Tra DB lấy nas_path & metadata
    const sbUrl = Deno.env.get('SUPABASE_URL');
    const srvKey = getServiceRoleKey();
    if (!sbUrl || !srvKey) throw new HttpError(500, 'Edge Function thiếu SUPABASE_SECRET_KEYS (hoặc SUPABASE_SERVICE_ROLE_KEY)');

    const dbResp = await fetch(
      `${sbUrl.replace(/\/+$/, '')}/rest/v1/equipment_attachments?id=eq.${id}&select=file_name,mime_type,nas_path,active`,
      {
        headers: {
          'Authorization': `Bearer ${srvKey}`,
          'apikey': srvKey,
        },
      },
    );
    if (!dbResp.ok) {
      const txt = await dbResp.text().catch(() => '');
      throw new HttpError(500, `DB lỗi: ${txt.slice(0, 200)}`);
    }
    const rows = await dbResp.json() as Array<{ file_name: string; mime_type: string; nas_path: string; active: boolean }>;
    const row = rows?.[0];
    if (!row) return jsonResponse({ error: 'File không tồn tại', code: 'NOT_FOUND' }, 404);
    if (!row.active) return jsonResponse({ error: 'File đã bị xóa', code: 'DELETED' }, 410);

    // 2. Stream từ NAS
    const cfg = getNasConfig();
    const remoteUrl = nasUrl(cfg, row.nas_path);

    const reqHeaders: HeadersInit = { ...nasAuthHeader(cfg) };
    const rangeHdr = req.headers.get('Range');
    if (rangeHdr) (reqHeaders as Record<string, string>).Range = rangeHdr;

    const upstream = await nasFetch(remoteUrl, {
      method: 'GET',
      headers: reqHeaders,
      timeoutMs: 90_000,
      maxRetries: 0,
    });

    if (upstream.status === 401) {
      return jsonResponse({ error: 'NAS từ chối auth', code: 'NAS_AUTH' }, 502);
    }
    if (upstream.status === 404) {
      return jsonResponse({ error: 'File mất trên NAS (DB còn ghi nhận)', code: 'NAS_MISSING' }, 404);
    }
    if (!upstream.ok && upstream.status !== 206) {
      const txt = await upstream.text().catch(() => '');
      return jsonResponse({ error: `NAS HTTP ${upstream.status}: ${txt.slice(0, 200)}`, code: 'NAS_ERROR' }, 502);
    }

    const contentType = inferContentType(row.file_name, row.mime_type || upstream.headers.get('Content-Type'));
    const encName = encodeURIComponent(row.file_name);

    const respHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',  // 1h — asset hiếm khi sửa
      'Content-Disposition': `inline; filename*=UTF-8''${encName}`,
    };
    for (const h of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag']) {
      const v = upstream.headers.get(h);
      if (v) respHeaders[h] = v;
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    const e = err as HttpError;
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(err);
    let code = 'NAS_ERROR';
    if (msg.includes('aborted') || msg.includes('timeout') || msg.includes('Timeout')) code = 'NAS_TIMEOUT';
    else if (status === 401) code = 'AUTH_EXPIRED';
    console.error('[asset-download]', status, msg);
    return jsonResponse({ error: msg, code }, status === 401 ? 401 : 200);
  }
});
