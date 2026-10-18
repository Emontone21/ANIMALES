import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Ref } from 'react';

import type { AnimalEnMapa, LngLat } from '@/types/dominio';

/** Contrato común de los mapas nativo (.tsx) y web (.web.tsx). */

export type MapaReportesRef = {
  /** Vuela la cámara a un punto. */
  irA: (centro: LngLat, zoom: number) => void;
};

export type MapaReportesProps = {
  animales: AnimalEnMapa[];
  onSeleccionar: (id: string) => void;
  onDeseleccionar: () => void;
  ref?: Ref<MapaReportesRef>;
};

export type MapaSelectorProps = {
  centroInicial: LngLat;
  zoomInicial: number;
  /** Se llama cada vez que el mapa deja de moverse, con el nuevo centro. */
  onCentroCambia: (centro: LngLat) => void;
};

export type PropiedadesMarcador = {
  id: string;
  especie: AnimalEnMapa['especie'];
  estado: AnimalEnMapa['estado'];
};

export type ColeccionAnimales = FeatureCollection<Point, PropiedadesMarcador>;

export function animalesAGeoJSON(animales: AnimalEnMapa[]): ColeccionAnimales {
  return {
    type: 'FeatureCollection',
    features: animales.map((a): Feature<Point, PropiedadesMarcador> => ({
      type: 'Feature',
      id: a.id,
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { id: a.id, especie: a.especie, estado: a.estado },
    })),
  };
}
