import { traducirError } from '@/features/auth/validaciones';
import { appConNavegador } from '@/features/instalar/formaDeInstalar';
import { supabase } from '@/lib/supabase';

/**
 * Ingresar con Google en web con el botón oficial de Google Identity Services
 * y signInWithIdToken: Google le da a la app un token de identidad y la app se
 * lo pasa a Supabase. Así la pantalla de Google muestra el sitio, no la
 * dirección de Supabase (docs/DECISIONES.md, "Ingresar con Google: el botón
 * de Google"). Reglas puras y la llamada a Supabase: el script y el botón
 * están en components/auth/IngresoGoogle.web.tsx.
 *
 * - `boton`: el botón de Google, ya cargado.
 * - `cargando`: el script de Google todavía no terminó.
 * - `respaldo`: el botón de siempre, que pasa por Supabase (signInWithOAuth):
 *   la app nativa, sin el ID de cliente o si el script no cargó o falló.
 * - `abrirEnNavegador`: el navegador de WhatsApp, Instagram o Facebook, donde
 *   Google no deja ingresar: hay que abrir el link en Chrome o Safari.
 */
export type FormaDeGoogle = 'boton' | 'cargando' | 'respaldo' | 'abrirEnNavegador';

export type EstadoScriptGoogle = 'cargando' | 'listo' | 'fallo';

export type DatosGoogle = {
  /** Platform.OS: la app nativa sigue con signInWithOAuth. */
  plataforma: string;
  userAgent: string;
  /** EXPO_PUBLIC_GOOGLE_CLIENT_ID, o null. */
  clientId: string | null;
  script: EstadoScriptGoogle;
};

export function formaDeIngresarConGoogle(datos: DatosGoogle): FormaDeGoogle {
  if (datos.plataforma !== 'web') return 'respaldo';
  if (appConNavegador(datos.userAgent)) return 'abrirEnNavegador';
  if (!datos.clientId || datos.script === 'fallo') return 'respaldo';
  return datos.script === 'listo' ? 'boton' : 'cargando';
}

const BYTES_DEL_NONCE = 32;

function hexadecimal(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * El nonce de un intento: 32 bytes al azar, en hexadecimal. El original va a
 * Supabase (signInWithIdToken) y su hash SHA-256 a Google, que lo pone en el
 * token. Supabase hashea el original y lo compara: un token robado no sirve
 * sin el nonce que solo tiene esta pantalla.
 */
export function crearNonce(
  azar: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (bytes) =>
    globalThis.crypto.getRandomValues(bytes),
): string {
  return hexadecimal(azar(new Uint8Array(BYTES_DEL_NONCE)));
}

/** El hash SHA-256 del nonce, en hexadecimal: lo que se le pasa a Google. */
export async function hashDelNonce(nonce: string): Promise<string> {
  const digesto = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  return hexadecimal(new Uint8Array(digesto));
}

export type NonceGoogle = { original: string; hash: string };

export async function prepararNonce(nonce: string = crearNonce()): Promise<NonceGoogle> {
  return { original: nonce, hash: await hashDelNonce(nonce) };
}

/**
 * Abre la sesión con el token que dio el botón de Google y el nonce original
 * (no el hash). Después todo sigue igual: la sesión, el perfil y aceptar los
 * términos (AuthProvider).
 */
export async function ingresarConTokenDeGoogle(token: string, nonce: NonceGoogle): Promise<void> {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce: nonce.original,
  });
  if (error) throw traducirError(error);
}
