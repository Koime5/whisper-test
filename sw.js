const CACHE_NAME = 'whisper-test-cache-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './images/icon-192.png',
    './images/icon-512.png'
];

// Install → cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            for (const url of ASSETS_TO_CACHE) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.warn('Failed to cache', url, err);
                }
            }
        })()
    );
});

// Activate → cleanup old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }))
        )
    );
    self.clients.claim();
});

// Fetch → serve cached assets if offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
            .catch(() => {
                // Optional fallback if offline and asset not cached
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});