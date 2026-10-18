import { AttributionControl, Map as MapaGL, NavigationControl } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { configurarMapLibreWeb } from '@/components/mapa/maplibreWeb';
import type { MapaSelectorProps } from '@/components/mapa/tipos';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';

/** Mapa para elegir un punto en el navegador. El pin fijo lo dibuja quien lo usa. */
export function MapaSelector({ centroInicial, zoomInicial, onCentroCambia }: MapaSelectorProps) {
  const contenedorRef = useRef<HTMLElement | null>(null);
  const onCentroRef = useRef(onCentroCambia);
  useEffect(() => {
    onCentroRef.current = onCentroCambia;
  }, [onCentroCambia]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    configurarMapLibreWeb();

    const mapa = new MapaGL({
      container: contenedor,
      style: ENV.mapStyleUrl,
      center: centroInicial,
      zoom: zoomInicial,
      attributionControl: false,
    });
    mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapa.addControl(
      new AttributionControl({ compact: true, customAttribution: t.mapa.atribucion }),
      'bottom-left',
    );
    mapa.on('moveend', () => {
      const { lng, lat } = mapa.getCenter();
      onCentroRef.current([lng, lat]);
    });

    return () => mapa.remove();
    // Solo al montar: el centro inicial no cambia mientras el modal está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En react-native-web la ref de un View es el elemento del DOM.
  return <View ref={contenedorRef as never} style={estilos.mapa} />;
}

const estilos = StyleSheet.create({
  mapa: { flex: 1, minHeight: 320 },
});
