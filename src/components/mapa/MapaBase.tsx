import {
  Camera,
  type CameraRef,
  type InitialViewState,
  type LngLatBounds,
  Map,
  type MapProps,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import type { ReactNode, Ref } from 'react';
import { View } from 'react-native';

import { AtribucionMapa } from '@/components/mapa/AtribucionMapa';
import { useEstiloMapa } from '@/components/mapa/estiloBase';
import type { MargenesMapa } from '@/components/mapa/tipos';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { MONTEVIDEO, ZOOM_CIUDAD } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

export type MapaBaseProps = {
  children?: ReactNode;
  centroInicial?: LngLat;
  zoomInicial?: number;
  /** Si se pasa, la cámara arranca encuadrando estos límites [oeste, sur, este, norte]. */
  limitesIniciales?: LngLatBounds;
  /** Lo que tapan la hoja o el panel al arrancar: el centro inicial queda en la parte visible. */
  margenesIniciales?: MargenesMapa;
  interactivo?: boolean;
  cameraRef?: Ref<CameraRef>;
  mapRef?: Ref<MapRef>;
  /** Distancia de la atribución al borde inferior (para no quedar bajo la hoja). */
  atribucionAbajo?: number;
  /** Distancia de la atribución al borde izquierdo (para no quedar bajo el panel). */
  atribucionIzquierda?: number;
  onPress?: MapProps['onPress'];
  onRegionDidChange?: MapProps['onRegionDidChange'];
  onDidFinishLoadingMap?: MapProps['onDidFinishLoadingMap'];
};

const PADDING_LIMITES = { top: 48, bottom: 48, left: 48, right: 48 };

/**
 * Mapa de MapLibre con el estilo base recoloreado (claro u oscuro), centrado en
 * Montevideo. Siempre al norte: sin rotar ni inclinar. Lleva la atribución
 * obligatoria de OSM/OpenMapTiles abajo a la izquierda.
 */
export function MapaBase({
  children,
  centroInicial = MONTEVIDEO,
  zoomInicial = ZOOM_CIUDAD,
  limitesIniciales,
  margenesIniciales,
  interactivo = true,
  cameraRef,
  mapRef,
  atribucionAbajo,
  atribucionIzquierda,
  onPress,
  onRegionDidChange,
  onDidFinishLoadingMap,
}: MapaBaseProps) {
  const estilos = useEstilos(crear);
  const estilo = useEstiloMapa();
  const vistaInicial: InitialViewState = limitesIniciales
    ? { bounds: limitesIniciales, padding: PADDING_LIMITES }
    : { center: centroInicial, zoom: zoomInicial, padding: margenesIniciales };

  return (
    <View style={estilos.contenedor} accessibilityLabel={t.mapa.titulo}>
      {estilo ? (
        <Map
          ref={mapRef}
          style={estilos.mapa}
          mapStyle={estilo}
          attribution={false}
          logo={false}
          compass={false}
          touchPitch={false}
          touchRotate={false}
          dragPan={interactivo}
          touchZoom={interactivo}
          doubleTapZoom={interactivo}
          onPress={onPress}
          onRegionDidChange={onRegionDidChange}
          onDidFinishLoadingMap={onDidFinishLoadingMap}>
          <Camera ref={cameraRef} initialViewState={vistaInicial} />
          {children}
        </Map>
      ) : null}
      {/* Un mapa que no se mueve es el chico del detalle, adentro de un botón: sin link. */}
      <AtribucionMapa
        abajo={atribucionAbajo}
        izquierda={atribucionIzquierda}
        enlace={interactivo}
      />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  // Mientras se descarga el estilo se ve el color de la tierra, no un blanco.
  contenedor: { flex: 1, backgroundColor: c.mapaTierra },
  mapa: { flex: 1 },
}));
