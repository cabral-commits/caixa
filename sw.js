/* Service worker do app instalado: guarda a tela no aparelho para abrir rápido e sem sinal.
 * Os dados NÃO passam por aqui (vão por POST direto para a planilha); a tela é buscada na rede primeiro
 * para receber atualizações, e só usa a cópia guardada quando não há conexão. */
const VERSION = 'caixa-6c4b453c1c15';
const SHELL = ['./', './index.html', './config.js', './pwa-client.js', './manifest.webmanifest', './icone-192.png', './icone-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { // tela do app: rede primeiro, cópia guardada se estiver sem sinal
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { // fontes: cópia guardada primeiro
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  }
});
