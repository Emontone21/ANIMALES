import { useMutation } from '@tanstack/react-query';

import type { DatosDelDispositivo } from '@/features/errores/reporte';
import { t } from '@/i18n/es-UY';
import { ErrorVisible } from '@/lib/errores';
import { BUCKET_CAPTURAS, comprimirFoto, subir } from '@/lib/fotos';
import { supabase } from '@/lib/supabase';

/**
 * "Reportar un error": mandar un reporte, con su captura. Solo lo usa el
 * formulario, que se carga al abrirlo. Lo de moderación (listar y resolver)
 * está en moderacion.ts: si los dos bloques compartieran este archivo, Metro
 * lo pondría en el bloque común, que se baja al abrir la app.
 */

export type NuevoReporteError = {
  quePaso: string;
  queHacias: string;
  /** Solo sin cuenta. */
  contacto: string;
  /** Solo con cuenta: la captura elegida, sin comprimir. */
  captura: { uri: string; width: number } | null;
  dispositivo: DatosDelDispositivo;
};

/**
 * Comprime la captura como las fotos (JPEG de 1280 de ancho, sin miniatura) y
 * la sube al bucket privado, en la carpeta de la persona.
 */
async function subirCaptura(uri: string, ancho: number, usuarioId: string): Promise<string> {
  try {
    const Crypto = await import('expo-crypto');
    const ruta = `${usuarioId}/${Crypto.randomUUID()}.jpg`;
    const foto = await comprimirFoto(uri, ancho);
    await subir(foto.uri, ruta, BUCKET_CAPTURAS);
    return ruta;
  } catch {
    throw new ErrorVisible(t.errores.formulario.errorCaptura);
  }
}

/** Manda el reporte. La base valida, limita (5 por hora por cuenta) y avisa a moderación. */
export async function reportarError(
  reporte: NuevoReporteError,
  usuarioId: string | null,
): Promise<string> {
  const captura =
    usuarioId && reporte.captura
      ? await subirCaptura(reporte.captura.uri, reporte.captura.width, usuarioId)
      : null;
  const { dispositivo } = reporte;
  const { data, error } = await supabase.rpc('reportar_error', {
    p_que_paso: reporte.quePaso.trim(),
    p_que_hacias: reporte.queHacias.trim() || null,
    p_contacto: usuarioId ? null : reporte.contacto.trim() || null,
    p_captura_path: captura,
    p_pantalla_anterior: dispositivo.pantallaAnterior,
    p_navegador: dispositivo.navegador,
    p_tamanio_pantalla: dispositivo.tamanioPantalla,
    p_plataforma: dispositivo.plataforma,
    p_version_app: dispositivo.version,
  });
  if (error) throw error;
  return data;
}

// --- Hooks -----------------------------------------------------------------

export function useReportarError(usuarioId: string | null) {
  return useMutation({
    mutationFn: (reporte: NuevoReporteError) => reportarError(reporte, usuarioId),
  });
}
