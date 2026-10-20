import type { Point } from 'geojson';
import type { GeoJSONSource, Map as MapaGL, MapMouseEvent } from 'maplibre-gl';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import { AtribucionMapa } from '@/components/mapa/AtribucionMapa';
import {
  aEstiloWeb,
  agregarCapasRecorridoGrande,
  agregarMiUbicacion,
  crearMapaWeb,
} from '@/components/mapa/capasWeb';
import { useEstiloMapa } from '@/components/mapa/estiloBase';
import { CAPAS_GRANDE_TOCABLES, ID_FUENTE_RECORRIDO_GRANDE } from '@/components/mapa/estilosCapa';
import { type MapaRecorridoGrandeProps, puntoAGeoJSON } from '@/components/mapa/tipos';
import {
  encuadrar,
  latitudDelRecorrido,
  puntosParaEncuadrar,
  ZOOM_SIN_ENCUADRE,
} from '@/features/mapa/encuadre';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { MONTEVIDEO } from '@/lib/ubicacion';

/** Alrededor del dedo o del puntero: los puntos miden menos que un área táctil (44). */
const TOLERANCIA_TOQUE_PX = 12;

/**
 * Mapa en grande del recorrido en el navegador (6.9.1): se mueve, se acerca y
 * se toca. Va en el bloque de MapLibre: lo carga MapaRecorridoGrande.web.tsx.
 */
export function MapaRecorridoGrandeGL({
  datos,
  colorTipo,
  miUbicacion,
  margenes,
  onSeleccionar,
  ref,
}: MapaRecorridoGrandeProps) {
  const { c, esquema } = useTema();
  const estilos = useEstilos(crear);
  const estiloBase = useEstiloMapa();
  const contenedorRef = useRef<HTMLElement | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const cargadoRef = useRef(false);
  const aplicadoRef = useRef<{ estilo: typeof estiloBase; esquema: typeof esquema } | null>(null);

  // Lo último recibido, para los eventos del mapa y por si el estilo todavía no cargó.
  const actual = useRef({
    datos,
    miUbicacion: puntoAGeoJSON(miUbicacion),
    c,
    esquema,
    colorTipo,
    margenes,
    onSeleccionar,
  });
  useEffect(() => {
    Object.assign(actual.current, { c, esquema, colorTipo, margenes, onSeleccionar });
  });

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) => {
      const mapa = mapaRef.current;
      if (!mapa) return;
      const destino = { center: centro, padding: actual.current.margenes };
      if (zoom === undefined) mapa.easeTo({ ...destino, duration: 450 });
      else mapa.flyTo({ ...destino, zoom, duration: 600 });
    },
  }));

  // Se crea una vez, cuando el estilo está listo, con todos los puntos a la vista.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || !estiloBase || mapaRef.current) return;

    const { width, height } = contenedor.getBoundingClientRect();
    const vista = encuadrar(puntosParaEncuadrar(actual.current.datos), {
      ancho: width || window.innerWidth,
      alto: height || window.innerHeight,
      margenes: actual.current.margenes,
    });
    const mapa = crearMapaWeb(contenedor, estiloBase, {
      center: vista?.centro ?? MONTEVIDEO,
      zoom: vista?.zoom ?? ZOOM_SIN_ENCUADRE,
    });
    // El centro queda en el medio de lo que no tapan los botones ni la tarjeta.
    mapa.setPadding(actual.current.margenes);
    mapaRef.current = mapa;
    aplicadoRef.current = { estilo: estiloBase, esquema: actual.current.esquema };

    // Cada carga de estilo (la primera y cada cambio de esquema) borra las capas propias.
    mapa.on('style.load', () => {
      const { c: paleta, esquema: esq, colorTipo: color } = actual.current;
      // Mi ubicación va debajo del recorrido.
      agregarMiUbicacion(mapa, actual.current.miUbicacion, paleta, esq);
      agregarCapasRecorridoGrande(
        mapa,
        actual.current.datos,
        paleta,
        color,
        latitudDelRecorrido(actual.current.datos),
      );
      cargadoRef.current = true;
    });

    // Tocar un punto (o su zona) lo elige: el más cercano al dedo.
    mapa.on('click', (evento: MapMouseEvent) => {
      const { x, y } = evento.point;
      const tocados = mapa.queryRenderedFeatures(
        [
          [x - TOLERANCIA_TOQUE_PX, y - TOLERANCIA_TOQUE_PX],
          [x + TOLERANCIA_TOQUE_PX, y + TOLERANCIA_TOQUE_PX],
        ],
        { layers: CAPAS_GRANDE_TOCABLES.filter((capa) => mapa.getLayer(capa)) },
      );
      let elegido: string | null = null;
      let distancia = Infinity;
      for (const feature of tocados) {
        const id = feature.properties?.['id'];
        if (typeof id !== 'string') continue;
        const [lng, lat] = (feature.geometry as Point).coordinates;
        const punto = mapa.project([lng, lat]);
        const d = Math.hypot(punto.x - x, punto.y - y);
        if (d < distancia) {
          distancia = d;
          elegido = id;
        }
      }
      if (elegido) actual.current.onSeleccionar(elegido);
    });

    for (const capa of CAPAS_GRANDE_TOCABLES) {
      mapa.on('mouseenter', capa, () => {
        mapa.getCanvas().style.cursor = 'pointer';
      });
      mapa.on('mouseleave', capa, () => {
        mapa.getCanvas().style.cursor = '';
      });
    }
  }, [estiloBase]);

  useEffect(
    () => () => {
      cargadoRef.current = false;
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    [],
  );

  // Cambio de esquema: se recarga el estilo y, con él, las capas con la paleta nueva.
  useEffect(() => {
    const mapa = mapaRef.current;
    const aplicado = aplicadoRef.current;
    if (!mapa || !estiloBase || !aplicado) return;
    if (aplicado.estilo === estiloBase && aplicado.esquema === esquema) return;
    aplicadoRef.current = { estilo: estiloBase, esquema };
    cargadoRef.current = false;
    mapa.setStyle(aEstiloWeb(estiloBase), { diff: false });
  }, [estiloBase, esquema]);

  // Otro punto elegido: solo cambian los datos.
  useEffect(() => {
    actual.current.datos = datos;
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      (mapa.getSource(ID_FUENTE_RECORRIDO_GRANDE) as GeoJSONSource | undefined)?.setData(datos);
    }
  }, [datos]);

  // Otro color del caso (cambió su estado mientras se miraba): se rehacen las capas.
  const colorRef = useRef(colorTipo);
  useEffect(() => {
    if (colorRef.current === colorTipo) return;
    colorRef.current = colorTipo;
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      const { datos: d, c: paleta } = actual.current;
      agregarCapasRecorridoGrande(mapa, d, paleta, colorTipo, latitudDelRecorrido(d));
    }
  }, [colorTipo]);

  useEffect(() => {
    actual.current.miUbicacion = puntoAGeoJSON(miUbicacion);
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      agregarMiUbicacion(mapa, actual.current.miUbicacion, c, esquema);
    }
  }, [miUbicacion, c, esquema]);

  return (
    <View style={estilos.raiz}>
      {/* En react-native-web la ref de un View es el elemento del DOM. */}
      <View
        ref={contenedorRef as never}
        style={estilos.mapa}
        accessibilityLabel={t.mapa.recorrido.titulo}
      />
      <AtribucionMapa abajo={margenes.bottom + 8} izquierda={margenes.left + 8} />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.mapaTierra },
  mapa: { flex: 1 },
}));
