import type { Feature, LineString, Point } from 'geojson';

import type { ColeccionRecorridoGrande, PropiedadesPuntoGrande } from '@/components/mapa/tipos';
import type { AvistamientoDetalle, TipoAvistamiento } from '@/types/dominio';

/**
 * Mapa en grande del recorrido (docs/DISENO.md, 6.9.1): en qué orden van los
 * avistamientos, cuáles se dibujan como zona y cómo se recorren con Anterior y
 * Siguiente. Solo lo usa la pantalla (src/app/animal/[id]/mapa.tsx): el mapa
 * recibe el GeoJSON ya armado, así esto no se comparte entre dos bloques web.
 */

type Avistamiento = Pick<AvistamientoDetalle, 'id' | 'lng' | 'lat' | 'visto_en' | 'tipo'>;

export type PuntoDelRecorrido<A extends Avistamiento = AvistamientoDetalle> = {
  avistamiento: A;
  /** 1 es el más viejo. */
  orden: number;
  ultimo: boolean;
  /** Guardado redondeado en la base: se dibuja como zona, no como punto exacto. */
  aproximado: boolean;
};

/**
 * La base redondea a 3 decimales (unos 100 m) lo que suele ser una casa: donde
 * se perdió (publicar_animal, 0010) y el "¿Dónde está ahora?" de un resguardo
 * (cambiar_estado_animal, 0013). Los demás puntos son de la calle y van exactos.
 */
export function esUbicacionAproximada(tipo: TipoAvistamiento): boolean {
  return tipo === 'perdido' || tipo === 'resguardado';
}

/**
 * Del más viejo al más nuevo, numerados desde 1. Dos en el mismo momento van
 * por id, así el orden no cambia entre una carga y otra.
 */
export function ordenarRecorrido<A extends Avistamiento>(
  avistamientos: A[],
): PuntoDelRecorrido<A>[] {
  const ordenados = [...avistamientos].sort(
    (a, b) =>
      new Date(a.visto_en).getTime() - new Date(b.visto_en).getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return ordenados.map((avistamiento, i) => ({
    avistamiento,
    orden: i + 1,
    ultimo: i === ordenados.length - 1,
    aproximado: esUbicacionAproximada(avistamiento.tipo),
  }));
}

/** El punto anterior (-1) o el siguiente (1); en las puntas se queda donde está. */
export function indiceVecino(indice: number, total: number, paso: -1 | 1): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, indice + paso));
}

export function hayAnterior(indice: number): boolean {
  return indice > 0;
}

export function haySiguiente(indice: number, total: number): boolean {
  return indice < total - 1;
}

/**
 * La línea punteada del más viejo al más nuevo y un punto por avistamiento,
 * con su número y si es el último, aproximado o el seleccionado.
 */
export function recorridoGrandeAGeoJSON(
  puntos: PuntoDelRecorrido<Avistamiento>[],
  seleccionadoId: string | null,
): ColeccionRecorridoGrande {
  const features: ColeccionRecorridoGrande['features'] = puntos.map(
    ({ avistamiento: av, orden, ultimo, aproximado }): Feature<Point, PropiedadesPuntoGrande> => ({
      type: 'Feature',
      id: av.id,
      geometry: { type: 'Point', coordinates: [av.lng, av.lat] },
      properties: { id: av.id, orden, ultimo, aproximado, seleccionado: av.id === seleccionadoId },
    }),
  );
  if (puntos.length > 1) {
    const linea: Feature<LineString, Record<string, never>> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: puntos.map(({ avistamiento: av }) => [av.lng, av.lat]),
      },
      properties: {},
    };
    features.unshift(linea);
  }
  return { type: 'FeatureCollection', features };
}
