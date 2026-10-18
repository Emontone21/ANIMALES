import { AttributionControl, Map as MapaGL } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { agregarCapasRecorrido } from '@/components/mapa/capasWeb';
import { configurarMapLibreWeb } from '@/components/mapa/maplibreWeb';
import { limitesDe, type MapaRecorridoProps, recorridoAGeoJSON } from '@/components/mapa/tipos';
import { Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import { ENV } from '@/lib/env';
import { ZOOM_PUNTO } from '@/lib/ubicacion';

/** Mini mapa del detalle (navegador) con el recorrido del animal. */
export function MapaRecorrido({ avistamientos }: MapaRecorridoProps) {
  const contenedorRef = useRef<HTMLElement | null>(null);
  const datosRef = useRef(recorridoAGeoJSON(avistamientos));

  useEffect(() => {
    datosRef.current = recorridoAGeoJSON(avistamientos);
  }, [avistamientos]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    const limites = limitesDe(avistamientos.map((av) => [av.lng, av.lat]));
    if (!contenedor || !limites) return;
    configurarMapLibreWeb();

    const unSoloPunto = avistamientos.length === 1;
    const mapa = new MapaGL({
      container: contenedor,
      style: ENV.mapStyleUrl,
      attributionControl: false,
      interactive: false,
      ...(unSoloPunto
        ? { center: limites[0], zoom: ZOOM_PUNTO }
        : { bounds: limites, fitBoundsOptions: { padding: 48 } }),
    });
    mapa.addControl(
      new AttributionControl({ compact: true, customAttribution: t.mapa.atribucion }),
      'bottom-left',
    );
    mapa.on('load', () => agregarCapasRecorrido(mapa, datosRef.current));

    return () => mapa.remove();
    // Solo al montar: si cambian los avistamientos, el padre cambia la key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (avistamientos.length === 0) return null;

  // En react-native-web la ref de un View es el elemento del DOM.
  return <View ref={contenedorRef as never} style={estilos.contenedor} />;
}

const estilos = StyleSheet.create({
  contenedor: { height: 220, borderRadius: Radio.m, overflow: 'hidden' },
});
