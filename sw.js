// ════════════════════════════════════════════════════════════════
// EVNHANOI Dashboard — Service Worker
// Cache strategy: stale-while-revalidate cho assets, network-first cho API
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'evn-v6-nas-retry';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE    = `${CACHE_VERSION}-api`;

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

  // ── Supabase API queries: network-first (luôn lấy data mới) ──
  if (url.hostname.includes('supabase.co')) {
    // Edge Functions không cache
    if (url.pathname.includes('/functions/')) {
      return;  // dùng default network fetch
    }
    // REST queries: network-first, fallback cache
    event.respondWith(networkFirstWithCache(req));
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
      event.respondWith(networkFirstWithCache(req));
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

// ── Strategy: Network-first với cache fallback ───────────
async function networkFirstWithCache(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      // Cache GET data 5 phút (cho fallback khi offline)
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    // Mất mạng → fallback cache
    const cached = await cache.match(req);
    if (cached) {
      console.log('[SW] Offline fallback:', req.url);
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'Offline - không có cache' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Message handler: cho phép page yêu cầu skipWaiting ──
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
