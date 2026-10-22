import { assertEquals } from '@std/assert';

import { procesarAvisos, TANDA } from '../procesar.ts';
import { crearEnviador, type Enviar, importarClaves } from '../push.ts';
import { aviso, BaseFalsa, clavesVapid, ServicioPush, suscriptor } from './ayudas.ts';

const CONVERSACION = '99999999-8888-4777-8666-555555555555';

async function enviadorReal(): Promise<Enviar> {
  const { publica, privada } = await clavesVapid();
  return crearEnviador(await importarClaves(publica, privada), 'https://spot.example');
}

Deno.test('manda cada aviso a los celulares de su persona y guarda el resultado, con la vencida', async () => {
  const servicio = new ServicioPush();
  const celular = await suscriptor();
  const vieja = await suscriptor(); // se desinstaló: el servicio dice 410
  const otraPersona = await suscriptor('https://web.push.apple.com/prueba-iphone');
  servicio.registrar(celular);
  servicio.registrar(vieja, 410);
  servicio.registrar(otraPersona);

  const base = new BaseFalsa();
  const toby = aviso({ suscripciones: [celular.suscripcion, vieja.suscripcion] });
  const mensaje = aviso({
    tipo: 'mensaje',
    evento: null,
    conversacion_id: CONVERSACION,
    suscripciones: [otraPersona.suscripcion],
  });
  base.tandas.push([toby, mensaje]);

  const resumen = await servicio.con(async () =>
    procesarAvisos({ base, enviar: await enviadorReal(), ahora: () => 0, topeMs: 20_000 })
  );

  assertEquals(resumen, { avisos: 2, enviados: 2, vencidas: 1, errores: 0 });
  assertEquals(base.terminados.length, 1);
  assertEquals(
    base.terminados[0].map((r) => [r.aviso_id, r.suscripcion_id, r.resultado]).sort(),
    [
      [toby.aviso_id, celular.suscripcion.id, 'ok'],
      [toby.aviso_id, vieja.suscripcion.id, 'vencida'],
      [mensaje.aviso_id, otraPersona.suscripcion.id, 'ok'],
    ].sort(),
  );
  // Lo que se vio en cada celular.
  const porEndpoint = Object.fromEntries(servicio.recibidos.map((r) => [r.endpoint, r.mensaje.titulo]));
  assertEquals(porEndpoint, {
    [celular.suscripcion.endpoint]: 'Alguien vio a Toby',
    [otraPersona.suscripcion.endpoint]: 'Tenés un mensaje nuevo sobre Toby',
  });
  // Una tanda incompleta: no se vuelve a preguntar.
  assertEquals(base.pedidosPreparar, 1);
});

Deno.test('sin avisos pendientes no manda ni guarda nada', async () => {
  const base = new BaseFalsa();
  let envios = 0;
  const enviar: Enviar = () => {
    envios++;
    return Promise.resolve('ok');
  };
  assertEquals(await procesarAvisos({ base, enviar, ahora: () => 0, topeMs: 1000 }), {
    avisos: 0,
    enviados: 0,
    vencidas: 0,
    errores: 0,
  });
  assertEquals([envios, base.terminados.length], [0, 0]);
});

Deno.test('una tanda llena pide otra; pasado el tope de tiempo, no', async () => {
  const s = await suscriptor();
  const llena = () => Array.from({ length: TANDA }, () => aviso({ suscripciones: [s.suscripcion] }));
  const enviar: Enviar = () => Promise.resolve('ok');

  const base = new BaseFalsa();
  base.tandas.push(llena(), [aviso({ suscripciones: [s.suscripcion] })]);
  assertEquals((await procesarAvisos({ base, enviar, ahora: () => 0, topeMs: 1000 })).avisos, TANDA + 1);
  assertEquals(base.pedidosPreparar, 2);

  const conTope = new BaseFalsa();
  conTope.tandas.push(llena(), llena());
  let reloj = 0;
  const resumen = await procesarAvisos({
    base: conTope,
    enviar: () => {
      reloj += 100;
      return Promise.resolve('ok');
    },
    ahora: () => reloj,
    topeMs: 1000,
  });
  assertEquals(resumen.avisos, TANDA);
  assertEquals(conTope.pedidosPreparar, 1);
});

Deno.test('un envío que tira una excepción queda como error y no corta los demás', async () => {
  const base = new BaseFalsa();
  const a = await suscriptor();
  const b = await suscriptor();
  base.tandas.push([aviso({ suscripciones: [a.suscripcion, b.suscripcion] })]);
  const enviar: Enviar = (s) =>
    s.id === a.suscripcion.id ? Promise.reject(new Error('se cayó')) : Promise.resolve('ok');
  const resumen = await procesarAvisos({ base, enviar, ahora: () => 0, topeMs: 1000 });
  assertEquals(resumen, { avisos: 1, enviados: 1, vencidas: 0, errores: 1 });
  assertEquals(base.terminados[0].map((r) => r.resultado).sort(), ['error', 'ok']);
});
