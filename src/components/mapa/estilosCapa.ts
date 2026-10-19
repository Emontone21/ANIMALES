import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';

import { coloresDeEstado, type Esquema, OPACIDAD_REUNIDO, type Paleta } from '@/constants/tema';
import type { EstadoAnimal } from '@/types/dominio';

/**
 * Capas de marcadores, compartidas entre el mapa nativo (MapLibre React
 * Native) y el web (MapLibre GL JS). Son JSON del style spec y reciben la
 * paleta del esquema activo, así sirven igual en los dos y en claro u oscuro.
 * Marcadores según docs/DISENO.md, 6.6 (etapa 1: círculos; la foto solo en el
 * seleccionado hasta que haya miniaturas).
 */

// --- Animales ----------------------------------------------------------------

export const ID_FUENTE_ANIMALES = 'animales';
export const ID_CAPA_CLUSTER = 'animales-cluster';
export const ID_CAPA_CLUSTER_NUMERO = 'animales-cluster-numero';
export const ID_CAPA_HALO = 'animales-halo';
export const ID_CAPA_PUNTO = 'animales-punto';
export const ID_CAPA_CENTRO = 'animales-centro';

export const OPCIONES_CLUSTER = { cluster: true, clusterRadius: 44, clusterMaxZoom: 15 } as const;

export const FILTRO_CLUSTER: FilterSpecification = ['has', 'point_count'];
const PUNTO_SUELTO: ExpressionSpecification = ['!', ['has', 'point_count']];
const ES_PERDIDO: ExpressionSpecification = ['==', ['get', 'tipo'], 'perdido'];

/**
 * Sin el seleccionado: ese caso se dibuja con su foto (marcador aparte) y el
 * círculo quedaría asomando debajo.
 */
function sinSeleccionado(
  condiciones: ExpressionSpecification[],
  id: string | null,
): FilterSpecification {
  if (!id) return ['all', ...condiciones];
  const distinto: ExpressionSpecification = ['!=', ['get', 'id'], id];
  return ['all', ...condiciones, distinto];
}

/** Puntos sueltos (no clusters). */
export const filtroPunto = (seleccionadoId: string | null) =>
  sinSeleccionado([PUNTO_SUELTO], seleccionadoId);
/** Puntos sueltos de animales perdidos: llevan halo. */
export const filtroPerdido = (seleccionadoId: string | null) =>
  sinSeleccionado([PUNTO_SUELTO, ES_PERDIDO], seleccionadoId);

// Fuente disponible en los estilos de OpenFreeMap (Positron, Liberty, Bright).
const FUENTE_NUMEROS = ['Noto Sans Bold'];

/** Color del anillo según estado y tipo, igual que coloresDeEstado. */
function anilloPorEstado(c: Paleta): ExpressionSpecification {
  const anillo = (estado: EstadoAnimal) => coloresDeEstado(c, estado).anillo;
  return [
    'case',
    ['all', ['==', ['get', 'tipo'], 'perdido'], ['==', ['get', 'estado'], 'avistado']],
    c.perdido,
    [
      'match',
      ['get', 'estado'],
      'resguardado',
      anillo('resguardado'),
      'reunido',
      anillo('reunido'),
      'vinculado',
      anillo('vinculado'),
      anillo('avistado'),
    ],
  ];
}

const OPACIDAD: ExpressionSpecification = [
  'match',
  ['get', 'estado'],
  'reunido',
  OPACIDAD_REUNIDO,
  1,
];

/** Radio según si su tarjeta tiene el mouse encima (solo web, con feature-state). */
function radioResaltable(normal: number, resaltado: number): ExpressionSpecification {
  return ['case', ['boolean', ['feature-state', 'resaltado'], false], resaltado, normal];
}

export function paintCluster(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
    'circle-color': c.inverso,
    'circle-stroke-width': 3,
    'circle-stroke-color': c.superficie,
  };
}

