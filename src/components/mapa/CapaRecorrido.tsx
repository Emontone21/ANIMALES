import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import {
  FILTRO_LINEA,
  FILTRO_PUNTO_RECORRIDO,
  FILTRO_ULTIMO,
  ID_CAPA_RECORRIDO_HALO,
  ID_CAPA_RECORRIDO_LINEA,
  ID_CAPA_RECORRIDO_PUNTO,
  ID_FUENTE_RECORRIDO,
  LAYOUT_RECORRIDO_LINEA,
  paintRecorridoHalo,
  paintRecorridoLinea,
  paintRecorridoPunto,
} from '@/components/mapa/estilosCapa';
import { type PuntoRecorrido, recorridoAGeoJSON } from '@/components/mapa/tipos';
import { useTema } from '@/hooks/useTema';

type Props = { avistamientos: PuntoRecorrido[]; colorTipo: string };

/** Capas nativas del recorrido: línea punteada, puntos neutros y el último con halo. */
export function CapaRecorrido({ avistamientos, colorTipo }: Props) {
  const { c } = useTema();
  const coleccion = useMemo(() => recorridoAGeoJSON(avistamientos), [avistamientos]);

  return (
    <GeoJSONSource id={ID_FUENTE_RECORRIDO} data={coleccion}>
      <Layer
        id={ID_CAPA_RECORRIDO_LINEA}
        type="line"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_LINEA}
        layout={LAYOUT_RECORRIDO_LINEA}
        paint={paintRecorridoLinea(c)}
      />
      <Layer
        id={ID_CAPA_RECORRIDO_HALO}
        type="circle"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_ULTIMO}
        paint={paintRecorridoHalo(colorTipo)}
      />
      <Layer
        id={ID_CAPA_RECORRIDO_PUNTO}
        type="circle"
        source={ID_FUENTE_RECORRIDO}
        filter={FILTRO_PUNTO_RECORRIDO}
        paint={paintRecorridoPunto(c, colorTipo)}
      />
    </GeoJSONSource>
  );
}
