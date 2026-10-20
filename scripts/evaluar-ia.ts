/**
 * Evalúa el reconocimiento con la API de Claude con fotos de animales conocidos.
 *
 * Uso, desde la raíz del repo (la clave va en ANTHROPIC_API_KEY; ver
 * docs/reportes/2026-10-20-reconocimiento-ia.md, "Evaluar"):
 *
 *   deno run --config supabase/functions/reconocer/deno.json \
 *     --allow-read --allow-env --allow-net=api.anthropic.com \
 *     scripts/evaluar-ia.ts CARPETA --especie perro
 *
 * CARPETA tiene una subcarpeta por animal con dos o más fotos, el mismo
 * formato que services/vision/evaluar.py:
 *
 *   CARPETA/
 *     firulais/  1.jpg 2.jpg 3.jpg
 *     manchita/  a.jpg b.jpg
 *
 * Por cada animal hace lo mismo que la función (supabase/functions/reconocer,
 * con su mismo código): la primera foto es la "nueva" y se compara con otra
 * foto del mismo animal y con fotos de otros animales, hasta --candidatos.
 * Cada foto se describe una vez. Antes de mandarlas, las recorta cuadradas y
 * las lleva a 320 px, como la miniatura que ve Claude en la app (--lado 0 las
 * manda como están).
 *
 * Mide, para cada umbral de confianza: qué parte de las fotos reconoce a su
 * animal y cuántas coincidencias falsas tendría cada foto; y cuánto cuesta.
 * Recomienda el umbral que más reconoce sin pasar de --falsos-max
 * coincidencias falsas por foto. No guarda las fotos ni las sube a ningún lado
 * fuera de la API.
 */

import Anthropic from '@anthropic-ai/sdk';
// Solo para el script (achicar las fotos como la miniatura); la función no lo usa.
import { Jimp } from 'jimp';

import {
  type CandidatoParaComparar,
  clasificarError,
  comparar,
  costoEstimado,
  crearCliente,
  describir,
  type Imagen,
  type Respuesta,
} from '../supabase/functions/reconocer/claude.ts';
import type { Descripcion } from '../supabase/functions/reconocer/validar.ts';

const EXTENSIONES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** El resultado de comparar una foto nueva con sus candidatos. */
export type Consulta = {
  animal: string;
  /** null si la foto nueva no se comparó (sin animal, otra especie o error). */
  mismo: number | null;
  /** La confianza con cada animal distinto. */
  otros: number[];
  veredictoMismo: string | null;
  veredictosOtros: string[];
};

export type Fila = {
  umbral: number;
  /** Fracción de las fotos que encuentran a su animal (las no comparadas cuentan como no encontradas). */
  reconoce: number;
  /** Promedio de animales distintos que pasan el umbral, por foto. */
  falsosPorFoto: number;
  paresFalsos: number;
  totalFalsos: number;
};

// --- Cálculos (sin la API: los usan las pruebas) ----------------------------------

export function tabla(consultas: Consulta[], umbrales: number[]): Fila[] {
  const n = Math.max(consultas.length, 1);
  const totalFalsos = consultas.reduce((s, c) => s + c.otros.length, 0);
  return umbrales.map((umbral) => {
    const encontradas = consultas.filter((c) => c.mismo !== null && c.mismo >= umbral).length;
    const falsos = consultas.reduce((s, c) => s + c.otros.filter((x) => x >= umbral).length, 0);
    return { umbral, reconoce: encontradas / n, falsosPorFoto: falsos / n, paresFalsos: falsos, totalFalsos };
  });
}

/** El que más reconoce sin pasar de falsosMax por foto; a igual, el umbral más alto. Uno que no reconoce nada no sirve. */
export function recomendar(filas: Fila[], falsosMax: number): Fila | null {
  const aceptables = filas.filter((f) => f.falsosPorFoto <= falsosMax && f.reconoce > 0);
  if (aceptables.length === 0) return null;
  return aceptables.reduce((mejor, f) =>
    f.reconoce > mejor.reconoce || (f.reconoce === mejor.reconoce && f.umbral > mejor.umbral) ? f : mejor
  );
}

/** "50:95:5" → [50, 55, …, 95]. */
export function rango(texto: string): number[] {
  const [desde, hasta, paso] = texto.split(':').map(Number);
  if (![desde, hasta, paso].every(Number.isFinite) || paso <= 0) throw new Error(`Rango inválido: ${texto}`);
  const valores: number[] = [];
  for (let u = desde; u <= hasta + 1e-9; u += paso) valores.push(Math.round(u));
  return valores;
}

