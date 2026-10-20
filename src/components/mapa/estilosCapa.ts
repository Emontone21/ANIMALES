import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';

import type { Esquema, Paleta } from '@/constants/tema';
import { paradasRadioZona } from '@/features/mapa/encuadre';
import { masLegible } from '@/lib/contraste';

/**
 * Capas de marcadores, compartidas entre el mapa nativo (MapLibre React
 * Native) y el web (MapLibre GL JS). Son JSON del style spec y reciben la
 * paleta del esquema activo, así sirven igual en los dos y en claro u oscuro.
 * Marcadores según docs/DISENO.md, 6.6: los clusters son círculos; cada punto
 * suelto lleva un marcador con la foto (MarcadorFoto en nativo, un elemento del
 * DOM en web) sobre una zona táctil invisible.
 */

// --- Animales ----------------------------------------------------------------

export const ID_FUENTE_ANIMALES = 'animales';
export const ID_CAPA_CLUSTER = 'animales-cluster';
export const ID_CAPA_CLUSTER_NUMERO = 'animales-cluster-numero';
/** Puntos sueltos: zona táctil invisible bajo la foto, y la lista de los que se ven. */
export const ID_CAPA_PUNTO = 'animales-punto';

export const OPCIONES_CLUSTER = { cluster: true, clusterRadius: 44, clusterMaxZoom: 15 } as const;

/** Medidas del marcador con foto (6.6), iguales en web y en nativo. */
export const MARCADOR = {
  diametro: 48,
  diametroSeleccionado: 58,
  /** Borde interno en superficie y anillo exterior del color del tipo. */
  borde: 3,
  anillo: 3,
  /** Colita: rombo del color del tipo, que asoma debajo del círculo. */
  colita: 12,
  solapeColita: 8,
  /** Halo de los perdidos, al 22 %: se distinguen también sin color. */
  halo: 9.5,
  opacidadHalo: 0.22,
} as const;

/**
 * El marcador va anclado abajo (la colita en el punto): su círculo queda unas
 * decenas de píxeles por encima. La zona táctil se corre hasta ahí.
 */
const CENTRO_SOBRE_PUNTO = MARCADOR.diametro / 2 + MARCADOR.colita / 2;

export const FILTRO_CLUSTER: FilterSpecification = ['has', 'point_count'];
const PUNTO_SUELTO: ExpressionSpecification = ['!', ['has', 'point_count']];

/**
 * Puntos sueltos, sin el seleccionado: ese se dibuja aparte, más grande, y
 * aunque el cluster lo tape.
 */
export function filtroPunto(seleccionadoId: string | null): FilterSpecification {
  if (!seleccionadoId) return PUNTO_SUELTO;
  return ['all', PUNTO_SUELTO, ['!=', ['get', 'id'], seleccionadoId]];
}

// Fuente disponible en los estilos de OpenFreeMap (Positron, Liberty, Bright).
const FUENTE_NUMEROS = ['Noto Sans Bold'];

