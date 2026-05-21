// ════════════════════════════════════════════════════════════════
// Edge Function: asset-upload
// Nhận file từ browser (multipart hoặc Base64) → PUT lên NAS WebDAV
// → Insert record vào bảng equipment_attachments
//
// Request (KHUYẾN NGHỊ):
//   POST multipart/form-data với fields: assetKey, tram, capDienAp,
//        loaiThietBi, tenThietBi, nganThietBi, fileName, mimeType,
//        fileSize, fileType, note, file (binary)
//
// Request (LEGACY):
//   POST application/json với { fileBase64, fileName, mimeType, ... }
//
// Response: { success:true, id, nasPath } | { success:false, error }
// ════════════════════════════════════════════════════════════════

import {
  errorResponse, handlePreflight, jsonResponse,
} from '../_shared/cors.ts';
import {
  getNasConfig, nasUrl, nasAuthHeader, nasFetch, safeJoinPath,
  requireUser, getServiceRoleKey, HttpError,
} from '../_shared/nas.ts';

interface UploadMeta {
  assetKey:    string;
  tram:        string;
  capDienAp:   string | number;
  loaiThietBi: string;
  tenThietBi:  string;
  nganThietBi: string;
  fileName:    string;
  mimeType:    string;
  fileSize:    number;
  fileType:    'image' | 'document' | string;
  note:        string;
}

function sanitizeFileSegment(s: string): string {
  return (s || '').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 64) || 'unknown';
}

async function readMultipart(req: Request): Promise<{ meta: UploadMeta; bytes: Uint8Array }> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Thiếu field "file" trong multipart');
  const meta: UploadMeta = {
    assetKey:    String(form.get('assetKey') ?? ''),
    tram:        String(form.get('tram') ?? ''),
    capDienAp:   String(form.get('capDienAp') ?? ''),
    loaiThietBi: String(form.get('loaiThietBi') ?? ''),
    tenThietBi:  String(form.get('tenThietBi') ?? ''),
    nganThietBi: String(form.get('nganThietBi') ?? ''),
    fileName:    String(form.get('fileName') ?? file.name ?? 'file'),
    mimeType:    String(form.get('mimeType') ?? file.type ?? 'application/octet-stream'),
    fileSize:    Number(form.get('fileSize') ?? file.size ?? 0),
    fileType:    (String(form.get('fileType') ?? '') || (file.type.startsWith('image/') ? 'image' : 'document')) as any,
    note:        String(form.get('note') ?? ''),
  };
  const buf = new Uint8Array(await file.arrayBuffer());
  return { meta, bytes: buf };
}

async function readJsonBase64(req: Request): Promise<{ meta: UploadMeta; bytes: Uint8Array }> {
  const body = await req.json() as Record<string, unknown> & { fileBase64?: string };
  if (!body.fileBase64) throw new HttpError(400, 'Thiếu fileBase64');
  const meta: UploadMeta = {
    assetKey:    String(body.assetKey ?? ''),
    tram:        String(body.tram ?? ''),
    capDienAp:   String(body.capDienAp ?? ''),
    loaiThietBi: String(body.loaiThietBi ?? ''),
    tenThietBi:  String(body.tenThietBi ?? ''),
    nganThietBi: String(body.nganThietBi ?? ''),
    fileName:    String(body.fileName ?? 'file'),
    mimeType:    String(body.mimeType ?? 'application/octet-stream'),
    fileSize:    Number(body.fileSize ?? 0),
    fileType:    String(body.fileType ?? 'document') as any,
    note:        String(body.note ?? ''),
  };
  // decode Base64 → Uint8Array
  const bin = atob(body.fileBase64 as string);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { meta, bytes };
}

