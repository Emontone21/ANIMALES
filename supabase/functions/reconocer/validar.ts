/**
 * Valida lo que devuelve Claude contra el esquema de cada herramienta. La API
 * ya restringe la forma (herramientas con strict), pero no los largos ni los
 * rangos, y una respuesta cortada o rara no tiene por qué cumplir: lo que no
 * valida cuenta como error y la foto se reintenta (la cola).
 *
 * Los largos del motivo y de las listas de rasgos (rasgos, coinciden y
 * difieren) son un tope de pantalla, no de seguridad: si lo único mal es que
 * se pasan, se recortan y la respuesta vale, con un aviso de cuánto se pasó
 * (queda en llamadas_ia.detalle). El modelo escribe pegado al tope y el
 * esquema estricto no puede limitar largos.
 */

export const ESPECIES = ['perro', 'gato', 'otro', 'ninguno'] as const;
export const COLORES = ['negro', 'blanco', 'gris', 'marron', 'dorado', 'naranja', 'otro', 'no_se_ve'] as const;
export const COLORES_SECUNDARIOS = [...COLORES, 'ninguno'] as const;
export const PATRONES = ['liso', 'bicolor', 'manchas', 'atigrado', 'tricolor', 'otro', 'no_se_ve'] as const;
export const TAMANIOS = ['chico', 'mediano', 'grande', 'no_se_ve'] as const;
export const COLLARES = ['si', 'no', 'no_se_ve'] as const;
export const CALIDADES = ['buena', 'regular', 'mala'] as const;
export const VEREDICTOS = ['mismo', 'posible', 'distinto'] as const;

/** Los mismos largos que los checks de la migración 0018. */
export const LIMITES = {
  motivo: 140,
  rasgo: 80,
  rasgos: 8,
  collarColor: 40,
  raza: 60,
} as const;

/** Lo que se le pide al modelo, por debajo de los topes, así no vive pegado a ellos. */
export const OBJETIVOS = {
  motivo: 110,
  rasgo: 60,
} as const;

export type Especie = (typeof ESPECIES)[number];
export type Veredicto = (typeof VEREDICTOS)[number];

export type Descripcion = {
  hay_animal: boolean;
  especie: Especie;
  color_principal: (typeof COLORES)[number];
  color_secundario: (typeof COLORES_SECUNDARIOS)[number];
  patron: (typeof PATRONES)[number];
  tamanio: (typeof TAMANIOS)[number];
  collar: (typeof COLLARES)[number];
  collar_color: string | null;
  raza_aproximada: string | null;
  rasgos: string[];
  calidad: (typeof CALIDADES)[number];
};

export type ResultadoComparacion = {
  candidato: string;
  veredicto: Veredicto;
  /** De 0 a 100, la probabilidad de que sea el mismo animal: 0 seguro que no, 100 seguro que sí. */
  probabilidad_mismo: number;
  motivo: string;
  coinciden: string[];
  difieren: string[];
};

/** `avisos`: lo que se recortó y cuánto se pasaba ("C1 motivo: 163 > 140"). */
export type Validacion<T> = { ok: true; valor: T; avisos: string[] } | { ok: false; motivo: string };

const CLAVES_DESCRIPCION = [
  'hay_animal',
  'especie',
  'color_principal',
  'color_secundario',
  'patron',
  'tamanio',
  'collar',
  'collar_color',
  'raza_aproximada',
  'rasgos',
  'calidad',
] as const;

const CLAVES_RESULTADO = ['candidato', 'veredicto', 'probabilidad_mismo', 'motivo', 'coinciden', 'difieren'] as const;

/**
 * Desde dónde la probabilidad dice "es el mismo": "distinto" tiene que quedar
 * por debajo y "mismo", llegar. Si no, la respuesta se contradice (la IA usó
 * el número como qué tan segura estaba de su veredicto) y no vale.
 */
export const PROBABILIDAD_MEDIA = 50;

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Las claves tienen que ser exactamente estas (strict ya lo pide). */
function clavesExactas(x: Record<string, unknown>, claves: readonly string[]): string | null {
  for (const clave of claves) if (!(clave in x)) return `falta ${clave}`;
  for (const clave of Object.keys(x)) if (!claves.includes(clave)) return `sobra ${clave}`;
  return null;
}

