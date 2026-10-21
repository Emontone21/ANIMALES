import { Platform } from 'react-native';

import {
  BUCKET_FOTOS,
  LADO_MINIATURA,
  medidasMediana,
  rutaMediana,
  rutaMiniatura,
} from '@/lib/imagenes';
import { supabase } from '@/lib/supabase';

/**
 * Comprimir, subir y borrar fotos del bucket "fotos". La convención de los
 * nombres (y la de las variantes) está en imagenes.ts.
 *
 * expo-image-manipulator, expo-crypto y expo-file-system se importan al
 * usarlos (import dinámico): en web quedan fuera de la carga inicial, porque
 * solo hacen falta al subir una foto.
 */

const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.75;
const CALIDAD_MINIATURA = 0.7;

export type FotoComprimida = { uri: string; width: number; height: number };

/**
 * Redimensiona a un ancho máximo y recomprime a JPEG antes de subir.
 * Una foto de celular de 4-6 MB queda en ~150-300 KB.
 */
export async function comprimirFoto(uri: string, anchoOriginal?: number): Promise<FotoComprimida> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const contexto = ImageManipulator.manipulate(uri, { maxWidth: ANCHO_MAXIMO * 2 });
  if (!anchoOriginal || anchoOriginal > ANCHO_MAXIMO) {
    contexto.resize({ width: ANCHO_MAXIMO });
  }
  const render = await contexto.renderAsync();
  const resultado = await render.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG });
  return { uri: resultado.uri, width: resultado.width, height: resultado.height };
}

/** Miniatura cuadrada de 320: el centro de la foto ya comprimida, unos 20 KB. */
async function miniaturaDe(foto: FotoComprimida): Promise<string> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const lado = Math.min(foto.width, foto.height);
  const render = await ImageManipulator.manipulate(foto.uri)
    .crop({
      originX: Math.floor((foto.width - lado) / 2),
      originY: Math.floor((foto.height - lado) / 2),
      width: lado,
      height: lado,
    })
    .resize({ width: LADO_MINIATURA, height: LADO_MINIATURA })
    .renderAsync();
  const resultado = await render.saveAsync({
    format: SaveFormat.JPEG,
    compress: CALIDAD_MINIATURA,
  });
  return resultado.uri;
}

/**
 * La foto entera a 640 px de lado mayor, sin recorte, unos 50-80 KB: la que ve
 * la IA del reconocimiento (supabase/functions/reconocer), que con la
 * miniatura cuadrada perdía lo que quedaba fuera del centro.
 */
async function medianaDe(foto: FotoComprimida): Promise<string> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const render = await ImageManipulator.manipulate(foto.uri)
    .resize(medidasMediana(foto.width, foto.height))
    .renderAsync();
  const resultado = await render.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG });
  return resultado.uri;
}

/** Lee la foto local como bytes. En web la URI es blob: o data:, así que se usa fetch. */
async function leerBytes(uriLocal: string): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === 'web') {
    const respuesta = await fetch(uriLocal);
    return respuesta.blob();
  }
  const { File } = await import('expo-file-system');
  return new File(uriLocal).arrayBuffer();
}

/** Bucket privado de las capturas de "Reportar un error" (migración 0016). */
export const BUCKET_CAPTURAS = 'capturas';

/** Sube un JPEG ya comprimido. Por defecto al bucket público "fotos". */
export async function subir(uriLocal: string, ruta: string, bucket = BUCKET_FOTOS): Promise<void> {
  const bytes = await leerBytes(uriLocal);
  // El nombre es un UUID y nunca se reescribe (upsert: false): se cachea un año.
  const { error } = await supabase.storage.from(bucket).upload(ruta, bytes, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
}

/**
 * Sube una foto ya comprimida al bucket público "fotos", dentro de la carpeta
 * del usuario (lo exige la política de Storage), con su miniatura y su versión
 * mediana al lado. Si alguna falla, no se publica nada. Devuelve la ruta de la
 * original, que es la que se guarda en la base.
 */
export async function subirFoto(foto: FotoComprimida, usuarioId: string): Promise<string> {
  const Crypto = await import('expo-crypto');
  const ruta = `${usuarioId}/${Crypto.randomUUID()}.jpg`;
  const [uriMiniatura, uriMediana] = await Promise.all([miniaturaDe(foto), medianaDe(foto)]);
  await Promise.all([
    subir(foto.uri, ruta),
    subir(uriMiniatura, rutaMiniatura(ruta) as string),
    subir(uriMediana, rutaMediana(ruta) as string),
  ]);
  return ruta;
}

/** Comprime y sube: lo que hacen todas las pantallas que suben una foto. */
export async function comprimirYSubir(
  uri: string,
  anchoOriginal: number | undefined,
  usuarioId: string,
): Promise<string> {
  return subirFoto(await comprimirFoto(uri, anchoOriginal), usuarioId);
}

/** Las capturas son privadas: se ven con un link firmado, que dura una hora. */
export async function urlCaptura(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_CAPTURAS)
    .createSignedUrl(ruta, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Una foto del bucket y sus variantes (la miniatura y la mediana), para borrarlas juntas. */
export function conVariantes(rutas: string[]): string[] {
  return rutas.flatMap((ruta) => {
    const miniatura = rutaMiniatura(ruta);
    const mediana = rutaMediana(ruta);
    return miniatura && mediana ? [ruta, miniatura, mediana] : [];
  });
}

/** La API de Storage borra de a tandas. */
const TANDA = 100;

export class ErrorFotos extends Error {}

/**
 * Borra fotos de la carpeta propia con la API de Storage y la sesión del
 * usuario (la política deja borrar lo propio; por SQL no se puede). Las rutas
 * salen de la base (fotos_para_borrar, fotos_del_reporte), que solo devuelve
 * fotos que existen: si se borran menos, algo falló y se corta. Con `bucket`,
 * las capturas de "Reportar un error" (capturas_para_borrar).
 */
export async function borrarFotos(rutas: string[], bucket = BUCKET_FOTOS): Promise<void> {
  for (let i = 0; i < rutas.length; i += TANDA) {
    const tanda = rutas.slice(i, i + TANDA);
    const { data, error } = await supabase.storage.from(bucket).remove(tanda);
    // Storage no da error si no pudo borrar alguna: se comparan las cantidades.
    if (error || data.length !== tanda.length) throw new ErrorFotos(error?.message ?? '');
  }
}
