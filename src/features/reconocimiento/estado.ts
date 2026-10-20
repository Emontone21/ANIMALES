import { t } from '@/i18n/es-UY';
import { diaYHora } from '@/lib/fechas';
import type { ErrorLlamadaIa, EstadoReconocimiento, LlamadaIa } from '@/types/dominio';

/**
 * Moderación › Reconocimiento: qué decir de cada dato. Lo usa solo esa
 * sección, que va en un bloque aparte.
 */

/** Lo que devuelven procesar_pendientes_vision y reactivar_reconocimiento (despertar_vision). */
export type ResultadoProcesar =
  'enviado' | 'sin_pendientes' | 'sin_configurar' | 'apagado' | 'pausado' | 'tope_diario';

const RESULTADOS: readonly ResultadoProcesar[] = [
  'enviado',
  'sin_pendientes',
  'sin_configurar',
  'apagado',
  'pausado',
  'tope_diario',
];

export function resultadoProcesar(valor: string): ResultadoProcesar {
  return (RESULTADOS as readonly string[]).includes(valor)
    ? (valor as ResultadoProcesar)
    : 'enviado';
}

export function avisoProcesar(resultado: ResultadoProcesar): {
  texto: string;
  tipo: 'exito' | 'info';
} {
  switch (resultado) {
    case 'enviado':
      return { texto: t.reconocimiento.enviado, tipo: 'exito' };
    case 'sin_pendientes':
      return { texto: t.reconocimiento.sinPendientes, tipo: 'info' };
    case 'apagado':
      return { texto: t.reconocimiento.apagadoAyuda, tipo: 'info' };
    case 'pausado':
      return { texto: t.reconocimiento.pausadoAyuda, tipo: 'info' };
    case 'tope_diario':
      return { texto: t.reconocimiento.topeAlcanzado, tipo: 'info' };
    default:
      return { texto: t.reconocimiento.sinConfigurarAyuda, tipo: 'info' };
  }
}

/** Después de Reactivar: listo si quedó andando; si no, por qué no. */
export function avisoReactivar(resultado: ResultadoProcesar): {
  texto: string;
  tipo: 'exito' | 'info';
} {
  return resultado === 'enviado' || resultado === 'sin_pendientes'
    ? { texto: t.reconocimiento.reactivado, tipo: 'exito' }
    : avisoProcesar(resultado);
}

/** Lo primero que hay que saber: sin configurar, apagado, pausado o andando. */
export type EstadoGeneral = 'sin_configurar' | 'apagado' | 'pausado' | 'configurado';

export function estadoGeneral(
  e: Pick<EstadoReconocimiento, 'configurado' | 'activa' | 'pausa'>,
): EstadoGeneral {
  if (!e.configurado) return 'sin_configurar';
  if (!e.activa) return 'apagado';
  if (e.pausa) return 'pausado';
  return 'configurado';
}

/** "Procesar pendientes ahora" solo tiene sentido si la función puede llamar a la API. */
export function puedeProcesar(e: Pick<EstadoReconocimiento, 'configurado' | 'activa' | 'pausa'>) {
  return estadoGeneral(e) === 'configurado';
}

/** La etiqueta del estado y la ayuda que va debajo (null si anda). */
export function etiquetaEstado(estado: EstadoGeneral): {
  texto: string;
  fondo: 'primarioSuave' | 'avisoFondo' | 'peligroSuave';
  color: 'textoPrimarioSuave' | 'texto' | 'peligro';
  ayuda: string | null;
} {
  switch (estado) {
    case 'configurado':
      return {
        texto: t.reconocimiento.configurado,
        fondo: 'primarioSuave',
        color: 'textoPrimarioSuave',
        ayuda: null,
      };
    case 'apagado':
      return {
        texto: t.reconocimiento.apagado,
        fondo: 'avisoFondo',
        color: 'texto',
        ayuda: t.reconocimiento.apagadoAyuda,
      };
    case 'pausado':
      return {
        texto: t.reconocimiento.pausado,
        fondo: 'peligroSuave',
        color: 'peligro',
        ayuda: t.reconocimiento.pausadoAyuda,
      };
    default:
      return {
        texto: t.reconocimiento.sinConfigurar,
        fondo: 'avisoFondo',
        color: 'texto',
        ayuda: t.reconocimiento.sinConfigurarAyuda,
      };
  }
}

/** "Hoy a las 14:05", o "Todavía ninguna" si nunca pasó. */
export function cuando(fecha: string | null, ahora: Date = new Date()): string {
  return fecha ? diaYHora(fecha, ahora) : t.reconocimiento.nunca;
}

/** Una llamada que no anduvo: "Hoy a las 14:05 · Comparar · Sin crédito". */
export function filaError(
  llamada: Pick<LlamadaIa, 'created_at' | 'tipo' | 'resultado'>,
  ahora: Date = new Date(),
): string {
  const error = t.reconocimiento.errorLlamada[llamada.resultado as ErrorLlamadaIa] ?? '';
  return t.reconocimiento.filaError(
    diaYHora(llamada.created_at, ahora),
    t.reconocimiento.tipoLlamada[llamada.tipo],
    error || t.reconocimiento.errorLlamada.error,
  );
}

/** Si ya se llegó al tope de llamadas del día. */
export function enElTope(e: Pick<EstadoReconocimiento, 'llamadas_hoy' | 'tope_diario'>): boolean {
  return e.llamadas_hoy >= e.tope_diario;
}
