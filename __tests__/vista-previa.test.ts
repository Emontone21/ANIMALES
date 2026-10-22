/**
 * @jest-environment node
 */
// La función de Vercel corre en Node: fetch, Request y Response del runtime.
import fs from 'node:fs';
import path from 'node:path';

const ID = 'b0000000-0000-4000-8000-000000000004';
const SITIO = 'https://animales.test';
const PLANTILLA =
  '<!doctype html><html><head><title>Spot</title><meta name="description" content="La genérica de index.html." /></head><body><div id="root"></div></body></html>';
const FOTO = '00000000-0000-4000-8000-0000000000f1/abc.jpg';

type Caso = Record<string, unknown>;

const toby: Caso = {
  id: ID,
  tipo_reporte: 'perdido',
  estado: 'avistado',
  nombre: 'Toby',
  especie: 'perro',
  color: 'Marrón',
  tamanio: 'mediano',
  tiene_collar: true,
  foto_principal_path: FOTO,
  oculto: false,
};

/** Lo que devuelve historia_reencuentro (sin cuenta): lo mismo que el muro. */
const historiaDeToby: Caso = {
  animal_id: ID,
  nombre: 'Toby',
  especie: 'perro',
  foto_path: FOTO,
  frase: 'Una vecina lo vio en la plaza y nos escribió',
  dias: 3,
  reunido_en: '2026-10-20T15:00:00Z',
  oculta: false,
};

/** Simula la plantilla del deploy, la API de Supabase y Storage. */
function simularRed({
  caso = toby as Caso | null,
  historia = historiaDeToby as Caso | null,
  plantilla = true,
  miniatura = true,
}: {
  caso?: Caso | null;
  historia?: Caso | null;
  plantilla?: boolean;
  miniatura?: boolean;
} = {}) {
  const pedidos: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = jest.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    pedidos.push({ url, init });
    if (url === `${SITIO}/`) {
      return plantilla ? new Response(PLANTILLA) : new Response('', { status: 500 });
    }
    if (url.includes('/rest/v1/animales')) {
      return Response.json(caso ? [caso] : []);
    }
    if (url.endsWith('/rest/v1/rpc/historia_reencuentro')) {
      return Response.json(historia ? [historia] : []);
    }
    if (url.includes('/storage/v1/object/public/')) {
      return new Response(null, { status: miniatura ? 200 : 404 });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }) as typeof fetch;
  return pedidos;
}

/** Cada prueba carga la función de nuevo: guarda la plantilla en memoria. */
function cargarFuncion(): typeof import('../api/vista-previa') {
  let modulo: typeof import('../api/vista-previa') | undefined;
  jest.isolateModules(() => {
    modulo = require('../api/vista-previa');
  });
  return modulo as typeof import('../api/vista-previa');
}

async function pedir(ruta: string, metodo: 'GET' | 'HEAD' = 'GET') {
  const funcion = cargarFuncion();
  const respuesta = await funcion[metodo](new Request(`${SITIO}${ruta}`, { method: metodo }));
  return { respuesta, html: await respuesta.text() };
}

