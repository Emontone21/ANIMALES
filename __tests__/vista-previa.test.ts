/**
 * @jest-environment node
 */
// La función de Vercel corre en Node: fetch, Request y Response del runtime.

const ID = 'b0000000-0000-4000-8000-000000000004';
const SITIO = 'https://animales.test';
const PLANTILLA =
  '<!doctype html><html><head><title>Encontrados</title></head><body><div id="root"></div></body></html>';
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

/** Simula la plantilla del deploy, la API de Supabase y Storage. */
function simularRed({
  caso = toby as Caso | null,
  plantilla = true,
  miniatura = true,
}: { caso?: Caso | null; plantilla?: boolean; miniatura?: boolean } = {}) {
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
    expect(html).toContain('<title>Se perdió Toby · Encontrados</title>');
    expect(html).toContain('<meta property="og:title" content="Se perdió Toby" />');
    expect(html).toContain(
      '<meta property="og:description" content="Perro marrón, mediano, con collar. Si lo viste, avisá en Encontrados." />',
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://encontrados.test/animal/${ID}" />`,
    );
    expect(html).toContain('abc.miniatura.jpg');
    expect(html).toContain('<meta property="og:image:width" content="320" />');
    expect(html.match(/<title>/g)).toHaveLength(1);
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
    expect(html).toContain('<title>Encontrados</title>');
    expect(html).not.toContain('Toby');
    expect(html).not.toContain('og:image');
  });

  test('un id que no es un UUID no consulta la base', async () => {
    const pedidos = simularRed();
    const { html } = await pedir('/api/vista-previa?id=no-es-un-id');
    expect(pedidos.some((p) => p.url.includes('/rest/v1/'))).toBe(false);
    expect(html).toContain('<meta property="og:url" content="https://encontrados.test" />');
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

  test('HEAD: mismas cabeceras, sin cuerpo', async () => {
    simularRed();
    const { respuesta, html } = await pedir(`/api/vista-previa?id=${ID}`, 'HEAD');
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(html).toBe('');
  });
});
