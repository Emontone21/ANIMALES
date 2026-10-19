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
  ID_CAPA_CLUSTER,
  ID_CAPA_MI_UBICACION_HALO,
  ID_CAPA_PUNTO,
  ID_FUENTE_ANIMALES,
  MARCADOR,
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
import { urlFoto, urlMiniatura } from '@/lib/imagenes';
import { MONTEVIDEO, ZOOM_CIUDAD } from '@/lib/ubicacion';
import type { AnimalEnMapa } from '@/types/dominio';

const SIN_MARGENES = { top: 0, right: 0, bottom: 0, left: 0 };

/** Un marcador con foto ya dibujado, con lo que hace falta para saber si cambió. */
type MarcadorWeb = {
  marcador: Marker;
  circulo: HTMLElement;
  animal: AnimalEnMapa;
  seleccionado: boolean;
  c: Paleta;
};

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
  // Marcadores con foto, por id del animal.
  const marcadoresRef = useRef(new Map<string, MarcadorWeb>());

  const seleccionado = animales.find((a) => a.id === seleccionadoId) ?? null;
  const colorTipo = coloresDeEstado(
    c,
    seleccionado?.estado ?? 'avistado',
    seleccionado?.tipo_reporte,
  ).anillo;

  // Lo último recibido, para los eventos del mapa y por si el estilo todavía no cargó.
  const actual = useRef({
    animales: animalesAGeoJSON([]),
    porId: new Map<string, AnimalEnMapa>(),
    resaltadoId,
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
      resaltadoId,
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
    });

    // Cuando el mapa termina de dibujar (al cargar, al moverse, con datos
    // nuevos), cada punto suelto que se ve tiene su marcador con foto.
    mapa.on('idle', () => actualizarMarcadores(mapa, marcadoresRef.current, actual.current));

    // El marcador no recibe el toque: llega a la zona táctil que tiene debajo.
    const tocarPunto = (evento: MapMouseEvent) => {
      const feature = mapa.queryRenderedFeatures(evento.point, { layers: [ID_CAPA_PUNTO] })[0];
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
  useEffect(() => {
    const marcadores = marcadoresRef.current;
    return () => {
      cargadoRef.current = false;
      for (const { marcador } of marcadores.values()) marcador.remove();
      marcadores.clear();
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, []);

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
    actual.current.porId = new Map(animales.map((a) => [a.id, a]));
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
    actual.current.seleccionadoId = seleccionadoId;
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current) filtrarSeleccionado(mapa, seleccionadoId);
  }, [seleccionadoId]);

  // Selección, datos, paleta o tarjeta con el mouse encima: se rehacen los
  // marcadores que cambiaron (el resto, en el próximo "idle").
  useEffect(() => {
    actual.current.resaltadoId = resaltadoId;
    const mapa = mapaRef.current;
    if (mapa && cargadoRef.current)
      actualizarMarcadores(mapa, marcadoresRef.current, actual.current);
  }, [animales, seleccionadoId, resaltadoId, c]);

  return (
    <View style={estilos.raiz}>
      {/* En react-native-web la ref de un View es el elemento del DOM. */}
      <View ref={contenedorRef as never} style={estilos.mapa} accessibilityLabel={t.mapa.titulo} />
      <AtribucionMapa abajo={margenes.bottom + 8} izquierda={margenes.left + 8} />
    </View>
  );
}

type EstadoMarcadores = {
  porId: Map<string, AnimalEnMapa>;
  seleccionadoId: string | null;
  resaltadoId: string | null;
  c: Paleta;
};

/**
 * Deja un marcador con foto en cada punto suelto que se ve (los que dibuja la
 * zona táctil) y en el seleccionado, aunque un cluster lo tape. Reutiliza los
 * que no cambiaron y saca los que ya no se ven o quedaron dentro de un cluster.
 */
