import type { Map as MapaGL } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { AtribucionMapa } from '@/components/mapa/AtribucionMapa';
import { aEstiloWeb, crearMapaWeb } from '@/components/mapa/capasWeb';
import { useEstiloMapa } from '@/components/mapa/estiloBase';
import type { MapaSelectorProps } from '@/components/mapa/tipos';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

/**
 * Mapa para elegir un punto en el navegador. El pin fijo lo dibuja quien lo usa.
 * Va en un bloque aparte: lo carga MapaSelector.web.tsx.
 */
export function MapaSelectorGL({ centroInicial, zoomInicial, onCentroCambia }: MapaSelectorProps) {
  const { esquema } = useTema();
  const estilos = useEstilos(crear);
  const estiloBase = useEstiloMapa();
  const contenedorRef = useRef<HTMLElement | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const onCentroRef = useRef(onCentroCambia);
  useEffect(() => {
    onCentroRef.current = onCentroCambia;
  }, [onCentroCambia]);

  // Se crea una vez, cuando el estilo está listo: el centro inicial no cambia con el modal abierto.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || !estiloBase || mapaRef.current) return;
    const mapa = crearMapaWeb(contenedor, estiloBase, { center: centroInicial, zoom: zoomInicial });
    mapaRef.current = mapa;
    mapa.on('moveend', () => {
      const { lng, lat } = mapa.getCenter();
      onCentroRef.current([lng, lat]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estiloBase]);

  useEffect(
    () => () => {
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    [],
  );

  const esquemaRef = useRef(esquema);
  useEffect(() => {
    if (esquemaRef.current === esquema) return;
    esquemaRef.current = esquema;
    if (estiloBase) mapaRef.current?.setStyle(aEstiloWeb(estiloBase));
  }, [esquema, estiloBase]);

  return (
    <View style={estilos.contenedor}>
      {/* En react-native-web la ref de un View es el elemento del DOM. */}
      <View ref={contenedorRef as never} style={estilos.mapa} />
      <AtribucionMapa />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: { flex: 1, minHeight: 320, backgroundColor: c.mapaTierra },
  mapa: { flex: 1 },
}));
