import { assertEquals, assertStringIncludes } from '@std/assert';

import { HERRAMIENTA_COMPARAR, HERRAMIENTA_DESCRIBIR } from '../claude.ts';
import { procesarFoto } from '../procesar.ts';
import {
  apiFalsa,
  BaseFalsa,
  candidato,
  conHerramienta,
  dependencias,
  DESCRIPCION_PERRO,
  errorDeApi,
  type PedidoClaude,
  pendiente,
  soloTexto,
  SUPABASE,
  urlsDeImagenes,
} from './ayudas.ts';

const ID = pendiente().avistamiento_id;
const A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MINIATURA_NUEVA = `${SUPABASE}/storage/v1/object/public/fotos/uid-familia/foto-nueva.miniatura.jpg`;

/** La API responde a describir y a comparar según la herramienta del pedido. */
function apiQueResponde(resultados: unknown[] = [], descripcion: unknown = DESCRIPCION_PERRO) {
  return apiFalsa((pedido: PedidoClaude) => {
    const herramienta = (pedido.tools?.[0] as { name: string }).name;
    return herramienta === HERRAMIENTA_DESCRIBIR
      ? conHerramienta(HERRAMIENTA_DESCRIBIR, descripcion, { input_tokens: 1200, output_tokens: 250 })
      : conHerramienta(HERRAMIENTA_COMPARAR, { resultados }, { input_tokens: 4000, output_tokens: 1300 });
  });
}

const resultado = (candidatoEtiqueta: string, confianza: number) => ({
  candidato: candidatoEtiqueta,
  confianza,
  veredicto: confianza >= 70 ? 'mismo' : 'distinto',
  motivo: confianza >= 70 ? 'Mismo collar rojo y mancha blanca en el pecho' : 'Otra forma de orejas',
  coinciden: [],
  difieren: [],
});

Deno.test('una foto nueva: la describe, la compara con los candidatos y guarda con el caso de cada etiqueta', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  base.candidatos_ = [candidato(A), candidato(B, { descripcion: DESCRIPCION_PERRO })];
  const api = apiQueResponde([resultado('C2', 20), resultado('C1', 85)]);

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: true, comparado: true, coincidencias: 1 });
  assertEquals(api.pedidos.length, 2);
  // Describe la miniatura de la foto nueva y compara con la miniatura de cada candidato.
  assertEquals(urlsDeImagenes(api.pedidos[0]), [MINIATURA_NUEVA]);
  assertEquals(urlsDeImagenes(api.pedidos[1]), [
    MINIATURA_NUEVA,
    `${SUPABASE}/storage/v1/object/public/fotos/uid-hallazgo/${A}.miniatura.jpg`,
    `${SUPABASE}/storage/v1/object/public/fotos/uid-hallazgo/${B}.miniatura.jpg`,
  ]);
  assertEquals(base.descripciones, [{
    id: ID,
    descripcion: DESCRIPCION_PERRO,
    tokensEntrada: 1200,
    tokensSalida: 250,
  }]);
  assertEquals(
    base.comparaciones[0].resultados.map((x) => [x.animal_id, x.confianza]),
    [[B, 20], [A, 85]],
  );
  // Las dos llamadas quedan registradas, con tokens y costo.
  assertEquals(
    base.llamadas.map((l) => [l.tipo, l.resultado, l.tokensEntrada, l.tokensSalida, l.costo]),
    [
      ['describir', 'ok', 1200, 250, 0.000245],
      ['comparar', 'ok', 4000, 1300, 0.00105],
    ],
  );
  assertEquals(base.errores, []);
});

Deno.test('sin miniatura (fotos de antes de la Fase 8), manda la original; un candidato sin foto queda afuera', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  base.candidatos_ = [candidato(A), candidato(B)];
  const api = apiQueResponde([resultado('C1', 90)]);
  const existe = (url: string) => Promise.resolve(!url.endsWith('foto-nueva.miniatura.jpg') && !url.includes(B));

  const r = await procesarFoto(dependencias(base, api.cliente, { existe }), await base.config(), ID);

  assertEquals(r.procesado, true);
  assertEquals(urlsDeImagenes(api.pedidos[0]), [
    `${SUPABASE}/storage/v1/object/public/fotos/uid-familia/foto-nueva.jpg`,
  ]);
  assertEquals(urlsDeImagenes(api.pedidos[1]).length, 2);
  assertEquals(base.comparaciones[0].resultados.map((x) => x.animal_id), [A]);
});

Deno.test('si no hay animal, o es de otra especie, no se compara', async () => {
  for (
    const descripcion of [
      { ...DESCRIPCION_PERRO, especie: 'gato' },
      { ...DESCRIPCION_PERRO, hay_animal: false, especie: 'ninguno' },
    ]
  ) {
    const base = new BaseFalsa();
    base.agregar(pendiente());
    base.candidatos_ = [candidato(A)];
    const api = apiQueResponde([], descripcion);

    const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

    assertEquals(r, { procesado: true, comparado: false, coincidencias: 0, motivo: 'sin_animal_de_la_especie' });
    assertEquals(api.pedidos.length, 1);
    assertEquals(base.hechas, [ID]);
  }
});

