import { assertEquals } from '@std/assert';

import { HERRAMIENTA_DESCRIBIR } from '../claude.ts';
import { crearManejador, mismoSecreto } from '../servidor.ts';
import { apiFalsa, BaseFalsa, conHerramienta, dependencias, DESCRIPCION_PERRO, pendiente, SECRETO } from './ayudas.ts';

const URL_FUNCION = 'https://proyecto.supabase.co/functions/v1/reconocer';

function pedido(ruta: string, cuerpo: unknown = {}, secreto: string | null = SECRETO, metodo = 'POST'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secreto !== null) headers['X-Vision-Secret'] = secreto;
  return new Request(`${URL_FUNCION}${ruta}`, {
    method: metodo,
    headers,
    body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
  });
}

/** Cada foto describe un gato en un caso de perro: no se compara, una llamada por foto. */
function apiDeUnaLlamada() {
  return apiFalsa(() => conHerramienta(HERRAMIENTA_DESCRIBIR, { ...DESCRIPCION_PERRO, especie: 'gato' }));
}

Deno.test('sin el secreto, con otro o sin secreto cargado, no atiende', async () => {
  const base = new BaseFalsa();
  const manejar = crearManejador(dependencias(base, apiDeUnaLlamada().cliente));
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, null))).status, 401);
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, 'otro'))).status, 401);
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, 'f'.repeat(64)))).status, 401);
  base.config_.secreto = '';
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, ''))).status, 401);
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, SECRETO))).status, 401);
});

Deno.test('un header sin la forma del secreto se rechaza sin consultar la base', async () => {
  const base = new BaseFalsa();
  const manejar = crearManejador(dependencias(base, apiDeUnaLlamada().cliente));
  for (const secreto of [null, '', 'otro', SECRETO.slice(1), `${SECRETO}0`, `${SECRETO.slice(1)}g`]) {
    assertEquals((await manejar(pedido('/procesar-pendientes', {}, secreto))).status, 401);
  }
  assertEquals(base.consultasConfig, 0);
  // Con la forma correcta sí va a la base, y en mayúsculas también.
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, 'f'.repeat(64)))).status, 401);
  assertEquals(base.consultasConfig, 1);
  base.config_.secreto = SECRETO.toUpperCase();
  assertEquals((await manejar(pedido('/procesar-pendientes', {}, SECRETO.toUpperCase()))).status, 200);
});

Deno.test('solo POST, rutas conocidas y un avistamiento_id que sea un UUID', async () => {
  const manejar = crearManejador(dependencias(new BaseFalsa(), apiDeUnaLlamada().cliente));
  assertEquals((await manejar(pedido('/procesar', null, SECRETO, 'GET'))).status, 405);
  assertEquals((await manejar(pedido('/otra'))).status, 404);
  assertEquals((await manejar(pedido('/procesar', { avistamiento_id: 'x' }))).status, 400);
  assertEquals((await manejar(pedido('/procesar', { avistamiento_id: pendiente().avistamiento_id }))).status, 200);
});

Deno.test('sin ANTHROPIC_API_KEY responde 503 y no toca la cola', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const manejar = crearManejador(dependencias(base, null));
  assertEquals((await manejar(pedido('/procesar-pendientes'))).status, 503);
  assertEquals(base.pendientes.size, 1);
});

Deno.test('/procesar responde lo que pasó con la foto', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const manejar = crearManejador(dependencias(base, apiDeUnaLlamada().cliente));
  const r = await manejar(pedido('/procesar', { avistamiento_id: pendiente().avistamiento_id }));
  assertEquals(await r.json(), {
    procesado: true,
    comparado: false,
    coincidencias: 0,
    motivo: 'sin_animal_de_la_especie',
  });
});

/** n fotos pendientes con ids distintos. */
function cola(base: BaseFalsa, n: number) {
  for (let i = 0; i < n; i++) {
    base.agregar(pendiente({ avistamiento_id: `00000000-0000-4000-8000-00000000000${i}` }));
  }
}

Deno.test('/procesar-pendientes vacía la cola y dice cuántas quedan', async () => {
  const base = new BaseFalsa();
  cola(base, 7);
  const manejar = crearManejador(dependencias(base, apiDeUnaLlamada().cliente));
  const r = await manejar(pedido('/procesar-pendientes'));
  assertEquals(await r.json(), { procesados: 7, errores: 0, quedan: 0 });
});

Deno.test('/procesar-pendientes no empieza otra foto pasado el tope de tiempo', async () => {
  const base = new BaseFalsa();
  cola(base, 6);
  let reloj = 0;
  // Cada foto tarda 40 s: con un tope de 90 s se empiezan 3 (a los 0, 40 y 80 s).
  const api = apiFalsa(() => {
    reloj += 40_000;
    return conHerramienta(HERRAMIENTA_DESCRIBIR, { ...DESCRIPCION_PERRO, especie: 'gato' });
  });
  const manejar = crearManejador(dependencias(base, api.cliente, { ahora: () => reloj, topeMs: 90_000 }));
  const r = await manejar(pedido('/procesar-pendientes'));
  assertEquals(await r.json(), { procesados: 3, errores: 0, quedan: 3 });
});

Deno.test('/procesar-pendientes corta al llegar al tope del día', async () => {
  const base = new BaseFalsa();
  cola(base, 4);
  base.lugar = 2;
  const manejar = crearManejador(dependencias(base, apiDeUnaLlamada().cliente));
  const r = await manejar(pedido('/procesar-pendientes'));
  // Dos fotos procesadas; la tercera se tomó, no hubo lugar y volvió a la cola.
  assertEquals(await r.json(), { procesados: 2, errores: 0, quedan: 2, motivo: 'sin_lugar' });
  assertEquals(base.soltadas.length, 1);
});

Deno.test('el secreto se compara entero', () => {
  assertEquals(mismoSecreto('abc', 'abc'), true);
  assertEquals(mismoSecreto('abd', 'abc'), false);
  assertEquals(mismoSecreto('ab', 'abc'), false);
  assertEquals(mismoSecreto('abcd', 'abc'), false);
  assertEquals(mismoSecreto('', 'abc'), false);
});
