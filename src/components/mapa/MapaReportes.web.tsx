import type { Feature, Point } from 'geojson';
import { type GeoJSONSource, type Map as MapaGL, type MapMouseEvent, Marker } from 'maplibre-gl';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import { AtribucionMapa } from '@/components/mapa/AtribucionMapa';
import {
  aEstiloWeb,
  agregarCapasAnimales,
  agregarCapasRecorrido,
  agregarMiUbicacion,
  crearMapaWeb,
  filtrarSeleccionado,
} from '@/components/mapa/capasWeb';
import { useEstiloMapa } from '@/components/mapa/estiloBase';
import {
  ID_CAPA_CENTRO,
  ID_CAPA_CLUSTER,
  ID_CAPA_MI_UBICACION_HALO,
  ID_CAPA_PUNTO,
  ID_FUENTE_ANIMALES,
} from '@/components/mapa/estilosCapa';
import {
  animalesAGeoJSON,
  type MapaReportesProps,
  puntoAGeoJSON,
  recorridoAGeoJSON,
} from '@/components/mapa/tipos';
import { coloresDeEstado, type Paleta } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { urlFoto } from '@/lib/imagenes';
import { MONTEVIDEO, ZOOM_CIUDAD } from '@/lib/ubicacion';
import type { AnimalEnMapa } from '@/types/dominio';

const SIN_MARGENES = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Mapa principal en el navegador (MapLibre GL JS). Mismas capas que la versión
 * nativa; al cambiar de esquema cambia de estilo sin perder posición ni selección.
 */
