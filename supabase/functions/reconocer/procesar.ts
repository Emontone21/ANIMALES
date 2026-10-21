/**
 * El trabajo de la función: procesar una foto de la cola y vaciar la cola con
 * un tope de tiempo. Todo dentro del pedido; lo que quede lo vuelve a pedir el
 * trabajo de pg_cron (despertar_vision).
 *
 * Por foto: 1) Claude la describe (si no estaba descripta); 2) si hay un
 * animal de la especie del caso, la base elige los candidatos; 3) Claude la
 * compara con ellos y la base guarda el resultado y crea las coincidencias
 * desde umbral_ia. Cada llamada a la API se reserva antes (topes) y se
 * registra después (tokens, costo, resultado).
 */

import type Anthropic from '@anthropic-ai/sdk';

import type { Base, Candidato, Config, EstadoIa, Pendiente, ResultadoLlamada, TipoLlamada } from './base.ts';
import {
  type CandidatoParaComparar,
  clasificarError,
  comparar,
  costoEstimado,
  describir,
  type Imagen,
  limpiarDetalle,
  type Respuesta,
} from './claude.ts';
import type { FotoBajada } from './descargar.ts';
import { urlDeMiniatura } from './fotos.ts';
import type { Descripcion } from './validar.ts';

export type Dependencias = {
  base: Base;
  /** null si falta ANTHROPIC_API_KEY. */
  claude: Anthropic | null;
  supabaseUrl: string;
  /** Baja una foto de otro sitio (descargar.ts): null si no se pudo. */
  bajar: (url: string) => Promise<FotoBajada | null>;
  ahora: () => number;
  /** Tope de /procesar-pendientes: no empieza otra foto pasado este tiempo. */
  topeMs: number;
};

export type ResultadoFoto =
  | { procesado: true; comparado: boolean; coincidencias: number; motivo?: string }
  | {
    procesado: false;
    motivo: Exclude<EstadoIa, 'disponible'> | 'no_pendiente' | 'sin_lugar' | 'error';
    error?: string;
  };

/** Lo que corta la vuelta: la API no se puede usar hasta que algo cambie. */
const CORTAN_LA_VUELTA = new Set(['apagado', 'pausado', 'tope_diario', 'sin_lugar', 'sin_clave', 'sin_credito']);

/**
 * Lo que la API acepta por pedido son 32 MB: de fotos bajadas (en base64) se
 * mandan hasta 20 MB y los candidatos que no entran quedan afuera.
 */
export const TOPE_PEDIDO_BASE64 = 20 * 1024 * 1024;

type FotoParaClaude = { imagen: Imagen; largo: number };

/**
 * Cómo ve Claude una foto: las del bucket, la miniatura por URL; las de otros
 * sitios (datos de demo), bajadas por la función y dentro del pedido. null si
 * no se pudo bajar.
 */
async function fotoParaClaude(d: Dependencias, ruta: string): Promise<FotoParaClaude | null> {
  const url = urlDeMiniatura(d.supabaseUrl, ruta);
  if (url) return { imagen: { type: 'url', url }, largo: 0 };
  const foto = await d.bajar(ruta);
  if (!foto) return null;
  return { imagen: { type: 'base64', media_type: foto.media_type, data: foto.data }, largo: foto.data.length };
}

type Llamada<T> = { tipo: 'ok'; valor: T; uso: { entrada: number; salida: number } } | { tipo: 'sin_lugar' } | {
  tipo: 'fallo';
  resultado: ResultadoLlamada;
};

/**
 * Reserva la llamada (si no hay lugar, no llama), llama y la registra. Una
 * respuesta que no valida o un error de la API marcan la foto con error, para
 * que la cola la reintente; sin crédito, además, pausa todo.
 */
