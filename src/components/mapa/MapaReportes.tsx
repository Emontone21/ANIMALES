import {
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type MapRef,
  Marker,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import { CapaRecorrido } from '@/components/mapa/CapaRecorrido';
import {
  FILTRO_CLUSTER,
  filtroPunto,
  ID_CAPA_CLUSTER,
  ID_CAPA_CLUSTER_NUMERO,
  ID_CAPA_MI_UBICACION,
  ID_CAPA_MI_UBICACION_HALO,
  ID_CAPA_PUNTO,
  ID_FUENTE_ANIMALES,
  ID_FUENTE_MI_UBICACION,
  LAYOUT_CLUSTER_NUMERO,
  OPCIONES_CLUSTER,
  paintCluster,
  paintClusterNumero,
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
/** Tiempo para que el mapa vuelva a agrupar los puntos después de un cambio de datos. */
const ESPERA_DATOS_MS = 300;

/**
 * Mapa principal en Android/iOS (MapLibre React Native): clusters como
 * círculos con clustering nativo y un marcador con foto en cada punto suelto
 * que se ve (el seleccionado, más grande).
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
  const mapaRef = useRef<MapRef>(null);
  const fuenteRef = useRef<GeoJSONSourceRef>(null);
  // Puntos sueltos que se ven: los que dibuja la zona táctil.
  const [visibles, setVisibles] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom, otros = margenes) =>
      cameraRef.current?.flyTo({ center: centro, zoom, duration: 600, padding: otros }),
  }));

  const coleccion = useMemo(() => animalesAGeoJSON(animales), [animales]);

  const buscarVisibles = useCallback(async () => {
    const features = await mapaRef.current?.queryRenderedFeatures({ layers: [ID_CAPA_PUNTO] });
    const ids = new Set<string>();
    for (const feature of features ?? []) {
      const id = feature.properties?.['id'];
      if (typeof id === 'string') ids.add(id);
    }
    setVisibles([...ids]);
  }, []);

  // Con datos nuevos (filtros, casos nuevos), cuando el mapa ya los agrupó.
  useEffect(() => {
    const reloj = setTimeout(() => void buscarVisibles(), ESPERA_DATOS_MS);
    return () => clearTimeout(reloj);
  }, [coleccion, seleccionadoId, buscarVisibles]);

  const conMarcador = useMemo(() => {
    const ids = new Set(visibles);
    if (seleccionadoId) ids.add(seleccionadoId);
    return animales.filter((a) => ids.has(a.id));
  }, [animales, visibles, seleccionadoId]);
  const ubicacion = useMemo(() => puntoAGeoJSON(miUbicacion), [miUbicacion]);
  const seleccionado = animales.find((a) => a.id === seleccionadoId) ?? null;
  const colorTipo = coloresDeEstado(
    c,
    seleccionado?.estado ?? 'avistado',
    seleccionado?.tipo_reporte,
  ).anillo;

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
      mapRef={mapaRef}
      margenesIniciales={margenes}
      atribucionAbajo={margenes.bottom + 8}
      atribucionIzquierda={margenes.left + 8}
      onPress={onDeseleccionar}
      onDidFinishLoadingMap={() => void buscarVisibles()}
      onRegionDidChange={(evento) => {
        onMovimiento?.(evento.nativeEvent.center);
        void buscarVisibles();
      }}>
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
        {/* Zona táctil invisible bajo cada foto: recibe el toque del marcador. */}
        <Layer
          id={ID_CAPA_PUNTO}
          type="circle"
          source={ID_FUENTE_ANIMALES}
          filter={filtroPunto(seleccionado?.id ?? null)}
          paint={paintPunto(c)}
        />
      </GeoJSONSource>
      {conMarcador.map((animal) => (
        <Marker
          key={animal.id}
          id={`marcador-${animal.id}`}
          lngLat={[animal.lng, animal.lat]}
          anchor="bottom">
          <MarcadorFoto animal={animal} seleccionado={animal.id === seleccionado?.id} />
        </Marker>
      ))}
    </MapaBase>
  );
}