/** Un generador al azar con semilla (mulberry32): la misma corrida elige los mismos animales. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mezclar<T>(lista: T[], r: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// --- Fotos y API ----------------------------------------------------------------

type Opciones = {
  carpeta: string;
  especie: 'perro' | 'gato' | 'otro';
  candidatos: number;
  maxAnimales: number;
  maxFotos: number;
  modelo: string;
  umbrales: number[];
  falsosMax: number;
  semilla: number;
  lado: number;
  salida: string | null;
};

function leerOpciones(args: string[]): Opciones {
  const valores = new Map<string, string>();
  const sueltos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) valores.set(args[i].slice(2), args[++i] ?? '');
    else sueltos.push(args[i]);
  }
  const especie = valores.get('especie');
  if (sueltos.length !== 1 || (especie !== 'perro' && especie !== 'gato' && especie !== 'otro')) {
    throw new Error('Uso: evaluar-ia.ts CARPETA --especie perro|gato|otro [--candidatos 10] [--max-animales 30]');
  }
  const numero = (clave: string, defecto: number) => {
    const v = Number(valores.get(clave) ?? defecto);
    if (!Number.isFinite(v)) throw new Error(`--${clave} tiene que ser un número`);
    return v;
  };
  return {
    carpeta: sueltos[0],
    especie,
    candidatos: Math.max(2, Math.min(20, numero('candidatos', 10))),
    maxAnimales: numero('max-animales', 30),
    maxFotos: numero('max-fotos', 6),
    modelo: valores.get('modelo') ?? 'claude-haiku-5-5',
    umbrales: rango(valores.get('umbrales') ?? '50:95:5'),
    falsosMax: numero('falsos-max', 0.2),
    semilla: numero('semilla', 1),
    lado: numero('lado', 320),
    salida: valores.get('salida') ?? null,
  };
}

async function leerCarpeta(carpeta: string, maxFotos: number): Promise<Map<string, string[]>> {
  const animales = new Map<string, string[]>();
  const nombres: string[] = [];
  for await (const e of Deno.readDir(carpeta)) if (e.isDirectory) nombres.push(e.name);
  for (const nombre of nombres.sort()) {
    const fotos: string[] = [];
    for await (const e of Deno.readDir(`${carpeta}/${nombre}`)) {
      const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase();
      if (e.isFile && EXTENSIONES[ext]) fotos.push(`${carpeta}/${nombre}/${e.name}`);
    }
    fotos.sort();
    if (fotos.length >= 2) animales.set(nombre, fotos.slice(0, maxFotos));
  }
  return animales;
}

/** La foto en base64: recortada cuadrada y a `lado` px como la miniatura de la app, o tal cual. */
async function imagenDe(ruta: string, lado: number): Promise<Imagen> {
  const datos = await Deno.readFile(ruta);
  if (lado > 0) {
    const foto = await Jimp.fromBuffer(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength));
    foto.cover({ w: lado, h: lado });
    const jpeg = await foto.getBuffer('image/jpeg', { quality: 85 });
    return { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(jpeg)) };
  }
  const ext = ruta.slice(ruta.lastIndexOf('.')).toLowerCase();
  return { type: 'base64', media_type: EXTENSIONES[ext], data: base64(datos) };
}

function base64(bytes: Uint8Array): string {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

type Gasto = { llamadas: number; entrada: number; salida: number; costo: number; fallidas: number };

/** Llama, cuenta el gasto y reintenta los errores de la API (hasta 3 veces, con espera). */
async function conReintentos<T>(gasto: Gasto, modelo: string, hacer: () => Promise<Respuesta<T>>): Promise<T | null> {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await hacer();
      gasto.llamadas += 1;
      gasto.entrada += r.uso.entrada;
      gasto.salida += r.uso.salida;
      gasto.costo += costoEstimado(modelo, r.uso) ?? 0;
      if (r.valida) return r.valor;
      console.error(`  respuesta inválida (${r.motivo})`);
    } catch (error) {
      const { resultado, detalle } = clasificarError(error);
      console.error(`  error de la API: ${resultado} (${detalle})`);
      if (resultado === 'sin_credito') throw new Error('Sin crédito en la cuenta de Anthropic.');
      if (error instanceof Anthropic.AuthenticationError) throw new Error('La clave no sirve (ANTHROPIC_API_KEY).');
    }
    await new Promise((listo) => setTimeout(listo, 5000 * intento));
  }
  gasto.fallidas += 1;
  return null;
}

const porcentaje = (x: number) => `${(x * 100).toFixed(1)} %`.padStart(8);

