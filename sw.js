// Service Worker for Sea Battle PWA
const CACHE_NAME = 'sea-battle-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './config.js',
    './manifest.json',
    './assets/icons/icon.svg',
    './assets/icons/192.png',
    './assets/icons/512.png',
    './assets/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Bypass the HTTP cache so the precache never stores stale files
            return cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: 'reload' })));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only handle same-origin requests (Supabase realtime, CDN and fonts go straight to the network)
    if (url.origin !== self.location.origin) return;

    // Network-First strategy: always fetch fresh files when online, fall back to the cache when offline
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Skip one-off URLs such as ?room= invite links so they don't pile up in the cache
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' && !url.search) {
                    const responseToCache = networkResponse.clone();
                    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html').then((page) => page || Response.error());
                    }
                    return Response.error();
                });
            })
    );
});
