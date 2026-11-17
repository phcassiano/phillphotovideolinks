// Service worker: guarda só o "casco" do app e arquivos estáticos.
// Páginas e dados de estabelecimentos vão sempre à rede (sem dado defasado);
// sem conexão, mostra /offline.html.
const VERSION = 'v1';
const STATIC_CACHE = `perto-static-${VERSION}`;
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('perto-') && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/demo/') || url.pathname === '/og-default.png')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Arquivos com hash no nome e imagens estáticas: cache primeiro.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navegação: sempre rede; sem conexão, página offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
  }
  // Demais requisições (dados das páginas, Supabase, mapas): sem interferência.
});
