import {
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  Marker,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';
import { useImperativeHandle, useMemo, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import { CapaRecorrido } from '@/components/mapa/CapaRecorrido';
import {
  FILTRO_CLUSTER,
  filtroPerdido,
  filtroPunto,
  ID_CAPA_CENTRO,
  ID_CAPA_CLUSTER,
  ID_CAPA_CLUSTER_NUMERO,
  ID_CAPA_HALO,
  ID_CAPA_MI_UBICACION,
  ID_CAPA_MI_UBICACION_HALO,
  ID_CAPA_PUNTO,
  ID_FUENTE_ANIMALES,
  ID_FUENTE_MI_UBICACION,
  LAYOUT_CLUSTER_NUMERO,
  OPCIONES_CLUSTER,
  paintCentro,
  paintCluster,
  paintClusterNumero,
  paintHalo,
  paintMiUbicacion,
  paintMiUbicacionHalo,
  paintPunto,
} from '@/components/mapa/estilosCapa';
import { MapaBase } from '@/components/mapa/MapaBase';
import { MarcadorFoto } from '@/components/mapa/MarcadorFoto';
import { animalesAGeoJSON, type MapaReportesProps, puntoAGeoJSON } from '@/components/mapa/tipos';
import { coloresDeEstado } from '@/constants/tema';
import { useTema } from '@/hooks/useTema';

const SIN_MARGENES = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Mapa principal en Android/iOS (MapLibre React Native): marcadores como capas
 * de círculos con clustering nativo; el seleccionado muestra la foto.
 */
export function MapaReportes({
  animales,
  recorrido = [],
  seleccionadoId = null,
  miUbicacion = null,
  margenes = SIN_MARGENES,
  onSeleccionar,
  onDeseleccionar,
  onMovimiento,
  ref,
}: MapaReportesProps) {
  const { c, esquema } = useTema();
  const cameraRef = useRef<CameraRef>(null);
  const fuenteRef = useRef<GeoJSONSourceRef>(null);

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) =>
      cameraRef.current?.flyTo({ center: centro, zoom, duration: 600, padding: margenes }),
  }));

  const coleccion = useMemo(() => animalesAGeoJSON(animales), [animales]);
  const ubicacion = useMemo(() => puntoAGeoJSON(miUbicacion), [miUbicacion]);
  const seleccionado = animales.find((a) => a.id === seleccionadoId) ?? null;
  const colorTipo = coloresDeEstado(c, seleccionado?.estado ?? 'avistado').anillo;

  const manejarPress = async (evento: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = evento.nativeEvent.features[0] as Feature<Point> | undefined;
    if (!feature) return;

    const props = feature.properties ?? {};
    if (props['cluster'] && typeof props['cluster_id'] === 'number') {
      const zoom = await fuenteRef.current?.getClusterExpansionZoom(props['cluster_id']);
      const [lng, lat] = feature.geometry.coordinates;
      cameraRef.current?.flyTo({
        center: [lng, lat],
        zoom: (zoom ?? 14) + 0.5,
        duration: 500,
        padding: margenes,
      });
      return;
    }
    if (typeof props['id'] === 'string') {
      onSeleccionar(props['id']);
    }
  };

  return (
    <MapaBase
      cameraRef={cameraRef}
      margenesIniciales={margenes}
      atribucionAbajo={margenes.bottom + 8}
      atribucionIzquierda={margenes.left + 8}
      onPress={onDeseleccionar}
      onRegionDidChange={(evento) => onMovimiento?.(evento.nativeEvent.center)}>
      {/* El recorrido y mi ubicación van debajo de los marcadores. */}
      {recorrido.length > 1 ? (
        <CapaRecorrido avistamientos={recorrido} colorTipo={colorTipo} />
      ) : null}
      <GeoJSONSource id={ID_FUENTE_MI_UBICACION} data={ubicacion}>
        <Layer
          id={ID_CAPA_MI_UBICACION_HALO}
          type="circle"
          source={ID_FUENTE_MI_UBICACION}
          paint={paintMiUbicacionHalo(c, esquema)}
        />
        <Layer
          id={ID_CAPA_MI_UBICACION}
          type="circle"
          source={ID_FUENTE_MI_UBICACION}
          paint={paintMiUbicacion(c)}
        />
      </GeoJSONSource>
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
          paint={paintCluster(c)}
        />
        <Layer
          id={ID_CAPA_CLUSTER_NUMERO}
          type="symbol"
          source={ID_FUENTE_ANIMALES}
          filter={FILTRO_CLUSTER}
          layout={LAYOUT_CLUSTER_NUMERO}
          paint={paintClusterNumero(c)}
        />
        <Layer
          id={ID_CAPA_HALO}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={filtroPerdido(seleccionado?.id ?? null)}
          paint={paintHalo(c)}
        />
        <Layer
          id={ID_CAPA_PUNTO}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={filtroPunto(seleccionado?.id ?? null)}
          paint={paintPunto(c)}
        />
        <Layer
          id={ID_CAPA_CENTRO}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={filtroPunto(seleccionado?.id ?? null)}
          paint={paintCentro(c)}
        />
      </GeoJSONSource>
      {seleccionado ? (
        <Marker id="seleccionado" lngLat={[seleccionado.lng, seleccionado.lat]} anchor="bottom">
          <MarcadorFoto animal={seleccionado} />
        </Marker>
      ) : null}
    </MapaBase>
  );
}
