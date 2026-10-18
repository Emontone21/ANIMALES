import type {
  CircleLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';

import { ColorEspecie, Colores } from '@/constants/tema';

/**
 * Estilo de las capas de marcadores, compartido entre el mapa nativo
 * (MapLibre React Native) y el web (MapLibre GL JS). Es JSON del style spec,
 * así que sirve igual en los dos.
 */

export const ID_FUENTE_ANIMALES = 'animales';
export const ID_CAPA_CLUSTER = 'animales-cluster';
export const ID_CAPA_CLUSTER_NUMERO = 'animales-cluster-numero';
export const ID_CAPA_PUNTO = 'animales-punto';

export const OPCIONES_CLUSTER = { cluster: true, clusterRadius: 44, clusterMaxZoom: 15 } as const;

export const FILTRO_CLUSTER: FilterSpecification = ['has', 'point_count'];
export const FILTRO_PUNTO: FilterSpecification = ['!', ['has', 'point_count']];

export const PAINT_CLUSTER: CircleLayerSpecification['paint'] = {
  'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
  'circle-color': Colores.primario,
  'circle-stroke-width': 3,
  'circle-stroke-color': '#FFFFFF',
};

export const LAYOUT_CLUSTER_NUMERO: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'point_count_abbreviated'],
  'text-size': 13,
  // Fuente disponible en los estilos de OpenFreeMap.
  'text-font': ['Noto Sans Bold'],
  'text-allow-overlap': true,
};

export const PAINT_CLUSTER_NUMERO: SymbolLayerSpecification['paint'] = {
  'text-color': '#FFFFFF',
};

export const PAINT_PUNTO: CircleLayerSpecification['paint'] = {
  'circle-radius': 10,
  'circle-color': [
    'match',
    ['get', 'especie'],
    'perro',
    ColorEspecie.perro,
    'gato',
    ColorEspecie.gato,
    ColorEspecie.otro,
  ],
  'circle-stroke-width': ['match', ['get', 'estado'], 'resguardado', 4, 2.5],
  'circle-stroke-color': ['match', ['get', 'estado'], 'resguardado', Colores.primario, '#FFFFFF'],
  'circle-opacity': ['match', ['get', 'estado'], 'reunido', 0.45, 1],
};

// --- Recorrido de un animal (línea entre avistamientos + puntos numerados) ---

export const ID_FUENTE_RECORRIDO = 'recorrido';
export const ID_CAPA_RECORRIDO_LINEA = 'recorrido-linea';
export const ID_CAPA_RECORRIDO_PUNTO = 'recorrido-punto';
export const ID_CAPA_RECORRIDO_NUMERO = 'recorrido-numero';

export const FILTRO_LINEA: FilterSpecification = ['==', ['geometry-type'], 'LineString'];
export const FILTRO_PUNTO_RECORRIDO: FilterSpecification = ['==', ['geometry-type'], 'Point'];

export const PAINT_RECORRIDO_LINEA: LineLayerSpecification['paint'] = {
  'line-color': Colores.primario,
  'line-width': 3,
  'line-opacity': 0.85,
  'line-dasharray': [2, 1.5],
};

export const LAYOUT_RECORRIDO_LINEA: LineLayerSpecification['layout'] = {
  'line-cap': 'round',
  'line-join': 'round',
};

export const PAINT_RECORRIDO_PUNTO: CircleLayerSpecification['paint'] = {
  'circle-radius': 11,
  'circle-color': ['match', ['get', 'tipo'], 'resguardado', Colores.primario, '#FFFFFF'],
  'circle-stroke-width': 2.5,
  'circle-stroke-color': Colores.primario,
};

export const LAYOUT_RECORRIDO_NUMERO: SymbolLayerSpecification['layout'] = {
  'text-field': ['to-string', ['get', 'orden']],
  'text-size': 12,
  'text-font': ['Noto Sans Bold'],
  'text-allow-overlap': true,
};

export const PAINT_RECORRIDO_NUMERO: SymbolLayerSpecification['paint'] = {
  'text-color': ['match', ['get', 'tipo'], 'resguardado', '#FFFFFF', Colores.primario],
};
