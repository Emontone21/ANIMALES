import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, Point } from 'geojson';
import { type GeoJSONSource, Map as MapaGL, type MapOptions } from 'maplibre-gl';

import {
  FILTRO_CLUSTER,
  FILTRO_LINEA,
  FILTRO_PUNTO_RECORRIDO,
  FILTRO_ULTIMO,
  filtroPunto,
  ID_CAPA_CLUSTER,
  ID_CAPA_CLUSTER_NUMERO,
  ID_CAPA_MI_UBICACION,
  ID_CAPA_MI_UBICACION_HALO,
  ID_CAPA_PUNTO,
  ID_CAPA_RECORRIDO_HALO,
  ID_CAPA_RECORRIDO_LINEA,
  ID_CAPA_RECORRIDO_PUNTO,
  ID_FUENTE_ANIMALES,
  ID_FUENTE_MI_UBICACION,
  ID_FUENTE_RECORRIDO,
  LAYOUT_CLUSTER_NUMERO,
  LAYOUT_RECORRIDO_LINEA,
  OPCIONES_CLUSTER,
  paintCluster,
  paintClusterNumero,
  paintMiUbicacion,
  paintMiUbicacionHalo,
  paintPunto,
  paintRecorridoHalo,
  paintRecorridoLinea,
  paintRecorridoPunto,
} from '@/components/mapa/estilosCapa';
import { configurarMapLibreWeb } from '@/components/mapa/maplibreWeb';
import type { ColeccionAnimales, ColeccionRecorrido } from '@/components/mapa/tipos';
import type { Esquema, Paleta } from '@/constants/tema';

/** Solo web: helpers de MapLibre GL JS compartidos por los tres mapas. */

type EstiloWeb = Exclude<MapOptions['style'], undefined>;

/**
 * maplibre-gl trae su propia copia (más nueva) de los tipos del style spec; el
 * estilo es el mismo JSON, solo cambia de qué paquete sale el tipo.
 */
export function aEstiloWeb(estilo: StyleSpecification | string): EstiloWeb {
  return estilo as unknown as EstiloWeb;
}

/** Crea el mapa sin controles propios de MapLibre (la atribución la dibuja AtribucionMapa). */
export function crearMapaWeb(
  contenedor: HTMLElement,
  estilo: StyleSpecification | string,
  opciones: Omit<MapOptions, 'container' | 'style'>,
): MapaGL {
  configurarMapLibreWeb();
  return new MapaGL({
    container: contenedor,
    style: aEstiloWeb(estilo),
    attributionControl: false,
    // Una mano arrastrando el mapa no rota ni inclina: el mapa queda siempre al norte.
    pitchWithRotate: false,
    dragRotate: false,
    ...opciones,
  });
}

/** Agrega la fuente y las capas, o solo actualiza los datos si ya existen. */
function fuenteGeoJSON(
  mapa: MapaGL,
  id: string,
  datos: FeatureCollection,
  extra?: Record<string, unknown>,
): boolean {
  const fuente = mapa.getSource(id) as GeoJSONSource | undefined;
  if (fuente) {
    fuente.setData(datos);
    return false;
  }
  mapa.addSource(id, { type: 'geojson', data: datos, ...extra });
  return true;
}

export function agregarCapasAnimales(
  mapa: MapaGL,
  datos: ColeccionAnimales,
  c: Paleta,
  seleccionadoId: string | null,
): void {
  if (!fuenteGeoJSON(mapa, ID_FUENTE_ANIMALES, datos, { ...OPCIONES_CLUSTER, promoteId: 'id' })) {
    return;
  }
  const fuente = ID_FUENTE_ANIMALES;
  mapa.addLayer({
    id: ID_CAPA_CLUSTER,
    type: 'circle',
    source: fuente,
    filter: FILTRO_CLUSTER,
    paint: paintCluster(c),
  });
  mapa.addLayer({
    id: ID_CAPA_CLUSTER_NUMERO,
    type: 'symbol',
    source: fuente,
    filter: FILTRO_CLUSTER,
    layout: LAYOUT_CLUSTER_NUMERO,
    paint: paintClusterNumero(c),
  });
  mapa.addLayer({
    id: ID_CAPA_PUNTO,
    type: 'circle',
    source: fuente,
    filter: filtroPunto(seleccionadoId),
    paint: paintPunto(c),
  });
}

/** Saca de los puntos sueltos al seleccionado, que se dibuja aparte y más grande. */
export function filtrarSeleccionado(mapa: MapaGL, seleccionadoId: string | null): void {
  if (!mapa.getLayer(ID_CAPA_PUNTO)) return;
  mapa.setFilter(ID_CAPA_PUNTO, filtroPunto(seleccionadoId));
}

export function agregarCapasRecorrido(
  mapa: MapaGL,
  datos: ColeccionRecorrido,
  c: Paleta,
  colorTipo: string,
  antesDe?: string,
): void {
  fuenteGeoJSON(mapa, ID_FUENTE_RECORRIDO, datos);
  // El color del último punto depende del caso: las capas se rehacen (son tres y chicas).
  for (const capa of [ID_CAPA_RECORRIDO_PUNTO, ID_CAPA_RECORRIDO_HALO, ID_CAPA_RECORRIDO_LINEA]) {
    if (mapa.getLayer(capa)) mapa.removeLayer(capa);
  }
  const fuente = ID_FUENTE_RECORRIDO;
  const antes = antesDe && mapa.getLayer(antesDe) ? antesDe : undefined;
  mapa.addLayer(
    {
      id: ID_CAPA_RECORRIDO_LINEA,
      type: 'line',
      source: fuente,
      filter: FILTRO_LINEA,
      layout: LAYOUT_RECORRIDO_LINEA,
      paint: paintRecorridoLinea(c),
    },
    antes,
  );
  mapa.addLayer(
    {
      id: ID_CAPA_RECORRIDO_HALO,
      type: 'circle',
      source: fuente,
      filter: FILTRO_ULTIMO,
      paint: paintRecorridoHalo(colorTipo),
    },
    antes,
  );
  mapa.addLayer(
    {
      id: ID_CAPA_RECORRIDO_PUNTO,
      type: 'circle',
      source: fuente,
      filter: FILTRO_PUNTO_RECORRIDO,
      paint: paintRecorridoPunto(c, colorTipo),
    },
    antes,
  );
}

export function agregarMiUbicacion(
  mapa: MapaGL,
  datos: FeatureCollection<Point>,
  c: Paleta,
  esquema: Esquema,
): void {
  if (!fuenteGeoJSON(mapa, ID_FUENTE_MI_UBICACION, datos)) return;
  const fuente = ID_FUENTE_MI_UBICACION;
  mapa.addLayer({
    id: ID_CAPA_MI_UBICACION_HALO,
    type: 'circle',
    source: fuente,
    paint: paintMiUbicacionHalo(c, esquema),
  });
  mapa.addLayer({
    id: ID_CAPA_MI_UBICACION,
    type: 'circle',
    source: fuente,
    paint: paintMiUbicacion(c),
  });
}
