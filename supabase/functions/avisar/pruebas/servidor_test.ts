import { assertEquals } from '@std/assert';

import type { Dependencias } from '../procesar.ts';
import type { Enviar } from '../push.ts';
import { crearManejador, mismoSecreto } from '../servidor.ts';
import { aviso, BaseFalsa, SECRETO, suscriptor } from './ayudas.ts';

const URL_FUNCION = 'https://proyecto.supabase.co/functions/v1/avisar';

function pedido(secreto: string | null = SECRETO, metodo = 'POST'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secreto !== null) headers['X-Avisar-Secret'] = secreto;
  return new Request(URL_FUNCION, { method: metodo, headers, body: metodo === 'POST' ? '{}' : undefined });
}

const siempreOk: Enviar = () => Promise.resolve('ok');

function dependencias(base: BaseFalsa, enviar: Enviar | null = siempreOk): Dependencias {
  return { base, enviar, ahora: () => 0, topeMs: 20_000 };
}

Deno.test('solo POST', async () => {
  const manejar = crearManejador(dependencias(new BaseFalsa()));
  assertEquals((await manejar(pedido(SECRETO, 'GET'))).status, 405);
});

Deno.test('un header sin la forma del secreto se rechaza sin consultar la base', async () => {
  const base = new BaseFalsa();
  const manejar = crearManejador(dependencias(base));
  for (const secreto of [null, '', 'otro', SECRETO.slice(1), `${SECRETO}0`, `${SECRETO.slice(1)}g`]) {
    assertEquals((await manejar(pedido(secreto))).status, 401);
  }
  assertEquals(base.consultasConfig, 0);
});

Deno.test('con otro secreto, o sin secreto cargado, no atiende ni toca la cola', async () => {
  const base = new BaseFalsa();
  const manejar = crearManejador(dependencias(base));
  assertEquals((await manejar(pedido('f'.repeat(64)))).status, 401);
  base.config_.secreto = '';
  assertEquals((await manejar(pedido(SECRETO))).status, 401);
  assertEquals(base.pedidosPreparar, 0);
  assertEquals(mismoSecreto(SECRETO, SECRETO), true);
  assertEquals(mismoSecreto(SECRETO, SECRETO.slice(1)), false);
});

Deno.test('sin las claves VAPID responde 503 y deja lo pendiente', async () => {
  const base = new BaseFalsa();
  base.tandas.push([aviso()]);
  const respuesta = await crearManejador(dependencias(base, null))(pedido());
  assertEquals(respuesta.status, 503);
  assertEquals(base.pedidosPreparar, 0);
});

Deno.test('con el secreto manda lo pendiente y devuelve el resumen', async () => {
  const base = new BaseFalsa();
  const s = await suscriptor();
  base.tandas.push([aviso({ suscripciones: [s.suscripcion] })]);
  const respuesta = await crearManejador(dependencias(base))(pedido(SECRETO.toUpperCase().toLowerCase()));
  assertEquals(respuesta.status, 200);
  assertEquals(await respuesta.json(), { avisos: 1, enviados: 1, vencidas: 0, errores: 0 });
});

Deno.test('si la base falla, 503 sin detalles', async () => {
  const base = new BaseFalsa();
  base.preparar = () => Promise.reject(new Error('caída con datos'));
  const respuesta = await crearManejador(dependencias(base))(pedido());
  assertEquals(respuesta.status, 503);
  assertEquals(await respuesta.json(), { error: 'base' });
});
