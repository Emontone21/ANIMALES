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
 * Las URLs a probar para una foto, en orden: la miniatura (lo que ve Claude:
 * menos tokens) y la original (las fotos de antes de la Fase 8 no tienen
 * miniatura). Una URL externa va tal cual.
 */
export function urlsCandidatas(supabaseUrl: string, ruta: string): string[] {
  if (esUrlExterna(ruta)) return [ruta];
  const miniatura = rutaMiniatura(ruta);
  return [miniatura, ruta]
    .filter((r): r is string => r !== null)
    .map((r) => urlPublica(supabaseUrl, r));
}
