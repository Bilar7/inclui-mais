// Inclui+ — funciona sem internet depois da primeira visita (exceto o reconhecimento pela câmara na 1.ª vez).
const VERSION = 'incluimais-v10';
const CORE = ['./', 'index.html', 'app.js', 'css/app.css?v=10', 'assets/avatars/avatars.js', 'manifest.webmanifest', 'assets/brand/logo-full.png', 'assets/brand/badge.png', 'assets/icons/icon-192.png',
  'assets/avatars/avatars.json', 'assets/avatars/standard/feminino.glb', 'assets/avatars/standard/masculino.glb', 'assets/brand/hero.jpg', 'assets/brand/hero-m.jpg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /cdn\.jsdelivr\.net|storage\.googleapis\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!cacheable) return;
  // rede primeiro para a aplicação (sempre atualizada); cópia guardada quando não há internet
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(req, c)); } return r; })
    .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
