import { lazy, Suspense } from 'react';
import { View } from 'react-native';

import type { MapaReportesProps } from '@/components/mapa/tipos';
import { useCargarMapa } from '@/components/mapa/useCargarMapa';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

// MapLibre GL JS pesa cerca de 1 MB: va en un bloque aparte (import dinámico),
// así la pantalla, los controles y "Cerca tuyo" no lo esperan.
const MapaReportesGL = lazy(() =>
  import('@/components/mapa/mapasWeb').then((m) => ({ default: m.MapaReportesGL })),
);

/** Mapa principal en el navegador. Mientras llega MapLibre, el fondo del mapa. */
export function MapaReportes(props: MapaReportesProps) {
  const estilos = useEstilos(crear);
  // Primero los casos de "Cerca tuyo" con sus fotos; después, el mapa.
  const cargar = useCargarMapa(props.animales.length > 0);
  const fondo = <View style={estilos.fondo} />;
  if (!cargar) return fondo;
  return (
    <Suspense fallback={fondo}>
      <MapaReportesGL {...props} />
    </Suspense>
  );
}

// El mismo tamaño y color que el mapa (MapaReportesGL): nada se mueve cuando llega.
const crear = crearEstilos((c) => ({
  fondo: { flex: 1, minHeight: 240, backgroundColor: c.mapaTierra },
}));