function enLista<T extends string>(x: unknown, lista: readonly T[]): x is T {
  return typeof x === 'string' && (lista as readonly string[]).includes(x);
}

/** Caracteres como los cuenta char_length en Postgres (un emoji es uno). */
export function largo(texto: string): number {
  return Array.from(texto).length;
}

/**
 * Corta un texto a `maximo` caracteres contando el "…": en el último espacio
 * antes del tope, sin la puntuación que quede colgando. Sin espacios, justo.
 */
export function recortar(texto: string, maximo: number): string {
  const letras = Array.from(texto);
  if (letras.length <= maximo) return texto;
  const corte = letras.slice(0, maximo - 1).join('');
  const espacio = corte.lastIndexOf(' ');
  const base = (espacio > 0 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.\-–—]+$/u, '');
  return `${base === '' ? corte : base}…`;
}

/** null, o un texto de hasta `maximo` caracteres; uno vacío cuenta como null. Uno largo no vale. */
function textoOpcional(
  x: unknown,
  maximo: number,
): { ok: true; valor: string | null } | { ok: false; largo?: number } {
  if (x === null) return { ok: true, valor: null };
  if (typeof x !== 'string') return { ok: false };
  const valor = x.trim();
  if (largo(valor) > maximo) return { ok: false, largo: largo(valor) };
  return { ok: true, valor: valor === '' ? null : valor };
}

/**
 * Una lista de textos no vacíos. Si trae más de LIMITES.rasgos se queda con
 * los primeros, y los de más de LIMITES.rasgo se recortan; cada cosa, con su
 * aviso. Un elemento que no es texto, o vacío, no vale.
 */
function listaDeTextos(x: unknown, campo: string): { valores: string[]; avisos: string[] } | null {
  if (!Array.isArray(x)) return null;
  const avisos: string[] = [];
  const valores: string[] = [];
  for (const item of x) {
    if (typeof item !== 'string') return null;
    const valor = item.trim();
    if (valor.length === 0) return null;
    valores.push(valor);
  }
  if (valores.length > LIMITES.rasgos) avisos.push(`${campo}: ${valores.length} > ${LIMITES.rasgos}`);
  const primeros = valores.slice(0, LIMITES.rasgos).map((valor, i) => {
    if (largo(valor) <= LIMITES.rasgo) return valor;
    avisos.push(`${campo}[${i + 1}]: ${largo(valor)} > ${LIMITES.rasgo}`);
    return recortar(valor, LIMITES.rasgo);
  });
  return { valores: primeros, avisos };
}

/** "collar_color" o, si se pasó de largo, "collar_color: 45 > 40". */
const conLargo = (campo: string, maximo: number, r: { largo?: number }) =>
  r.largo === undefined ? campo : `${campo}: ${r.largo} > ${maximo}`;

export function validarDescripcion(x: unknown): Validacion<Descripcion> {
  if (!esObjeto(x)) return { ok: false, motivo: 'no es un objeto' };
  const claves = clavesExactas(x, CLAVES_DESCRIPCION);
  if (claves) return { ok: false, motivo: claves };

  if (typeof x.hay_animal !== 'boolean') return { ok: false, motivo: 'hay_animal' };
  if (!enLista(x.especie, ESPECIES)) return { ok: false, motivo: 'especie' };
  // Sin animal no hay especie, y con animal sí.
  if (x.hay_animal === (x.especie === 'ninguno')) return { ok: false, motivo: 'especie y hay_animal' };
  if (!enLista(x.color_principal, COLORES)) return { ok: false, motivo: 'color_principal' };
  if (!enLista(x.color_secundario, COLORES_SECUNDARIOS)) return { ok: false, motivo: 'color_secundario' };
  if (!enLista(x.patron, PATRONES)) return { ok: false, motivo: 'patron' };
  if (!enLista(x.tamanio, TAMANIOS)) return { ok: false, motivo: 'tamanio' };
  if (!enLista(x.collar, COLLARES)) return { ok: false, motivo: 'collar' };
  const collarColor = textoOpcional(x.collar_color, LIMITES.collarColor);
  if (!collarColor.ok) return { ok: false, motivo: conLargo('collar_color', LIMITES.collarColor, collarColor) };
  const raza = textoOpcional(x.raza_aproximada, LIMITES.raza);
  if (!raza.ok) return { ok: false, motivo: conLargo('raza_aproximada', LIMITES.raza, raza) };
  const rasgos = listaDeTextos(x.rasgos, 'rasgos');
  if (!rasgos) return { ok: false, motivo: 'rasgos' };
  if (!enLista(x.calidad, CALIDADES)) return { ok: false, motivo: 'calidad' };

  return {
    ok: true,
    valor: {
      hay_animal: x.hay_animal,
      especie: x.especie,
      color_principal: x.color_principal,
      color_secundario: x.color_secundario,
      patron: x.patron,
      tamanio: x.tamanio,
      collar: x.collar,
      collar_color: collarColor.valor,
      raza_aproximada: raza.valor,
      rasgos: rasgos.valores,
      calidad: x.calidad,
    },
    avisos: rasgos.avisos,
  };
}

