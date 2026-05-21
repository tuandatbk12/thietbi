// ════════════════════════════════════════════════════════════════
// Edge Function: bbtn-download
// Streaming proxy: NAS WebDAV GET → client (KHÔNG buffer toàn bộ)
//
// Request:   GET ?path=/BBTN/Đội X/2024/Trạm Y/file.pdf[&download=1]
// Response:  Binary stream với Content-Type & Content-Disposition phù hợp
// ════════════════════════════════════════════════════════════════

import {
  corsHeaders, errorResponse, handlePreflight, jsonResponse,
} from '../_shared/cors.ts';
import {
  getNasConfig, nasUrl, nasAuthHeader, nasFetch, normalizeClientPath,
  requireUser, HttpError,
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
    'zip' : 'application/zip',
    'txt' : 'text/plain; charset=utf-8',
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
    const rawPath = url.searchParams.get('path') ?? '';
    const forceDownload = url.searchParams.get('download') === '1';
    if (!rawPath) return errorResponse('Thiếu tham số path', 400);

    const cfg = getNasConfig();
    const path = normalizeClientPath(rawPath, cfg.bbtnRoot);
    const remoteUrl = nasUrl(cfg, path);

    // Forward Range header nếu client yêu cầu (video/PDF progressive)
    const reqHeaders: HeadersInit = { ...nasAuthHeader(cfg) };
    const rangeHdr = req.headers.get('Range');
    if (rangeHdr) (reqHeaders as Record<string, string>).Range = rangeHdr;

    // 120s timeout cho file lớn — không retry vì stream
    const upstream = await nasFetch(remoteUrl, {
      method: 'GET',
      headers: reqHeaders,
      timeoutMs: 120_000,
      maxRetries: 0,    // stream → không retry tự động (sẽ corrupt body)
    });

    if (upstream.status === 401) {
      return jsonResponse({ error: 'NAS từ chối truy cập — kiểm tra NAS_USER/NAS_PASS', code: 'NAS_AUTH' }, 502);
    }
    if (upstream.status === 404) {
      return jsonResponse({ error: 'File không tồn tại: ' + path, code: 'NOT_FOUND' }, 404);
    }
    if (!upstream.ok && upstream.status !== 206) {
      const txt = await upstream.text().catch(() => '');
      return jsonResponse({ error: `NAS lỗi HTTP ${upstream.status}: ${txt.slice(0, 200)}`, code: 'NAS_ERROR' }, 502);
    }

    const fileName = path.split('/').pop() || 'file';
    const contentType = inferContentType(fileName, upstream.headers.get('Content-Type'));
    const encName = encodeURIComponent(fileName);

    const respHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',   // 5 phút — cho phép browser cache
      'Content-Disposition': forceDownload
        ? `attachment; filename*=UTF-8''${encName}`
        : `inline; filename*=UTF-8''${encName}`,
    };
    // Pass-through các header quan trọng từ NAS (nếu có)
    const passThrough = ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag'];
    for (const h of passThrough) {
      const v = upstream.headers.get(h);
      if (v) respHeaders[h] = v;
    }

    // ✨ Stream trực tiếp — không buffer
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
    console.error('[bbtn-download]', status, msg);
    return jsonResponse({ error: msg, code }, status === 401 ? 401 : 200);
  }
});
