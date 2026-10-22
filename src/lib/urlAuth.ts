/**
 * Supabase devuelve el código en la query (?code=…) y los errores en la query
 * o en el fragmento (#error_code=…). Leemos los dos.
 */
export function leerParametros(url: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  const [sinFragmento, fragmento] = url.split('#');
  const query = sinFragmento?.split('?')[1];
  for (const parte of [query, fragmento]) {
    if (!parte) continue;
    for (const [clave, valor] of new URLSearchParams(parte)) {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

/** El link trae un error de Supabase Auth (por ejemplo, venció o ya se usó). */
export function tieneErrorAuth(params: Record<string, string>): boolean {
  return Boolean(params['error_code'] ?? params['error_description'] ?? params['error']);
}

/**
 * El código del flujo PKCE, si el link lo trae. Los tokens sueltos
 * (#access_token=…) no cuentan: con PKCE, la sesión sale solo de un código
 * que este navegador o esta app pidió (ver src/lib/supabase.ts).
 */
export function codigoDeAuth(params: Record<string, string>): string | null {
  const codigo = params['code']?.trim();
  return codigo ? codigo : null;
}

/** Se volvió a la pantalla de la contraseña nueva con un link vencido o ya usado. */
export function linkDeRecuperacionInvalido(url: string): boolean {
  let ruta: string;
  try {
    ruta = new URL(url).pathname;
  } catch {
    return false;
  }
  return ruta.startsWith('/auth/nueva-contrasena') && tieneErrorAuth(leerParametros(url));
}

/**
 * Los links de los mails de Supabase Auth (supabase/templates/) llevan a
 * /auth/confirmar?token_hash=…&type=…, que la app canjea con verifyOtp. Así
 * sirven en cualquier navegador, no solo en el que pidió el mail.
 * El enlace mágico no está: la app no lo usa (su mail no tiene link).
 */
export const TIPOS_DE_LINK_DE_MAIL = ['signup', 'recovery', 'email_change'] as const;

export type TipoLinkDeMail = (typeof TIPOS_DE_LINK_DE_MAIL)[number];

export type LinkDeMail = { tokenHash: string; tipo: TipoLinkDeMail };

/** El token_hash es un hash en hexadecimal, a veces con el prefijo "pkce_". */
const FORMA_TOKEN_HASH = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * El token y el tipo del link de un mail, si los trae bien. Un parámetro
 * repetido (?type=signup&type=recovery) no vale: no se elige uno.
 */
export function linkDeMail(
  params: Record<string, string | string[] | undefined>,
): LinkDeMail | null {
  const tokenHash = params['token_hash'];
  const tipo = params['type'];
  if (typeof tokenHash !== 'string' || typeof tipo !== 'string') return null;
  if (!FORMA_TOKEN_HASH.test(tokenHash)) return null;
  if (!(TIPOS_DE_LINK_DE_MAIL as readonly string[]).includes(tipo)) return null;
  return { tokenHash, tipo: tipo as TipoLinkDeMail };
}

/**
 * El email de una cuenta sin mostrarlo entero (e***@gmail.com): alcanza para
 * que la persona reconozca si es la suya.
 */
export function enmascararEmail(email: string | null | undefined): string {
  const arroba = email?.lastIndexOf('@') ?? -1;
  if (!email || arroba < 1 || arroba === email.length - 1) return '***';
  const [primera] = Array.from(email.slice(0, arroba));
  return `${primera}***${email.slice(arroba)}`;
}
