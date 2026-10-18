import type { GeoJSONSource, Map as MapaGL } from 'maplibre-gl';

import {
  FILTRO_LINEA,
  FILTRO_PUNTO_RECORRIDO,
  ID_CAPA_RECORRIDO_LINEA,
  ID_CAPA_RECORRIDO_NUMERO,
  ID_CAPA_RECORRIDO_PUNTO,
  ID_FUENTE_RECORRIDO,
  LAYOUT_RECORRIDO_LINEA,
  LAYOUT_RECORRIDO_NUMERO,
  PAINT_RECORRIDO_LINEA,
  PAINT_RECORRIDO_NUMERO,
  PAINT_RECORRIDO_PUNTO,
} from '@/components/mapa/estilosCapa';
import type { ColeccionRecorrido } from '@/components/mapa/tipos';

/** Solo web: agrega (o actualiza) la fuente y las capas del recorrido a un mapa cargado. */
export function agregarCapasRecorrido(mapa: MapaGL, datos: ColeccionRecorrido): void {
  const fuente = mapa.getSource(ID_FUENTE_RECORRIDO) as GeoJSONSource | undefined;
  if (fuente) {
    fuente.setData(datos);
    return;
  }
  mapa.addSource(ID_FUENTE_RECORRIDO, { type: 'geojson', data: datos });
  mapa.addLayer({
    id: ID_CAPA_RECORRIDO_LINEA,
    type: 'line',
    source: ID_FUENTE_RECORRIDO,
    filter: FILTRO_LINEA,
    layout: LAYOUT_RECORRIDO_LINEA,
    paint: PAINT_RECORRIDO_LINEA,
  });
  mapa.addLayer({
    id: ID_CAPA_RECORRIDO_PUNTO,
    type: 'circle',
    source: ID_FUENTE_RECORRIDO,
    filter: FILTRO_PUNTO_RECORRIDO,
    paint: PAINT_RECORRIDO_PUNTO,
  });
  mapa.addLayer({
    id: ID_CAPA_RECORRIDO_NUMERO,
    type: 'symbol',
    source: ID_FUENTE_RECORRIDO,
    filter: FILTRO_PUNTO_RECORRIDO,
    layout: LAYOUT_RECORRIDO_NUMERO,
    paint: PAINT_RECORRIDO_NUMERO,
  });
}
