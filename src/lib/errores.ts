import { t } from '@/i18n/es-UY';

/**
 * Qué texto mostrar cuando algo falla. Las pantallas nunca muestran el
 * mensaje de un error tal cual: los de la red, de PostgREST o de Storage
 * llegan en inglés ("Failed to fetch", "invalid input syntax for type uuid").
 * Se muestran los textos de la app y los que escribe la base en sus RPC; el
 * resto, un texto de respaldo.
 */

/** Un error cuyo mensaje ya sale de es-UY.ts y se puede mostrar. */
export class ErrorVisible extends Error {}

/** Códigos con los que las RPC de la base avisan algo, con su texto en español. */
const CODIGOS_DE_LA_BASE = new Set(['42501', '22023', 'P0002', 'P0001']);

/** Mensajes de Postgres con esos mismos códigos que no escribimos nosotros. */
const MENSAJES_DE_POSTGRES =
  /^(permission denied|new row violates|query returned|could not|invalid|null value|duplicate key|value too long|violates)/i;

const ERROR_DE_RED =
  /failed to fetch|load failed|network ?request failed|networkerror|network error|fetch failed|err_network|timeout|timed out/i;

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const { message } = error as { message: unknown };
    return typeof message === 'string' ? message : '';
  }
  return '';
}

function codigoDe(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : '';
  }
  return '';
}

/** Sin conexión, o el servidor no respondió. */
export function esErrorDeRed(error: unknown): boolean {
  return ERROR_DE_RED.test(mensajeDe(error));
}

/**
 * El texto para mostrar. `respaldo` es lo que se dice si el error no trae un
 * texto propio: por defecto, "Algo salió mal".
 */
export function mensajeDeError(error: unknown, respaldo: string = t.comunes.errorGenerico): string {
  if (!error) return respaldo;
  const mensaje = mensajeDe(error).trim();
  if (error instanceof ErrorVisible) return mensaje || respaldo;
  if (esErrorDeRed(error)) return t.comunes.sinConexion;
  if (
    CODIGOS_DE_LA_BASE.has(codigoDe(error)) &&
    mensaje !== '' &&
    !MENSAJES_DE_POSTGRES.test(mensaje)
  ) {
    return mensaje;
  }
  return respaldo;
}
