import { MapaBase } from '@/components/mapa/MapaBase';
import type { MapaSelectorProps } from '@/components/mapa/tipos';

/** Mapa para elegir un punto en Android/iOS. El pin fijo lo dibuja quien lo usa. */
export function MapaSelector({ centroInicial, zoomInicial, onCentroCambia }: MapaSelectorProps) {
  return (
    <MapaBase
      centroInicial={centroInicial}
      zoomInicial={zoomInicial}
      onRegionDidChange={(evento) => onCentroCambia(evento.nativeEvent.center)}
    />
  );
}