describe('vista previa del link de un caso', () => {
  test('un perdido: título, descripción, miniatura y link, sobre el index.html de la app', async () => {
    simularRed();
    const { respuesta, html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(respuesta.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=300');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<title>Se perdió Toby · Spot</title>');
    expect(html).toContain('<meta property="og:title" content="Se perdió Toby" />');
    expect(html).toContain(
      '<meta property="og:description" content="Perro marrón, mediano, con collar. Si lo viste, avisá en Spot." />',
    );
    expect(html).toContain(`<meta property="og:url" content="https://spot.test/animal/${ID}" />`);
    expect(html).toContain('abc.miniatura.jpg');
    expect(html).toContain('<meta property="og:image:width" content="320" />');
    expect(html.match(/<title>/g)).toHaveLength(1);
    // La descripción genérica de index.html se reemplaza: queda una sola, la del caso.
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('La genérica de index.html.');
  });

  test('un color con números (podría ser un teléfono) no aparece (B37)', async () => {
    simularRed({ caso: { ...toby, color: 'negro, llamar al 099 123 456' } });
    const { html } = await pedir(`/animal/${ID}`);
    expect(html).toContain(
      '<meta property="og:description" content="Perro, mediano, con collar. Si lo viste, avisá en Spot." />',
    );
    expect(html).not.toContain('099');
  });

  test('con la clave anon legacy la manda en apikey y en Authorization', async () => {
    const pedidos = simularRed();
    await pedir(`/animal/${ID}`);
    const consulta = pedidos.find((p) => p.url.includes('/rest/v1/animales'));
    expect(consulta!.init!.headers).toEqual({
      apikey: 'clave-de-prueba',
      authorization: 'Bearer clave-de-prueba',
    });
  });

  test('con la publishable la manda solo en apikey: no es un JWT', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_prueba';
    try {
      const pedidos = simularRed();
      const { html } = await pedir(`/animal/${ID}`);
      const consulta = pedidos.find((p) => p.url.includes('/rest/v1/animales'));
      expect(consulta!.init!.headers).toEqual({ apikey: 'sb_publishable_prueba' });
      expect(html).toContain('<meta property="og:title" content="Se perdió Toby" />');
    } finally {
      delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    }
  });

  test('a la base solo le pide columnas sin datos personales', async () => {
    const pedidos = simularRed();
    await pedir(`/animal/${ID}`);
    const consulta = pedidos.find((p) => p.url.includes('/rest/v1/animales'));
    const columnas = new URL(consulta!.url).searchParams.get('select')!.split(',');
    for (const personal of ['contacto_familia', 'creado_por', 'descripcion', 'ubicacion']) {
      expect(columnas).not.toContain(personal);
    }
  });

  test('aunque la base devolviera datos personales, no llegan a la página', async () => {
    simularRed({
      caso: {
        ...toby,
        contacto_familia: 'WhatsApp 099 111 222',
        descripcion: 'Vivimos en Rivera 1234',
        creado_por: 'alguien',
      },
    });
    const { html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(html).not.toContain('099 111 222');
    expect(html).not.toContain('Rivera 1234');
    expect(html).not.toContain('alguien');
  });

  test.each([
    ['oculto por moderación', { ...toby, oculto: true }],
    ['unido a otro caso', { ...toby, estado: 'vinculado' }],
    ['inexistente', null],
  ])('un caso %s lleva la vista previa genérica', async (_nombre, caso) => {
    simularRed({ caso });
    const { html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(html).toContain('<title>Spot</title>');
    expect(html).not.toContain('Toby');
    expect(html).not.toContain('og:image');
  });

  test('un id que no es un UUID no consulta la base', async () => {
    const pedidos = simularRed();
    const { html } = await pedir('/api/vista-previa?id=no-es-un-id');
    expect(pedidos.some((p) => p.url.includes('/rest/v1/'))).toBe(false);
    expect(html).toContain('<meta property="og:url" content="https://spot.test" />');
  });

  test('sin miniatura (fotos de antes de la Fase 8) usa la original, sin medidas', async () => {
    simularRed({ miniatura: false });
    const { html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(html).toContain(`fotos/${FOTO}" />`);
    expect(html).not.toContain('og:image:width');
  });

  test('sin la plantilla de la app: página mínima y sin caché', async () => {
    simularRed({ plantilla: false });
    const { respuesta, html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('og:title');
    expect(html).not.toContain('<div id="root">');
  });

  test('escapa lo que escribió la persona', async () => {
    simularRed({ caso: { ...toby, nombre: '"Toby"<script>' } });
    const { html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;Toby&quot;&lt;script&gt;');
  });

  test('"$`" o "$&" en un nombre se insertan tal cual, sin pedazos del <head> (S-B1)', async () => {
    simularRed({ caso: { ...toby, nombre: "Toby $` $& $'" } });
    const { html } = await pedir(`/api/vista-previa?id=${ID}`);
    expect(html).toContain('<title>Se perdió Toby $` $&amp; $&#39; · Spot</title>');
    expect(html.match(/<head>/g)).toHaveLength(1);
    expect(html.match(/<\/head>/g)).toHaveLength(1);
    expect(html.match(/<!doctype html>/gi)).toHaveLength(1);
  });

  test('con más de un id, las etiquetas genéricas y sin consultar la base (S-B7)', async () => {
    const otro = 'b0000000-0000-4000-8000-000000000005';
    const pedidos = simularRed();
    const { html } = await pedir(`/api/vista-previa?id=${ID}&id=${otro}`);
    expect(pedidos.some((p) => p.url.includes('/rest/v1/'))).toBe(false);
    expect(html).not.toContain('Toby');
    expect(html).toContain('<meta property="og:url" content="https://spot.test" />');
  });

  test('HEAD: mismas cabeceras, sin cuerpo', async () => {
    simularRed();
    const { respuesta, html } = await pedir(`/api/vista-previa?id=${ID}`, 'HEAD');
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(html).toBe('');
  });
});

describe('vista previa del link de una historia del muro', () => {
  test('el nombre, los días y la foto; el link a la historia', async () => {
    simularRed();
    const { html } = await pedir(`/api/vista-previa?historia=${ID}`);
    expect(html).toContain('<title>Toby volvió a casa · Spot</title>');
    expect(html).toContain('<meta property="og:title" content="Toby volvió a casa" />');
    expect(html).toContain(
      '<meta property="og:description" content="Volvió a casa después de 3 días. Mirá más reencuentros en Spot." />',
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://spot.test/reencuentros/${ID}" />`,
    );
    expect(html).toContain('abc.miniatura.jpg');
  });

  test('la pide por la misma RPC que el muro, con la clave pública', async () => {
    const pedidos = simularRed();
    await pedir(`/reencuentros/${ID}`);
    const consulta = pedidos.find((p) => p.url.includes('/rest/v1/rpc/historia_reencuentro'));
    expect(consulta!.init!.method).toBe('POST');
    expect(JSON.parse(String(consulta!.init!.body))).toEqual({ p_animal_id: ID });
    expect(consulta!.init!.headers).toMatchObject({ apikey: 'clave-de-prueba' });
    // De una historia no se consulta el caso: el link es de la historia.
    expect(pedidos.some((p) => p.url.includes('/rest/v1/animales'))).toBe(false);
  });

  test('sin el nombre (la familia no quiso), la especie; nunca la frase', async () => {
    simularRed({ historia: { ...historiaDeToby, nombre: null, dias: 0 } });
    const { html } = await pedir(`/api/vista-previa?historia=${ID}`);
    expect(html).toContain('<meta property="og:title" content="Un perro volvió a casa" />');
    expect(html).toContain('Volvió a casa el mismo día.');
    expect(html).not.toContain('Toby');
    expect(html).not.toContain('vecina');
  });

  test.each([
    ['oculta por moderación', { ...historiaDeToby, oculta: true }],
    ['inexistente', null],
  ])('una historia %s lleva la vista previa genérica del muro', async (_nombre, historia) => {
    simularRed({ historia });
    const { html } = await pedir(`/api/vista-previa?historia=${ID}`);
    expect(html).toContain('<title>Reencuentros en Spot</title>');
    expect(html).toContain(
      `<meta property="og:url" content="https://spot.test/reencuentros/${ID}" />`,
    );
    expect(html).not.toContain('Toby');
    expect(html).not.toContain('og:image');
  });

  test('un caso y una historia a la vez: las genéricas, sin consultar la base', async () => {
    const otro = 'b0000000-0000-4000-8000-000000000005';
    const pedidos = simularRed();
    const { html } = await pedir(`/reencuentros/${ID}?id=${otro}`);
    expect(pedidos.some((p) => p.url.includes('/rest/v1/'))).toBe(false);
    expect(html).not.toContain('Toby');
    expect(html).toContain('<meta property="og:url" content="https://spot.test" />');
  });

  test('la ruta y el parámetro del rewrite con el mismo id cuentan una vez', async () => {
    simularRed();
    const { html } = await pedir(`/reencuentros/${ID}?historia=${ID.toUpperCase()}`);
    expect(html).toContain('<meta property="og:title" content="Toby volvió a casa" />');
  });

  test('un id que no es un UUID no consulta la base', async () => {
    const pedidos = simularRed();
    await pedir('/api/vista-previa?historia=no-es-un-id');
    expect(pedidos.some((p) => p.url.includes('/rest/v1/'))).toBe(false);
  });
});

describe('vercel.json manda a los bots a la vista previa', () => {
  type Reescritura = {
    source: string;
    destination: string;
    has?: { type: string; key: string; value: string }[];
  };
  const { rewrites } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'),
  ) as { rewrites: Reescritura[] };

  test('el link de un caso y el de una historia, con los mismos bots y antes del resto', () => {
    const caso = rewrites.find((r) => r.source === '/animal/:id');
    const historia = rewrites.find((r) => r.source === '/reencuentros/:id');
    expect(caso?.destination).toBe('/api/vista-previa?id=:id');
    expect(historia?.destination).toBe('/api/vista-previa?historia=:id');
    expect(historia?.has).toEqual(caso?.has);
    expect(historia?.has?.[0]).toMatchObject({ type: 'header', key: 'user-agent' });
    const resto = rewrites.findIndex((r) => r.source === '/:path*');
    expect(rewrites.indexOf(historia!)).toBeLessThan(resto);
  });
});
