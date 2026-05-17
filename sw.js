// Service worker da app de Presenças RSB Lisboa.
//
// Estratégia:
// - App shell (HTML, CSS, JS, ícones, manifest): cache-first, com revalidação em background.
// - data/inscritos.json: network-first com fallback ao cache (lista pode mudar até ao evento).
// - data/presencas.json + chamadas a api.github.com: NÃO cacheadas (estado mutável).
//
// Bump da versão sempre que houver alterações ao app shell.

const CACHE_VERSION = 'rsb-presencas-v9-config-tablet-defensive';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/rsb-brasao.png',
  './assets/lisboa-cml-transparent.png',
  './assets/cabecalho.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cachear API do GitHub nem o ficheiro de presenças (estado mutável).
  if (url.host === 'api.github.com' || url.pathname.endsWith('/data/presencas.json')) {
    return; // deixa o browser tratar normalmente
  }

  // Outros ficheiros do mesmo origin → cache-first com revalidação.
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/data/inscritos.json')) {
      // Network-first para inscritos (pode mudar até ao evento)
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        }).catch(() => caches.match(req))
      );
      return;
    }
    event.respondWith(
      caches.match(req).then(cached => {
        const fetched = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(()=>{});
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
  }
});
