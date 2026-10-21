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
