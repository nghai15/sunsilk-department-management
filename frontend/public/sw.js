const CACHE = 'nha-tro-static-v3';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, '/manifest.json', '/icons/icon-192x192.png?v=sunsilk-s1', '/icons/icon-512x512.png?v=sunsilk-s1', '/icons/apple-touch-icon.png?v=sunsilk-s1'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('nha-tro-')) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/icons/') && url.pathname !== '/manifest.json') return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Nhà trọ', { body: data.body || 'Bạn có thông báo mới.', icon: '/icons/icon-192x192.png?v=sunsilk-s1', data: data.data || {} }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let url;
    try { url = new URL(event.notification.data?.url || '/thong_bao', self.location.origin); } catch { url = new URL('/thong_bao', self.location.origin); }
    if (url.origin !== self.location.origin) url = new URL('/thong_bao', self.location.origin);
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (new URL(client.url).origin === url.origin) { await client.navigate(url.href); return client.focus(); }
    }
    return self.clients.openWindow(url.href);
  })());
});
