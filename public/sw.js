// Service worker do Baraiada Poker Club.
// - Arquivos fixos do app (JS/CSS com hash, ícones, fontes): guardados no aparelho para abrir rápido.
// - Páginas: sempre da rede; sem conexão, mostra /offline.html.
// - Dados (/api) e áudios do Supabase: nunca guardados, para não mostrar valor velho.
const VERSION = 'baraiada-v2';
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = ['/offline.html', '/baraiada-logo.jpg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;          // Supabase, áudios etc.: direto da rede
  if (url.pathname.startsWith('/api/')) return;              // dados sempre da rede

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (isStaticAsset(url)) {
    // Cache primeiro: arquivos com hash nunca mudam; ícones/imagens atualizam em segundo plano.
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || network;
      }),
    );
  }
});
