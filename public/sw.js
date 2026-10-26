/* Service worker da Retrátil Film.
 * Política de segurança: NUNCA guarda páginas, respostas de API, ações ou dados do usuário.
 * Só armazena arquivos estáticos públicos (JS/CSS com hash, ícones) e uma página offline sem dados.
 * Navegações vão sempre à rede; sem conexão, mostra /offline.html. */
const VERSION = "v1";
const STATIC_CACHE = `rf-static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // ações de formulário, login etc.: sempre rede, nunca cache
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  // somente arquivos estáticos públicos e imutáveis
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
  }
  // todo o resto (dados RSC, /api, PDFs): segue direto para a rede, sem cache
});
