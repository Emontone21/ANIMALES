/**
 * La base, desde la función: solo las RPC de la migración 0024
 * (config_avisar, preparar_avisos_push y terminar_avisos_push), por PostgREST
 * con fetch.
 *
 * Clave: la secreta que Supabase pone en el entorno (SUPABASE_SECRET_KEYS, un
 * JSON con la clave "default") o, mientras exista, la legacy
 * SUPABASE_SERVICE_ROLE_KEY; igual que reconocer/base.ts. La secreta no es un
 * JWT: va solo en el header apikey.
 */

import type { Aviso } from './aviso.ts';
import type { ResultadoEnvio } from './push.ts';

export const PREFIJO_SECRETA = 'sb_secret_';
/** Supabase rechaza una clave secreta si el pedido parece de un navegador. */
export const AGENTE = 'spot-avisar';

export type Config = { secreto: string };

export type ResultadoParaGuardar = { aviso_id: number; suscripcion_id: string; resultado: ResultadoEnvio };

export interface Base {
  config(): Promise<Config>;
  preparar(limite: number): Promise<Aviso[]>;
  terminar(resultados: ResultadoParaGuardar[]): Promise<void>;
}

/** La clave secreta nueva si está; si no, la legacy service_role. */
export function claveDesdeEntorno(leer: (nombre: string) => string | undefined): string {
  const secretas = leer('SUPABASE_SECRET_KEYS');
  if (secretas) {
    try {
      const claves: unknown = JSON.parse(secretas);
      if (typeof claves === 'object' && claves !== null) {
        const porDefecto = (claves as Record<string, unknown>).default;
        if (typeof porDefecto === 'string' && porDefecto.trim()) return porDefecto.trim();
      }
    } catch {
      // Sigue con la legacy.
    }
  }
  return (leer('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
}

export function headersPara(clave: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: clave,
    'Content-Type': 'application/json',
    'User-Agent': AGENTE,
  };
  // Solo la legacy es un JWT.
  if (!clave.startsWith(PREFIJO_SECRETA)) headers.Authorization = `Bearer ${clave}`;
  return headers;
}

/** Un pedido a la base que falló. Sin el cuerpo de la respuesta, que puede traer datos. */
export class ErrorBase extends Error {
  constructor(
    readonly operacion: string,
    readonly estado: number,
  ) {
    super(`${operacion}: HTTP ${estado}`);
    this.name = 'ErrorBase';
  }
}

export class BaseSupabase implements Base {
  readonly #url: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: typeof fetch;

  constructor(supabaseUrl: string, clave: string, fetchFn: typeof fetch = fetch) {
    this.#url = supabaseUrl.replace(/\/+$/, '');
    this.#headers = headersPara(clave);
    this.#fetch = fetchFn;
  }

  async #rpc<T>(nombre: string, args: Record<string, unknown>): Promise<T> {
    const respuesta = await this.#fetch(`${this.#url}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: this.#headers,
      body: JSON.stringify(args),
    });
    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      throw new ErrorBase(nombre, respuesta.status);
    }
    const texto = await respuesta.text();
    return (texto ? JSON.parse(texto) : null) as T;
  }

  config() {
    return this.#rpc<Config>('config_avisar', {});
  }

  async preparar(limite: number) {
    return (await this.#rpc<Aviso[] | null>('preparar_avisos_push', { p_limite: limite })) ?? [];
  }

  async terminar(resultados: ResultadoParaGuardar[]) {
    await this.#rpc('terminar_avisos_push', { p_resultados: resultados });
  }
}
