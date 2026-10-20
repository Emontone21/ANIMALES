import { t } from '@/i18n/es-UY';
import { diaYHora } from '@/lib/fechas';

/**
 * Moderación › Reconocimiento: qué decir de cada dato. Lo usa solo esa
 * sección, que va en un bloque aparte.
 */

/** Lo que devuelve procesar_pendientes_vision (la misma llamada que el cron). */
export type ResultadoProcesar = 'enviado' | 'sin_pendientes' | 'sin_configurar';

export function resultadoProcesar(valor: string): ResultadoProcesar {
  return valor === 'sin_pendientes' || valor === 'sin_configurar' ? valor : 'enviado';
}

export function avisoProcesar(resultado: ResultadoProcesar): {
  texto: string;
  tipo: 'exito' | 'info';
} {
  if (resultado === 'enviado') return { texto: t.reconocimiento.enviado, tipo: 'exito' };
  if (resultado === 'sin_pendientes')
    return { texto: t.reconocimiento.sinPendientes, tipo: 'info' };
  return { texto: t.reconocimiento.sinConfigurarAyuda, tipo: 'info' };
}

/** "Hoy a las 14:05", o "Todavía ninguna" si nunca pasó. */
export function cuando(fecha: string | null, ahora: Date = new Date()): string {
  return fecha ? diaYHora(fecha, ahora) : t.reconocimiento.nunca;
}
