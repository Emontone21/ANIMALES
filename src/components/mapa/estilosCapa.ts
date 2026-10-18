import type {
  CircleLayerSpecification,
  FilterSpecification,
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
