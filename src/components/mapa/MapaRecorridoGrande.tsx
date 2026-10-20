import { type CameraRef, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  FILTRO_HALO_GRANDE,
  FILTRO_LINEA,
  FILTRO_PUNTO_EXACTO,
  FILTRO_PUNTO_RECORRIDO,
  FILTRO_ZONA,
  ID_CAPA_GRANDE_HALO,
  ID_CAPA_GRANDE_LINEA,
  ID_CAPA_GRANDE_NUMERO,
  ID_CAPA_GRANDE_PUNTO,
  ID_CAPA_GRANDE_ZONA,
  ID_CAPA_MI_UBICACION,
  ID_CAPA_MI_UBICACION_HALO,
  ID_FUENTE_MI_UBICACION,
  ID_FUENTE_RECORRIDO_GRANDE,
  LAYOUT_NUMERO_GRANDE,
  LAYOUT_PUNTO_GRANDE,
  LAYOUT_RECORRIDO_LINEA,
  LAYOUT_ZONA,
  paintHaloGrande,
  paintLineaGrande,
  paintMiUbicacion,
  paintMiUbicacionHalo,
  paintNumeroGrande,
  paintPuntoGrande,
  paintZonaAproximada,
} from '@/components/mapa/estilosCapa';
import { MapaBase } from '@/components/mapa/MapaBase';
import { type MapaRecorridoGrandeProps, puntoAGeoJSON } from '@/components/mapa/tipos';
import {
  type Encuadre,
  encuadrar,
  latitudDelRecorrido,
  puntosParaEncuadrar,
  ZOOM_SIN_ENCUADRE,
} from '@/features/mapa/encuadre';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { MONTEVIDEO } from '@/lib/ubicacion';

/**
 * Mapa en grande del recorrido en Android/iOS (6.9.1), con las mismas capas
 * que la versión web. La vista inicial necesita el tamaño del mapa: se dibuja
 * después de medirlo.
 */
export function MapaRecorridoGrande({
  datos,
  colorTipo,
  miUbicacion,
  margenes,
  onSeleccionar,
  ref,
}: MapaRecorridoGrandeProps) {
  const { c, esquema } = useTema();
  const estilos = useEstilos(crear);
  const cameraRef = useRef<CameraRef>(null);
  // La vista inicial, calculada una sola vez al medir: después la cámara es de quien mira.
  const [inicial, setInicial] = useState<{ vista: Encuadre | null } | null>(null);
  const ubicacion = useMemo(() => puntoAGeoJSON(miUbicacion), [miUbicacion]);
  const latitud = latitudDelRecorrido(datos);

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) => {
      if (zoom === undefined) {
        cameraRef.current?.easeTo({ center: centro, duration: 450, padding: margenes });
      } else {
        cameraRef.current?.flyTo({ center: centro, zoom, duration: 600, padding: margenes });
      }
    },
  }));

  return (
    <View
      style={estilos.raiz}
      accessibilityLabel={t.mapa.recorrido.titulo}
      onLayout={(evento) => {
        if (inicial) return;
        const { width, height } = evento.nativeEvent.layout;
        const vista = encuadrar(puntosParaEncuadrar(datos), {
          ancho: width,
          alto: height,
          margenes,
        });
        setInicial({ vista });
      }}>
      {inicial ? (
        <MapaBase
          cameraRef={cameraRef}
          centroInicial={inicial.vista?.centro ?? MONTEVIDEO}
          zoomInicial={inicial.vista?.zoom ?? ZOOM_SIN_ENCUADRE}
          margenesIniciales={margenes}
          atribucionAbajo={margenes.bottom + 8}
          atribucionIzquierda={margenes.left + 8}>
          {/* Mi ubicación va debajo del recorrido. */}
          <GeoJSONSource id={ID_FUENTE_MI_UBICACION} data={ubicacion}>
            <Layer
              id={ID_CAPA_MI_UBICACION_HALO}
              type="circle"
              source={ID_FUENTE_MI_UBICACION}
              paint={paintMiUbicacionHalo(c, esquema)}
            />
            <Layer
              id={ID_CAPA_MI_UBICACION}
              type="circle"
              source={ID_FUENTE_MI_UBICACION}
              paint={paintMiUbicacion(c)}
            />
          </GeoJSONSource>
          <GeoJSONSource
            id={ID_FUENTE_RECORRIDO_GRANDE}
            data={datos}
            // Los puntos miden menos que un área táctil (44).
            hitbox={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={(evento) => {
              const id = evento.nativeEvent.features[0]?.properties?.['id'];
              if (typeof id === 'string') onSeleccionar(id);
            }}>
            <Layer
              id={ID_CAPA_GRANDE_ZONA}
              type="circle"
              source={ID_FUENTE_RECORRIDO_GRANDE}
              filter={FILTRO_ZONA}
              layout={LAYOUT_ZONA}
              paint={paintZonaAproximada(c, colorTipo, latitud)}
            />
            <Layer
              id={ID_CAPA_GRANDE_LINEA}
              type="line"
              source={ID_FUENTE_RECORRIDO_GRANDE}
              filter={FILTRO_LINEA}
              layout={LAYOUT_RECORRIDO_LINEA}
              paint={paintLineaGrande(c)}
            />
            <Layer
              id={ID_CAPA_GRANDE_HALO}
              type="circle"
              source={ID_FUENTE_RECORRIDO_GRANDE}
              filter={FILTRO_HALO_GRANDE}
              paint={paintHaloGrande(colorTipo)}
            />
            <Layer
              id={ID_CAPA_GRANDE_PUNTO}
              type="circle"
              source={ID_FUENTE_RECORRIDO_GRANDE}
              filter={FILTRO_PUNTO_EXACTO}
              layout={LAYOUT_PUNTO_GRANDE}
              paint={paintPuntoGrande(c, colorTipo)}
            />
            <Layer
              id={ID_CAPA_GRANDE_NUMERO}
              type="symbol"
              source={ID_FUENTE_RECORRIDO_GRANDE}
              filter={FILTRO_PUNTO_RECORRIDO}
              layout={LAYOUT_NUMERO_GRANDE}
              paint={paintNumeroGrande(c, colorTipo)}
            />
          </GeoJSONSource>
        </MapaBase>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.mapaTierra },
}));
