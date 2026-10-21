/**
 * Para las pruebas: una base en memoria (con el registro de lo que se le
 * pidió) y un fetch que hace de la API de Claude con respuestas armadas.
 */

import type Anthropic from '@anthropic-ai/sdk';

import type {
  Base,
  Candidato,
  ComparacionParaGuardar,
  Config,
  Pendiente,
  ResultadoLlamada,
  TipoLlamada,
} from '../base.ts';
import { crearCliente } from '../claude.ts';
import type { FotoBajada } from '../descargar.ts';
import type { Dependencias } from '../procesar.ts';
import type { Descripcion } from '../validar.ts';

export const SUPABASE = 'https://proyecto.supabase.co';
export const SECRETO = 'secreto-de-prueba';

export const DESCRIPCION_PERRO: Descripcion = {
  hay_animal: true,
  especie: 'perro',
  color_principal: 'negro',
  color_secundario: 'blanco',
  patron: 'manchas',
  tamanio: 'mediano',
  collar: 'si',
  collar_color: 'rojo',
  raza_aproximada: 'mestizo',
  rasgos: ['mancha blanca en el pecho', 'oreja izquierda caída'],
  calidad: 'buena',
};

export function pendiente(cambios: Partial<Pendiente> = {}): Pendiente {
  return {
    avistamiento_id: '11111111-1111-4111-8111-111111111111',
    animal_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    foto_path: 'uid-familia/foto-nueva.jpg',
    especie: 'perro',
    tipo_reporte: 'perdido',
    caso_abierto: true,
    descripcion: null,
    ...cambios,
  };
}

export function candidato(animalId: string, cambios: Partial<Candidato> = {}): Candidato {
  return {
    animal_id: animalId,
    avistamiento_cercano: `av-${animalId}`,
    tipo_reporte: 'encontrado',
    especie: 'perro',
    tamanio: 'mediano',
    color: 'negro con blanco',
    tiene_collar: true,
    foto_path: `uid-hallazgo/${animalId}.jpg`,
    distancia_m: 800,
    horas: 5,
    descripcion: null,
    ...cambios,
  };
}

type Llamada = {
  id: number;
  tipo: TipoLlamada;
  avistamientoId: string;
  modelo: string;
  resultado?: ResultadoLlamada;
  tokensEntrada?: number;
  tokensSalida?: number;
  costo?: number | null;
  detalle?: string | null;
};

/** Una base en memoria que anota lo que le piden. */
export class BaseFalsa implements Base {
  config_: Config = { secreto: SECRETO, modelo: 'claude-haiku-5-5', estado: 'disponible' };
  pendientes = new Map<string, Pendiente>();
  cola: string[] = [];
  candidatos_: Candidato[] = [];
  /** guardar_descripcion_ia: si se compara. Por defecto, como la base. */
  comparable?: boolean;
  coincidenciasNuevas = 1;
  /** Cuántas llamadas se pueden reservar todavía (null: sin tope). */
  lugar: number | null = null;
  falla: Partial<Record<keyof Base, Error>> = {};

  llamadas: Llamada[] = [];
  hechas: string[] = [];
  soltadas: string[] = [];
  errores: { id: string; error: string }[] = [];
  descripciones: { id: string; descripcion: Descripcion; tokensEntrada: number; tokensSalida: number }[] = [];
  comparaciones: { id: string; resultados: ComparacionParaGuardar[]; modelo: string }[] = [];
  pausas: string[] = [];

  #fallar(operacion: keyof Base) {
    const error = this.falla[operacion];
    if (error) throw error;
  }

  config() {
    this.#fallar('config');
    return Promise.resolve({ ...this.config_ });
  }
  tomarPendiente(id: string) {
    this.#fallar('tomarPendiente');
    const p = this.pendientes.get(id) ?? null;
    this.pendientes.delete(id);
    this.cola = this.cola.filter((x) => x !== id);
    return Promise.resolve(p);
  }
  /** Como la base: vuelve a 'pendiente'. */
  soltarPendiente(id: string) {
    this.soltadas.push(id);
    const p = this.ultimas.get(id);
    if (p) {
      this.pendientes.set(id, p);
      this.cola.push(id);
    }
    return Promise.resolve();
  }
  marcarHecho(id: string) {
    this.hechas.push(id);
    return Promise.resolve();
  }
  marcarError(id: string, error: string) {
    this.errores.push({ id, error });
    return Promise.resolve();
  }
  guardarDescripcion(
    id: string,
    descripcion: Descripcion,
    _modelo: string,
    tokensEntrada: number,
    tokensSalida: number,
  ) {
    this.descripciones.push({ id, descripcion, tokensEntrada, tokensSalida });
    const p = pendienteDe(this, id);
    return Promise.resolve(
      this.comparable ?? (descripcion.hay_animal && (p === undefined || descripcion.especie === p.especie)),
    );
  }
  candidatos(_id: string) {
    this.#fallar('candidatos');
    return Promise.resolve(this.candidatos_);
  }
  guardarComparacion(id: string, resultados: ComparacionParaGuardar[], modelo: string) {
    this.comparaciones.push({ id, resultados, modelo });
    return Promise.resolve(this.coincidenciasNuevas);
  }
  iniciarLlamada(tipo: TipoLlamada, avistamientoId: string, modelo: string) {
    if (this.config_.estado !== 'disponible') return Promise.resolve(null);
    if (this.lugar !== null) {
      if (this.lugar <= 0) return Promise.resolve(null);
      this.lugar -= 1;
    }
    const id = this.llamadas.length + 1;
    this.llamadas.push({ id, tipo, avistamientoId, modelo });
    return Promise.resolve(id);
  }
  terminarLlamada(
    id: number,
    resultado: ResultadoLlamada,
    tokensEntrada: number,
    tokensSalida: number,
    costo: number | null,
    detalle: string | null,
  ) {
    Object.assign(this.llamadas[id - 1], { resultado, tokensEntrada, tokensSalida, costo, detalle });
    return Promise.resolve();
  }
  pausar(motivo: 'sin_credito') {
    this.pausas.push(motivo);
    this.config_.estado = 'pausado';
    return Promise.resolve();
  }
  siguientesPendientes(limite: number, excluir: string[]) {
    return Promise.resolve(this.cola.filter((id) => !excluir.includes(id)).slice(0, limite));
  }
  contarPendientes() {
    return Promise.resolve(this.cola.length);
  }

  /** Para las pruebas de la cola: una foto pendiente más. */
  agregar(p: Pendiente) {
    this.pendientes.set(p.avistamiento_id, p);
    this.cola.push(p.avistamiento_id);
    this.ultimas.set(p.avistamiento_id, p);
  }
  ultimas = new Map<string, Pendiente>();
}

