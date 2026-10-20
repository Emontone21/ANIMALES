/**
 * Las rutas de la función, con el mismo contrato que el servicio anterior
 * (services/vision): POST /procesar {"avistamiento_id": …} y POST
 * /procesar-pendientes. Las llama la base con pg_net (llamar_vision), con el
 * header X-Vision-Secret igual a config_app.vision_secret. verify_jwt está
 * apagado (supabase/config.toml): Postgres no tiene un JWT de usuario.
 */

import { type Dependencias, procesarFoto, vaciarCola } from './procesar.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let config;
    try {
      config = await d.base.config();
    } catch {
      return json({ error: 'base' }, 503);
    }
    // Sin secreto cargado no atiende a nadie.
    if (!config.secreto || !mismoSecreto(pedido.headers.get('x-vision-secret') ?? '', config.secreto)) {
      return json({ error: 'no_autorizado' }, 401);
    }
    if (!d.claude) return json({ error: 'falta ANTHROPIC_API_KEY' }, 503);

    const ruta = new URL(pedido.url).pathname.replace(/\/+$/, '');
    if (ruta.endsWith('/procesar-pendientes')) {
      return json(await vaciarCola(d));
    }
    if (ruta.endsWith('/procesar')) {
      const cuerpo: unknown = await pedido.json().catch(() => null);
      const id = typeof cuerpo === 'object' && cuerpo !== null
        ? (cuerpo as Record<string, unknown>).avistamiento_id
        : null;
      if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'avistamiento_id' }, 400);
      return json(await procesarFoto(d, config, id));
    }
    return json({ error: 'ruta' }, 404);
  };
}
