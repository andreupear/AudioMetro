/* AudioMetro · service worker mínim per a la instal·lació (PWA).
   Estratègia "network-first": sempre prova la xarxa (perquè l'app i les dades quedin fresques)
   i, si no hi ha connexió, cau a la còpia en cau (ús bàsic offline). */
const CACHE = 'audiometro-v1';
const ASSETS = [
  './', './index.html', './network-data.js', './supabase-config.js',
  './mapa-oficial.jpg', './icon-192.png', './icon-512.png', './manifest.webmanifest'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then(resp => {
      if (resp.ok && new URL(req.url).origin === location.origin) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
  );
});
