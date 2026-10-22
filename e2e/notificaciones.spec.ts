/**
 * El service worker de verdad (public/sw.js) con una notificación del celular:
 * Chromium entrega el push con el protocolo de depuración (CDP), como si
 * llegara del servicio de push, y la página lee lo que quedó en la bandeja.
 * No necesita cuentas ni Supabase: el mensaje es el que arma la función avisar.
 * Solo Chromium (CDP), y el completo: el "headless shell" que usan las demás
 * pruebas no da permiso de notificaciones.
 */
import { t } from '../src/i18n/es-UY';
import { SITIO } from './entorno';
import { expect, test } from './fixtures';

const CASO = '11111111-2222-4333-8444-555555555555';

type EnLaBandeja = { titulo: string; cuerpo: string; tag: string; url: unknown };

test('una notificación del celular: sin datos privados, agrupada por caso y lleva al caso', async ({
  playwright,
}) => {
  const proxy = process.env.E2E_PROXY?.trim();
  const navegador = await playwright.chromium.launch({
    channel: 'chromium',
    ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
  });
  // Las demás pruebas bloquean el service worker (solo sirve para instalar); acá hace falta.
  const contexto = await navegador.newContext({ baseURL: SITIO, serviceWorkers: 'allow' });
  await contexto.grantPermissions(['notifications'], { origin: new URL(SITIO).origin });
  try {
    const p = await contexto.newPage();
    const cdp = await contexto.newCDPSession(p);
    const registro = new Promise<string>((resolver) => {
      cdp.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
        const activa = versions.find((v) => v.status === 'activated');
        if (activa) resolver(activa.registrationId);
      });
    });
    await cdp.send('ServiceWorker.enable');
    // Una pantalla sin mapa: el service worker se registra en cualquiera (index.html).
    await p.goto('/perfil');
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // Activo y controlando la página (clients.claim en sw.js).
    await expect
      .poll(() => p.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    const registrationId = await registro;

    const bandeja = () =>
      p.evaluate(async () => {
        const avisos = await (await navigator.serviceWorker.ready).getNotifications();
        return avisos.map((n): EnLaBandeja => ({
          titulo: n.title,
          cuerpo: n.body,
          tag: n.tag,
          url: n.data?.url,
        }));
      });
    const enviar = (datos: { titulo: string; tag: string }) =>
      cdp.send('ServiceWorker.deliverPushMessage', {
        origin: new URL(SITIO).origin,
        registrationId,
        data: JSON.stringify(datos),
      });
    /**
     * Entrega el push y espera que aparezca. Este Chromium a veces descarta una
     * entrega por el protocolo de depuración (1 de cada 40 a 90, sin errores
     * del service worker; nunca en un bucle fuera del runner): si en 5 s no
     * apareció, se entrega otra vez. Con el mismo tag es el mismo aviso, y un
     * service worker que no muestra nada sigue fallando.
     */
    const entregar = async (datos: {
      titulo: string;
      tag: string;
      cuerpo: string;
      url: string;
    }) => {
      const aparecio = async () =>
        (await bandeja()).some((n) => n.tag === datos.tag && n.titulo === datos.titulo);
      await enviar(datos);
      for (let i = 0; i < 25 && !(await aparecio()); i++) await p.waitForTimeout(200);
      if (!(await aparecio())) await enviar(datos);
    };

    // Lo que manda la función avisar cuando alguien ve a Toby (aviso.ts).
    await entregar({
      titulo: t.avisosPush.visto.titulo('a Toby'),
      cuerpo: t.avisosPush.visto.cuerpo,
      url: `/animal/${CASO}`,
      tag: `caso-${CASO}`,
    });
    await expect.poll(bandeja).toEqual([
      {
        titulo: 'Alguien vio a Toby',
        cuerpo: 'Tocá para ver dónde lo vieron.',
        tag: `caso-${CASO}`,
        url: `/animal/${CASO}`,
      },
    ]);

    // Otra novedad del mismo caso reemplaza a la anterior: una sola en la bandeja.
    await entregar({
      titulo: t.avisosPush.resguardado.titulo('a Toby'),
      cuerpo: t.avisosPush.resguardado.cuerpo,
      url: `/animal/${CASO}`,
      tag: `caso-${CASO}`,
    });
    await expect.poll(bandeja).toEqual([
      {
        titulo: 'Alguien tiene a Toby a salvo',
        cuerpo: 'Tocá para ver el caso.',
        tag: `caso-${CASO}`,
        url: `/animal/${CASO}`,
      },
    ]);

    // Que un link a otro sitio lleve a Actividad lo prueba __tests__/swPush.test.ts: una
    // tercera entrega seguida a veces no aparece en getNotifications de este Chromium.
  } finally {
    await navegador.close();
  }
});
