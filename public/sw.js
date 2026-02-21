const CACHE_NAME = 'muslimlife-v3';
const OFFLINE_URL = '/offline.html';
const CORE_ASSETS = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message && message.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isAudioRequest =
    request.destination === 'audio' ||
    url.pathname.toLowerCase().endsWith('.mp3') ||
    url.hostname === 'cdn.equran.id';

  if (isAudioRequest) {
    // Let audio stream bypass SW cache to avoid stale/partial media responses.
    return;
  }

  const isRatingEndpoint =
    url.pathname === '/api/rating' || (url.pathname === '/api/weather' && url.searchParams.get('ml_route') === 'rating');

  if (isRatingEndpoint) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ ok: false, message: 'offline' }), { status: 503 }))
    );
    return;
  }

  const isNavigation = request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          return cache.match(OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'MuslimLife',
      body: event.data ? String(event.data.text()) : 'Pengingat baru.',
    };
  }

  const title = payload.title || 'MuslimLife';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'muslimlife-reminder',
    renotify: Boolean(payload.renotify),
    data: payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        client.postMessage({
          type: 'ml-push-received',
          payload: { title, body: options.body, tag: options.tag },
        });
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || '/');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'ml-push-clicked',
            payload: { url: targetUrl },
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
