/**
 * Variables de entorno públicas (prefijo EXPO_PUBLIC_).
 * Se leen acá y en ningún otro lado, así un valor faltante falla temprano
 * con un mensaje claro en vez de un error raro en runtime. La función de la
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

export const ENV = {
  supabaseUrl: requerida('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requerida(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  mapStyleUrl:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() ||
    'https://tiles.openfreemap.org/styles/positron',
  /** Sitio publicado: base de los links que se comparten (<sitio>/animal/<id>). */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://animales-blue.vercel.app').replace(
    /\/+$/,
    '',
  ),
} as const;