Deno.serve(async (req: Request) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    if (req.method !== 'POST') return errorResponse('Chỉ chấp nhận POST', 405);

    const user = await requireUser(req);

    // 1. Đọc body — hỗ trợ cả multipart (mới) và JSON+Base64 (legacy)
    const ctype = req.headers.get('Content-Type') ?? '';
    let meta: UploadMeta, bytes: Uint8Array;
    if (ctype.includes('multipart/form-data')) {
      ({ meta, bytes } = await readMultipart(req));
    } else {
      ({ meta, bytes } = await readJsonBase64(req));
    }

    // 2. Validate
    if (!meta.fileName) throw new HttpError(400, 'Thiếu fileName');
    const MAX = 25 * 1024 * 1024;
    if (bytes.byteLength > MAX) throw new HttpError(413, `File quá lớn (${(bytes.byteLength/1024/1024).toFixed(1)}MB) — tối đa 25MB`);

    // 3. Build NAS path
    const cfg = getNasConfig();
    const tramSeg = sanitizeFileSegment(meta.tram);
    const folderPath = safeJoinPath(cfg.assetsRoot, tramSeg);

    // 4. Đảm bảo folder tồn tại — gọi MKCOL (ignore 405 = đã có)
    await nasFetch(nasUrl(cfg, folderPath), {
      method: 'MKCOL',
      headers: nasAuthHeader(cfg),
      timeoutMs: 15_000,
      maxRetries: 0,
    }).catch(() => { /* folder đã có */ });

    // 5. Tên file an toàn + chống đụng
    const safeName = sanitizeFileSegment(meta.fileName);
    const ts = Date.now();
    const remoteName = `${ts}_${safeName}`;
    const remotePath = folderPath + '/' + remoteName;
    const remoteUrl  = nasUrl(cfg, remotePath);

    // 6. PUT lên NAS (binary) — bọc Uint8Array trong Blob để chuẩn BodyInit
    const put = await nasFetch(remoteUrl, {
      method: 'PUT',
      headers: {
        ...nasAuthHeader(cfg),
        'Content-Type': meta.mimeType || 'application/octet-stream',
        'Content-Length': String(bytes.byteLength),
      },
      body: new Blob([bytes as BlobPart], { type: meta.mimeType || 'application/octet-stream' }),
      timeoutMs: 90_000,
      maxRetries: 1,
    });

    if (put.status === 401) throw new HttpError(401, 'NAS từ chối auth khi upload — kiểm tra credentials');
    if (!put.ok && put.status !== 201 && put.status !== 204) {
      const txt = await put.text().catch(() => '');
      throw new HttpError(put.status, `NAS upload lỗi HTTP ${put.status}: ${txt.slice(0, 200)}`);
    }

    // 7. Insert metadata vào Supabase
    const sbUrl = Deno.env.get('SUPABASE_URL');
    const srvKey = getServiceRoleKey();   // ← tự dò SUPABASE_SECRET_KEYS (new) hoặc SERVICE_ROLE (legacy)
    if (!sbUrl || !srvKey) throw new HttpError(500, 'Edge Function thiếu SUPABASE_SECRET_KEYS (hoặc SUPABASE_SERVICE_ROLE_KEY)');

    const insertResp = await fetch(`${sbUrl.replace(/\/+$/, '')}/rest/v1/equipment_attachments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${srvKey}`,
        'apikey': srvKey,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        asset_key:         meta.assetKey,
        tram:              meta.tram,
        cap_dien_ap:       meta.capDienAp,
        loai_thiet_bi:     meta.loaiThietBi,
        ten_thiet_bi:      meta.tenThietBi,
        ngan_thiet_bi:     meta.nganThietBi,
        file_name:         meta.fileName,
        folder_path:       folderPath,       // ← đường dẫn folder cha (vd /TNDK/E1.1)
        nas_path:          remotePath,       // ← path đầy đủ (vd /TNDK/E1.1/1700000000_file.jpg)
        mime_type:         meta.mimeType,
        file_size:         bytes.byteLength,
        file_type:         meta.fileType,
        note:              meta.note || null,
        uploaded_by:       user.id,          // ← schema thực là 'uploaded_by' (uuid)
        uploaded_by_email: user.email,
        active:            true,
      }),
    });

    if (!insertResp.ok) {
      const txt = await insertResp.text().catch(() => '');
      // File đã lên NAS rồi — không rollback, chỉ log
      console.error('[asset-upload] Insert DB failed:', insertResp.status, txt);
      throw new HttpError(insertResp.status, `Lưu metadata thất bại: ${txt.slice(0, 200)}`);
    }
    const inserted = await insertResp.json() as Array<{ id: number }>;

    return jsonResponse({
      success: true,
      id: inserted?.[0]?.id ?? null,
      nasPath: remotePath,
    });
  } catch (err) {
    const e = err as HttpError;
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(err);
    console.error('[asset-upload]', status, msg);
    return jsonResponse({ success: false, error: msg }, status === 401 ? 401 : 200);
  }
});