export function paintCluster(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    // Al menos 44 de diámetro: es lo que se toca para acercarse.
    'circle-radius': ['step', ['get', 'point_count'], 22, 50, 28],
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

/**
 * Zona táctil del marcador: un círculo casi transparente del tamaño de la
 * foto, corrido hasta donde está la foto. No es 0: con opacidad 0 el mapa
 * nativo puede no dibujarlo, y entonces no responde al toque ni aparece al
 * consultar qué puntos se ven.
 */
export function paintPunto(c: Paleta): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': MARCADOR.diametro / 2,
    'circle-color': c.superficie,
    'circle-opacity': 0.01,
    'circle-translate': [0, -CENTRO_SOBRE_PUNTO],
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

// --- Mapa en grande del recorrido (6.9.1) --------------------------------------

export const ID_FUENTE_RECORRIDO_GRANDE = 'recorrido-grande';
export const ID_CAPA_GRANDE_ZONA = 'recorrido-grande-zona';
export const ID_CAPA_GRANDE_LINEA = 'recorrido-grande-linea';
export const ID_CAPA_GRANDE_HALO = 'recorrido-grande-halo';
export const ID_CAPA_GRANDE_PUNTO = 'recorrido-grande-punto';
export const ID_CAPA_GRANDE_NUMERO = 'recorrido-grande-numero';
/** Lo que se toca para elegir un punto. */
export const CAPAS_GRANDE_TOCABLES = [
  ID_CAPA_GRANDE_NUMERO,
  ID_CAPA_GRANDE_PUNTO,
  ID_CAPA_GRANDE_ZONA,
] as const;

/** Medidas de los puntos del mapa en grande: más grandes que en el mini mapa, con su número. */
export const PUNTO_GRANDE = {
  radio: 13,
  radioUltimo: 15,
  /** Lo que crece el seleccionado, que además lleva borde en `texto`. */
  extraSeleccionado: 3,
  halo: 27,
  borde: 2.5,
  bordeSeleccionado: 3.5,
  numero: 13,
  numeroSeleccionado: 15,
  opacidadZona: 0.16,
} as const;

const ES_PUNTO: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
const APROXIMADO: ExpressionSpecification = ['==', ['get', 'aproximado'], true];
const ULTIMO: ExpressionSpecification = ['==', ['get', 'ultimo'], true];
const SELECCIONADO: ExpressionSpecification = ['==', ['get', 'seleccionado'], true];

/** Encimados, arriba va el elegido y, si no, el más nuevo. */
const ORDEN_DIBUJO: ExpressionSpecification = ['case', SELECCIONADO, 1e6, ['get', 'orden']];

export const LAYOUT_ZONA: CircleLayerSpecification['layout'] = { 'circle-sort-key': ORDEN_DIBUJO };
export const LAYOUT_PUNTO_GRANDE: CircleLayerSpecification['layout'] = {
  'circle-sort-key': ORDEN_DIBUJO,
};

export const FILTRO_ZONA: FilterSpecification = ['all', ES_PUNTO, APROXIMADO];
export const FILTRO_PUNTO_EXACTO: FilterSpecification = ['all', ES_PUNTO, ['!', APROXIMADO]];
export const FILTRO_HALO_GRANDE: FilterSpecification = ['all', ES_PUNTO, ULTIMO, ['!', APROXIMADO]];

/**
 * Zona de un punto aproximado: un círculo translúcido del color del tipo que
 * mide RADIO_APROXIMADO_M en el mapa (src/features/mapa/encuadre.ts).
 */
export function paintZonaAproximada(
  c: Paleta,
  colorTipo: string,
  latitud: number,
): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': [
      'interpolate',
      ['exponential', 2],
      ['zoom'],
      ...paradasRadioZona(latitud).flat(),
    ] as ExpressionSpecification,
    'circle-color': colorTipo,
    'circle-opacity': PUNTO_GRANDE.opacidadZona,
    'circle-stroke-width': ['case', SELECCIONADO, PUNTO_GRANDE.bordeSeleccionado, 2],
    'circle-stroke-color': ['case', SELECCIONADO, c.texto, colorTipo],
  };
}

export function paintLineaGrande(c: Paleta): LineLayerSpecification['paint'] {
  return { ...paintRecorridoLinea(c), 'line-width': 3 };
}

export function paintHaloGrande(colorTipo: string): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': [
      'case',
      SELECCIONADO,
      PUNTO_GRANDE.halo + PUNTO_GRANDE.extraSeleccionado,
      PUNTO_GRANDE.halo,
    ],
    'circle-color': colorTipo,
    'circle-opacity': 0.22,
  };
}

/** Como en el mini mapa: el último en el color del tipo y los anteriores neutros. */
export function paintPuntoGrande(c: Paleta, colorTipo: string): CircleLayerSpecification['paint'] {
  return {
    'circle-radius': [
      '+',
      ['case', ULTIMO, PUNTO_GRANDE.radioUltimo, PUNTO_GRANDE.radio],
      ['case', SELECCIONADO, PUNTO_GRANDE.extraSeleccionado, 0],
    ],
    'circle-color': ['case', ULTIMO, colorTipo, c.puntoInactivo],
    'circle-stroke-width': [
      'case',
      SELECCIONADO,
      PUNTO_GRANDE.bordeSeleccionado,
      PUNTO_GRANDE.borde,
    ],
    'circle-stroke-color': ['case', SELECCIONADO, c.texto, c.superficie],
  };
}

export const LAYOUT_NUMERO_GRANDE: SymbolLayerSpecification['layout'] = {
  'text-field': ['to-string', ['get', 'orden']],
  'symbol-sort-key': ORDEN_DIBUJO,
  'text-size': ['case', SELECCIONADO, PUNTO_GRANDE.numeroSeleccionado, PUNTO_GRANDE.numero],
  'text-font': FUENTE_NUMEROS,
  // Siempre se ven todos, aunque se encimen: el orden es lo que se vino a mirar.
  'text-allow-overlap': true,
  'text-ignore-placement': true,
};

/**
 * El número, con el color que más se lee sobre su punto. En las zonas va sobre
 * el mapa, con un borde en superficie.
 */
export function paintNumeroGrande(c: Paleta, colorTipo: string): SymbolLayerSpecification['paint'] {
  const opciones = [c.texto, c.textoInverso, c.textoSobrePrimario];
  return {
    'text-color': [
      'case',
      APROXIMADO,
      c.texto,
      ULTIMO,
      masLegible(colorTipo, opciones),
      masLegible(c.puntoInactivo, opciones),
    ],
    'text-halo-color': c.superficie,
    'text-halo-width': ['case', APROXIMADO, 2, 0],
  };
}
