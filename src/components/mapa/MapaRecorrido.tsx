import { StyleSheet, View } from 'react-native';

import { CapaRecorrido } from '@/components/mapa/CapaRecorrido';
import { MapaBase } from '@/components/mapa/MapaBase';
import { limitesDe, type MapaRecorridoProps } from '@/components/mapa/tipos';
import { Radio } from '@/constants/tema';
import { ZOOM_PUNTO } from '@/lib/ubicacion';

/** Mini mapa del detalle (Android/iOS) con el recorrido del animal. */
export function MapaRecorrido({ avistamientos }: MapaRecorridoProps) {
  const limites = limitesDe(avistamientos.map((av) => [av.lng, av.lat]));
  if (!limites) return null;
  const unSoloPunto = avistamientos.length === 1;

  return (
    <View style={estilos.contenedor}>
      <MapaBase
        interactivo={false}
        centroInicial={unSoloPunto ? limites[0] : undefined}
        zoomInicial={ZOOM_PUNTO}
        limitesIniciales={
          unSoloPunto ? undefined : [limites[0][0], limites[0][1], limites[1][0], limites[1][1]]
        }>
        <CapaRecorrido avistamientos={avistamientos} />
      </MapaBase>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { height: 220, borderRadius: Radio.m, overflow: 'hidden' },
});
