import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.75;
const BUCKET = 'fotos';

export type FotoComprimida = { uri: string; width: number; height: number };

/**
 * Redimensiona a un ancho máximo y recomprime a JPEG antes de subir.
 * Una foto de celular de 4-6 MB queda en ~150-300 KB.
 */
export async function comprimirFoto(uri: string, anchoOriginal?: number): Promise<FotoComprimida> {
  const contexto = ImageManipulator.manipulate(uri, { maxWidth: ANCHO_MAXIMO * 2 });
  if (!anchoOriginal || anchoOriginal > ANCHO_MAXIMO) {
    contexto.resize({ width: ANCHO_MAXIMO });
  }
  const render = await contexto.renderAsync();
  const resultado = await render.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG });
  return { uri: resultado.uri, width: resultado.width, height: resultado.height };
}

/** Lee la foto local como bytes. En web la URI es blob: o data:, así que se usa fetch. */
async function leerBytes(uriLocal: string): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === 'web') {
    const respuesta = await fetch(uriLocal);
    return respuesta.blob();
  }
  return new File(uriLocal).arrayBuffer();
}

/**
 * Sube una foto ya comprimida al bucket público "fotos", dentro de la carpeta
 * del usuario (lo exige la política de Storage). Devuelve la ruta guardada.
 */
export async function subirFoto(uriLocal: string, usuarioId: string): Promise<string> {
  const bytes = await leerBytes(uriLocal);
  const ruta = `${usuarioId}/${Crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return ruta;
}

/** URL pública de una foto. Acepta rutas del bucket o URLs https (datos de demo). */
export function urlFoto(ruta: string): string {
  if (/^https?:\/\//.test(ruta)) return ruta;
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
