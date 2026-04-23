/**
 * SERVICE WORKER - Handles offline support and caching for AegisVault PWA
 * This service worker enables the app to work offline by caching resources
 * and serving them from cache when the network is unavailable
 */

const CACHE_VERSION = 'aegisvault-v2';
const CACHE_ASSETS = [
  './',
  './index-pwa.html',
  './index.html',
  './lawyers.html',
  './client-dashboard.html',
  './lawyer-dashboard.html',
  './app.css',
  './app.js',
  './lawyers.js',
  './dashboard.js',
  './chat.js',
  './service-worker.js',
  './manifest.json'
];

// Installation event - cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('Caching app assets');
        return cache.addAll(CACHE_ASSETS);
      })
      .catch((error) => {
        console.log('Cache installation error:', error);
      })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activation event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_VERSION)
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
  );
  
  // Take control of all open pages
  self.clients.claim();
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

// Fetch event - network-first for HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests (like CDNs, Firebase, Supabase)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('./index-pwa.html') || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => caches.match('./index-pwa.html') || caches.match('./index.html'));
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
