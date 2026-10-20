/**
 * Valida lo que devuelve Claude contra el esquema de cada herramienta. La API
 * ya restringe la forma (herramientas con strict), pero no los largos ni los
 * rangos, y una respuesta cortada o rara no tiene por qué cumplir: lo que no
 * valida cuenta como error y la foto se reintenta (la cola).
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
  confianza: number;
  veredicto: Veredicto;
  motivo: string;
  coinciden: string[];
  difieren: string[];
};

export type Validacion<T> = { ok: true; valor: T } | { ok: false; motivo: string };

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

const CLAVES_RESULTADO = ['candidato', 'confianza', 'veredicto', 'motivo', 'coinciden', 'difieren'] as const;

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

/** null, o un texto de hasta `maximo` caracteres; uno vacío cuenta como null. */
function textoOpcional(x: unknown, maximo: number): { ok: true; valor: string | null } | { ok: false } {
  if (x === null) return { ok: true, valor: null };
  if (typeof x !== 'string') return { ok: false };
  const valor = x.trim();
  if (valor.length > maximo) return { ok: false };
  return { ok: true, valor: valor === '' ? null : valor };
}

/** Una lista de hasta `cantidad` textos de 1 a `largo` caracteres. */
function listaDeTextos(x: unknown, cantidad: number, largo: number): string[] | null {
  if (!Array.isArray(x) || x.length > cantidad) return null;
  const valores: string[] = [];
  for (const item of x) {
    if (typeof item !== 'string') return null;
    const valor = item.trim();
    if (valor.length === 0 || valor.length > largo) return null;
    valores.push(valor);
  }
  return valores;
}

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
  if (!collarColor.ok) return { ok: false, motivo: 'collar_color' };
  const raza = textoOpcional(x.raza_aproximada, LIMITES.raza);
  if (!raza.ok) return { ok: false, motivo: 'raza_aproximada' };
  const rasgos = listaDeTextos(x.rasgos, LIMITES.rasgos, LIMITES.rasgo);
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
      rasgos,
      calidad: x.calidad,
    },
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
  for (const r of x.resultados) {
    if (!esObjeto(r)) return { ok: false, motivo: 'resultado' };
    const faltan = clavesExactas(r, CLAVES_RESULTADO);
    if (faltan) return { ok: false, motivo: faltan };
    if (typeof r.candidato !== 'string' || !etiquetas.includes(r.candidato)) {
      return { ok: false, motivo: 'candidato desconocido' };
    }
    if (vistos.has(r.candidato)) return { ok: false, motivo: 'candidato repetido' };
    vistos.add(r.candidato);
    if (!Number.isInteger(r.confianza) || (r.confianza as number) < 0 || (r.confianza as number) > 100) {
      return { ok: false, motivo: 'confianza' };
    }
    if (!enLista(r.veredicto, VEREDICTOS)) return { ok: false, motivo: 'veredicto' };
    const motivo = typeof r.motivo === 'string' ? r.motivo.trim() : '';
    if (motivo.length === 0 || motivo.length > LIMITES.motivo) return { ok: false, motivo: 'motivo' };
    const coinciden = listaDeTextos(r.coinciden, LIMITES.rasgos, LIMITES.rasgo);
    const difieren = listaDeTextos(r.difieren, LIMITES.rasgos, LIMITES.rasgo);
    if (!coinciden || !difieren) return { ok: false, motivo: 'coinciden o difieren' };
    valores.push({
      candidato: r.candidato,
      confianza: r.confianza as number,
      veredicto: r.veredicto,
      motivo,
      coinciden,
      difieren,
    });
  }
  return { ok: true, valor: valores };
}
