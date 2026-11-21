const CACHE = 'jathufy-shell-v3';
const CORE = ['./','./index.html','./css/styles.css','./js/data.js','./js/app.js','./manifest.webmanifest','./icon.svg','./jathufy-logo.png',
'./audio/neon-drive.wav','./audio/midnight-bloom.wav','./audio/golden-hour.wav','./audio/paper-planes.wav',
'./audio/slow-tide.wav','./audio/city-lights.wav','./audio/lantern-hills.wav','./audio/static-dreams.wav'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const req = event.request; if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
    if (response.ok && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image' || req.mode === 'navigate')) { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(req,copy)); }
    return response;
  }).catch(() => caches.match('./index.html'))));
});
