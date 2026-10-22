/**
 * Una vuelta de la función: toma los avisos pendientes (preparar_avisos_push
 * ya aplicó el tope, los grupos, los bloqueos y los casos ocultos), manda cada
 * uno a los celulares de su persona y guarda el resultado, que borra las
 * suscripciones vencidas. Todo dentro del pedido, con tope de tiempo: lo que
 * quede lo toma el próximo aviso (o, si pasa una hora, se descarta: ya está
 * en Actividad).
 */

import { armarMensaje } from './aviso.ts';
import type { Base, ResultadoParaGuardar } from './base.ts';
import type { Enviar } from './push.ts';

export type Dependencias = {
  base: Base;
  /** null: faltan las claves VAPID. */
  enviar: Enviar | null;
  ahora: () => number;
  /** Pasado este tiempo no se toma otra tanda. */
  topeMs: number;
};

export type Resumen = { avisos: number; enviados: number; vencidas: number; errores: number };

/** Avisos por tanda, y cuántos envíos a la vez. */
export const TANDA = 50;
const A_LA_VEZ = 10;

async function enTandas<T, R>(items: T[], tamanio: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < items.length; i += tamanio) {
    salida.push(...(await Promise.all(items.slice(i, i + tamanio).map(fn))));
  }
  return salida;
}

export async function procesarAvisos(d: Dependencias & { enviar: Enviar }): Promise<Resumen> {
  const inicio = d.ahora();
  const resumen: Resumen = { avisos: 0, enviados: 0, vencidas: 0, errores: 0 };
  while (d.ahora() - inicio < d.topeMs) {
    const avisos = await d.base.preparar(TANDA);
    if (avisos.length === 0) break;
    const envios = avisos.flatMap((aviso) => {
      const { mensaje, opciones } = armarMensaje(aviso);
      return aviso.suscripciones.map((suscripcion) => ({ aviso, suscripcion, mensaje, opciones }));
    });
    const resultados: ResultadoParaGuardar[] = await enTandas(envios, A_LA_VEZ, async (e) => ({
      aviso_id: e.aviso.aviso_id,
      suscripcion_id: e.suscripcion.id,
      resultado: await d.enviar(e.suscripcion, e.mensaje, e.opciones).catch(() => 'error' as const),
    }));
    await d.base.terminar(resultados);
    resumen.avisos += avisos.length;
    for (const r of resultados) {
      if (r.resultado === 'ok') resumen.enviados++;
      else if (r.resultado === 'vencida') resumen.vencidas++;
      else resumen.errores++;
    }
    if (avisos.length < TANDA) break;
  }
  return resumen;
}
