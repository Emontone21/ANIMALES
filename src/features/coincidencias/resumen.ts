import { t } from '@/i18n/es-UY';
import type { CoincidenciaDetalle, Especie, TipoReporte } from '@/types/dominio';

/**
 * Qué dice cada coincidencia en "Posibles coincidencias" (DISENO.md, 6.10).
 * Las del reconocimiento con IA muestran el motivo que dio Claude en vez del
 * porcentaje ("Mismo collar rojo y mancha blanca en el pecho."); las de antes
 * (embeddings, sin motivo) siguen con el porcentaje de parecido.
 */
export function resumenCoincidencia(
  c: Pick<CoincidenciaDetalle, 'motivo' | 'similitud' | 'distancia_m' | 'horas_diferencia'>,
  otro: { especie: Especie; tipo: TipoReporte; nombre: string | null },
): { oracion: string; motivo: string | null } {
  const km = c.distancia_m === null ? null : c.distancia_m / 1000;
  const tiempo =
    c.horas_diferencia === null ? '' : ` ${t.coincidencias.tiempoOracion(c.horas_diferencia)}`;
  const motivo = c.motivo?.trim() ? conPunto(c.motivo.trim()) : null;
  const oracion = motivo
    ? t.coincidencias.quienYDonde(otro.especie, otro.tipo, otro.nombre, km)
    : t.coincidencias.resumen(
        otro.especie,
        otro.tipo,
        otro.nombre,
        km,
        Math.round(c.similitud * 100),
      );
  return { oracion: oracion + tiempo, motivo };
}

/** El motivo es una frase: termina en punto (o en lo que ya tenga). */
function conPunto(texto: string): string {
  return /[.!?…]$/.test(texto) ? texto : `${texto}.`;
}
