/**
 * Rutas y URLs públicas de las fotos del bucket "fotos", para mandarlas a
 * Claude por URL.
 *
 * Es una copia de rutaMiniatura y la URL pública de src/lib/imagenes.ts, el
 * único lugar con la convención del nombre de las miniaturas: Supabase
 * despliega la función solo con lo que hay en supabase/functions, así que no
 * puede importar de src/. __tests__/imagenes.test.ts comprueba que las dos
 * den lo mismo. Sin nada de Deno: también la importa jest.
 */

export const BUCKET_FOTOS = 'fotos';

/** <uid>/<uuid>.jpg → <uid>/<uuid>.miniatura.jpg (la miniatura cuadrada de 320). */
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
export function urlPublica(supabaseUrl: string, ruta: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return encodeURI(`${base}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta.replace(/^\/+/, '')}`);
}

/**
 * La URL que ve Claude de una foto del bucket: su miniatura de 320 (menos
 * tokens). Toda foto se sube con su miniatura (comprimirYSubir) y no se
 * publica si alguna de las dos falla. null si es una URL externa: esas las
 * baja la función (descargar.ts).
 */
export function urlDeMiniatura(supabaseUrl: string, ruta: string): string | null {
  const miniatura = rutaMiniatura(ruta);
  return miniatura === null ? null : urlPublica(supabaseUrl, miniatura);
}
