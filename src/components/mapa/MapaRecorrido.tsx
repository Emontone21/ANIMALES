import { View } from 'react-native';

import { CapaRecorrido } from '@/components/mapa/CapaRecorrido';
import { MapaBase } from '@/components/mapa/MapaBase';
import { limitesDe, type MapaRecorridoProps } from '@/components/mapa/tipos';
import { coloresDeEstado, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { ZOOM_PUNTO } from '@/lib/ubicacion';

const ALTO = 140;

/** Mini mapa del detalle (Android/iOS) con el recorrido del animal (6.9). */
export function MapaRecorrido({ avistamientos, estado, tipo }: MapaRecorridoProps) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
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
        <CapaRecorrido
          avistamientos={avistamientos}
          colorTipo={coloresDeEstado(c, estado, tipo).anillo}
        />
      </MapaBase>
    </View>
  );
}

const crear = crearEstilos(() => ({
  contenedor: { height: ALTO, borderRadius: Radio.m, overflow: 'hidden' },
}));
