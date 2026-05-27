// ════════════════════════════════════════════════════════════════
// EVNHANOI Dashboard — Service Worker
// Cache strategy:
//   - Static assets (HTML/JS/CSS): network-first → tránh giữ bản lỗi cũ
//   - CDN libraries: cache-first (version trong URL)
//   - Supabase API & Edge Functions: KHÔNG cache (luôn live)
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'evn-v18-back-btn-fix';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

// Assets cần cache ngay khi install (precaching)
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
];

// CDN libraries — cache lâu vì version trong URL
const CDN_PATTERNS = [
  /cdn\.jsdelivr\.net/,
  /cdnjs\.cloudflare\.com/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

// ── INSTALL: precache static assets ──────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache failed:', err);
      });
    }).then(() => self.skipWaiting())  // active ngay, không đợi tab cũ đóng
  );
});

// ── ACTIVATE: xóa cache phiên bản cũ ──────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION))
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
      );
    }).then(() => self.clients.claim())  // control các tab đang mở
  );
});

// ── FETCH: chiến lược cache theo từng loại request ──────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bỏ qua non-GET (POST/PUT/DELETE đến Supabase)
  if (req.method !== 'GET') return;

  // Bỏ qua chrome-extension, blob:, data:
  if (!url.protocol.startsWith('http')) return;

  // ── Supabase API & Edge Functions: KHÔNG đụng vào ──
  //   Lý do: bbtn-list, bbtn-download, asset-* cần dữ liệu live; cache sai
  //   sẽ cho user file/folder ảo. Mọi retry/timeout xử lý trong app.js.
  if (url.hostname.includes('supabase.co')) {
    return;  // dùng default network fetch của browser
  }

  // ── ngrok tunnel (nếu frontend gọi trực tiếp, không qua Edge): KHÔNG cache
  if (url.hostname.endsWith('ngrok-free.dev') || url.hostname.endsWith('ngrok-free.app') ||
      url.hostname.endsWith('ngrok.io') || url.hostname.endsWith('ngrok.app')) {
    return;
  }

  // ── CDN libraries: cache-first (version trong URL) ──
  if (CDN_PATTERNS.some(p => p.test(url.href))) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // ── Same-origin static files ──
  // app.js/index.html/sw.js dùng network-first để tránh trình duyệt giữ bản lỗi cũ sau deploy.
  if (url.origin === self.location.origin) {
    if (/\/(app\.js|index\.html|sw\.js)$/.test(url.pathname) || url.pathname === '/') {
      event.respondWith(networkFirstShortFallback(req));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // Others: default network
});

// ── Strategy: Cache-first ──────────────────────────────────
async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Stale-while-revalidate ─────────────────────
async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);

  // Background update (không await)
  const fetchPromise = fetch(req).then((fresh) => {
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);

  // Trả cached ngay nếu có, không thì đợi network
  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

// ── Strategy: Network-first cho static, fallback cache (chỉ cho HTML/JS/CSS chính) ──
async function networkFirstShortFallback(req) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    // Timeout ngắn 8s vì file local nhỏ
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const fresh = await fetch(req, { signal: ctrl.signal });
    clearTimeout(tid);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) {
      console.log('[SW] Offline fallback:', req.url);
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

// ── Message handler: cho phép page yêu cầu skipWaiting / clearCache ──
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