/** Un resultado por candidato, cada uno una sola vez, en cualquier orden. */
export function validarComparacion(
  x: unknown,
  etiquetas: readonly string[],
): Validacion<ResultadoComparacion[]> {
  if (!esObjeto(x)) return { ok: false, motivo: 'no es un objeto' };
  const claves = clavesExactas(x, ['resultados']);
  if (claves) return { ok: false, motivo: claves };
  if (!Array.isArray(x.resultados)) return { ok: false, motivo: 'resultados' };
  if (x.resultados.length !== etiquetas.length) {
    return { ok: false, motivo: `${x.resultados.length} resultados para ${etiquetas.length} candidatos` };
  }

  const vistos = new Set<string>();
  const valores: ResultadoComparacion[] = [];
  const avisos: string[] = [];
  for (const r of x.resultados) {
    if (!esObjeto(r)) return { ok: false, motivo: 'resultado' };
    const faltan = clavesExactas(r, CLAVES_RESULTADO);
    if (faltan) return { ok: false, motivo: faltan };
    if (typeof r.candidato !== 'string' || !etiquetas.includes(r.candidato)) {
      return { ok: false, motivo: 'candidato desconocido' };
    }
    if (vistos.has(r.candidato)) return { ok: false, motivo: 'candidato repetido' };
    vistos.add(r.candidato);
    if (!enLista(r.veredicto, VEREDICTOS)) return { ok: false, motivo: 'veredicto' };
    const probabilidad = r.probabilidad_mismo;
    if (typeof probabilidad !== 'number' || !Number.isInteger(probabilidad) || probabilidad < 0 || probabilidad > 100) {
      return { ok: false, motivo: 'probabilidad_mismo' };
    }
    if (
      (r.veredicto === 'distinto' && probabilidad >= PROBABILIDAD_MEDIA) ||
      (r.veredicto === 'mismo' && probabilidad < PROBABILIDAD_MEDIA)
    ) {
      return { ok: false, motivo: `${r.candidato} ${r.veredicto} con probabilidad_mismo ${probabilidad}` };
    }
    if (typeof r.motivo !== 'string' || r.motivo.trim().length === 0) return { ok: false, motivo: 'motivo' };
    let motivo = r.motivo.trim();
    if (largo(motivo) > LIMITES.motivo) {
      avisos.push(`${r.candidato} motivo: ${largo(motivo)} > ${LIMITES.motivo}`);
      motivo = recortar(motivo, LIMITES.motivo);
    }
    const coinciden = listaDeTextos(r.coinciden, `${r.candidato} coinciden`);
    const difieren = listaDeTextos(r.difieren, `${r.candidato} difieren`);
    if (!coinciden || !difieren) return { ok: false, motivo: 'coinciden o difieren' };
    avisos.push(...coinciden.avisos, ...difieren.avisos);
    valores.push({
      candidato: r.candidato,
      veredicto: r.veredicto,
      probabilidad_mismo: probabilidad,
      motivo,
      coinciden: coinciden.valores,
      difieren: difieren.valores,
    });
  }
  return { ok: true, valor: valores, avisos };
}
