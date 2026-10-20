/**
 * La base, desde la función: solo RPC de la migración 0018 (y marcar_error_vision
 * y la vista cola_vision_pendientes), por PostgREST con fetch.
 *
 * Clave: la secreta que Supabase pone en el entorno de cada función
 * (SUPABASE_SECRET_KEYS, un JSON con la clave "default") o, mientras exista,
 * la legacy SUPABASE_SERVICE_ROLE_KEY. La secreta no es un JWT: va solo en el
 * header apikey. La legacy va también como Authorization: Bearer.
 */

import type { Descripcion, Especie, ResultadoComparacion } from './validar.ts';

export const PREFIJO_SECRETA = 'sb_secret_';
/** Supabase rechaza una clave secreta si el pedido parece de un navegador. */
export const AGENTE = 'encontrados-reconocer';

export type EstadoIa = 'disponible' | 'apagado' | 'pausado' | 'tope_diario';
export type TipoReporte = 'perdido' | 'encontrado';
export type Tamanio = 'chico' | 'mediano' | 'grande';
export type TipoLlamada = 'describir' | 'comparar';
export type ResultadoLlamada = 'ok' | 'invalida' | 'limite' | 'sobrecarga' | 'sin_credito' | 'error';

/** config_reconocimiento(). */
export type Config = { secreto: string; modelo: string; estado: EstadoIa };

/** tomar_pendiente_ia(): la foto y los datos del animal, nunca de personas. */
export type Pendiente = {
  avistamiento_id: string;
  animal_id: string;
  foto_path: string;
  especie: Exclude<Especie, 'ninguno'>;
  tipo_reporte: TipoReporte;
  caso_abierto: boolean;
  descripcion: Descripcion | null;
};

/** Una fila de candidatos_ia(). */
export type Candidato = {
  animal_id: string;
  avistamiento_cercano: string;
  tipo_reporte: TipoReporte;
  especie: Exclude<Especie, 'ninguno'>;
  tamanio: Tamanio | null;
  color: string | null;
  tiene_collar: boolean;
  foto_path: string;
  distancia_m: number;
  horas: number;
  descripcion: Descripcion | null;
};

/** Lo que recibe guardar_comparacion_ia: el resultado con el caso en vez de la etiqueta. */
export type ComparacionParaGuardar = Omit<ResultadoComparacion, 'candidato'> & { animal_id: string };

export interface Base {
  config(): Promise<Config>;
  tomarPendiente(avistamientoId: string): Promise<Pendiente | null>;
  soltarPendiente(avistamientoId: string): Promise<void>;
  marcarHecho(avistamientoId: string): Promise<void>;
  marcarError(avistamientoId: string, error: string): Promise<void>;
  guardarDescripcion(
    avistamientoId: string,
    descripcion: Descripcion,
    modelo: string,
    tokensEntrada: number,
    tokensSalida: number,
  ): Promise<boolean>;
  candidatos(avistamientoId: string): Promise<Candidato[]>;
  guardarComparacion(
    avistamientoId: string,
    resultados: ComparacionParaGuardar[],
    modelo: string,
  ): Promise<number>;
  iniciarLlamada(tipo: TipoLlamada, avistamientoId: string, modelo: string): Promise<number | null>;
  terminarLlamada(
    id: number,
    resultado: ResultadoLlamada,
    tokensEntrada: number,
    tokensSalida: number,
    costoUsd: number | null,
    detalle: string | null,
  ): Promise<void>;
  pausar(motivo: 'sin_credito'): Promise<void>;
  /** Las próximas de cola_vision_pendientes, sin las que ya se probaron en esta vuelta. */
  siguientesPendientes(limite: number, excluir: string[]): Promise<string[]>;
  contarPendientes(): Promise<number>;
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

/** "0-0/5" → 5; "*\/0" → 0. */
export function totalDeContentRange(valor: string | null): number {
  const total = valor?.split('/')[1];
  const n = total === undefined ? NaN : Number(total);
  return Number.isFinite(n) ? n : 0;
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
    return this.#rpc<Config>('config_reconocimiento', {});
  }