export const LAYOUT_CLUSTER_NUMERO: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'point_count_abbreviated'],
  'text-size': 13,
  'text-font': FUENTE_NUMEROS,
  'text-allow-overlap': true,
};

export function paintClusterNumero(c: Paleta): SymbolLayerSpecification['paint'] {
  return { 'text-color': c.textoInverso };
}

/** Halo de 9 a 10 px alrededor de los perdidos: se distinguen también sin color. */
export function paintHalo(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': 21,
    'circle-color': c.perdido,
    'circle-opacity': 0.22,
  };
}

export function paintPunto(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': radioResaltable(11, 14),
    'circle-color': c.superficie,
    'circle-stroke-width': 3,
    'circle-stroke-color': anilloPorEstado(c),
    'circle-opacity': OPACIDAD,
    'circle-stroke-opacity': OPACIDAD,
  };
}

/** Centro del marcador en el color del tipo, hasta que haya foto en cada uno. */
export function paintCentro(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': radioResaltable(4.5, 6),
    'circle-color': anilloPorEstado(c),
    'circle-opacity': OPACIDAD,
  };
}

// --- Mi ubicación --------------------------------------------------------------

export const ID_FUENTE_MI_UBICACION = 'mi-ubicacion';
export const ID_CAPA_MI_UBICACION_HALO = 'mi-ubicacion-halo';
export const ID_CAPA_MI_UBICACION = 'mi-ubicacion-punto';

export function paintMiUbicacionHalo(
  c: Paleta,
  esquema: Esquema,
): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': 22,
    'circle-color': c.texto,
    'circle-opacity': esquema === 'oscuro' ? 0.12 : 0.1,
  };
}

export function paintMiUbicacion(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': 8,
    'circle-color': c.texto,
    'circle-stroke-width': 3,
    'circle-stroke-color': c.superficie,
  };
}

// --- Recorrido de un animal (línea punteada entre avistamientos) ---------------

export const ID_FUENTE_RECORRIDO = 'recorrido';
export const ID_CAPA_RECORRIDO_LINEA = 'recorrido-linea';
export const ID_CAPA_RECORRIDO_HALO = 'recorrido-halo';
export const ID_CAPA_RECORRIDO_PUNTO = 'recorrido-punto';

export const FILTRO_LINEA: FilterSpecification = ['==', ['geometry-type'], 'LineString'];
export const FILTRO_PUNTO_RECORRIDO: FilterSpecification = ['==', ['geometry-type'], 'Point'];
export const FILTRO_ULTIMO: FilterSpecification = [
  'all',
  ['==', ['geometry-type'], 'Point'],
  ['==', ['get', 'ultimo'], true],
];

export const LAYOUT_RECORRIDO_LINEA: LineLayerSpecification['layout'] = {
  'line-cap': 'round',
  'line-join': 'round',
};

export function paintRecorridoLinea(c: Paleta): LineLayerSpecification['paint'] {
  return {
    'line-color': c.textoSecundario,
    'line-width': 2.5,
    'line-dasharray': [1.2, 1.8],
  };
}

/** Halo del último punto, en el color del tipo del caso. */
export function paintRecorridoHalo(colorTipo: string): CircleLayerSpecification['paint'] {
  return { 'circle-radius': 18, 'circle-color': colorTipo, 'circle-opacity': 0.22 };
}

/** El último punto en el color del tipo; los anteriores, chicos y neutros. */
export function paintRecorridoPunto(
  c: Paleta,
  colorTipo: string,
): CircleLayerSpecification['paint'] {
  const ultimo: ExpressionSpecification = ['==', ['get', 'ultimo'], true];
  return {
    'circle-radius': ['case', ultimo, 8, 5],
    'circle-color': ['case', ultimo, colorTipo, c.puntoInactivo],
    'circle-stroke-width': ['case', ultimo, 3, 2],
    'circle-stroke-color': c.superficie,
  };
}
