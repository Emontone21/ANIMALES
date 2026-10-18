import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import {
  FILTRO_LINEA,
  FILTRO_PUNTO_RECORRIDO,
  ID_CAPA_RECORRIDO_LINEA,
  ID_CAPA_RECORRIDO_NUMERO,
  ID_CAPA_RECORRIDO_PUNTO,
  ID_FUENTE_RECORRIDO,
  LAYOUT_RECORRIDO_LINEA,
  LAYOUT_RECORRIDO_NUMERO,
  PAINT_RECORRIDO_LINEA,
  PAINT_RECORRIDO_NUMERO,
  PAINT_RECORRIDO_PUNTO,
} from '@/components/mapa/estilosCapa';
import { recorridoAGeoJSON } from '@/components/mapa/tipos';
import type { AvistamientoDetalle } from '@/types/dominio';

/** Capas nativas del recorrido de un animal: línea punteada y puntos numerados. */
export function CapaRecorrido({ avistamientos }: { avistamientos: AvistamientoDetalle[] }) {
  const coleccion = useMemo(() => recorridoAGeoJSON(avistamientos), [avistamientos]);

  return (
    <GeoJSONSource id={ID_FUENTE_RECORRIDO} data={coleccion}>
      <Layer
        id={ID_CAPA_RECORRIDO_LINEA}
        type="line"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_LINEA}
        layout={LAYOUT_RECORRIDO_LINEA}
        paint={PAINT_RECORRIDO_LINEA}
      />
      <Layer
        id={ID_CAPA_RECORRIDO_PUNTO}
        type="circle"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_PUNTO_RECORRIDO}
        paint={PAINT_RECORRIDO_PUNTO}
      />
      <Layer
        id={ID_CAPA_RECORRIDO_NUMERO}
        type="symbol"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_PUNTO_RECORRIDO}
        layout={LAYOUT_RECORRIDO_NUMERO}
        paint={PAINT_RECORRIDO_NUMERO}
      />
    </GeoJSONSource>
  );
}
