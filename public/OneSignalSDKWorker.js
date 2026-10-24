// OneSignal Web Push service worker & Android PWA background handler.
// Loaded by OneSignal Web SDK and PWA service worker registration.
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('[sw] OneSignal CDN import failed or offline:', e);
}

// Background push notification receiver for Android PWA (fires even when PWA is closed)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    let payload = null;
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Flick ⚡️', message: event.data.text() };
    }

    const title =
      payload.title ||
      payload.headings?.en ||
      (payload.custom?.a?.title) ||
      'Flick Notification';

    const message =
      payload.message ||
      payload.contents?.en ||
      payload.body ||
      (payload.custom?.a?.body) ||
      'New activity on Flick';

    const deepLink =
      payload.url ||
      payload.launchUrl ||
      payload.data?.deepLink ||
      payload.data?.url ||
      (payload.custom?.a?.launchUrl) ||
      '/messages';

    const icon = payload.icon || payload.chrome_web_icon || '/icon-192.png';
    const badge = payload.badge || payload.chrome_web_badge || '/icon-192.png';

    const options = {
      body: message,
      icon,
      badge,
      vibrate: [100, 50, 100],
      tag: payload.dedupe_id || payload.collapse_id || `flick-${Date.now()}`,
      renotify: true,
      data: {
        url: deepLink,
        ...payload,
      },
      actions: [
        { action: 'open', title: 'Open Flick' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[sw] push event processing error:', err);
  }
});

// Support routing when notifications are clicked on Android PWA / Browser
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const rawUrl =
    event.notification.data?.url ||
    event.notification.data?.launchUrl ||
    event.notification.data?.data?.deepLink ||
    '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== rawUrl) {
            client.navigate(rawUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(rawUrl);
      }
    })
  );
});

// Support direct notification triggers from main app thread (even when tab is minimized or backgrounded)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Flick ⚡️', options || {})
    );
  }
});