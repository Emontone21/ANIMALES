/**
 * La ruta de la función: POST, con el header X-Avisar-Secret igual a
 * config_app.avisar_secret. La llama la base con pg_net (llamar_avisar), sin
 * cuerpo: la función toma lo pendiente. verify_jwt está apagado
 * (supabase/config.toml): Postgres no tiene un JWT de usuario.
 */

import { type Dependencias, procesarAvisos } from './procesar.ts';

/**
 * El secreto son 32 bytes en hexadecimal, como el de reconocer. Un header con
 * otra forma se rechaza sin consultar la base.
 */
const FORMA_SECRETO = /^[0-9a-f]{64}$/i;

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Compara sin cortar en el primer carácter distinto (no deja adivinar el secreto por el tiempo). */
export function mismoSecreto(recibido: string, esperado: string): boolean {
  const a = new TextEncoder().encode(recibido);
  const b = new TextEncoder().encode(esperado);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferencia |= (a[i] ?? 0) ^ b[i];
  return diferencia === 0;
}

export function crearManejador(d: Dependencias): (pedido: Request) => Promise<Response> {
  return async (pedido) => {
    if (pedido.method !== 'POST') return json({ error: 'metodo' }, 405);
    const recibido = pedido.headers.get('x-avisar-secret') ?? '';
    if (!FORMA_SECRETO.test(recibido)) return json({ error: 'no_autorizado' }, 401);

    let config;
    try {
      config = await d.base.config();
    } catch {
      return json({ error: 'base' }, 503);
    }
    // Sin secreto cargado no atiende a nadie.
    if (!config.secreto || !mismoSecreto(recibido, config.secreto)) {
      return json({ error: 'no_autorizado' }, 401);
    }
    // Sin las claves VAPID no se puede mandar nada: lo pendiente espera.
    if (!d.enviar) return json({ error: 'faltan las claves VAPID' }, 503);

    try {
      return json(await procesarAvisos({ ...d, enviar: d.enviar }));
    } catch {
      return json({ error: 'base' }, 503);
    }
  };
}
