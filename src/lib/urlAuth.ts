/**
 * Supabase devuelve los tokens en el fragmento (#access_token=…) o, si hubo
 * error, en la query (?error_code=…). Leemos los dos.
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
