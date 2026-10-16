const CACHE_NAME = 'mozbiscates-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle background notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (data.providerId) {
            client.postMessage({ type: 'open-provider', providerId: data.providerId });
          } else if (data.jobId) {
            client.postMessage({ type: 'open-job', jobId: data.jobId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        const url = data.providerId ? `/?workerId=${data.providerId}` : '/';
        return clients.openWindow(url);
      }
    })
  );
});
