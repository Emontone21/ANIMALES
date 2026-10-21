import { assertEquals } from '@std/assert';

import { aBase64, bajarFoto, ORIGENES_DEMO, origenPermitido, tipoPorBytes, TOPE_FOTO_BYTES } from '../descargar.ts';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const GIF = [...new TextEncoder().encode('GIF89a'), 0x01];
const WEBP = [...new TextEncoder().encode('RIFF'), 0x24, 0x00, 0x00, 0x00, ...new TextEncoder().encode('WEBPVP8 ')];
const HTML = [...new TextEncoder().encode('<!doctype html><p>No encontrado</p>')];

const bytes = (x: number[]) => new Uint8Array(x);

/** Un fetch que responde siempre lo mismo y anota a qué URL se pidió. */
function sitio(respuesta: () => Response) {
  const pedidos: string[] = [];
  const fetchFalso: typeof fetch = (entrada) => {
    pedidos.push(String(entrada));
    return Promise.resolve(respuesta());
  };
  return { pedidos, fetchFalso };
}

Deno.test('el tipo sale de los bytes: JPEG, PNG, GIF y WebP; cualquier otra cosa, ninguno', () => {
  assertEquals(tipoPorBytes(bytes(JPEG)), 'image/jpeg');
  assertEquals(tipoPorBytes(bytes(PNG)), 'image/png');
  assertEquals(tipoPorBytes(bytes(GIF)), 'image/gif');
  assertEquals(tipoPorBytes(bytes([...new TextEncoder().encode('GIF87a')]))!, 'image/gif');
  assertEquals(tipoPorBytes(bytes(WEBP)), 'image/webp');
  assertEquals(tipoPorBytes(bytes(HTML)), null);
  // RIFF que no es WebP (un WAV), un GIF a medias, vacío.
  assertEquals(tipoPorBytes(bytes([...new TextEncoder().encode('RIFF\0\0\0\0WAVEfmt ')])), null);
  assertEquals(tipoPorBytes(bytes([...new TextEncoder().encode('GIF8')])), null);
  assertEquals(tipoPorBytes(bytes([])), null);
});

Deno.test('base64 de archivos grandes, por partes', () => {
  assertEquals(aBase64(bytes(JPEG)), btoa(String.fromCharCode(...JPEG)));
  const grande = new Uint8Array(200_000).map((_, i) => i % 256);
  let binario = '';
  for (const b of grande) binario += String.fromCharCode(b);
  assertEquals(aBase64(grande), btoa(binario));
});

Deno.test('una foto de otro sitio se baja con el tipo de sus bytes, aunque el sitio diga otro', async () => {
  // placedog.net dice "image/jpg", que no es un tipo válido.
  const { pedidos, fetchFalso } = sitio(() => new Response(bytes(JPEG), { headers: { 'content-type': 'image/jpg' } }));
  const foto = await bajarFoto(fetchFalso)('https://placedog.net/640/480?id=12');
  assertEquals(foto, { media_type: 'image/jpeg', data: aBase64(bytes(JPEG)), bytes: JPEG.length });
  assertEquals(pedidos, ['https://placedog.net/640/480?id=12']);

  // Y un PNG que dice ser JPEG va como PNG.
  const png = sitio(() => new Response(bytes(PNG), { headers: { 'content-type': 'image/jpeg' } }));
  assertEquals((await bajarFoto(png.fetchFalso)('https://cataas.com/cat?id=1'))?.media_type, 'image/png');
});