async function main(args: string[]): Promise<number> {
  const o = leerOpciones(args);
  const clave = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim();
  if (!clave) {
    console.error('Falta ANTHROPIC_API_KEY (ver el reporte, "Evaluar").');
    return 1;
  }
  const cliente = crearCliente(clave);

  const todos = await leerCarpeta(o.carpeta, o.maxFotos);
  if (todos.size < 2) {
    console.error('Hacen falta al menos dos subcarpetas con dos fotos o más.');
    return 1;
  }
  const r = azar(o.semilla);
  const nombres = mezclar([...todos.keys()], r).slice(0, o.maxAnimales);
  console.error(`${nombres.length} animales de ${todos.size}, ${o.candidatos} candidatos por foto, modelo ${o.modelo}`);

  const gasto: Gasto = { llamadas: 0, entrada: 0, salida: 0, costo: 0, fallidas: 0 };
  const imagenes = new Map<string, Imagen>();
  const descripciones = new Map<string, Descripcion | null>();
  const imagen = async (ruta: string) => {
    if (!imagenes.has(ruta)) imagenes.set(ruta, await imagenDe(ruta, o.lado));
    return imagenes.get(ruta) as Imagen;
  };
  const descripcion = async (ruta: string) => {
    if (!descripciones.has(ruta)) {
      const img = await imagen(ruta);
      descripciones.set(ruta, await conReintentos(gasto, o.modelo, () => describir(cliente, o.modelo, img)));
    }
    return descripciones.get(ruta) ?? null;
  };
  // Como la base: una foto sin animal, o de otra especie, no se compara.
  const comparable = (d: Descripcion | null) => d !== null && d.hay_animal && d.especie === o.especie;

  const consultas: Consulta[] = [];
  let sinComparar = 0;
  for (const [i, nombre] of nombres.entries()) {
    console.error(`[${i + 1}/${nombres.length}] ${nombre}`);
    const [nueva, misma] = todos.get(nombre) as string[];
    const dNueva = await descripcion(nueva);
    if (!comparable(dNueva)) {
      sinComparar += 1;
      consultas.push({ animal: nombre, mismo: null, otros: [], veredictoMismo: null, veredictosOtros: [] });
      continue;
    }
    const distintos = mezclar(nombres.filter((x) => x !== nombre), r)
      .slice(0, o.candidatos - 1)
      .map((x) => ({ animal: x, ruta: (todos.get(x) as string[])[0] }));
    const fotos = mezclar([{ animal: nombre, ruta: misma }, ...distintos], r);
    const candidatos: (CandidatoParaComparar & { animal: string })[] = [];
    for (const f of fotos) {
      const d = await descripcion(f.ruta);
      if (d !== null && !d.hay_animal) continue; // la base no lo daría como candidato
      candidatos.push({
        animal: f.animal,
        etiqueta: `C${candidatos.length + 1}`,
        imagen: await imagen(f.ruta),
        tipo_reporte: 'encontrado',
        tamanio: null,
        color: null,
        tiene_collar: false,
        descripcion: d,
      });
    }
    const resultados = await conReintentos(
      gasto,
      o.modelo,
      () =>
        comparar(cliente, o.modelo, {
          imagen: imagenes.get(nueva) as Imagen,
          tipo_reporte: 'perdido',
          descripcion: dNueva as Descripcion,
        }, candidatos),
    );
    if (!resultados) {
      sinComparar += 1;
      consultas.push({ animal: nombre, mismo: null, otros: [], veredictoMismo: null, veredictosOtros: [] });
      continue;
    }
    const animalDe = new Map(candidatos.map((c) => [c.etiqueta, c.animal]));
    const delMismo = resultados.find((x) => animalDe.get(x.candidato) === nombre);
    const deOtros = resultados.filter((x) => animalDe.get(x.candidato) !== nombre);
    consultas.push({
      animal: nombre,
      mismo: delMismo?.confianza ?? null,
      otros: deOtros.map((x) => x.confianza),
      veredictoMismo: delMismo?.veredicto ?? null,
      veredictosOtros: deOtros.map((x) => x.veredicto),
    });
  }

  const filas = tabla(consultas, o.umbrales);
  console.log(`\n${consultas.length} fotos, ${sinComparar} sin comparar (sin animal, otra especie o error)\n`);
  console.log('umbral  reconoce  falsos/foto  pares falsos');
  for (const f of filas) {
    console.log(
      `${String(f.umbral).padStart(6)}  ${porcentaje(f.reconoce)}  ${
        f.falsosPorFoto.toFixed(2).padStart(11)
      }  ${f.paresFalsos}/${f.totalFalsos}`,
    );
  }
  const cuenta = (lista: (string | null)[]) =>
    ['mismo', 'posible', 'distinto'].map((v) => `${v} ${lista.filter((x) => x === v).length}`).join(', ');
  console.log(`\nVeredictos con su animal: ${cuenta(consultas.map((c) => c.veredictoMismo))}`);
  console.log(`Veredictos con otros: ${cuenta(consultas.flatMap((c) => c.veredictosOtros))}`);

  const n = Math.max(consultas.length, 1);
  console.log(
    `\nCosto: ${gasto.llamadas} llamadas, ${gasto.entrada} tokens de entrada y ${gasto.salida} de salida, ` +
      `US$${gasto.costo.toFixed(4)} (US$${(gasto.costo / n).toFixed(5)} por foto). ${gasto.fallidas} fallaron.`,
  );
  const elegida = recomendar(filas, o.falsosMax);
  console.log(
    elegida
      ? `\nRecomendado: umbral_ia = ${elegida.umbral} (reconoce el ${porcentaje(elegida.reconoce).trim()} con ${
        elegida.falsosPorFoto.toFixed(2)
      } coincidencias falsas por foto)`
      : `\nNingún umbral reconoce fotos con ${o.falsosMax} falsas por foto o menos: probá otro rango o revisá las fotos.`,
  );
  if (o.salida) {
    await Deno.writeTextFile(o.salida, JSON.stringify({ opciones: { ...o }, consultas, filas, gasto }, null, 2));
    console.error(`Resultados en ${o.salida}`);
  }
  return 0;
}

if (import.meta.main) {
  try {
    Deno.exit(await main(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
