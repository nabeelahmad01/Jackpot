const SW_VERSION = 'jackpot-static-v4';
const APP_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/jackpot-splash.mp4'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SW_VERSION)
      .then((cache) => cache.addAll(APP_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept page navigations — let Next.js handle refreshes directly
  if (e.request.mode === 'navigate') {
    return;
  }

  // Never cache Next.js bundles — stale chunks cause intermittent load failures
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // API routes always go to network
  if (url.pathname.startsWith('/api')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (
          response.ok &&
          e.request.method === 'GET' &&
          url.origin === self.location.origin &&
          APP_ASSETS.includes(url.pathname)
        ) {
          const copy = response.clone();
          e.waitUntil(caches.open(SW_VERSION).then((cache) => cache.put(e.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        return new Response('Network connection offline.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() || 'A new offer is available.' };
  }

  const title = data.title || 'Jackpot Royals';
  const options = {
    body: data.body || 'A new offer is available.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    image: data.image || undefined,
    tag: data.tag || 'jackpot-promo',
    renotify: true,
    vibrate: [120, 60, 120],
    requireInteraction: false,
    data: {
      url: data.url || '/lobby',
      promotionId: data.promotionId || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/lobby', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
