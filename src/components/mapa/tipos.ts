import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Ref } from 'react';

import type { AnimalEnMapa, AvistamientoDetalle, LngLat } from '@/types/dominio';

/** Contrato común de los mapas nativo (.tsx) y web (.web.tsx). */

export type MapaReportesRef = {
  /** Vuela la cámara a un punto. */
  irA: (centro: LngLat, zoom: number) => void;
};

export type MapaReportesProps = {
  animales: AnimalEnMapa[];
  /** Avistamientos del animal seleccionado, para dibujar su recorrido. */
  recorrido?: AvistamientoDetalle[];
  onSeleccionar: (id: string) => void;
  onDeseleccionar: () => void;
  ref?: Ref<MapaReportesRef>;
};

export type MapaRecorridoProps = {
  avistamientos: AvistamientoDetalle[];
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

export type PropiedadesRecorrido = { orden: number; tipo: AvistamientoDetalle['tipo'] };

export type ColeccionRecorrido = FeatureCollection<
  Point | LineString,
  PropiedadesRecorrido | Record<string, never>
>;

/** Línea del más viejo al más nuevo más un punto numerado por avistamiento. */
export function recorridoAGeoJSON(avistamientos: AvistamientoDetalle[]): ColeccionRecorrido {
  const ordenados = [...avistamientos].sort(
    (a, b) => new Date(a.visto_en).getTime() - new Date(b.visto_en).getTime(),
  );
  const puntos = ordenados.map((av, i): Feature<Point, PropiedadesRecorrido> => ({
    type: 'Feature',
    id: av.id,
    geometry: { type: 'Point', coordinates: [av.lng, av.lat] },
    properties: { orden: i + 1, tipo: av.tipo },
  }));
  const features: ColeccionRecorrido['features'] = [...puntos];
  if (ordenados.length > 1) {
    features.unshift({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ordenados.map((av) => [av.lng, av.lat]) },
      properties: {},
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Esquinas [suroeste, noreste] que contienen todos los puntos. */
export function limitesDe(puntos: LngLat[]): [LngLat, LngLat] | null {
  if (puntos.length === 0) return null;
  let oeste = Infinity;
  let sur = Infinity;
  let este = -Infinity;
  let norte = -Infinity;
  for (const [lng, lat] of puntos) {
    oeste = Math.min(oeste, lng);
    este = Math.max(este, lng);
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
  }
  return [
    [oeste, sur],
    [este, norte],
  ];
}
