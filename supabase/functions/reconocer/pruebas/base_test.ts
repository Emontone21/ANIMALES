import { assertEquals, assertRejects } from '@std/assert';

import { BaseSupabase, claveDesdeEntorno, ErrorBase, headersPara, totalDeContentRange } from '../base.ts';

const SECRETA = 'sb_secret_prueba123';
const LEGACY = 'eyJhbGciOiJIUzI1NiJ9.prueba.firma';

Deno.test('la clave: la secreta de SUPABASE_SECRET_KEYS si está; si no, la legacy', () => {
  const entorno = (valores: Record<string, string>) => (nombre: string) => valores[nombre];
  assertEquals(
    claveDesdeEntorno(
      entorno({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRETA }), SUPABASE_SERVICE_ROLE_KEY: LEGACY }),
    ),
    SECRETA,
  );
  assertEquals(claveDesdeEntorno(entorno({ SUPABASE_SERVICE_ROLE_KEY: LEGACY })), LEGACY);
  assertEquals(
    claveDesdeEntorno(entorno({ SUPABASE_SECRET_KEYS: 'no es json', SUPABASE_SERVICE_ROLE_KEY: LEGACY })),
    LEGACY,
  );
  assertEquals(claveDesdeEntorno(entorno({ SUPABASE_SECRET_KEYS: '{"otra":"x"}' })), '');
});

Deno.test('la secreta va solo en apikey; la legacy también como Bearer; nunca un User-Agent de navegador', () => {
  const secreta = headersPara(SECRETA);
  assertEquals(secreta.apikey, SECRETA);
  assertEquals('Authorization' in secreta, false);
  assertEquals(headersPara(LEGACY).Authorization, `Bearer ${LEGACY}`);
  assertEquals(/Mozilla/.test(secreta['User-Agent']), false);
});

type Pedido = { url: string; init?: RequestInit };

function fetchQueResponde(respuesta: () => Response) {
  const pedidos: Pedido[] = [];
  const f: typeof fetch = (entrada, init) => {
    pedidos.push({ url: String(entrada), init });
    return Promise.resolve(respuesta());
  };
  return { pedidos, f };
}

Deno.test('las RPC van a /rest/v1/rpc/<nombre> con sus parámetros', async () => {
  const { pedidos, f } = fetchQueResponde(() => new Response('true', { status: 200 }));
  const base = new BaseSupabase('https://proyecto.supabase.co/', SECRETA, f);
  const comparable = await base.guardarDescripcion(
    'av-1',
    {
      hay_animal: true,
      especie: 'perro',
      color_principal: 'negro',
      color_secundario: 'ninguno',
      patron: 'liso',
      tamanio: 'no_se_ve',
      collar: 'no',
      collar_color: null,
      raza_aproximada: null,
      rasgos: [],
      calidad: 'buena',
    },
    'claude-haiku-5-5',
    10,
    20,
  );

  assertEquals(comparable, true);
  assertEquals(pedidos[0].url, 'https://proyecto.supabase.co/rest/v1/rpc/guardar_descripcion_ia');
  assertEquals(pedidos[0].init?.method, 'POST');
  const cuerpo = JSON.parse(String(pedidos[0].init?.body));
  assertEquals(cuerpo.p_avistamiento_id, 'av-1');
  assertEquals(cuerpo.p_descripcion.color_principal, 'negro');
  assertEquals(cuerpo.p_tokens_salida, 20);
  assertEquals((pedidos[0].init?.headers as Record<string, string>).apikey, SECRETA);
});

Deno.test('una RPC que falla tira ErrorBase con el estado, sin el cuerpo de la respuesta', async () => {
  const { f } = fetchQueResponde(() => new Response('{"message":"detalle de la base"}', { status: 500 }));
  const base = new BaseSupabase('https://proyecto.supabase.co', SECRETA, f);
  const error = await assertRejects(() => base.marcarHecho('av-1'), ErrorBase);
  assertEquals(error.message, 'marcar_hecho_ia: HTTP 500');
});

Deno.test('las pendientes salen de la vista, sin las que ya se probaron; y se cuentan', async () => {
  const { pedidos, f } = fetchQueResponde(() =>
    new Response('[{"avistamiento_id":"av-3"}]', { status: 200, headers: { 'content-range': '0-0/4' } })
  );
  const base = new BaseSupabase('https://proyecto.supabase.co', SECRETA, f);
  assertEquals(await base.siguientesPendientes(5, ['av-1', 'av-2']), ['av-3']);
  const url = new URL(pedidos[0].url);
  assertEquals(url.pathname, '/rest/v1/cola_vision_pendientes');
  assertEquals(url.searchParams.get('avistamiento_id'), 'not.in.(av-1,av-2)');
  assertEquals(url.searchParams.get('limit'), '5');
  assertEquals(await base.contarPendientes(), 4);
  assertEquals((pedidos[1].init?.headers as Record<string, string>).Prefer, 'count=exact');
});

Deno.test('Content-Range', () => {
  assertEquals(totalDeContentRange('0-0/12'), 12);
  assertEquals(totalDeContentRange('*/0'), 0);
  assertEquals(totalDeContentRange(null), 0);
});
