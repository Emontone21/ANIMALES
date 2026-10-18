import {
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';
import { useImperativeHandle, useMemo, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

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
import { MapaBase } from '@/components/mapa/MapaBase';
import { animalesAGeoJSON, type MapaReportesProps } from '@/components/mapa/tipos';

/**
 * Mapa principal en Android/iOS (MapLibre React Native): marcadores de
 * animales como capa de círculos con clustering nativo.
 */
export function MapaReportes({ animales, onSeleccionar, onDeseleccionar, ref }: MapaReportesProps) {
  const cameraRef = useRef<CameraRef>(null);
  const fuenteRef = useRef<GeoJSONSourceRef>(null);

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) => cameraRef.current?.flyTo({ center: centro, zoom, duration: 600 }),
  }));

  const coleccion = useMemo(() => animalesAGeoJSON(animales), [animales]);

  const manejarPress = async (evento: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = evento.nativeEvent.features[0] as Feature<Point> | undefined;
    if (!feature) return;

    const props = feature.properties ?? {};
    if (props['cluster'] && typeof props['cluster_id'] === 'number') {
      const zoom = await fuenteRef.current?.getClusterExpansionZoom(props['cluster_id']);
      const [lng, lat] = feature.geometry.coordinates;
      cameraRef.current?.flyTo({ center: [lng, lat], zoom: (zoom ?? 14) + 0.5, duration: 500 });
      return;
    }
    if (typeof props['id'] === 'string') {
      onSeleccionar(props['id']);
    }
  };

  return (
    <MapaBase cameraRef={cameraRef} onPress={onDeseleccionar}>
      <GeoJSONSource
        id={ID_FUENTE_ANIMALES}
        ref={fuenteRef}
        data={coleccion}
        {...OPCIONES_CLUSTER}
        hitbox={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={(evento) => void manejarPress(evento)}>
        <Layer
          id={ID_CAPA_CLUSTER}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={FILTRO_CLUSTER}
          paint={PAINT_CLUSTER}
        />
        <Layer
          id={ID_CAPA_CLUSTER_NUMERO}
          type="symbol"
          source={ID_FUENTE_ANIMALES}
          filter={FILTRO_CLUSTER}
          layout={LAYOUT_CLUSTER_NUMERO}
          paint={PAINT_CLUSTER_NUMERO}
        />
        <Layer
          id={ID_CAPA_PUNTO}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={FILTRO_PUNTO}
          paint={PAINT_PUNTO}
        />
      </GeoJSONSource>
    </MapaBase>
  );
}
