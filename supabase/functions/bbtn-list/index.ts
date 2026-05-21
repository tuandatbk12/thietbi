// ════════════════════════════════════════════════════════════════
// Edge Function: bbtn-list
// Liệt kê thư mục BBTN trên NAS qua WebDAV PROPFIND (Depth: 1)
//
// Request:   GET ?path=/BBTN/Đội X/2024/Trạm Y
// Response:  { items: [{ name, isFolder, size, modified, relativePath }] }
// ════════════════════════════════════════════════════════════════

import {
  corsHeaders, jsonResponse, errorResponse, handlePreflight,
} from '../_shared/cors.ts';
import {
  getNasConfig, nasPropfind, normalizeClientPath, requireUser, HttpError,
} from '../_shared/nas.ts';

Deno.serve(async (req: Request) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    if (req.method !== 'GET') return errorResponse('Chỉ chấp nhận GET', 405);

    // 1. Auth — bắt buộc đăng nhập
    await requireUser(req);

    // 2. Đọc & chuẩn hóa path
    const url = new URL(req.url);
    const rawPath = url.searchParams.get('path') ?? '';
    const cfg = getNasConfig();
    const path = normalizeClientPath(rawPath, cfg.bbtnRoot);

    // 3. Gọi WebDAV PROPFIND
    const items = await nasPropfind(cfg, path);

    // 4. Map relativePath theo root BBTN (để client gọi bbtn-download)
    const out = items.map(it => ({
      name:         it.name,
      isFolder:     it.isFolder,
      size:         it.size,
      modified:     it.modified,
      relativePath: (path.replace(/\/+$/, '') + '/' + it.name),
    }));

    return jsonResponse({ items: out, path });
  } catch (err) {
    const e = err as HttpError;
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(err);

    // Chuẩn hóa code lỗi để frontend hiển thị dễ hiểu
    let code = 'NAS_ERROR';
    if (msg.includes('aborted') || msg.includes('timeout') || msg.includes('Timeout')) code = 'NAS_TIMEOUT';
    else if (status === 401) code = 'AUTH_EXPIRED';
    else if (status === 404) code = 'NOT_FOUND';

    console.error('[bbtn-list]', status, msg);
    return jsonResponse({ error: msg, code, detail: '' }, status === 401 ? 401 : 200);
  }
});