async function llamar<T>(
  d: Dependencias,
  modelo: string,
  tipo: TipoLlamada,
  avistamientoId: string,
  hacer: () => Promise<Respuesta<T>>,
): Promise<Llamada<T>> {
  const id = await d.base.iniciarLlamada(tipo, avistamientoId, modelo);
  if (id === null) return { tipo: 'sin_lugar' };
  let respuesta: Respuesta<T>;
  try {
    respuesta = await hacer();
  } catch (error) {
    const { resultado, codigo, detalle } = clasificarError(error);
    // Una llamada que falló no se cobra. El texto del error queda en la llamada; en la cola, solo el código.
    await d.base.terminarLlamada(id, resultado, 0, 0, 0, detalle);
    await d.base.marcarError(avistamientoId, `${tipo}: ${resultado} (${codigo})`);
    if (resultado === 'sin_credito') await d.base.pausar('sin_credito');
    return { tipo: 'fallo', resultado };
  }
  const costo = costoEstimado(modelo, respuesta.uso);
  const { entrada, salida } = respuesta.uso;
  if (!respuesta.valida) {
    await d.base.terminarLlamada(id, 'invalida', entrada, salida, costo, limpiarDetalle(respuesta.motivo));
    await d.base.marcarError(avistamientoId, `${tipo}: respuesta inválida (${respuesta.motivo})`);
    return { tipo: 'fallo', resultado: 'invalida' };
  }
  // Lo que se recortó queda como aviso en la llamada, que igual sale bien (no es un error).
  const avisos = respuesta.avisos.length > 0 ? limpiarDetalle(respuesta.avisos.join('; ')) : null;
  await d.base.terminarLlamada(id, 'ok', entrada, salida, costo, avisos);
  return { tipo: 'ok', valor: respuesta.valor, uso: respuesta.uso };
}

/** Procesa una foto de la cola. Nunca tira: los errores quedan en la cola. */
export async function procesarFoto(d: Dependencias, config: Config, avistamientoId: string): Promise<ResultadoFoto> {
  if (config.estado !== 'disponible') return { procesado: false, motivo: config.estado };
  const claude = d.claude;
  if (!claude) return { procesado: false, motivo: 'error', error: 'sin_clave' };

  let pendiente: Pendiente | null;
  try {
    pendiente = await d.base.tomarPendiente(avistamientoId);
  } catch {
    return { procesado: false, motivo: 'error', error: 'base' };
  }
  if (!pendiente) return { procesado: false, motivo: 'no_pendiente' };

  try {
    return await procesarTomada(d, claude, config.modelo, pendiente);
  } catch {
    // La base o algo inesperado: la cola la reintenta.
    await d.base.marcarError(avistamientoId, 'error interno').catch(() => {});
    return { procesado: false, motivo: 'error', error: 'interno' };
  }
}