export function MapaReportes({
  animales,
  recorrido = [],
  seleccionadoId = null,
  resaltadoId = null,
  miUbicacion = null,
  margenes = SIN_MARGENES,
  onSeleccionar,
  onDeseleccionar,
  onMovimiento,
  ref,
}: MapaReportesProps) {
  const { c, esquema } = useTema();
  const estilos = useEstilos(crear);
  const estiloBase = useEstiloMapa();

  const contenedorRef = useRef<HTMLElement | null>(null);
  const mapaRef = useRef<MapaGL | null>(null);
  const cargadoRef = useRef(false);
  // Estilo y esquema con los que se cargó el mapa por última vez.
  const aplicadoRef = useRef<{ estilo: typeof estiloBase; esquema: typeof esquema } | null>(null);
  const marcadorRef = useRef<Marker | null>(null);
  const resaltadoRef = useRef<string | null>(null);

  const seleccionado = animales.find((a) => a.id === seleccionadoId) ?? null;
  const colorTipo = coloresDeEstado(
    c,
    seleccionado?.estado ?? 'avistado',
    seleccionado?.tipo_reporte,
  ).anillo;

  // Lo último recibido, para los eventos del mapa y por si el estilo todavía no cargó.
  const actual = useRef({
    animales: animalesAGeoJSON([]),
    recorrido: recorridoAGeoJSON([]),
    miUbicacion: puntoAGeoJSON(null),
    seleccionadoId,
    c,
    esquema,
    colorTipo,
    margenes,
    onSeleccionar,
    onDeseleccionar,
    onMovimiento,
  });
  useEffect(() => {
    Object.assign(actual.current, {
      c,
      esquema,
      colorTipo,
      margenes,
      onSeleccionar,
      onDeseleccionar,
      onMovimiento,
    });
  });

  useImperativeHandle(ref, () => ({
    irA: (centro, zoom) =>
      mapaRef.current?.flyTo({
        center: centro,
        zoom,
        duration: 600,
        padding: actual.current.margenes,
      }),
  }));

  // Crear el mapa una sola vez, cuando el estilo está listo.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || !estiloBase || mapaRef.current) return;

    const mapa = crearMapaWeb(contenedor, estiloBase, { center: MONTEVIDEO, zoom: ZOOM_CIUDAD });
    // El centro inicial queda en la parte visible, fuera de la hoja o el panel.
    mapa.setPadding(actual.current.margenes);
    mapaRef.current = mapa;
    aplicadoRef.current = { estilo: estiloBase, esquema: actual.current.esquema };

    // Cada carga de estilo (la primera y cada cambio de esquema) borra las capas propias.
    mapa.on('style.load', () => {
      const { c: paleta, esquema: esq } = actual.current;
      agregarCapasAnimales(mapa, actual.current.animales, paleta, actual.current.seleccionadoId);
      // El recorrido y mi ubicación van debajo de los marcadores.
      agregarCapasRecorrido(
        mapa,
        actual.current.recorrido,
        paleta,
        actual.current.colorTipo,
        ID_CAPA_PUNTO,
      );
      agregarMiUbicacion(mapa, actual.current.miUbicacion, paleta, esq);
      if (mapa.getLayer(ID_CAPA_MI_UBICACION_HALO))
        mapa.moveLayer(ID_CAPA_MI_UBICACION_HALO, ID_CAPA_CLUSTER);
      cargadoRef.current = true;
      aplicarResaltado(mapa, resaltadoRef.current, resaltadoRef.current);
    });

    const tocarPunto = (evento: MapMouseEvent) => {
      const feature = mapa.queryRenderedFeatures(evento.point, {
        layers: [ID_CAPA_PUNTO, ID_CAPA_CENTRO],
      })[0];
      const id = feature?.properties?.['id'];
      if (typeof id === 'string') actual.current.onSeleccionar(id);
    };
    mapa.on('click', ID_CAPA_PUNTO, tocarPunto);

    mapa.on('click', ID_CAPA_CLUSTER, async (evento: MapMouseEvent) => {
      const feature = mapa.queryRenderedFeatures(evento.point, { layers: [ID_CAPA_CLUSTER] })[0] as
        Feature<Point> | undefined;
      const clusterId = feature?.properties?.['cluster_id'];
      if (!feature || typeof clusterId !== 'number') return;
      const fuente = mapa.getSource(ID_FUENTE_ANIMALES) as GeoJSONSource;
      const zoom = await fuente.getClusterExpansionZoom(clusterId);
      const [lng, lat] = feature.geometry.coordinates;
      mapa.easeTo({
        center: [lng, lat],
        zoom: zoom + 0.5,
        duration: 500,
        padding: actual.current.margenes,
      });
    });

    mapa.on('click', (evento: MapMouseEvent) => {
      const tocados = mapa.queryRenderedFeatures(evento.point, {
        layers: [ID_CAPA_PUNTO, ID_CAPA_CLUSTER].filter((capa) => mapa.getLayer(capa)),
      });
      if (tocados.length === 0) actual.current.onDeseleccionar();
    });

    for (const capa of [ID_CAPA_PUNTO, ID_CAPA_CLUSTER]) {
      mapa.on('mouseenter', capa, () => {
        mapa.getCanvas().style.cursor = 'pointer';
      });
      mapa.on('mouseleave', capa, () => {
        mapa.getCanvas().style.cursor = '';
      });
    }

    mapa.on('moveend', () => {
      const { lng, lat } = mapa.getCenter();
      actual.current.onMovimiento?.([lng, lat]);
    });
    // Centro inicial, para ordenar por distancia antes del primer movimiento.
    mapa.once('load', () => {
      const { lng, lat } = mapa.getCenter();
      actual.current.onMovimiento?.([lng, lat]);
    });
  }, [estiloBase]);

  // Al desmontar.
  useEffect(
    () => () => {
      cargadoRef.current = false;
      marcadorRef.current?.remove();
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    [],
  );

  // Cambio de esquema: se recarga el estilo y, con él, las capas con la paleta nueva.
  // Si la descarga falló y se usa la URL tal cual, el estilo no cambia pero las capas sí.
  useEffect(() => {
    const mapa = mapaRef.current;
    const aplicado = aplicadoRef.current;
    if (!mapa || !estiloBase || !aplicado) return;
    if (aplicado.estilo === estiloBase && aplicado.esquema === esquema) return;
    aplicadoRef.current = { estilo: estiloBase, esquema };
    cargadoRef.current = false;
    mapa.setStyle(aEstiloWeb(estiloBase), { diff: false });
  }, [estiloBase, esquema]);

  useEffect(() => {
    actual.current.animales = animalesAGeoJSON(animales);
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      (mapa.getSource(ID_FUENTE_ANIMALES) as GeoJSONSource | undefined)?.setData(
        actual.current.animales,
      );
    }
  }, [animales]);

  useEffect(() => {
    actual.current.recorrido = recorridoAGeoJSON(recorrido);
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) {
      agregarCapasRecorrido(mapa, actual.current.recorrido, c, colorTipo, ID_CAPA_PUNTO);
    }
  }, [recorrido, c, colorTipo]);

  useEffect(() => {
    actual.current.miUbicacion = puntoAGeoJSON(miUbicacion);
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current)
      agregarMiUbicacion(mapa, actual.current.miUbicacion, c, esquema);
  }, [miUbicacion, c, esquema]);

  useEffect(() => {
    const mapa = mapaRef.current;
    const anterior = resaltadoRef.current;
    resaltadoRef.current = resaltadoId;
    if (mapa && cargadoRef.current) aplicarResaltado(mapa, anterior, resaltadoId);
  }, [resaltadoId]);

  useEffect(() => {
    actual.current.seleccionadoId = seleccionadoId;
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) filtrarSeleccionado(mapa, seleccionadoId);
  }, [seleccionadoId]);

  // Marcador con foto del seleccionado.
  useEffect(() => {
    marcadorRef.current?.remove();
    marcadorRef.current = null;
    const mapa = mapaRef.current;
    if (!mapa || !seleccionado) return;
    marcadorRef.current = new Marker({
      element: elementoFoto(seleccionado, c),
      anchor: 'bottom',
    })
      .setLngLat([seleccionado.lng, seleccionado.lat])
      .addTo(mapa);
  }, [seleccionado, c, estiloBase]);

  return (
    <View style={estilos.raiz}>
      {/* En react-native-web la ref de un View es el elemento del DOM. */}
      <View ref={contenedorRef as never} style={estilos.mapa} accessibilityLabel={t.mapa.titulo} />
      <AtribucionMapa abajo={margenes.bottom + 8} izquierda={margenes.left + 8} />
    </View>
  );
}

