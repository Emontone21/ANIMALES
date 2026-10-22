import type { Map as MapaGL } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { AtribucionMapa } from '@/components/mapa/AtribucionMapa';
import { aEstiloWeb, agregarCapasRecorrido, crearMapaWeb } from '@/components/mapa/capasWeb';
import { useEstiloMapa } from '@/components/mapa/estiloBase';
import {
  ALTO_MAPA_RECORRIDO,
  limitesDe,
  type MapaRecorridoProps,
  recorridoAGeoJSON,
} from '@/components/mapa/tipos';
import { coloresDeEstado, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { ZOOM_PUNTO } from '@/lib/ubicacion';

/**
 * Mini mapa del detalle (navegador) con el recorrido del animal (6.9). Va en un
 * bloque aparte: lo carga MapaRecorrido.web.tsx.
 */
export function MapaRecorridoGL({ avistamientos, estado, tipo }: MapaRecorridoProps) {
  const { c, esquema } = useTema();
  const estilos = useEstilos(crear);
  const estiloBase = useEstiloMapa();
  const contenedorRef = useRef<HTMLElement | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const colorTipo = coloresDeEstado(c, estado, tipo).anillo;
  const actual = useRef({ datos: recorridoAGeoJSON([]), c, colorTipo });

  useEffect(() => {
    actual.current = { datos: recorridoAGeoJSON(avistamientos), c, colorTipo };
  });

  // Se crea una vez, cuando el estilo está listo; si cambian los avistamientos, el padre cambia la key.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    const limites = limitesDe(avistamientos.map((av) => [av.lng, av.lat]));
    if (!contenedor || !limites || !estiloBase || mapaRef.current) return;

    const unSoloPunto = avistamientos.length === 1;
    const mapa = crearMapaWeb(contenedor, estiloBase, {
      interactive: false,
      ...(unSoloPunto
        ? { center: limites[0], zoom: ZOOM_PUNTO }
        : { bounds: limites, fitBoundsOptions: { padding: 32 } }),
    });
    mapaRef.current = mapa;
    mapa.on('style.load', () => {
      const { datos, c: paleta, colorTipo: color } = actual.current;
      agregarCapasRecorrido(mapa, datos, paleta, color);
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

  // Cambio de esquema: otro estilo y las capas con la paleta nueva.
  const esquemaRef = useRef(esquema);
  useEffect(() => {
    if (esquemaRef.current === esquema) return;
    esquemaRef.current = esquema;
    if (estiloBase) mapaRef.current?.setStyle(aEstiloWeb(estiloBase), { diff: false });
  }, [esquema, estiloBase]);

  if (avistamientos.length === 0) return null;

  return (
    <View style={estilos.contenedor}>
      {/* En react-native-web la ref de un View es el elemento del DOM. */}
      <View ref={contenedorRef as never} style={estilos.mapa} />
      {/* Va adentro del botón "Ver el mapa en grande": sin link (AtribucionMapa). */}
      <AtribucionMapa enlace={false} />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: {
    height: ALTO_MAPA_RECORRIDO,
    borderRadius: Radio.m,
    overflow: 'hidden',
    backgroundColor: c.mapaTierra,
  },
  mapa: { flex: 1 },
}));
