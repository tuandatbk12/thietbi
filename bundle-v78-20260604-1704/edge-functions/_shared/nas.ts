// ════════════════════════════════════════════════════════════════
// NAS WebDAV Client cho EVNHANOI
// Đọc cấu hình từ Supabase Function secrets (đã sync với UI Supabase):
//   NAS_BASE_URL     (vd: https://slicing-requisite-custodian.ngrok-free.dev)
//   NAS_USERNAME     (tài khoản WebDAV trên Synology)
//   NAS_PASSWORD     (mật khẩu)
//   NAS_BBTN_PATH    (tùy chọn, mặc định /BBTN)
//   NAS_ASSET_PATH   (tùy chọn, mặc định /TNDK)
//
// LƯU Ý về aliases:
//   Để tương thích cả tên cũ (NAS_USER/NAS_PASS) lẫn tên mới (NAS_USERNAME/
//   NAS_PASSWORD), function tự dò cả 2. Tương tự với BBTN_PATH/BBTN_ROOT.
// ════════════════════════════════════════════════════════════════

export interface NasConfig {
  baseUrl: string;
  username: string;
  password: string;
  bbtnRoot: string;
  assetsRoot: string;
}

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim()) return v;
  }
  return '';
}

export function getNasConfig(): NasConfig {
  const baseUrl  = firstEnv('NAS_BASE_URL');
  const username = firstEnv('NAS_USERNAME', 'NAS_USER');           // ← chuẩn UI Supabase
  const password = firstEnv('NAS_PASSWORD', 'NAS_PASS');           // ← chuẩn UI Supabase
  if (!baseUrl)  throw new Error('Thiếu env NAS_BASE_URL');
  if (!username) throw new Error('Thiếu env NAS_USERNAME');
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    username,
    password,
    bbtnRoot:   (firstEnv('NAS_BBTN_PATH',   'NAS_BBTN_ROOT')   || '/BBTN').replace(/\/+$/, ''),
    assetsRoot: (firstEnv('NAS_ASSET_PATH',  'NAS_ASSETS_ROOT') || '/TNDK').replace(/\/+$/, ''),
  };
}

// ── Supabase key resolver ─────────────────────────────────
//   Supabase 2026 đổi sang JSON dict:
//     SUPABASE_PUBLISHABLE_KEYS = {"default":"sb_publishable_xxx", ...}
//     SUPABASE_SECRET_KEYS      = {"default":"sb_secret_xxx", ...}
//   2 biến cũ (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY) bị marked
//   DEPRECATED nhưng tạm thời vẫn được Supabase auto-populate.
//
//   Resolver: thử new pattern trước, fallback deprecated.
function pickFromJsonDict(envName: string): string {
  const raw = Deno.env.get(envName);
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw);
    if (typeof obj === 'string') return obj;
    if (!obj || typeof obj !== 'object') return '';
    // Ưu tiên key 'default', sau đến 'service_role'/'anon', cuối cùng giá trị đầu tiên
    const order = ['default', 'service_role', 'anon', 'primary'];
    for (const k of order) {
      if (obj[k] && typeof obj[k] === 'string') return obj[k];
    }
    const first = Object.values(obj).find(v => typeof v === 'string');
    return (first as string) ?? '';
  } catch (_) {
    // Không phải JSON → có thể Supabase trả raw string cho các project cũ
    return raw;
  }
}

export function getServiceRoleKey(): string {
  return pickFromJsonDict('SUPABASE_SECRET_KEYS')
      || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  // deprecated nhưng vẫn dùng được
      || '';
}

export function getAnonKey(): string {
  return pickFromJsonDict('SUPABASE_PUBLISHABLE_KEYS')
      || Deno.env.get('SUPABASE_ANON_KEY')
      || '';
}

export function nasAuthHeader(cfg: NasConfig): Record<string, string> {
  const cred = btoa(`${cfg.username}:${cfg.password}`);
  return {
    'Authorization': `Basic ${cred}`,
    // QUAN TRỌNG: bypass HTML interstitial của ngrok free tier
    'ngrok-skip-browser-warning': 'true',
    // Đề phòng caching trung gian gây stale
    'Cache-Control': 'no-cache',
  };
}

