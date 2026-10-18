import { Camera, type CameraRef, Map, type MapProps } from '@maplibre/maplibre-react-native';
import type { ReactNode, Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';
import { MONTEVIDEO, ZOOM_CIUDAD } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

export type MapaBaseProps = {
  children?: ReactNode;
  centroInicial?: LngLat;
  zoomInicial?: number;
  cameraRef?: Ref<CameraRef>;
  onPress?: MapProps['onPress'];
  onRegionDidChange?: MapProps['onRegionDidChange'];
};

/**
 * Mapa de MapLibre con el estilo de OpenFreeMap, centrado en Montevideo.
 * Lleva la atribución obligatoria de OSM/OpenMapTiles abajo a la izquierda.
 */
export function MapaBase({
  children,
  centroInicial = MONTEVIDEO,
  zoomInicial = ZOOM_CIUDAD,
  cameraRef,
  onPress,
  onRegionDidChange,
}: MapaBaseProps) {
  return (
    <View style={estilos.contenedor}>
      <Map
        style={estilos.mapa}
        mapStyle={ENV.mapStyleUrl}
        attribution={false}
        logo={false}
        compass
        compassPosition={{ top: 8, right: 8 }}
        touchPitch={false}
        onPress={onPress}
        onRegionDidChange={onRegionDidChange}>
        <Camera ref={cameraRef} initialViewState={{ center: centroInicial, zoom: zoomInicial }} />
        {children}
      </Map>
      <View style={estilos.atribucion} pointerEvents="none">
        <Texto variante="pequeno" style={estilos.atribucionTexto}>
          {t.mapa.atribucion}
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  mapa: { flex: 1 },
  atribucion: {
    position: 'absolute',
    left: Espacio.s,
    bottom: Espacio.s,
    paddingHorizontal: Espacio.s,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  atribucionTexto: { fontSize: 10, color: Colores.textoSecundario },
});
