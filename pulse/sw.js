const CACHE = 'jathufy-shell-v7';
const CORE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/data.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/assets/aistudio/favicon-96x96_e09a4bb2.png',
  '/assets/aistudio/favicon_97cfe0e1.svg',
  '/assets/aistudio/apple-touch-icon_6b362fe9.png',
  '/assets/aistudio/web-app-manifest-192x192_c0d0e92c.png',
  '/assets/aistudio/web-app-manifest-512x512_c1671e3a.png',
  '/assets/aistudio/jathufy-logo_fe498894.png',
  '/assets/aistudio/file_0000000019788211b937aaff901ce977_2b6a3659.png',
  '/images/album-night-signals.jpg',
  '/images/album-bloom.jpg',
  '/images/album-golden-hours.jpg',
  '/images/album-paper-skies.jpg',
  '/images/cover-liked-songs.jpg',
  '/audio/neon-drive.wav',
  '/audio/midnight-bloom.wav',
  '/audio/golden-hour.wav',
  '/audio/paper-planes.wav',
  '/audio/slow-tide.wav',
  '/audio/city-lights.wav',
  '/audio/lantern-hills.wav',
  '/audio/static-dreams.wav'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/health') return;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      if (response.ok && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image' || req.mode === 'navigate')) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return response;
    }).catch(() => {
      if (req.mode === 'navigate') return caches.match('/index.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    }))
  );
});
