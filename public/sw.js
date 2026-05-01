const CACHE_NAME = 'boda-judith-jesus-v1.5.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/favicon.svg',
  '/favicon-ring.svg'
];

// Instalación del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Network First, fallback a Cache
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean HTTP/HTTPS (chrome-extension, etc.)
  // Y EXCLUIR peticiones de IA para no interferir con el streaming
  if (!event.request.url.startsWith('http') || event.request.url.includes('/api/ai')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo cacheamos si la respuesta es válida y es una petición GET
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentamos obtener de caché
        return caches.match(event.request);
      })
  );
});
