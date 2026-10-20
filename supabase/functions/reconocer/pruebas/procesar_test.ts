import { assertEquals, assertStringIncludes } from '@std/assert';

import { HERRAMIENTA_COMPARAR, HERRAMIENTA_DESCRIBIR } from '../claude.ts';
import type { FotoBajada } from '../descargar.ts';
import { procesarFoto, TOPE_PEDIDO_BASE64 } from '../procesar.ts';
import {
  apiFalsa,
  BaseFalsa,
  candidato,
  conHerramienta,
  dependencias,
  DESCRIPCION_PERRO,
  errorDeApi,
  imagenesDe,
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

Deno.test('una foto de otro sitio la baja la función y va dentro del pedido; una que no se pudo bajar queda afuera', async () => {
  const PERRO = 'https://placedog.net/640/480?id=12';
  const base = new BaseFalsa();
  base.agregar(pendiente({ foto_path: PERRO }));
  // A es del bucket; B y C, de otros sitios (C no se puede bajar).
  const C = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  base.candidatos_ = [
    candidato(A),
    candidato(B, { foto_path: PERRO }),
    candidato(C, { foto_path: 'https://cataas.com/cat?id=1' }),
  ];
  const api = apiQueResponde([resultado('C1', 10), resultado('C2', 90)]);
  const bajadas: string[] = [];
  const bajar = (url: string): Promise<FotoBajada | null> => {
    bajadas.push(url);
    return Promise.resolve(url === PERRO ? { media_type: 'image/jpeg', data: '/9j/4AAQ', bytes: 6 } : null);
  };

  const r = await procesarFoto(dependencias(base, api.cliente, { bajar }), await base.config(), ID);

  assertEquals(r, { procesado: true, comparado: true, coincidencias: 1 });
  // Las fotos de otros sitios se bajan (nunca las del bucket) y llegan en base64 con el tipo de sus bytes.
  assertEquals(bajadas.sort(), [PERRO, PERRO, 'https://cataas.com/cat?id=1'].sort());
  assertEquals(imagenesDe(api.pedidos[0]), ['base64:image/jpeg']);
  assertEquals(imagenesDe(api.pedidos[1]), [
    'base64:image/jpeg',
    `url:${SUPABASE}/storage/v1/object/public/fotos/uid-hallazgo/${A}.miniatura.jpg`,
    'base64:image/jpeg',
  ]);
  // C, sin foto, no se comparó: C1 es A y C2 es B.
  assertEquals(base.comparaciones[0].resultados.map((x) => [x.animal_id, x.confianza]), [[A, 10], [B, 90]]);
});

Deno.test('las fotos bajadas no pasan de 20 MB por pedido: los candidatos que no entran quedan afuera', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente({ foto_path: 'https://otro.sitio/nueva.jpg' }));
  base.candidatos_ = [
    candidato(A, { foto_path: 'https://otro.sitio/a.jpg' }),
    candidato(B, { foto_path: 'https://otro.sitio/b.jpg' }),
  ];
  const api = apiQueResponde([resultado('C1', 10)]);
  // Cada una ocupa un poco más de la tercera parte del tope: entran la nueva y una más.
  const grande = 'A'.repeat(Math.floor(TOPE_PEDIDO_BASE64 / 3) + 1);
  const bajar = () => Promise.resolve<FotoBajada>({ media_type: 'image/png', data: grande, bytes: 0 });

  const r = await procesarFoto(dependencias(base, api.cliente, { bajar }), await base.config(), ID);

  assertEquals(r.procesado, true);
  assertEquals(imagenesDe(api.pedidos[1]), ['base64:image/png', 'base64:image/png']);
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
  assertEquals(base.llamadas.map((l) => [l.resultado, l.costo, l.detalle]), [[
    'sin_credito',
    0,
    'billing_error: mensaje en inglés de la API',
  ]]);
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

Deno.test('el texto del error de la API queda en la llamada, limpio; en la cola, solo el código', async () => {
  const base = new BaseFalsa();
  base.agregar(pendiente());
  const mensaje = 'Unable to download https://proyecto.supabase.co/storage/v1/object/public/fotos/uid/x.jpg ' +
    'for sk-ant-api03-abc123 (escribile a ana@correo.com o al 099 123 456). ' + 'x'.repeat(400);
  const api = apiFalsa(() => errorDeApi(400, 'invalid_request_error', mensaje, 'req_011CPrueba'));

  const r = await procesarFoto(dependencias(base, api.cliente), await base.config(), ID);

  assertEquals(r, { procesado: false, motivo: 'error', error: 'error' });
  const detalle = base.llamadas[0].detalle ?? '';
  assertEquals(detalle.length, 300);
  assertStringIncludes(
    detalle,
    'invalid_request_error: Unable to download [url] for [clave] (escribile a [email] o al [número]). xxx',
  );
  for (const dato of ['supabase.co', 'sk-ant', 'ana@', '099']) assertEquals(detalle.includes(dato), false, dato);
  assertEquals(base.errores, [{ id: ID, error: 'describir: error (invalid_request_error)' }]);
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

Deno.test('una foto que no está pendiente, o de otro sitio que no se pudo bajar, no llama a la API', async () => {
  const base = new BaseFalsa();
  const api = apiQueResponde();
  assertEquals(await procesarFoto(dependencias(base, api.cliente), await base.config(), ID), {
    procesado: false,
    motivo: 'no_pendiente',
  });

  base.agregar(pendiente({ foto_path: 'https://cataas.com/cat?id=1' }));
  const r = await procesarFoto(
    dependencias(base, api.cliente, { bajar: () => Promise.resolve(null) }),
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
