import { lazy, Suspense } from 'react';
import { View } from 'react-native';

import { ALTO_MAPA_RECORRIDO, type MapaRecorridoProps } from '@/components/mapa/tipos';
import { useCargarMapa } from '@/components/mapa/useCargarMapa';
import { Radio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

// MapLibre va en un bloque aparte: la foto, los datos y las acciones del caso
// no lo esperan; el mini mapa llega después.
const MapaRecorridoGL = lazy(() =>
  import('@/components/mapa/mapasWeb').then((m) => ({ default: m.MapaRecorridoGL })),
);

/** Mini mapa del detalle (navegador). Mientras llega MapLibre, su fondo. */
export function MapaRecorrido(props: MapaRecorridoProps) {
  const estilos = useEstilos(crear);
  // Primero la foto y los datos del caso; después, el mini mapa.
  const cargar = useCargarMapa(props.avistamientos.length > 0);
  if (props.avistamientos.length === 0) return null;
  const fondo = <View style={estilos.fondo} />;
  if (!cargar) return fondo;
  return (
    <Suspense fallback={fondo}>
      <MapaRecorridoGL {...props} />
    </Suspense>
  );
}

// El mismo tamaño y color que el mini mapa (MapaRecorridoGL).
const crear = crearEstilos((c) => ({
  fondo: { height: ALTO_MAPA_RECORRIDO, borderRadius: Radio.m, backgroundColor: c.mapaTierra },
}));
