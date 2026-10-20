import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapaRecorridoGrande } from '@/components/mapa/MapaRecorridoGrande';
import type { MapaRecorridoGrandeRef, MargenesMapa } from '@/components/mapa/tipos';
import { Boton } from '@/components/ui/Boton';
import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { Cargando } from '@/components/ui/Cargando';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { coloresDeEstado, Espacio, Margen, Medida, Radio, sombraFlotante } from '@/constants/tema';
import {
  hayAnterior,
  haySiguiente,
  indiceVecino,
  ordenarRecorrido,
  recorridoGrandeAGeoJSON,
} from '@/features/mapa/recorrido';
import { useAnimal, useAvistamientos } from '@/features/reportes/api';
import { useDisposicion } from '@/hooks/useDisposicion';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { diaYHora } from '@/lib/fechas';
import { obtenerPosicionActual, ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

/** Ancho máximo de la tarjeta del punto elegido (6.9.1). */
const ANCHO_TARJETA = 420;

/**
 * Mapa en grande del recorrido (docs/DISENO.md, 6.9.1). Es una pantalla, no
 * una hoja: Atrás vuelve al detalle como en cualquier otra.
 */
export default function PantallaRecorrido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const insets = useSafeAreaInsets();
  const compacto = useDisposicion() === 'compacto';
  const animal = useAnimal(id);
  const avistamientos = useAvistamientos(id);
  const mapaRef = useRef<MapaRecorridoGrandeRef>(null);

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [altoTarjeta, setAltoTarjeta] = useState(0);
  const [miUbicacion, setMiUbicacion] = useState<LngLat | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  const caso = animal.data;
  const vinculadoA = caso?.estado === 'vinculado' ? caso.vinculado_a : null;
  // Un caso que no existe, que está oculto para quien mira o que no se pudo
  // cargar: el detalle muestra lo mismo que siempre ("no disponible", o el
  // error con Reintentar).
  const sinCaso =
    !animal.isPending &&
    (animal.isError || !caso || (avistamientos.isSuccess && avistamientos.data.length === 0));
  useEffect(() => {
    if (vinculadoA) router.replace(`/animal/${vinculadoA}/mapa`);
    else if (sinCaso) router.replace(`/animal/${id}`);
  }, [vinculadoA, sinCaso, id, router]);

  const puntos = useMemo(() => ordenarRecorrido(avistamientos.data ?? []), [avistamientos.data]);
  // Al abrir, el último avistamiento.
  const elegido = puntos.findIndex((p) => p.avistamiento.id === seleccionadoId);
  const indice = elegido >= 0 ? elegido : puntos.length - 1;
  const punto = puntos[indice];
  const datos = useMemo(
    () => recorridoGrandeAGeoJSON(puntos, punto?.avistamiento.id ?? null),
    [puntos, punto],
  );

  const altoBotones = insets.top + Espacio.m + Medida.botonRedondo;
  // Lo que tapan los botones de arriba y la tarjeta: el mapa encuadra y centra en el resto.
  const margenes: MargenesMapa = {
    top: altoBotones,
    right: 0,
    bottom: altoTarjeta + insets.bottom + Espacio.m,
    left: 0,
  };

  const volver = () => (router.canGoBack() ? router.back() : router.replace(`/animal/${id}`));

  const irAMiUbicacion = async () => {
    setBuscandoGps(true);
    setAvisoGps(null);
    const posicion = await obtenerPosicionActual();
    setBuscandoGps(false);
    // El mismo aviso que en el mapa principal y en Publicar.
    if (!posicion) return setAvisoGps(t.publicar.permisoUbicacion);
    setMiUbicacion(posicion);
    mapaRef.current?.irA(posicion, ZOOM_PUNTO);
  };

  const mover = (paso: -1 | 1) => {
    const vecino = puntos[indiceVecino(indice, puntos.length, paso)];
    if (!vecino) return;
    setSeleccionadoId(vecino.avistamiento.id);
    mapaRef.current?.irA([vecino.avistamiento.lng, vecino.avistamiento.lat]);
  };

  if (animal.isPending || avistamientos.isPending || !caso || sinCaso || vinculadoA) {
    return <Cargando />;
  }

  const colorTipo = coloresDeEstado(c, caso.estado, caso.tipo_reporte).anillo;
  const titulo = t.animal.tituloCaso(caso.nombre, caso.especie, caso.color, caso.tamanio);
  const av = punto?.avistamiento;

  return (
    <View style={estilos.raiz}>
      {/* Antes que el mapa en el árbol: Volver es lo primero al navegar con Tab. */}
      <View
        style={[
          estilos.arriba,
          {
            top: insets.top + Espacio.m,
            left: Margen.mapa + insets.left,
            right: Margen.mapa + insets.right,
          },
        ]}>
        <View style={estilos.botones}>
          <BotonRedondo
            icono="chevron-back"
            accessibilityLabel={t.comunes.volver}
            onPress={volver}
          />
          <BotonRedondo
            icono="locate-outline"
            color="primario"
            accessibilityLabel={t.mapa.miUbicacion}
            onPress={() => void irAMiUbicacion()}
            cargando={buscandoGps}
          />
        </View>
        {avisoGps ? <Mensaje texto={avisoGps} /> : null}
      </View>

      <View style={estilos.mapa}>
        {/* Con la tarjeta medida: la vista inicial deja los puntos fuera de ella. */}
        {altoTarjeta > 0 ? (
          <MapaRecorridoGrande
            ref={mapaRef}
            datos={datos}
            colorTipo={colorTipo}
            miUbicacion={miUbicacion}
            margenes={margenes}
            onSeleccionar={setSeleccionadoId}
          />
        ) : null}
      </View>

      <View
        style={[
          estilos.abajo,
          compacto ? estilos.abajoCentrado : null,
          {
            bottom: insets.bottom + Espacio.m,
            left: Margen.mapa + insets.left,
            right: Margen.mapa + insets.right,
          },
        ]}>
        <View
          style={estilos.tarjeta}
          onLayout={(evento) => setAltoTarjeta(evento.nativeEvent.layout.height)}>
          {avistamientos.isError ? (
            <Mensaje
              texto={mensajeDeError(avistamientos.error)}
              tipo="error"
              onReintentar={() => void avistamientos.refetch()}
            />
          ) : punto && av ? (
            <>
              {/* Al pasar con Anterior o Siguiente, se anuncia el punto nuevo. */}
              <View style={estilos.punto} accessibilityLiveRegion="polite">
                {av.foto_path ? (
                  <FotoMiniatura
                    ruta={av.foto_path}
                    descripcion={titulo}
                    style={estilos.foto}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <View style={estilos.textos}>
                  <Texto variante="cuerpoFuerte">
                    {t.animal.queHizo(av.tipo, av.usuario_nombre)}
                  </Texto>
                  <Texto variante="secundario">{diaYHora(av.visto_en)}</Texto>
                  {av.nota ? (
                    <Texto color="textoCuerpo" numberOfLines={3}>
                      {av.nota}
                    </Texto>
                  ) : null}
                  {punto.aproximado ? (
                    <Texto variante="pequeno">{t.mapa.recorrido.aproximada}</Texto>
                  ) : null}
                </View>
              </View>
              <View style={estilos.pasos}>
                <Boton
                  titulo={t.mapa.recorrido.anterior}
                  variante="secundario"
                  deshabilitado={!hayAnterior(indice)}
                  onPress={() => mover(-1)}
                  style={estilos.paso}
                />
                <Texto variante="secundario" style={estilos.posicion}>
                  {t.mapa.recorrido.posicion(punto.orden, puntos.length)}
                </Texto>
                <Boton
                  titulo={t.mapa.recorrido.siguiente}
                  variante="secundario"
                  deshabilitado={!haySiguiente(indice, puntos.length)}
                  onPress={() => mover(1)}
                  style={estilos.paso}
                />
              </View>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  raiz: { flex: 1, backgroundColor: c.mapaTierra },
  mapa: { flex: 1 },
  arriba: { position: 'absolute', zIndex: 1, gap: Espacio.s, pointerEvents: 'box-none' },
  botones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  // Celular: centrada; medio y amplio: abajo a la izquierda.
  abajo: { position: 'absolute', zIndex: 1, alignItems: 'flex-start', pointerEvents: 'box-none' },
  abajoCentrado: { alignItems: 'center' },
  tarjeta: {
    width: '100%',
    maxWidth: ANCHO_TARJETA,
    gap: Espacio.sm,
    padding: Espacio.m,
    borderRadius: Radio.xl,
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
  },
  punto: { flexDirection: 'row', gap: Espacio.sm },
  foto: { width: 64, height: 64, borderRadius: Radio.s, backgroundColor: c.superficieSuave },
  textos: { flex: 1, gap: 2 },
  pasos: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  // Secundario de 44 de alto (no 54): van dentro de la tarjeta.
  paso: { minHeight: Medida.areaTactil, paddingHorizontal: Espacio.m },
  posicion: { flex: 1, textAlign: 'center' },
}));
