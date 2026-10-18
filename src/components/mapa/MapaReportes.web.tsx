import type { Feature, Point } from 'geojson';
import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapaGL,
  type MapMouseEvent,
  NavigationControl,
} from 'maplibre-gl';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  FILTRO_CLUSTER,
  FILTRO_PUNTO,
  ID_CAPA_CLUSTER,
  ID_CAPA_CLUSTER_NUMERO,
  ID_CAPA_PUNTO,
  ID_FUENTE_ANIMALES,
  LAYOUT_CLUSTER_NUMERO,
  OPCIONES_CLUSTER,
  PAINT_CLUSTER,
  PAINT_CLUSTER_NUMERO,
  PAINT_PUNTO,
} from '@/components/mapa/estilosCapa';
import { configurarMapLibreWeb } from '@/components/mapa/maplibreWeb';
import { animalesAGeoJSON, type MapaReportesProps } from '@/components/mapa/tipos';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';
import { MONTEVIDEO, ZOOM_CIUDAD } from '@/lib/ubicacion';

/**
 * Mapa principal en el navegador (MapLibre GL JS). Mismo estilo de capas que
 * la versión nativa; la fuente GeoJSON se actualiza cuando cambian los animales.
 */
export function MapaReportes({ animales, onSeleccionar, onDeseleccionar, ref }: MapaReportesProps) {
  const contenedorRef = useRef<HTMLElement | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const cargadoRef = useRef(false);
  // Últimos datos recibidos, por si el mapa todavía no terminó de cargar.
  const datosRef = useRef(animalesAGeoJSON(animales));

  // Callbacks siempre actuales sin re-crear el mapa.
  const callbacksRef = useRef({ onSeleccionar, onDeseleccionar });
  useEffect(() => {
    callbacksRef.current = { onSeleccionar, onDeseleccionar };
  }, [onSeleccionar, onDeseleccionar]);

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) => mapaRef.current?.flyTo({ center: centro, zoom, duration: 600 }),
  }));

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    configurarMapLibreWeb();

    const mapa = new MapaGL({
      container: contenedor,
      style: ENV.mapStyleUrl,
      center: MONTEVIDEO,
      zoom: ZOOM_CIUDAD,
      attributionControl: false,
    });
    mapaRef.current = mapa;

    mapa.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    mapa.addControl(
      new AttributionControl({ compact: true, customAttribution: t.mapa.atribucion }),
      'bottom-left',
    );

    mapa.on('load', () => {
      mapa.addSource(ID_FUENTE_ANIMALES, {
        type: 'geojson',
        data: datosRef.current,
        ...OPCIONES_CLUSTER,
      });
      mapa.addLayer({
        id: ID_CAPA_CLUSTER,
        type: 'circle',
        source: ID_FUENTE_ANIMALES,
        filter: FILTRO_CLUSTER,
        paint: PAINT_CLUSTER,
      });
      mapa.addLayer({
        id: ID_CAPA_CLUSTER_NUMERO,
        type: 'symbol',
        source: ID_FUENTE_ANIMALES,
        filter: FILTRO_CLUSTER,
        layout: LAYOUT_CLUSTER_NUMERO,
        paint: PAINT_CLUSTER_NUMERO,
      });
      mapa.addLayer({
        id: ID_CAPA_PUNTO,
        type: 'circle',
        source: ID_FUENTE_ANIMALES,
        filter: FILTRO_PUNTO,
        paint: PAINT_PUNTO,
      });

      mapa.on('click', ID_CAPA_PUNTO, (evento: MapMouseEvent) => {
        const feature = mapa.queryRenderedFeatures(evento.point, { layers: [ID_CAPA_PUNTO] })[0];
        const id = feature?.properties?.['id'];
        if (typeof id === 'string') callbacksRef.current.onSeleccionar(id);
      });

      mapa.on('click', ID_CAPA_CLUSTER, async (evento: MapMouseEvent) => {
        const feature = mapa.queryRenderedFeatures(evento.point, {
          layers: [ID_CAPA_CLUSTER],
        })[0] as Feature<Point> | undefined;
        const clusterId = feature?.properties?.['cluster_id'];
        if (!feature || typeof clusterId !== 'number') return;
        const fuente = mapa.getSource(ID_FUENTE_ANIMALES) as GeoJSONSource;
        const zoom = await fuente.getClusterExpansionZoom(clusterId);
        const [lng, lat] = feature.geometry.coordinates;
        mapa.easeTo({ center: [lng, lat], zoom: zoom + 0.5, duration: 500 });
      });

      mapa.on('click', (evento: MapMouseEvent) => {
        const tocados = mapa.queryRenderedFeatures(evento.point, {
          layers: [ID_CAPA_PUNTO, ID_CAPA_CLUSTER],
        });
        if (tocados.length === 0) callbacksRef.current.onDeseleccionar();
      });

      for (const capa of [ID_CAPA_PUNTO, ID_CAPA_CLUSTER]) {
        mapa.on('mouseenter', capa, () => {
          mapa.getCanvas().style.cursor = 'pointer';
        });
        mapa.on('mouseleave', capa, () => {
          mapa.getCanvas().style.cursor = '';
        });
      }

      cargadoRef.current = true;
    });

    return () => {
      cargadoRef.current = false;
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    datosRef.current = animalesAGeoJSON(animales);
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      (mapa.getSource(ID_FUENTE_ANIMALES) as GeoJSONSource | undefined)?.setData(datosRef.current);
    }
  }, [animales]);

  // En react-native-web la ref de un View es el elemento del DOM.
  return <View ref={contenedorRef as never} style={estilos.mapa} />;
}

const estilos = StyleSheet.create({
  mapa: { flex: 1, minHeight: 320 },
});
