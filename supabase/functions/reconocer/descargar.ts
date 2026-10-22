/**
 * La función baja cada foto y la manda dentro del pedido: del bucket, la
 * versión mediana (o la original, si es de antes); de otros sitios (los datos
 * de demo cargados por SQL, que guardan una URL https), la que hay. Así no
 * depende de que la API pueda bajarla ni de lo que el sitio diga del tipo
 * (placedog.net responde "image/jpg", que no existe): el tipo sale de los
 * primeros bytes. Con topes de tamaño y de tiempo, solo de los orígenes
 * permitidos y sin seguir redirecciones (auditoría 2, S-B3): una ruta guardada
 * en la base no puede hacer que la función pida otra cosa.
 */

/** Los tipos que acepta la API. */
export type TipoImagen = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type FotoBajada = { media_type: TipoImagen; data: string; bytes: number };

/** Lo que la API acepta por imagen. */
export const TOPE_FOTO_BYTES = 5 * 1024 * 1024;
export const TOPE_FOTO_MS = 10_000;

/** Los sitios de las fotos de demo (supabase/seed.sql). El proyecto se suma en index.ts. */
export const ORIGENES_DEMO: readonly string[] = ['https://placedog.net', 'https://cataas.com'];

/** La URL es de uno de `origenes` (esquema, host y puerto exactos). */
export function origenPermitido(url: string, origenes: readonly string[]): boolean {
  try {
    return origenes.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

/** El tipo por la firma del archivo, o null si no es JPEG, PNG, WebP ni GIF. */
export function tipoPorBytes(b: Uint8Array): TipoImagen | null {
  const empieza = (firma: number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);
  if (empieza([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // "GIF87a" o "GIF89a".
  if (empieza([0x47, 0x49, 0x46, 0x38]) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  // "RIFF", el largo y "WEBP".
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

/** Base64 por partes: String.fromCharCode con millones de argumentos desborda la pila. */
export function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

/** Lee el cuerpo hasta `tope` bytes; si se pasa o se corta por tiempo, null. */
async function leerHasta(
  lector: ReadableStreamDefaultReader<Uint8Array>,
  tope: number,
  senal: AbortSignal,
): Promise<Uint8Array | null> {
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await lector.read();
    // Al vencer el tiempo se cancela el lector y read() termina antes de tiempo.
    if (senal.aborted) return null;
    if (done) break;
    total += value.length;
    if (total > tope) {
      await lector.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let i = 0;
  for (const parte of partes) {
    bytes.set(parte, i);
    i += parte.length;
  }
  return bytes;
}

/**
 * Baja una foto de otro sitio. null si no es de `origenes`, no responde 200
 * (una redirección tampoco vale), tarda más de `topeMs` (todo: conectar y
 * leer), pesa más de `topeBytes` o no es una imagen que acepte la API: la foto
 * queda como "foto no disponible".
 */
export function bajarFoto(
  fetchFn: typeof fetch = fetch,
  { topeMs = TOPE_FOTO_MS, topeBytes = TOPE_FOTO_BYTES, origenes = ORIGENES_DEMO }: {
    topeMs?: number;
    topeBytes?: number;
    origenes?: readonly string[];
  } = {},
) {
  return async (url: string): Promise<FotoBajada | null> => {
    if (!origenPermitido(url, origenes)) return null;
    const control = new AbortController();
    let lector: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const reloj = setTimeout(() => {
      control.abort();
      lector?.cancel().catch(() => {});
    }, topeMs);
    try {
      const respuesta = await fetchFn(url, { signal: control.signal, redirect: 'error' });
      if (!respuesta.ok || !respuesta.body) {
        await respuesta.body?.cancel();
        return null;
      }
      // Si el sitio ya dice que pesa de más, ni se lee.
      if (Number(respuesta.headers.get('content-length')) > topeBytes) {
        await respuesta.body.cancel();
        return null;
      }
      lector = respuesta.body.getReader();
      if (control.signal.aborted) return null;
      const bytes = await leerHasta(lector, topeBytes, control.signal);
      if (!bytes) return null;
      const tipo = tipoPorBytes(bytes);
      return tipo ? { media_type: tipo, data: aBase64(bytes), bytes: bytes.length } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(reloj);
    }
  };
}