function actualizarMarcadores(
  mapa: MapaGL,
  marcadores: Map<string, MarcadorWeb>,
  { porId, seleccionadoId, resaltadoId, c }: EstadoMarcadores,
) {
  const ids = new Set<string>();
  if (mapa.getLayer(ID_CAPA_PUNTO)) {
    for (const feature of mapa.queryRenderedFeatures({ layers: [ID_CAPA_PUNTO] })) {
      const id = feature.properties?.['id'];
      if (typeof id === 'string') ids.add(id);
    }
  }
  if (seleccionadoId) ids.add(seleccionadoId);

  for (const [id, { marcador }] of marcadores) {
    if (!ids.has(id) || !porId.has(id)) {
      marcador.remove();
      marcadores.delete(id);
    }
  }
  for (const id of ids) {
    const animal = porId.get(id);
    if (!animal) continue;
    const seleccionado = id === seleccionadoId;
    const actual = marcadores.get(id);
    if (actual?.animal === animal && actual.seleccionado === seleccionado && actual.c === c)
      continue;
    actual?.marcador.remove();
    const { raiz, circulo } = elementoFoto(animal, c, seleccionado);
    const marcador = new Marker({ element: raiz, anchor: 'bottom' })
      .setLngLat([animal.lng, animal.lat])
      .addTo(mapa);
    marcadores.set(id, { marcador, circulo, animal, seleccionado, c });
  }
  // La tarjeta con el mouse encima en el panel agranda su marcador.
  for (const [id, { circulo }] of marcadores) {
    circulo.style.transform = id === resaltadoId ? 'scale(1.12)' : '';
  }
}

/**
 * Marcador del mapa (6.6): círculo de 48 (58 si está seleccionado) con la
 * miniatura, borde interno en superficie, anillo del tipo, colita y, en los
 * perdidos, halo. Los reunidos van al 45 %.
 */
function elementoFoto(
  animal: AnimalEnMapa,
  c: Paleta,
  seleccionado: boolean,
): { raiz: HTMLElement; circulo: HTMLElement } {
  const { anillo, opacidad } = coloresDeEstado(c, animal.estado, animal.tipo_reporte);
  const diametro = seleccionado ? MARCADOR.diametroSeleccionado : MARCADOR.diametro;
  const raiz = document.createElement('div');
  raiz.setAttribute('aria-hidden', 'true');
  Object.assign(raiz.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
    opacity: String(opacidad),
    // El seleccionado queda por encima de los demás.
    zIndex: seleccionado ? '2' : '1',
    filter: `drop-shadow(0px 6px 9px ${c.sombra})`,
  });
  const circulo = document.createElement('div');
  Object.assign(circulo.style, {
    position: 'relative',
    width: `${diametro}px`,
    height: `${diametro}px`,
    boxSizing: 'border-box',
    borderRadius: '50%',
    border: `${MARCADOR.anillo}px solid ${anillo}`,
    background: c.superficie,
    padding: `${MARCADOR.borde}px`,
  });
  if (animal.tipo_reporte === 'perdido') {
    const halo = document.createElement('div');
    Object.assign(halo.style, {
      position: 'absolute',
      inset: `${-(MARCADOR.halo + MARCADOR.anillo)}px`,
      borderRadius: '50%',
      background: c.perdido,
      opacity: String(MARCADOR.opacidadHalo),
      zIndex: '-1',
    });
    circulo.appendChild(halo);
  }
  const foto = document.createElement('img');
  // La miniatura; si no existe (fotos de antes de la Fase 8), la original.
  foto.src = urlMiniatura(animal.foto_principal_path);
  foto.onerror = () => {
    foto.onerror = null;
    foto.src = urlFoto(animal.foto_principal_path);
  };
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
    width: `${MARCADOR.colita}px`,
    height: `${MARCADOR.colita}px`,
    marginTop: `${-MARCADOR.solapeColita}px`,
    transform: 'rotate(45deg)',
    background: anillo,
  });
  raiz.append(circulo, colita);
  return { raiz, circulo };
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.mapaTierra },
  mapa: { flex: 1, minHeight: 240 },
}));
