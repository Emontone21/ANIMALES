import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilaFiltros } from '@/components/mapa/FilaFiltros';
import {
  ALTO_HOJA_PLEGADA,
  altoHojaCercaTuyo,
  HojaCercaTuyo,
} from '@/components/mapa/HojaCercaTuyo';
import { HojaFiltros } from '@/components/mapa/HojaFiltros';
import { MapaReportes } from '@/components/mapa/MapaReportes';
import { ANCHO_PANEL, MARGEN_PANEL, PanelCasos } from '@/components/mapa/PanelCasos';
import type { MapaReportesRef, MargenesMapa } from '@/components/mapa/tipos';
import { useHojaPlegable } from '@/components/mapa/useHojaPlegable';
import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { Mensaje } from '@/components/ui/Mensaje';
import { Espacio, Margen, Medida } from '@/constants/tema';
import { useAnimalesMapa, useAvistamientos } from '@/features/reportes/api';
import { aplicarFiltros, ordenarPorCercania, useFiltrosMapa } from '@/features/reportes/filtros';
import { useDisposicion } from '@/hooks/useDisposicion';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { obtenerPosicionActual, ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

export default function PantallaMapa() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const disposicion = useDisposicion();
  const compacto = disposicion === 'compacto';
  const medio = disposicion === 'medio';
  const amplio = disposicion === 'amplio';

  const mapaRef = useRef<MapaReportesRef>(null);
  // Compartidos con la lista de casos ("Ver lista").
  const { filtros, setFiltros, centro, setCentro } = useFiltrosMapa();
  const [verFiltros, setVerFiltros] = useState(false);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [resaltadoId, setResaltadoId] = useState<string | null>(null);
  const [miUbicacion, setMiUbicacion] = useState<LngLat | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  const { data: animales = [], error, refetch, isError, isLoading } = useAnimalesMapa();

  const visibles = useMemo(() => aplicarFiltros(animales, filtros), [animales, filtros]);
  const seleccionado = visibles.find((a) => a.id === seleccionadoId) ?? null;
  const casos = useMemo(
    () => ordenarPorCercania(visibles, centro, seleccionado?.id ?? null),
    [visibles, centro, seleccionado],
  );
  // Recorrido del animal seleccionado (solo se dibuja si tiene más de un avistamiento).
  const avistamientos = useAvistamientos(seleccionado?.id);
  const recorrido = useMemo(
    () =>
      seleccionado && avistamientos.data && avistamientos.data.length > 1 ? avistamientos.data : [],
    [seleccionado, avistamientos.data],
  );

  // Celular: la hoja "Cerca tuyo", abierta o plegada (sin casos, solo la barra).
  const altoHojaAbierta =
    isLoading || casos.length > 0 ? altoHojaCercaTuyo(height) : ALTO_HOJA_PLEGADA;
  const hoja = useHojaPlegable(compacto ? altoHojaAbierta - ALTO_HOJA_PLEGADA : 0);
  const altoHoja = hoja.plegada ? ALTO_HOJA_PLEGADA : altoHojaAbierta;
  const altoControles = insets.top + Espacio.s + Medida.chip + Espacio.s;
  // Lo que tapan los controles, para que el mapa centre en la parte visible.
  const margenes: MargenesMapa = compacto
    ? { top: altoControles, right: 0, bottom: altoHoja, left: 0 }
    : medio
      ? { top: 0, right: 0, bottom: 0, left: ANCHO_PANEL.flotante + MARGEN_PANEL * 2 }
      : { top: 0, right: 0, bottom: 0, left: 0 };

  const irAMiUbicacion = async () => {
    setBuscandoGps(true);
    setAvisoGps(null);
    const posicion = await obtenerPosicionActual();
    setBuscandoGps(false);
    // El mismo aviso que en Publicar.
    if (!posicion) return setAvisoGps(t.publicar.permisoUbicacion);
    setMiUbicacion(posicion);
    mapaRef.current?.irA(posicion, ZOOM_PUNTO);
  };

  const seleccionar = (id: string) => {
    setSeleccionadoId(id);
    // Con la hoja plegada, se despliega con esa tarjeta primera: el mapa centra
    // el marcador por encima de la hoja abierta.
    const desplegar = compacto && hoja.plegada;
    if (desplegar) hoja.setPlegada(false);
    const animal = visibles.find((a) => a.id === id);
    if (animal) {
      mapaRef.current?.irA(
        [animal.lng, animal.lat],
        Math.max(ZOOM_PUNTO - 1, 13),
        desplegar ? { ...margenes, bottom: altoHojaAbierta } : undefined,
      );
    }
  };

  const abrir = (id: string) => router.push(`/animal/${id}`);

  const aviso = isError ? (
    <Mensaje texto={mensajeDeError(error)} tipo="error" onReintentar={() => void refetch()} />
  ) : avisoGps ? (
    <Mensaje texto={avisoGps} />
  ) : visibles.length === 0 && animales.length > 0 ? (
    <Mensaje texto={t.mapa.sinReportes} />
  ) : null;

  const filaFiltros = (
    <FilaFiltros
      filtros={filtros}
      onCambio={setFiltros}
      onMasFiltros={() => setVerFiltros(true)}
      flotante={compacto}
      margen={compacto ? Margen.mapa : Espacio.m}
    />
  );

  const panel = (forma: 'flotante' | 'fijo') => (
    <PanelCasos
      forma={forma}
      casos={casos}
      cargando={isLoading}
      seleccionadoId={seleccionado?.id ?? null}
      controles={filaFiltros}
      aviso={aviso}
      onAbrir={abrir}
      onResaltar={setResaltadoId}
    />
  );

  // El mapa queda siempre en la misma posición del árbol: al cambiar el ancho
  // de la ventana no se vuelve a crear y no pierde la posición ni la selección.
  return (
    <View style={estilos.raiz}>
      {amplio ? (
        <View style={[estilos.franjaPanel, { paddingTop: insets.top }]}>{panel('fijo')}</View>
      ) : null}
      <View style={estilos.mapa}>
        {compacto ? (
          <View style={[estilos.controles, { top: insets.top + Espacio.s }]}>
            {filaFiltros}
            {aviso ? <View style={estilos.avisoFlotante}>{aviso}</View> : null}
          </View>
        ) : null}
        {medio ? (
          <View style={[estilos.capaPanel, { top: insets.top }]}>{panel('flotante')}</View>
        ) : null}

        <MapaReportes
          ref={mapaRef}
          animales={visibles}
          recorrido={recorrido}
          seleccionadoId={seleccionado?.id ?? null}
          resaltadoId={resaltadoId}
          miUbicacion={miUbicacion}
          margenes={margenes}
          onSeleccionar={seleccionar}
          onDeseleccionar={() => setSeleccionadoId(null)}
          onMovimiento={setCentro}
        />

        {/* En celular, justo encima de la hoja y baja con ella; en pantallas anchas, arriba a la derecha (lejos de la atribución). */}
        <Animated.View
          style={[
            estilos.gps,
            compacto
              ? {
                  bottom: altoHojaAbierta + Espacio.sm,
                  right: Margen.mapa + insets.right,
                  transform: [{ translateY: hoja.desplazamiento }],
                }
              : { top: insets.top + MARGEN_PANEL, right: MARGEN_PANEL + insets.right },
          ]}>
          <BotonRedondo
            icono="locate-outline"
            color="primario"
            accessibilityLabel={t.mapa.miUbicacion}
            onPress={() => void irAMiUbicacion()}
            cargando={buscandoGps}
          />
        </Animated.View>

        {compacto ? (
          <HojaCercaTuyo
            casos={casos}
            alto={altoHojaAbierta}
            cargando={isLoading}
            seleccionadoId={seleccionado?.id ?? null}
            hoja={hoja}
            onAbrir={abrir}
            onVerLista={() => router.push('/casos')}
          />
        ) : null}
      </View>

      <HojaFiltros
        visible={verFiltros}
        filtros={filtros}
        onCambio={setFiltros}
        onCerrar={() => setVerFiltros(false)}
      />
    </View>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, flexDirection: 'row', backgroundColor: c.mapaTierra },
  franjaPanel: { backgroundColor: c.superficie },
  // La hoja plegada baja: lo que queda fuera del mapa no se ve.
  mapa: { flex: 1, overflow: 'hidden' },
  // Los controles van antes del mapa en el árbol (orden de Tab en web) y por encima con zIndex.
  controles: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    gap: Espacio.s,
    pointerEvents: 'box-none',
  },
  avisoFlotante: { marginHorizontal: Margen.mapa },
  capaPanel: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: ANCHO_PANEL.flotante + MARGEN_PANEL * 2,
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  gps: { position: 'absolute', pointerEvents: 'box-none' },
}));