Deno.test('solo de los orígenes permitidos y sin seguir redirecciones (auditoría 2, S-B3)', async () => {
  const proyecto = 'https://proyecto.supabase.co';
  const origenes = [proyecto, ...ORIGENES_DEMO];
  assertEquals(origenPermitido(`${proyecto}/storage/v1/object/public/fotos/u/a.jpg`, origenes), true);
  assertEquals(origenPermitido('https://placedog.net/640/480?id=12', origenes), true);
  // Otro host, otro esquema, otro puerto, un host que solo empieza igual, una ruta suelta.
  for (
    const url of [
      'https://otro.sitio/a.jpg',
      'http://placedog.net/640/480',
      'https://placedog.net:8443/640/480',
      'https://placedog.net.otro.sitio/a.jpg',
      'https://proyecto.supabase.co@otro.sitio/a.jpg',
      'u/a.jpg',
    ]
  ) {
    assertEquals(origenPermitido(url, origenes), false, url);
  }

  // De otro sitio ni se pide.
  const otro = sitio(() => new Response(bytes(JPEG)));
  assertEquals(await bajarFoto(otro.fetchFalso, { origenes })('https://otro.sitio/a.jpg'), null);
  assertEquals(otro.pedidos, []);

  // Del proyecto sí, y siempre con redirect: 'error'.
  const modos: (RequestRedirect | undefined)[] = [];
  const delProyecto: typeof fetch = (_entrada, init) => {
    modos.push(init?.redirect);
    return Promise.resolve(new Response(bytes(JPEG)));
  };
  const url = `${proyecto}/storage/v1/object/public/fotos/u/a.jpg`;
  assertEquals((await bajarFoto(delProyecto, { origenes })(url))?.media_type, 'image/jpeg');
  assertEquals(modos, ['error']);

  // Una redirección hace fallar el pedido (como fetch con redirect: 'error'): la foto no está.
  const redirige: typeof fetch = (_entrada, init) =>
    init?.redirect === 'error'
      ? Promise.reject(new TypeError('Fetch failed: redirect'))
      : Promise.resolve(new Response(bytes(JPEG)));
  assertEquals(await bajarFoto(redirige, { origenes })(url), null);
});

Deno.test('no se baja: una respuesta que no es 200, una página en vez de una imagen o un error de red', async () => {
  const noEncontrada = sitio(() => new Response(bytes(JPEG), { status: 404 }));
  assertEquals(await bajarFoto(noEncontrada.fetchFalso)('https://cataas.com/cat?id=1'), null);

  const pagina = sitio(() => new Response(bytes(HTML), { headers: { 'content-type': 'image/jpeg' } }));
  assertEquals(await bajarFoto(pagina.fetchFalso)('https://cataas.com/cat?id=1'), null);

  const sinRed: typeof fetch = () => Promise.reject(new TypeError('error sending request'));
  assertEquals(await bajarFoto(sinRed)('https://cataas.com/cat?id=1'), null);
});

Deno.test('más de 5 MB no se baja: ni si lo dice el sitio ni si se pasa al leer', async () => {
  // Lo dice el sitio: ni se empieza a leer.
  let leidas = 0;
  const declarada = sitio(() =>
    new Response(
      new ReadableStream({
        pull(c) {
          leidas += 1;
          c.enqueue(bytes(JPEG));
        },
      }),
      { headers: { 'content-length': String(TOPE_FOTO_BYTES + 1) } },
    )
  );
  assertEquals(await bajarFoto(declarada.fetchFalso)('https://cataas.com/cat?id=1'), null);
  assertEquals(leidas <= 1, true);

  // No lo dice: se corta apenas pasa el tope.
  const parte = new Uint8Array(1024 * 1024);
  parte.set(JPEG);
  let mandadas = 0;
  const sinLargo = sitio(() =>
    new Response(
      new ReadableStream({
        pull(c) {
          mandadas += 1;
          c.enqueue(parte);
        },
      }),
    )
  );
  assertEquals(await bajarFoto(sinLargo.fetchFalso)('https://cataas.com/cat?id=1'), null);
  assertEquals(mandadas <= 7, true);

  // Justo 5 MB, sí.
  const justa = new Uint8Array(TOPE_FOTO_BYTES);
  justa.set(JPEG);
  const tope = sitio(() => new Response(justa));
  assertEquals((await bajarFoto(tope.fetchFalso)('https://cataas.com/cat?id=1'))?.bytes, TOPE_FOTO_BYTES);
});

Deno.test('más del tope de tiempo no se baja: ni si no responde ni si manda de a poco', async () => {
  // No responde: el pedido se corta con la señal.
  const mudo: typeof fetch = (_entrada, init) =>
    new Promise((_listo, falla) => {
      init?.signal?.addEventListener('abort', () => falla(new DOMException('Cortado', 'AbortError')));
    });
  assertEquals(await bajarFoto(mudo, { topeMs: 30 })('https://cataas.com/cat?id=1'), null);

  // Responde y después no manda nada más.
  const lento = sitio(() =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(bytes(JPEG));
        },
        // Nunca cierra.
      }),
    )
  );
  assertEquals(await bajarFoto(lento.fetchFalso, { topeMs: 30 })('https://cataas.com/cat?id=1'), null);
});
