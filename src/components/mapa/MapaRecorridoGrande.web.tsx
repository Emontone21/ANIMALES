import { lazy, Suspense, useEffect } from 'react';
import { View } from 'react-native';

import { precargarEstiloMapa } from '@/components/mapa/estiloBase';
import type { MapaRecorridoGrandeProps } from '@/components/mapa/tipos';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { activarFuentesWeb } from '@/lib/fuentesWeb';

// En el bloque de MapLibre, como los otros mapas (src/components/mapa/mapasWeb.ts).
const MapaRecorridoGrandeGL = lazy(() =>
  import('@/components/mapa/mapasWeb').then((m) => ({ default: m.MapaRecorridoGrandeGL })),
);

/**
 * Mapa en grande del recorrido (navegador). Acá el mapa es lo que se vino a
 * ver: se pide enseguida, y mientras llega se ve su fondo.
 */
export function MapaRecorridoGrande(props: MapaRecorridoGrandeProps) {
  const estilos = useEstilos(crear);

  useEffect(() => {
    precargarEstiloMapa();
    activarFuentesWeb();
  }, []);

  return (
    <Suspense fallback={<View style={estilos.fondo} />}>
      <MapaRecorridoGrandeGL {...props} />
    </Suspense>
  );
}

// El mismo color que el mapa (MapaRecorridoGrandeGL): nada cambia cuando llega.
const crear = crearEstilos((c) => ({
  fondo: { flex: 1, backgroundColor: c.mapaTierra },
}));