  tomarPendiente(avistamientoId: string) {
    return this.#rpc<Pendiente | null>('tomar_pendiente_ia', { p_avistamiento_id: avistamientoId });
  }

  async soltarPendiente(avistamientoId: string) {
    await this.#rpc('soltar_pendiente_ia', { p_avistamiento_id: avistamientoId });
  }

  async marcarHecho(avistamientoId: string) {
    await this.#rpc('marcar_hecho_ia', { p_avistamiento_id: avistamientoId });
  }

  async marcarError(avistamientoId: string, error: string) {
    await this.#rpc('marcar_error_vision', { p_avistamiento_id: avistamientoId, p_error: error });
  }

  guardarDescripcion(
    avistamientoId: string,
    descripcion: Descripcion,
    modelo: string,
    tokensEntrada: number,
    tokensSalida: number,
  ) {
    return this.#rpc<boolean>('guardar_descripcion_ia', {
      p_avistamiento_id: avistamientoId,
      p_descripcion: descripcion,
      p_modelo: modelo,
      p_tokens_entrada: tokensEntrada,
      p_tokens_salida: tokensSalida,
    });
  }

  async candidatos(avistamientoId: string) {
    return (await this.#rpc<Candidato[] | null>('candidatos_ia', { p_avistamiento_id: avistamientoId })) ?? [];
  }

  guardarComparacion(avistamientoId: string, resultados: ComparacionParaGuardar[], modelo: string) {
    return this.#rpc<number>('guardar_comparacion_ia', {
      p_avistamiento_id: avistamientoId,
      p_resultados: resultados,
      p_modelo: modelo,
    });
  }

  iniciarLlamada(tipo: TipoLlamada, avistamientoId: string, modelo: string) {
    return this.#rpc<number | null>('iniciar_llamada_ia', {
      p_tipo: tipo,
      p_avistamiento_id: avistamientoId,
      p_modelo: modelo,
    });
  }

  async terminarLlamada(
    id: number,
    resultado: ResultadoLlamada,
    tokensEntrada: number,
    tokensSalida: number,
    costoUsd: number | null,
    detalle: string | null,
  ) {
    await this.#rpc('terminar_llamada_ia', {
      p_id: id,
      p_resultado: resultado,
      p_tokens_entrada: tokensEntrada,
      p_tokens_salida: tokensSalida,
      p_costo_usd: costoUsd,
      p_detalle: detalle,
    });
  }

  async pausar(motivo: 'sin_credito') {
    await this.#rpc('pausar_ia', { p_motivo: motivo });
  }

  async siguientesPendientes(limite: number, excluir: string[]) {
    const params = new URLSearchParams({ select: 'avistamiento_id', limit: String(limite) });
    if (excluir.length > 0) params.set('avistamiento_id', `not.in.(${excluir.join(',')})`);
    const respuesta = await this.#fetch(`${this.#url}/rest/v1/cola_vision_pendientes?${params}`, {
      headers: this.#headers,
    });
    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      throw new ErrorBase('cola_vision_pendientes', respuesta.status);
    }
    const filas = (await respuesta.json()) as { avistamiento_id: string }[];
    return filas.map((f) => f.avistamiento_id);
  }

  async contarPendientes() {
    const respuesta = await this.#fetch(
      `${this.#url}/rest/v1/cola_vision_pendientes?select=avistamiento_id&limit=1`,
      { headers: { ...this.#headers, Prefer: 'count=exact' } },
    );
    await respuesta.body?.cancel();
    if (!respuesta.ok) throw new ErrorBase('cola_vision_pendientes', respuesta.status);
    return totalDeContentRange(respuesta.headers.get('content-range'));
  }
}