Deno.test('una foto ya descripta (un reintento) no se vuelve a describir', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente({ descripcion: DESCRIPCION_PERRO }));
  base.candidatos_ = [candidato(A)];
  const api = apiQueResponde([resultado('C1', 40)]);

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r.procesado, true);
  assertEquals(api.pedidos.map((p) => (p.tools?.[0] as { name: string }).name), [HERRAMIENTA_COMPARAR]);
  assertEquals(base.descripciones, []);
});

Deno.test('sin candidatos, o con el caso cerrado, sale de la cola sin comparar', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const api = apiQueResponde();
  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);
  assertEquals(r, { procesado: true, comparado: false, coincidencias: 0, motivo: 'sin_candidatos' });
  assertEquals(api.pedidos.length, 1);

  const cerrada = new BaseFalsa();
  cerrada.agregar(pendiente({ caso_abierto: false }));
  const api2 = apiQueResponde();
  const r2 = await procesarFoto(dependencias(cerrada, api2.cliente), await cerrada.config(), ID);
  assertEquals(r2, { procesado: true, comparado: false, coincidencias: 0, motivo: 'caso_cerrado' });
  assertEquals(api2.pedidos.length, 0);
  assertEquals(cerrada.hechas, [ID]);
});

Deno.test('apagado, pausado o en el tope: no toma la foto ni llama', async () => {
  for (const estado of ['apagado', 'pausado', 'tope_diario'] as const) {
    const base = new BaseFalsa();
    base.agregar(pendiente());
    const api = apiQueResponde();
    const r = await procesarFoto(dependencias(base, api.cliente), { ...(await base.config()), estado }, ID);
    assertEquals(r, { procesado: false, motivo: estado });
    assertEquals(base.pendientes.size, 1);
    assertEquals(api.pedidos.length, 0);
  }
});

Deno.test('si justo se llegó al tope al reservar, la foto vuelve a esperar sin gastar un intento', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  base.candidatos_ = [candidato(A)];
  base.lugar = 1; // alcanza para describir, no para comparar
  const api = apiQueResponde([resultado('C1', 90)]);

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: false, motivo: 'sin_lugar' });
  assertEquals(api.pedidos.length, 1);
  assertEquals(base.soltadas, [ID]);
  assertEquals(base.errores, []);
});

Deno.test('sin crédito: registra la llamada, marca el error (se reintenta) y pausa', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const api = apiFalsa(() => errorDeApi(402, 'billing_error'));

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: false, motivo: 'error', error: 'sin_credito' });
  assertEquals(base.llamadas.map((l) => [l.resultado, l.costo, l.detalle]), [['sin_credito', 0, 'billing_error']]);
  assertEquals(base.errores.length, 1);
  assertStringIncludes(base.errores[0].error, 'sin_credito');
  assertEquals(base.pausas, ['sin_credito']);
});

Deno.test('límite (429) y sobrecarga (529): error con reintento, sin pausar', async () => {
  for (
    const [estado, tipo, resultado] of [
      [429, 'rate_limit_error', 'limite'],
      [529, 'overloaded_error', 'sobrecarga'],
    ] as const
  ) {
    const base = new BaseFalsa();
    base.agregar(pendiente());
    const api = apiFalsa(() => errorDeApi(estado, tipo));
    const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);
    assertEquals(r, { procesado: false, motivo: 'error', error: resultado });
    assertEquals(base.llamadas[0].resultado, resultado);
    assertEquals(base.errores.length, 1);
    assertEquals(base.pausas, []);
  }
});

Deno.test('una respuesta que no valida cuenta como error con reintento, con su costo', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const api = apiFalsa(() => soloTexto('Parece un perro negro.'));

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: false, motivo: 'error', error: 'invalida' });
  assertEquals(base.llamadas.map((l) => [l.resultado, l.detalle, l.tokensEntrada]), [[
    'invalida',
    'sin herramienta',
    900,
  ]]);
  assertEquals(base.errores.length, 1);
  assertEquals(base.descripciones, []);
});

Deno.test('una foto que no está pendiente, o que no se puede ver, no llama a la API', async () => {
  const base = new BaseFalsa();
  const api = apiQueResponde();
  assertEquals(await procesarFoto(dependencias(base, api.cliente), await base.config(), ID), {
    procesado: false,
    motivo: 'no_pendiente',
  });

  base.agregar(pendiente());
  const r = await procesarFoto(
    dependencias(base, api.cliente, { existe: () => Promise.resolve(false) }),
    await base.config(),
    ID,
  );
  assertEquals(r, { procesado: false, motivo: 'error', error: 'foto_no_disponible' });
  assertEquals(api.pedidos.length, 0);
  assertEquals(base.errores, [{ id: ID, error: 'foto no disponible' }]);
});

Deno.test('si falla la base a mitad de camino, la foto queda con error para reintentarla', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  base.falla.candidatos = new Error('HTTP 500');
  const api = apiQueResponde();

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: false, motivo: 'error', error: 'interno' });
  assertEquals(base.errores, [{ id: ID, error: 'error interno' }]);
});
