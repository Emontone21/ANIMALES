import { assertEquals, assertNotEquals, assertRejects } from '@std/assert';

import { armarMensaje } from '../aviso.ts';
import { crearEnviador, ErrorClaves, esEndpointPush, importarClaves } from '../push.ts';
import { aviso, clavesVapid, deBase64url, ServicioPush, suscriptor } from './ayudas.ts';

const CONTACTO = 'https://spot.example';

async function enviador(esperaMs?: number) {
  const { publica, privada } = await clavesVapid();
  return { enviar: crearEnviador(await importarClaves(publica, privada), CONTACTO, esperaMs), publica };
}

Deno.test('las claves VAPID tienen que ser un par', async () => {
  const a = await clavesVapid();
  const b = await clavesVapid();
  await importarClaves(a.publica, a.privada);
  await assertRejects(() => importarClaves(a.publica, b.privada), ErrorClaves);
  await assertRejects(() => importarClaves('corta', a.privada), ErrorClaves);
  await assertRejects(() => importarClaves(a.publica, 'no/es-base64!'), ErrorClaves);
});

Deno.test('solo los servicios de push de los navegadores (como es_endpoint_push)', () => {
  for (
    const bueno of [
      'https://fcm.googleapis.com/fcm/send/x',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB-prueba',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%3d%3d',
      'https://web.push.apple.com/QGx-prueba_1',
    ]
  ) assertEquals(esEndpointPush(bueno), true, bueno);
  for (
    const malo of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://fcm.googleapis.com.otro.example/fcm/send/x',
      'https://fcm.googleapis.com:8443/fcm/send/x',
      'https://usuario@fcm.googleapis.com/fcm/send/x',
      'https://ejemplo.supabase.co/functions/v1/avisar',
      'https://127.0.0.1/x',
      'https://push.apple.com.example/x',
      'https://web.push.apple.com/x y',
      `https://fcm.googleapis.com/${'x'.repeat(1100)}`,
    ]
  ) assertEquals(esEndpointPush(malo), false, malo);
});

Deno.test('el celular recibe el mensaje cifrado y firmado, y puede leerlo', async () => {
  const { enviar, publica } = await enviador();
  const s = await suscriptor();
  const servicio = new ServicioPush();
  servicio.registrar(s);
  const { mensaje, opciones } = armarMensaje(aviso());

  const resultado = await servicio.con(() => enviar(s.suscripcion, mensaje, opciones));

  assertEquals(resultado, 'ok');
  assertEquals(servicio.recibidos.length, 1);
  const [recibido] = servicio.recibidos;
  // Lo que descifra el navegador es exactamente el mensaje, sin nada más.
  assertEquals(recibido.mensaje, mensaje);
  assertEquals(recibido.headers['content-encoding'], 'aes128gcm');
  assertEquals(recibido.headers.ttl, String(opciones.ttl));
  assertEquals(recibido.headers.urgency, 'high');
  assertEquals(recibido.headers.topic, opciones.topic);
  assertEquals(recibido.vapid.sub, CONTACTO);
  assertEquals(recibido.vapid.aud, 'https://fcm.googleapis.com');
  assertEquals(recibido.vapid.k, publica);
});

Deno.test('cada mensaje se cifra con un par de claves nuevo', async () => {
  const { enviar } = await enviador();
  const s = await suscriptor();
  const claves: string[] = [];
  const servicio = new ServicioPush();
  servicio.registrar(s);
  const original = servicio.fetch;
  const espia = (entrada: RequestInfo | URL, init?: RequestInit) => {
    const cuerpo = new Uint8Array(init?.body as ArrayBuffer);
    claves.push(Array.from(cuerpo.slice(21, 21 + cuerpo[20])).join(','));
    return original(entrada, init);
  };
  const { mensaje, opciones } = armarMensaje(aviso());
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = espia;
  try {
    assertEquals(await enviar(s.suscripcion, mensaje, opciones), 'ok');
    assertEquals(await enviar(s.suscripcion, mensaje, opciones), 'ok');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  assertEquals(claves.length, 2);
  assertNotEquals(claves[0], claves[1]);
});

Deno.test('una suscripción vencida (404 o 410) da vencida; otra falla, error', async () => {
  const { enviar } = await enviador();
  const servicio = new ServicioPush();
  const vencida = await suscriptor();
  const borrada = await suscriptor();
  const caida = await suscriptor();
  servicio.registrar(vencida, 410);
  servicio.registrar(borrada, 404);
  servicio.registrar(caida, 500);
  const { mensaje, opciones } = armarMensaje(aviso());
  await servicio.con(async () => {
    assertEquals(await enviar(vencida.suscripcion, mensaje, opciones), 'vencida');
    assertEquals(await enviar(borrada.suscripcion, mensaje, opciones), 'vencida');
    assertEquals(await enviar(caida.suscripcion, mensaje, opciones), 'error');
  });
  assertEquals(servicio.recibidos.length, 0);
});

Deno.test('una suscripción con claves que no sirven o fuera de los servicios conocidos no se intenta', async () => {
  const { enviar } = await enviador();
  const s = await suscriptor();
  const pedidos: string[] = [];
  const { mensaje, opciones } = armarMensaje(aviso());
  const original = globalThis.fetch;
  globalThis.fetch = (entrada) => {
    pedidos.push(String(entrada));
    return Promise.resolve(new Response(null, { status: 201 }));
  };
  try {
    const otraClave = { ...s.suscripcion, p256dh: 'B' + 'A'.repeat(86) };
    assertEquals(deBase64url(otraClave.p256dh).length, 65);
    assertEquals(await enviar(otraClave, mensaje, opciones), 'vencida');
    assertEquals(await enviar({ ...s.suscripcion, auth: 'corto' }, mensaje, opciones), 'vencida');
    assertEquals(
      await enviar(
        { ...s.suscripcion, endpoint: 'https://ejemplo.supabase.co/functions/v1/avisar' },
        mensaje,
        opciones,
      ),
      'vencida',
    );
  } finally {
    globalThis.fetch = original;
  }
  assertEquals(pedidos, []);
});

Deno.test('un servicio que no contesta no frena: error al pasar la espera', async () => {
  const { enviar } = await enviador(50);
  const s = await suscriptor();
  const { mensaje, opciones } = armarMensaje(aviso());
  let soltar = () => {};
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    new Promise<Response>((resolver) => {
      soltar = () => resolver(new Response(null, { status: 201 }));
    });
  try {
    assertEquals(await enviar(s.suscripcion, mensaje, opciones), 'error');
  } finally {
    soltar();
    globalThis.fetch = original;
  }
});
