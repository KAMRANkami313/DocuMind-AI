const CACHE_NAME = 'documind-v1';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

const STATIC_ASSETS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_NAME))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request));
      return;
    }
    if (isStaticAsset(request)) {
      event.respondWith(cacheFirst(request));
      return;
    }
  }
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const staticCache = await caches.open(STATIC_CACHE);
    const fallback = await staticCache.match('/');
    if (fallback) return fallback;
    throw new Error('Network failed and no cache available');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    throw new Error('Failed to fetch static asset');
  }
}

function isStaticAsset(request) {
  const dest = request.destination;
  return (
    dest === 'style' ||
    dest === 'script' ||
    dest === 'font' ||
    dest === 'image'
  );
}