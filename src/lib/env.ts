/**
 * Variables de entorno públicas (prefijo EXPO_PUBLIC_).
 * Se leen acá y en ningún otro lado, así un valor faltante falla temprano
 * con un mensaje claro en vez de un error raro en runtime. Única excepción:
 * EXPO_PUBLIC_COMMIT y EXPO_PUBLIC_FECHA_BUILD, que pone el build y lee solo
 * el formulario de errores: acá cambiarían el bloque inicial en cada deploy. La función de la
 * vista previa del link (api/) también las lee de acá: este archivo no importa
 * nada de la app.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá .env.example a .env y completala.`,
    );
  }
  return valor.trim();
}

/**
 * La clave pública de Supabase: la publishable (sb_publishable_…) o, si no
 * está, la anon legacy, que Supabase deja de aceptar a fin de 2026. Las dos
 * entran solo hasta donde deja la RLS.
 */
export function elegirClave(publishable: string | undefined, anon: string | undefined): string {
  const nueva = publishable?.trim();
  if (nueva) return nueva;
  return requerida('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o EXPO_PUBLIC_SUPABASE_ANON_KEY)', anon);
}

/**
 * Las claves nuevas (sb_publishable_…) no son un JWT: van en el header apikey
 * y no en Authorization. La anon legacy sí es un JWT y va en los dos.
 */
export function esClaveNueva(clave: string): boolean {
  return clave.startsWith('sb_');
}

export const ENV = {
  supabaseUrl: requerida('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: elegirClave(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  mapStyleUrl:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() ||
    'https://tiles.openfreemap.org/styles/positron',
  /**
   * Clave del sitio de Cloudflare Turnstile (pública). Sin ella no hay captcha
   * al registrarse, ingresar ni recuperar la contraseña.
   */
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
  /**
   * La clave VAPID pública de las notificaciones en el celular (Web Push), la
   * misma que el secreto VAPID_PUBLIC_KEY de la función avisar. La privada va
   * solo en la función. Sin ella, la app no ofrece notificaciones.
   */
  vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null,
  /**
   * El ID de cliente web de Google (público): el botón de Google Identity
   * Services en Ingresar y Registrarse. Sin él, el botón de siempre
   * (signInWithOAuth).
   */
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null,
  /** Sitio publicado: base de los links que se comparten (<sitio>/animal/<id>). */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://spot-uy.vercel.app').replace(
    /\/+$/,
    '',
  ),
} as const;