/** Build URL chuẩn cho 1 path WebDAV — encode mỗi segment giữ '/' */
export function nasUrl(cfg: NasConfig, path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  const encoded = path.split('/').map(seg => encodeURIComponent(seg)).join('/');
  return cfg.baseUrl + encoded;
}

/** Tạo AbortSignal timeout đa nền tảng (Deno >=1.36 có AbortSignal.timeout, fallback nếu thiếu) */
export function timeoutSignal(ms: number): AbortSignal {
  // @ts-ignore  AbortSignal.timeout available in modern Deno
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    return (AbortSignal as any).timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** Fetch với retry exponential backoff + timeout
 *  - retry chỉ với network error / 5xx / 408 / 504
 *  - không retry với 401/403/404 (lỗi nghiệp vụ rõ ràng)
 */
export interface NasFetchOpts extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
}
export async function nasFetch(url: string, opts: NasFetchOpts = {}): Promise<Response> {
  const timeoutMs  = opts.timeoutMs  ?? 45_000;
  const maxRetries = opts.maxRetries ?? 1;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        ...opts,
        signal: timeoutSignal(timeoutMs),
      });
      // Retry chỉ với 5xx & 408 & 504
      if (!resp.ok && attempt < maxRetries && (resp.status >= 500 || resp.status === 408 || resp.status === 504)) {
        // Drain body để giải phóng connection
        try { await resp.body?.cancel(); } catch (_) { /* ignore */ }
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return resp;
    } catch (err) {
      lastErr = err;
      const isAbort = (err as any)?.name === 'AbortError' || (err as any)?.name === 'TimeoutError';
      if (attempt < maxRetries && (isAbort || (err as any)?.message?.includes('network'))) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('NAS fetch failed');
}

// ── PROPFIND parser ────────────────────────────────────────
//   Tự parse XML PROPFIND response (Deno chưa có DOMParser cho XML
//   trong runtime mặc định) bằng regex — đủ chính xác cho Synology.

export interface NasItem {
  name: string;
  isFolder: boolean;
  size: number;
  modified: string | null;
  href: string;
  relativePath: string;     // path tính từ root (BBTN/ ... )
  fullUrl: string;          // URL đầy đủ (server side, không dùng để return)
}

/** Liệt kê thư mục với PROPFIND Depth: 1 — đã có timeout & retry */
export async function nasPropfind(cfg: NasConfig, path: string): Promise<NasItem[]> {
  const url = nasUrl(cfg, path);
  const xmlBody =
    `<?xml version="1.0" encoding="utf-8"?>
     <D:propfind xmlns:D="DAV:">
       <D:prop>
         <D:displayname/>
         <D:resourcetype/>
         <D:getcontentlength/>
         <D:getlastmodified/>
       </D:prop>
     </D:propfind>`;

  const resp = await nasFetch(url, {
    method: 'PROPFIND',
    headers: {
      ...nasAuthHeader(cfg),
      'Depth': '1',                  // CỰC QUAN TRỌNG — chỉ lấy 1 cấp
      'Content-Type': 'application/xml; charset=utf-8',
      'Accept': 'application/xml,text/xml',
    },
    body: xmlBody,
    timeoutMs: 45_000,
    maxRetries: 1,
  });

  if (resp.status === 401) throw new HttpError(401, 'NAS WebDAV trả 401 — kiểm tra NAS_USER/NAS_PASS');
  if (resp.status === 404) throw new HttpError(404, 'Thư mục không tồn tại trên NAS: ' + path);
  if (resp.status !== 207) {
    const txt = await resp.text().catch(() => '');
    throw new HttpError(resp.status, `PROPFIND lỗi: HTTP ${resp.status} ${txt.slice(0, 200)}`);
  }

  const xml = await resp.text();
  return parsePropfindXml(xml, path);
}

