/**
 * Rutas y URLs públicas de las fotos del bucket "fotos", para que la función
 * las baje y se las mande a Claude.
 *
 * Es una copia de rutaMediana y la URL pública de src/lib/imagenes.ts, el
 * único lugar con la convención del nombre de las variantes: Supabase
 * despliega la función solo con lo que hay en supabase/functions, así que no
 * puede importar de src/. __tests__/imagenes.test.ts comprueba que las dos
 * den lo mismo. Sin nada de Deno: también la importa jest.
 */

export const BUCKET_FOTOS = 'fotos';

/** <uid>/<uuid>.jpg → <uid>/<uuid>.mediana.jpg (la foto entera, a 640 px de lado mayor). */
const SUFIJO_MEDIANA = '.mediana.jpg';

/** Datos de demo cargados por SQL: una URL https en vez de una ruta del bucket. */
export function esUrlExterna(ruta: string): boolean {
  return /^https?:\/\//.test(ruta);
}

/** Ruta de la versión mediana de una foto del bucket, o null si es una URL externa. */
export function rutaMediana(ruta: string): string | null {
  if (esUrlExterna(ruta)) return null;
  const punto = ruta.indexOf('.', ruta.lastIndexOf('/') + 1);
  return (punto === -1 ? ruta : ruta.slice(0, punto)) + SUFIJO_MEDIANA;
}

/** URL pública de una ruta del bucket, igual a la que arma supabase-js. */
export function urlPublica(supabaseUrl: string, ruta: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return encodeURI(`${base}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta.replace(/^\/+/, '')}`);
}

/**
 * De dónde baja la función una foto, en orden. Del bucket: la mediana (la foto
 * entera a 640 px, lo que ve Claude) y, si no está (fotos subidas antes de que
 * existiera), la original de 1280. Una URL externa, tal cual.
 */
export function urlsParaBajar(supabaseUrl: string, ruta: string): string[] {
  const mediana = rutaMediana(ruta);
  if (mediana === null) return [ruta];
  return [urlPublica(supabaseUrl, mediana), urlPublica(supabaseUrl, ruta)];
}