function aplicarResaltado(mapa: MapaGL, anterior: string | null, nuevo: string | null) {
  if (!mapa.getSource(ID_FUENTE_ANIMALES)) return;
  if (anterior)
    mapa.setFeatureState({ source: ID_FUENTE_ANIMALES, id: anterior }, { resaltado: false });
  if (nuevo) mapa.setFeatureState({ source: ID_FUENTE_ANIMALES, id: nuevo }, { resaltado: true });
}

/** Círculo de 58 con la foto, borde interno en superficie, anillo del tipo y colita (6.6). */
function elementoFoto(animal: AnimalEnMapa, c: Paleta): HTMLElement {
  const anillo = coloresDeEstado(c, animal.estado, animal.tipo_reporte).anillo;
  const raiz = document.createElement('div');
  raiz.setAttribute('aria-hidden', 'true');
  Object.assign(raiz.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
    filter: `drop-shadow(0px 6px 9px ${c.sombra})`,
  });
  const circulo = document.createElement('div');
  Object.assign(circulo.style, {
    width: '58px',
    height: '58px',
    boxSizing: 'border-box',
    borderRadius: '50%',
    border: `3px solid ${anillo}`,
    background: c.superficie,
    padding: '3px',
  });
  const foto = document.createElement('img');
  foto.src = urlFoto(animal.foto_principal_path);
  foto.alt = '';
  Object.assign(foto.style, {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
    background: c.superficieSuave,
  });
  circulo.appendChild(foto);
  const colita = document.createElement('div');
  Object.assign(colita.style, {
    width: '12px',
    height: '12px',
    marginTop: '-8px',
    transform: 'rotate(45deg)',
    background: anillo,
  });
  raiz.append(circulo, colita);
  return raiz;
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.mapaTierra },
  mapa: { flex: 1, minHeight: 240 },
}));