function parsePropfindXml(xml: string, rootPath: string): NasItem[] {
  const items: NasItem[] = [];
  // Match từng <D:response> hoặc <response> bất kể namespace prefix
  const respRegex = /<([a-zA-Z0-9]+:)?response\b[^>]*>([\s\S]*?)<\/\1?response>/gi;
  let m: RegExpExecArray | null;
  const rootNorm = rootPath.replace(/\/+$/, '');
  while ((m = respRegex.exec(xml)) !== null) {
    const block = m[2];
    const hrefRaw = extractTag(block, 'href');
    if (!hrefRaw) continue;
    let href: string;
    try { href = decodeURIComponent(hrefRaw); } catch { href = hrefRaw; }
    // Bỏ chính nó (folder cha)
    const hrefNorm = href.replace(/\/+$/, '');
    const rootEnc = rootNorm;
    const hrefPath = stripOrigin(hrefNorm);
    if (hrefPath === rootEnc || hrefPath + '/' === rootEnc) continue;
    if (hrefPath === rootEnc.replace(/^\/+/, '')) continue;

    const isFolder = /<([a-zA-Z0-9]+:)?collection\s*\/?>/i.test(block);
    const sizeStr  = extractTag(block, 'getcontentlength');
    const modified = extractTag(block, 'getlastmodified');
    const name = (hrefNorm.split('/').filter(Boolean).pop() || '').trim();
    if (!name) continue;

    items.push({
      name,
      isFolder,
      size: sizeStr ? parseInt(sizeStr, 10) || 0 : 0,
      modified: modified || null,
      href: hrefPath,
      relativePath: rootNorm + '/' + name,
      fullUrl: '',  // sẽ điền sau nếu cần
    });
  }
  // Folders đầu, files sau, mỗi nhóm a→z
  items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, 'vi');
  });
  return items;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<([a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/\\1?${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[2].trim() : null;
}

function stripOrigin(href: string): string {
  // Nếu href là URL tuyệt đối, chỉ giữ pathname
  try {
    if (/^https?:\/\//i.test(href)) {
      const u = new URL(href);
      return u.pathname.replace(/\/+$/, '');
    }
  } catch (_) { /* ignore */ }
  return href.replace(/\/+$/, '');
}

// ── Custom HTTP error có status ───────────────────────────
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── Path security: chống path traversal ────────────────────
export function safeJoinPath(root: string, userPath: string): string {
  // Loại bỏ '..' và '//'
  const cleaned = userPath
    .replace(/\\/g, '/')
    .split('/')
    .filter(seg => seg && seg !== '.' && seg !== '..')
    .join('/');
  const full = (root.replace(/\/+$/, '') + '/' + cleaned).replace(/\/+/g, '/');
  // Đảm bảo path vẫn nằm trong root
  if (!full.startsWith(root.replace(/\/+$/, '') + '/') && full !== root.replace(/\/+$/, '')) {
    throw new HttpError(400, 'Đường dẫn không hợp lệ');
  }
  return full;
}

/** Chuẩn hóa path đầu vào từ client (đã có thể là '/BBTN/...' hoặc 'BBTN/...') */
export function normalizeClientPath(input: string, root: string): string {
  if (!input) return root;
  const p = input.startsWith('/') ? input : '/' + input;
  // Nếu client gửi đường dẫn trong root → giữ; ngược lại nối vào root
  const rootNorm = root.replace(/\/+$/, '');
  if (p === rootNorm || p.startsWith(rootNorm + '/')) {
    return safeJoinPath(rootNorm, p.slice(rootNorm.length));
  }
  return safeJoinPath(rootNorm, p);
}

// ── Auth: verify Supabase JWT ─────────────────────────────
//   Mỗi Edge Function tự verify token để biết caller là user đã đăng nhập.
export async function requireUser(req: Request): Promise<{ id: string; email: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Thiếu Bearer token');

  const sbUrl = Deno.env.get('SUPABASE_URL');
  // Ưu tiên SUPABASE_SECRET_KEYS → fallback service_role → fallback anon
  // (auth/v1/user chấp nhận cả anon key + Bearer token là đủ để verify)
  const sbKey = getServiceRoleKey() || getAnonKey();
  if (!sbUrl || !sbKey) throw new HttpError(500, 'Edge function chưa cấu hình SUPABASE_URL/SUPABASE_*_KEYS');

  // Dùng endpoint /auth/v1/user để verify (nhẹ nhất, không cần SDK)
  const resp = await fetch(`${sbUrl.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': sbKey,
    },
  });
  if (resp.status === 401) throw new HttpError(401, 'Phiên đăng nhập hết hạn');
  if (!resp.ok) throw new HttpError(resp.status, 'Xác thực thất bại: HTTP ' + resp.status);
  const user = await resp.json() as { id?: string; email?: string };
  if (!user.id) throw new HttpError(401, 'Không lấy được user');
  return { id: user.id, email: user.email ?? '' };
}
