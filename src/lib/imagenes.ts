import { ENV } from './env';

/**
 * Rutas y URLs de las fotos del bucket "fotos". Es el único lugar con la
 * convención del nombre de las miniaturas: lo usan la app y la función de la
 * vista previa del link (api/), así que no importa nada de React ni de Expo.
 * Comprimir y subir está en subirFotos.ts.
 */

export const BUCKET_FOTOS = 'fotos';

/** Lado de la miniatura cuadrada que se sube junto a cada foto. */
export const LADO_MINIATURA = 320;

/**
 * La miniatura va junto a la original, en la misma carpeta:
 * <uid>/<uuid>.jpg → <uid>/<uuid>.miniatura.jpg. La base solo sabe que una
 * foto y sus variantes comparten la ruta hasta el primer punto (raiz_foto,
 * migración 0012), para no borrar la miniatura de lo que queda publicado.
 */
const SUFIJO_MINIATURA = '.miniatura.jpg';

/** Datos de demo cargados por SQL: una URL https en vez de una ruta del bucket. */
export function esUrlExterna(ruta: string): boolean {
  return /^https?:\/\//.test(ruta);
}

/** Ruta de la miniatura de una foto del bucket, o null si es una URL externa. */
export function rutaMiniatura(ruta: string): string | null {
  if (esUrlExterna(ruta)) return null;
  const punto = ruta.indexOf('.', ruta.lastIndexOf('/') + 1);
  return (punto === -1 ? ruta : ruta.slice(0, punto)) + SUFIJO_MINIATURA;
}

/** URL pública de una ruta del bucket, igual a la que arma supabase-js. */
function urlPublica(ruta: string): string {
  const base = ENV.supabaseUrl.replace(/\/+$/, '');
  return encodeURI(`${base}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta.replace(/^\/+/, '')}`);
}

/** URL pública de una foto. Acepta rutas del bucket o URLs https (datos de demo). */
export function urlFoto(ruta: string): string {
  return esUrlExterna(ruta) ? ruta : urlPublica(ruta);
}

/**
 * URL de la miniatura, o de la original si es una URL externa. Las fotos
 * subidas antes de la Fase 8 no tienen miniatura: quien la muestra pasa a la
 * original si no carga (FotoMiniatura).
 */
export function urlMiniatura(ruta: string): string {
  const miniatura = rutaMiniatura(ruta);
  return miniatura ? urlPublica(miniatura) : ruta;
}
