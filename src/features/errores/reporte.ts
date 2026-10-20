import { t } from '@/i18n/es-UY';
import type { Plataforma } from '@/types/dominio';

/**
 * "Reportar un error": límites, validación y lo que la app suma sola. Reglas
 * puras, sin React ni Supabase: las prueba __tests__/reporteError.test.ts. La
 * base valida lo mismo en reportar_error (migración 0016) y además limita
 * cuántos se mandan por hora.
 */

/** Los mismos límites que la tabla reportes_errores. */
export const LIMITES_REPORTE = {
  quePasoMinimo: 10,
  quePasoMaximo: 1000,
  queHaciasMaximo: 1000,
  contactoMaximo: 200,
  /** Lo que suma la app: la base lo recorta igual, pero mejor no mandar de más. */
  pantallaAnterior: 300,
  navegador: 500,
  tamanioPantalla: 40,
  version: 80,
} as const;

export type FormularioReporte = { quePaso: string; queHacias: string; contacto: string };
export type CampoReporte = keyof FormularioReporte;
export type ErroresReporte = Partial<Record<CampoReporte, string>>;

/** Qué le falta al formulario. El contacto es solo para quien no tiene cuenta. */
export function validarReporte(formulario: FormularioReporte, conCuenta: boolean): ErroresReporte {
  const errores: ErroresReporte = {};
  const quePaso = formulario.quePaso.trim();
  if (quePaso.length < LIMITES_REPORTE.quePasoMinimo) {
    errores.quePaso = t.errores.formulario.quePasoCorto(LIMITES_REPORTE.quePasoMinimo);
  } else if (quePaso.length > LIMITES_REPORTE.quePasoMaximo) {
    errores.quePaso = t.errores.formulario.demasiadoLargo(LIMITES_REPORTE.quePasoMaximo);
  }
  if (formulario.queHacias.trim().length > LIMITES_REPORTE.queHaciasMaximo) {
    errores.queHacias = t.errores.formulario.demasiadoLargo(LIMITES_REPORTE.queHaciasMaximo);
  }
  const contacto = formulario.contacto.trim();
  if (conCuenta && contacto) {
    errores.contacto = t.errores.formulario.contactoConCuenta;
  } else if (contacto.length > LIMITES_REPORTE.contactoMaximo) {
    errores.contacto = t.errores.formulario.demasiadoLargo(LIMITES_REPORTE.contactoMaximo);
  }
  return errores;
}

/** Lo que hay que saber del dispositivo, ya leído (Platform, navigator, Dimensions). */
export type Dispositivo = {
  pantallaAnterior: string | null;
  userAgent: string | null;
  ancho: number;
  alto: number;
  escala: number;
  plataforma: string;
  version: string;
};

export type DatosDelDispositivo = {
  pantallaAnterior: string | null;
  navegador: string | null;
  tamanioPantalla: string;
  plataforma: Plataforma | null;
  version: string;
};

/** "390×844 @3x": el tamaño de la ventana en puntos y la densidad. */
export function tamanioDePantalla(ancho: number, alto: number, escala: number): string {
  const densidad = Math.round(escala * 100) / 100;
  return `${Math.round(ancho)}×${Math.round(alto)} @${String(densidad).replace('.', ',')}x`;
}

/** Lo que la app suma sola a cada reporte, recortado a lo que guarda la base. */
export function datosDelDispositivo(d: Dispositivo): DatosDelDispositivo {
  const recortar = (texto: string | null, maximo: number) =>
    texto?.trim() ? texto.trim().slice(0, maximo) : null;
  return {
    pantallaAnterior: recortar(d.pantallaAnterior, LIMITES_REPORTE.pantallaAnterior),
    navegador: recortar(d.userAgent, LIMITES_REPORTE.navegador),
    tamanioPantalla: tamanioDePantalla(d.ancho, d.alto, d.escala),
    plataforma:
      d.plataforma === 'web' || d.plataforma === 'ios' || d.plataforma === 'android'
        ? d.plataforma
        : null,
    version: d.version.slice(0, LIMITES_REPORTE.version),
  };
}

/**
 * La versión que se ve en el reporte: la de la app más el commit del deploy
 * (los primeros 7 caracteres) o, si no se sabe, la fecha del build.
 */
export function versionDeLaApp(
  version: string,
  commit: string | undefined,
  fechaBuild: string | undefined,
): string {
  if (commit?.trim()) return `${version} (${commit.trim().slice(0, 7)})`;
  if (fechaBuild?.trim()) return `${version} (build ${fechaBuild.trim()})`;
  return version;
}
