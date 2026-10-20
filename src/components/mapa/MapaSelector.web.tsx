import { lazy, Suspense, useEffect } from 'react';
import { View } from 'react-native';

import { precargarEstiloMapa } from '@/components/mapa/estiloBase';
import type { MapaSelectorProps } from '@/components/mapa/tipos';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

// MapLibre va en un bloque aparte (import dinámico): se baja al abrir el selector.
const MapaSelectorGL = lazy(() =>
  import('@/components/mapa/mapasWeb').then((m) => ({ default: m.MapaSelectorGL })),
);

/** Mapa para elegir un punto en el navegador. Mientras llega MapLibre, su fondo. */
export function MapaSelector(props: MapaSelectorProps) {
  const estilos = useEstilos(crear);
  useEffect(precargarEstiloMapa, []);
  return (
    <Suspense fallback={<View style={estilos.fondo} />}>
      <MapaSelectorGL {...props} />
    </Suspense>
  );
}

// El mismo tamaño y color que el selector (MapaSelectorGL).
const crear = crearEstilos((c) => ({
  fondo: { flex: 1, minHeight: 320, backgroundColor: c.mapaTierra },
}));
