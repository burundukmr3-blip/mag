// Сервис-воркер: после первой загрузки приложение работает без интернета (Н3).
// Список файлов сборки подставляется при `npm run build` (см. vite.config.ts).
const CACHE = 'svoya-igra-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('svoya-igra-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Страница: сначала сеть (чтобы подхватить обновление), без сети — из кэша.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreVary: true }).then((hit) => hit || caches.match('./', { ignoreVary: true }))),
    );
    return;
  }
  // Файлы сборки с хешем в имени не меняются: сначала кэш, потом сеть.
  // ignoreVary: сервер отвечает с «Vary: Origin», а модульные скрипты запрашиваются с заголовком Origin.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
