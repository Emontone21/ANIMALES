import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Ref } from 'react';

import type { TipoReporte } from '@/constants/tema';
import type { AnimalEnMapa, AvistamientoDetalle, EstadoAnimal, LngLat } from '@/types/dominio';

/** Contrato común de los mapas nativo (.tsx) y web (.web.tsx). */

/** Píxeles tapados por la hoja, el panel o los controles, para centrar en lo visible. */
export type MargenesMapa = { top: number; right: number; bottom: number; left: number };

/** Alto del mini mapa del recorrido en el detalle (6.9). */
export const ALTO_MAPA_RECORRIDO = 140;

export type MapaReportesRef = {
  /**
   * Vuela la cámara a un punto, centrándolo en la parte visible del mapa.
   * `margenes`, si lo que tapa va a cambiar (la hoja que se despliega).
   */
  irA: (centro: LngLat, zoom: number, margenes?: MargenesMapa) => void;
};

export type MapaReportesProps = {
  animales: AnimalEnMapa[];
  /** Avistamientos del animal seleccionado, para dibujar su recorrido. */
  recorrido?: AvistamientoDetalle[];
  /** Marcador seleccionado: muestra la foto del animal. */
  seleccionadoId?: string | null;
  /** Tarjeta con el mouse encima en el panel lateral: resalta su marcador (web). */
  resaltadoId?: string | null;
  /** Punto de "mi ubicación", si la persona la pidió. */
  miUbicacion?: LngLat | null;
  margenes?: MargenesMapa;
  onSeleccionar: (id: string) => void;
  onDeseleccionar: () => void;
  /** Cada vez que el mapa deja de moverse, con su nuevo centro. */
  onMovimiento?: (centro: LngLat) => void;
  ref?: Ref<MapaReportesRef>;
};

/** Lo que hace falta de un avistamiento para dibujarlo en un recorrido. */
export type PuntoRecorrido = Pick<AvistamientoDetalle, 'id' | 'lng' | 'lat' | 'visto_en' | 'tipo'>;

/** Un único punto (por ejemplo, la ubicación elegida al publicar) como recorrido. */
export function puntoComoRecorrido([lng, lat]: LngLat): PuntoRecorrido[] {
  return [{ id: 'punto', lng, lat, visto_en: new Date(0).toISOString(), tipo: 'visto' }];
}

export type MapaRecorridoProps = {
  avistamientos: PuntoRecorrido[];
  /** Estado del caso: da el color del último punto. */
  estado: EstadoAnimal;
  tipo?: TipoReporte;
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
  tipo: TipoReporte;
};

export type ColeccionAnimales = FeatureCollection<Point, PropiedadesMarcador>;

export function animalesAGeoJSON(animales: AnimalEnMapa[]): ColeccionAnimales {
  return {
    type: 'FeatureCollection',
    features: animales.map((a): Feature<Point, PropiedadesMarcador> => ({
      type: 'Feature',
      id: a.id,
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      // tipo da el anillo y el halo naranja de los perdidos (estilosCapa.ts).
      properties: { id: a.id, especie: a.especie, estado: a.estado, tipo: a.tipo_reporte },
    })),
  };
}

export function puntoAGeoJSON(punto: LngLat | null | undefined): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: punto
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: punto }, properties: {} }]
      : [],
  };
}

export type PropiedadesRecorrido = {
  orden: number;
  tipo: AvistamientoDetalle['tipo'];
  /** El avistamiento más reciente: va en el color del caso, con halo. */
  ultimo: boolean;
};

export type ColeccionRecorrido = FeatureCollection<
  Point | LineString,
  PropiedadesRecorrido | Record<string, never>
>;

// --- Mapa en grande del recorrido (6.9.1) ---------------------------------------
// Solo tipos: este archivo va en el bloque común de la web.

export type PropiedadesPuntoGrande = {
  id: string;
  /** Número visible: 1 es el más viejo. */
  orden: number;
  ultimo: boolean;
  /** Guardado redondeado: se dibuja como zona (src/features/mapa/recorrido.ts). */
  aproximado: boolean;
  seleccionado: boolean;
};

export type ColeccionRecorridoGrande = FeatureCollection<
  Point | LineString,
  PropiedadesPuntoGrande | Record<string, never>
>;

export type MapaRecorridoGrandeRef = {
  /**
   * Centra un punto en la parte visible. Sin zoom, se queda en el que está
   * (Anterior y Siguiente); con zoom, vuela hasta ahí (mi ubicación).
   */
  irA: (centro: LngLat, zoom?: number) => void;
};

export type MapaRecorridoGrandeProps = {
  /** Armado por la pantalla con recorridoGrandeAGeoJSON. */
  datos: ColeccionRecorridoGrande;
  /** Color del tipo del caso: el último punto y las zonas aproximadas. */
  colorTipo: string;
  miUbicacion: LngLat | null;
  /** Lo que tapan los botones y la tarjeta: la vista inicial y el centrado van en lo visible. */
  margenes: MargenesMapa;
  onSeleccionar: (id: string) => void;
  ref?: Ref<MapaRecorridoGrandeRef>;
};

/** Línea punteada del más viejo al más nuevo y un punto por avistamiento. */
export function recorridoAGeoJSON(avistamientos: PuntoRecorrido[]): ColeccionRecorrido {
  const ordenados = [...avistamientos].sort(
    (a, b) => new Date(a.visto_en).getTime() - new Date(b.visto_en).getTime(),
  );
  const puntos = ordenados.map((av, i): Feature<Point, PropiedadesRecorrido> => ({
    type: 'Feature',
    id: av.id,
    geometry: { type: 'Point', coordinates: [av.lng, av.lat] },
    properties: { orden: i + 1, tipo: av.tipo, ultimo: i === ordenados.length - 1 },
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