function pendienteDe(base: BaseFalsa, id: string): Pendiente | undefined {
  return base.ultimas.get(id);
}

/** Un pedido que le llegó a la API de Claude, ya leído. */
export type PedidoClaude = Anthropic.MessageCreateParamsNonStreaming;

type Respondedor = (pedido: PedidoClaude, n: number) => Response | Promise<Response>;

/** Un fetch que hace de la API de Claude y anota los pedidos. */
export function apiFalsa(responder: Respondedor) {
  const pedidos: PedidoClaude[] = [];
  const fetchFalso: typeof fetch = async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (!url.endsWith('/v1/messages')) throw new Error(`URL inesperada: ${url}`);
    const cuerpo = JSON.parse(String(init?.body)) as PedidoClaude;
    pedidos.push(cuerpo);
    return await responder(cuerpo, pedidos.length);
  };
  return { pedidos, cliente: crearCliente('clave-de-prueba', fetchFalso) };
}

/** Una respuesta de la API que llama a una herramienta. */
export function conHerramienta(
  nombre: string,
  entrada: unknown,
  cambios: Partial<{ stop_reason: string; input_tokens: number; output_tokens: number }> = {},
): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_prueba',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [
        { type: 'thinking', thinking: '', signature: 'firma' },
        { type: 'tool_use', id: 'toolu_prueba', name: nombre, input: entrada, caller: { type: 'direct' } },
      ],
      stop_reason: cambios.stop_reason ?? 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: cambios.input_tokens ?? 1200, output_tokens: cambios.output_tokens ?? 300 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Una respuesta de la API sin herramienta (solo texto). */
export function soloTexto(texto: string, stopReason = 'end_turn'): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_prueba',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [{ type: 'text', text: texto }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 900, output_tokens: 40 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Un error de la API, sin que el SDK lo reintente. */
export function errorDeApi(
  estado: number,
  tipo: string,
  mensaje = 'mensaje en inglés de la API',
  pedidoId?: string,
): Response {
  return new Response(
    JSON.stringify({ type: 'error', error: { type: tipo, message: mensaje } }),
    {
      status: estado,
      headers: {
        'content-type': 'application/json',
        'x-should-retry': 'false',
        ...(pedidoId ? { 'request-id': pedidoId } : {}),
      },
    },
  );
}

/** Una foto de otro sitio ya bajada: un JPEG chiquito. */
export const FOTO_BAJADA: FotoBajada = { media_type: 'image/jpeg', data: '/9j/4AAQ', bytes: 6 };

/** Las dependencias de la función con la base y la API falsas; las fotos de otros sitios se bajan bien. */
export function dependencias(
  base: BaseFalsa,
  cliente: Anthropic | null,
  cambios: Partial<Dependencias> = {},
): Dependencias {
  let reloj = 0;
  return {
    base,
    claude: cliente,
    supabaseUrl: SUPABASE,
    bajar: () => Promise.resolve(FOTO_BAJADA),
    ahora: () => reloj++,
    topeMs: 90_000,
    ...cambios,
  };
}

/** Las URLs de las imágenes de un pedido, en orden. */
export function urlsDeImagenes(pedido: PedidoClaude): string[] {
  const contenido = pedido.messages[0].content;
  if (typeof contenido === 'string') return [];
  return contenido.flatMap((b) => (b.type === 'image' && b.source.type === 'url' ? [b.source.url] : []));
}

/** Cómo llegó cada imagen de un pedido, en orden: "url:<url>" o "base64:<tipo>". */
export function imagenesDe(pedido: PedidoClaude): string[] {
  const contenido = pedido.messages[0].content;
  if (typeof contenido === 'string') return [];
  return contenido.flatMap((b) =>
    b.type !== 'image'
      ? []
      : b.source.type === 'url'
      ? [`url:${b.source.url}`]
      : b.source.type === 'base64'
      ? [`base64:${b.source.media_type}`]
      : []
  );
}

/** Los textos de un pedido, en orden. */
export function textosDe(pedido: PedidoClaude): string[] {
  const contenido = pedido.messages[0].content;
  if (typeof contenido === 'string') return [contenido];
  return contenido.flatMap((b) => (b.type === 'text' ? [b.text] : []));
}
