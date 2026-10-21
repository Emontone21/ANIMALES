/**
 * La conversación abierta pide solo lo nuevo (M20): desde el último mensaje que
 * tiene, con un margen para atrás, y lo suma a lo que ya tenía.
 *
 * El margen cubre un mensaje que se guarda con una hora apenas anterior al
 * último que ya llegó (created_at es la hora en que empezó su transacción, y
 * dos mensajes casi simultáneos pueden terminar de guardarse en otro orden).
 * Lo que vuelve a llegar por el margen se reemplaza por id, sin duplicarse.
 */

export const MARGEN_MS = 10_000;

type ConFecha = { id: string; created_at: string };

/** Milisegundos de una fecha de Postgres ("…T12:28:08.474245+00:00"), sin depender de cómo cada motor lee los microsegundos. */
export function milisegundos(fecha: string): number {
  return Date.parse(fecha.replace(/(\.\d{3})\d+/, '$1'));
}

/** Desde cuándo pedir: el último mensaje menos el margen, o null si no hay ninguno (se pide todo). */
export function desdeParaPedir(previos: readonly ConFecha[] | undefined): string | null {
  if (!previos?.length) return null;
  const ultimo = Math.max(...previos.map((m) => milisegundos(m.created_at)));
  return new Date(ultimo - MARGEN_MS).toISOString();
}

/** Lo que había más lo que llegó, sin repetir ids y en orden de llegada. */
export function sumarMensajes<T extends ConFecha>(
  previos: readonly T[],
  nuevos: readonly T[],
): T[] {
  const porId = new Map(previos.map((m) => [m.id, m]));
  for (const m of nuevos) porId.set(m.id, m);
  return [...porId.values()].sort(
    (a, b) => milisegundos(a.created_at) - milisegundos(b.created_at) || a.id.localeCompare(b.id),
  );
}

/** Los mensajes ajenos sin leer, marcados como leídos en la caché (después de marcarLeidos). */
export function marcarLeidosEnCache<
  T extends ConFecha & { emisor_id: string; leido_en: string | null },
>(mensajes: readonly T[], miId: string, cuando: string): T[] {
  return mensajes.map((m) =>
    m.emisor_id !== miId && !m.leido_en ? { ...m, leido_en: cuando } : m,
  );
}