async function procesarTomada(
  d: Dependencias,
  claude: Anthropic,
  modelo: string,
  p: Pendiente,
): Promise<ResultadoFoto> {
  const id = p.avistamiento_id;
  if (!p.caso_abierto) {
    await d.base.marcarHecho(id);
    return { procesado: true, comparado: false, coincidencias: 0, motivo: 'caso_cerrado' };
  }

  const foto = await fotoParaClaude(d, p.foto_path);
  if (!foto) {
    await d.base.marcarError(id, 'foto no disponible');
    return { procesado: false, motivo: 'error', error: 'foto_no_disponible' };
  }

  // 1. Describir (un reintento no la vuelve a describir).
  let descripcion: Descripcion;
  let comparable: boolean;
  if (p.descripcion) {
    descripcion = p.descripcion;
    comparable = descripcion.hay_animal && descripcion.especie === p.especie;
  } else {
    const r = await llamar(d, modelo, 'describir', id, () => describir(claude, modelo, foto.imagen));
    if (r.tipo === 'sin_lugar') {
      await d.base.soltarPendiente(id);
      return { procesado: false, motivo: 'sin_lugar' };
    }
    if (r.tipo === 'fallo') return { procesado: false, motivo: 'error', error: r.resultado };
    descripcion = r.valor;
    comparable = await d.base.guardarDescripcion(id, descripcion, modelo, r.uso.entrada, r.uso.salida);
  }
  if (!comparable) {
    await d.base.marcarHecho(id);
    return { procesado: true, comparado: false, coincidencias: 0, motivo: 'sin_animal_de_la_especie' };
  }

  // 2. Candidatos, con su foto a la vista (las de otros sitios se bajan a la vez).
  const candidatos = await d.base.candidatos(id);
  const fotos = await Promise.all(candidatos.map((c) => fotoParaClaude(d, c.foto_path)));
  const conFoto: { c: Candidato; imagen: Imagen }[] = [];
  let largo = foto.largo;
  candidatos.forEach((c, i) => {
    const f = fotos[i];
    if (!f || largo + f.largo > TOPE_PEDIDO_BASE64) return;
    largo += f.largo;
    conFoto.push({ c, imagen: f.imagen });
  });
  if (conFoto.length === 0) {
    await d.base.marcarHecho(id);
    return { procesado: true, comparado: false, coincidencias: 0, motivo: 'sin_candidatos' };
  }

  // 3. Comparar.
  const etiquetados: CandidatoParaComparar[] = conFoto.map(({ c, imagen }, i) => ({
    etiqueta: `C${i + 1}`,
    imagen,
    tipo_reporte: c.tipo_reporte,
    tamanio: c.tamanio,
    color: c.color,
    tiene_collar: c.tiene_collar,
    descripcion: c.descripcion,
  }));
  const r = await llamar(
    d,
    modelo,
    'comparar',
    id,
    () =>
      comparar(
        claude,
        modelo,
        { imagen: foto.imagen, tipo_reporte: p.tipo_reporte, descripcion },
        etiquetados,
      ),
  );
  if (r.tipo === 'sin_lugar') {
    await d.base.soltarPendiente(id);
    return { procesado: false, motivo: 'sin_lugar' };
  }
  if (r.tipo === 'fallo') return { procesado: false, motivo: 'error', error: r.resultado };

  const porEtiqueta = new Map(etiquetados.map((e, i) => [e.etiqueta, conFoto[i].c.animal_id]));
  const resultados = r.valor.map(({ candidato, ...resto }) => ({
    ...resto,
    animal_id: porEtiqueta.get(candidato) as string,
  }));
  const coincidencias = await d.base.guardarComparacion(id, resultados, modelo);
  return { procesado: true, comparado: true, coincidencias };
}

export type ResultadoVuelta = { procesados: number; errores: number; quedan: number; motivo?: string };

/**
 * Vacía la cola hasta el tope de tiempo: no empieza otra foto pasado
 * d.topeMs, y corta si la API no se puede usar (apagada, pausada, tope del día).
 */
export async function vaciarCola(d: Dependencias): Promise<ResultadoVuelta> {
  const inicio = d.ahora();
  const probadas: string[] = [];
  let procesados = 0;
  let errores = 0;
  let motivo: string | undefined;

  vuelta: while (d.ahora() - inicio < d.topeMs) {
    const config = await d.base.config();
    if (config.estado !== 'disponible') {
      motivo = config.estado;
      break;
    }
    const ids = await d.base.siguientesPendientes(5, probadas);
    if (ids.length === 0) break;
    for (const id of ids) {
      if (d.ahora() - inicio >= d.topeMs) break vuelta;
      probadas.push(id);
      const r = await procesarFoto(d, config, id);
      if (r.procesado) procesados += 1;
      else if (r.motivo === 'error') errores += 1;
      const corte = r.procesado ? null : r.motivo === 'error' ? (r.error ?? null) : r.motivo;
      if (corte && CORTAN_LA_VUELTA.has(corte)) {
        motivo = corte;
        break vuelta;
      }
    }
  }

  const quedan = await d.base.contarPendientes();
  return motivo ? { procesados, errores, quedan, motivo } : { procesados, errores, quedan };
}
