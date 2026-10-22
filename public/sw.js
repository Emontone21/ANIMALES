/*
 * Service worker mínimo. Existe porque Chrome lo pide para ofrecer la
 * instalación (el aviso beforeinstallprompt necesita un service worker con un
 * manejador de fetch que no esté vacío) y para las notificaciones en el
 * celular (push y notificationclick). No guarda nada, ni datos de Supabase ni
 * páginas, y no funciona sin conexión: las páginas van siempre a la red y todo
 * lo demás (JS, fotos, la API) no pasa por acá.
 * Ver docs/DECISIONES.md, "Instalar la app" y "Notificaciones en el celular".
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

/*
 * Notificaciones en el celular. El mensaje llega cifrado de la función avisar
 * (functions/avisar/aviso.ts): {titulo, cuerpo, url, tag}. Sin datos
 * de personas, ni el texto de un mensaje. El tag agrupa por caso o
 * conversación: una nueva reemplaza a la anterior sin volver a sonar.
 */

// Solo rutas de la app: "/animal/<id>", nunca otro sitio ni "//otro.example".
function rutaSegura(url) {
  return typeof url === 'string' && /^\/(?![\/\\])[A-Za-z0-9\-_/?=&.]{0,200}$/.test(url)
    ? url
    : '/actividad';
}

function textoCorto(valor, largo) {
  return typeof valor === 'string' ? valor.slice(0, largo) : '';
}

self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = (evento.data && evento.data.json()) || {};
  } catch (error) {
    datos = {};
  }
  const titulo = textoCorto(datos.titulo, 120) || 'Spot';
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: textoCorto(datos.cuerpo, 200),
      tag: textoCorto(datos.tag, 100) || 'spot',
      icon: '/iconos/icono-192.png',
      lang: 'es-UY',
      data: { url: rutaSegura(datos.url) },
    }),
  );
});

// Al tocarla: la app ya abierta va a esa pantalla; si no, se abre.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(
    rutaSegura(evento.notification.data && evento.notification.data.url),
    self.location.origin,
  ).href;
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const abierta = ventanas.find(
        (ventana) => new URL(ventana.url).origin === self.location.origin,
      );
      if (abierta) {
        try {
          await abierta.focus();
          await abierta.navigate(destino);
          return;
        } catch (error) {
          // Una ventana que no controla este service worker no se puede llevar: se abre otra.
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
