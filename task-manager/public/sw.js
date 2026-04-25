const CACHE_NAME = 'taskmanager-pro-v1';
const STATIC_ASSETS = ['/', '/tasks', '/calendar', '/pomodoro', '/analytics', '/settings', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/data') || url.pathname.startsWith('/api')) return;
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(caches.match(request).then((c) => c || fetch(request).then((r) => { caches.open(CACHE_NAME).then((cache) => cache.put(request, r.clone())); return r; }).catch(() => c)));
    return;
  }
  event.respondWith(fetch(request).then((r) => { caches.open(CACHE_NAME).then((cache) => cache.put(request, r.clone())); return r; }).catch(() => caches.match(request)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((cls) => {
    if (cls.length > 0) cls[0].focus(); else self.clients.openWindow('/');
  }));
});

// ── Task notification scheduling ──
const timers = new Map();
const fired = new Set();
let notificationsEnabled = true;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_TASKS') {
    if (typeof event.data.notificationsEnabled === 'boolean') {
      notificationsEnabled = event.data.notificationsEnabled;
    }

    // Clear all old timers
    timers.forEach((t) => clearTimeout(t));
    timers.clear();

    if (!notificationsEnabled) return;

    const tasks = event.data.tasks || [];
    const now = Date.now();

    tasks.forEach((task) => {
      if (task.status === 'completed') return;

      // Start notification
      if (task.scheduledAt && !task.notified) {
        const time = new Date(task.scheduledAt).getTime();
        const delay = time - now;
        const key = 's:' + task.id;

        if (!fired.has(key)) {
          if (delay <= 0 && delay > -300000) {
            // Due now — fire immediately
            notify(task, 'start');
          } else if (delay > 0) {
            // Future — schedule
            timers.set(key, setTimeout(() => notify(task, 'start'), delay));
          }
        }
      }

      // End notification
      if (task.endAt && task.notifyOnEnd && !task.endNotified) {
        const time = new Date(task.endAt).getTime();
        const delay = time - now;
        const key = 'e:' + task.id;

        if (!fired.has(key)) {
          if (delay <= 0 && delay > -300000) {
            notify(task, 'end');
          } else if (delay > 0) {
            timers.set(key, setTimeout(() => notify(task, 'end'), delay));
          }
        }
      }
    });
  } else if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('TaskPro Test Notification', {
      body: 'If you can see this, notifications are working correctly.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'test-notification',
      requireInteraction: false,
    });
  }
});

function notify(task, type) {
  const key = (type === 'start' ? 's:' : 'e:') + task.id;
  if (fired.has(key)) return;
  if (!notificationsEnabled) return;
  fired.add(key);

  self.registration.showNotification(
    type === 'start' ? 'Task Due Now!' : 'Task Time Complete!',
    {
      body: type === 'start' ? task.title : '"' + task.title + '" duration is over',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: (type === 'start' ? 'task-' : 'task-end-') + task.id,
      requireInteraction: true,
    }
  );

  self.clients.matchAll({ type: 'window' }).then((cls) => {
    cls.forEach((c) => c.postMessage({ type: 'MARK_NOTIFIED', taskId: task.id, field: type === 'start' ? 'notified' : 'endNotified' }));
  });
}
