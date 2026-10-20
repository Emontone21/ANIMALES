/*
 * Service worker mínimo. Solo existe porque Chrome lo pide para ofrecer la
 * instalación (el aviso beforeinstallprompt necesita un service worker con un
 * manejador de fetch que no esté vacío). No guarda nada, ni datos de Supabase
 * ni páginas, y no funciona sin conexión: las páginas van siempre a la red y
 * todo lo demás (JS, fotos, la API) no pasa por acá.
 * Ver docs/DECISIONES.md, "Instalar la app".
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // La página se pide en paralelo con el arranque del service worker: no la demora.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.mode !== 'navigate') return;
  evento.respondWith((async () => (await evento.preloadResponse) || fetch(evento.request))());
});
