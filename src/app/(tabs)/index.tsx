import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FiltrosMapa } from '@/components/mapa/FiltrosMapa';
import { MapaReportes } from '@/components/mapa/MapaReportes';
import { TarjetaAnimal } from '@/components/mapa/TarjetaAnimal';
import type { MapaReportesRef } from '@/components/mapa/tipos';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { useAnimalesMapa, useAvistamientos } from '@/features/reportes/api';
import {
  aplicarFiltros,
  FILTROS_INICIALES,
  type FiltrosMapa as Filtros,
} from '@/features/reportes/filtros';
import { t } from '@/i18n/es-UY';
import { obtenerPosicionActual, ZOOM_PUNTO } from '@/lib/ubicacion';

export default function PantallaMapa() {
  const router = useRouter();
  const mapaRef = useRef<MapaReportesRef>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);

  const { data: animales = [], error, refetch, isError } = useAnimalesMapa();

  const visibles = useMemo(() => aplicarFiltros(animales, filtros), [animales, filtros]);
  const seleccionado = visibles.find((a) => a.id === seleccionadoId) ?? null;
  // Recorrido del animal seleccionado (solo se dibuja si tiene más de un avistamiento).
  const avistamientos = useAvistamientos(seleccionado?.id);
  const recorrido = useMemo(
    () =>
      seleccionado && avistamientos.data && avistamientos.data.length > 1 ? avistamientos.data : [],
    [seleccionado, avistamientos.data],
  );

  const irAMiUbicacion = async () => {
    setBuscandoGps(true);
    const posicion = await obtenerPosicionActual();
    setBuscandoGps(false);
    if (posicion) mapaRef.current?.irA(posicion, ZOOM_PUNTO);
  };

  return (
    <Pantalla>
      <View style={estilos.encabezado}>
        <Texto variante="titulo">{t.app.nombre}</Texto>
        <Texto variante="secundario">{t.app.lema}</Texto>
      </View>
      <FiltrosMapa filtros={filtros} onCambio={setFiltros} />

      <View style={estilos.mapa}>
        <MapaReportes
          ref={mapaRef}
          animales={visibles}
          recorrido={recorrido}
          onSeleccionar={(id) => {
            setSeleccionadoId(id);
            const animal = visibles.find((a) => a.id === id);
            if (animal)
              mapaRef.current?.irA([animal.lng, animal.lat], Math.max(ZOOM_PUNTO - 1, 13));
          }}
          onDeseleccionar={() => setSeleccionadoId(null)}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.mapa.miUbicacion}
          onPress={() => void irAMiUbicacion()}
          disabled={buscandoGps}
          style={({ pressed }) => [estilos.botonGps, pressed && estilos.presionado]}>
          <Ionicons
            name={buscandoGps ? 'locate-outline' : 'locate'}
            size={24}
            color={Colores.primario}
          />
        </Pressable>

        {isError ? (
          <View style={estilos.aviso}>
            <Mensaje
              texto={error?.message ?? t.comunes.errorGenerico}
              tipo="error"
              onReintentar={() => void refetch()}
            />
          </View>
        ) : visibles.length === 0 && animales.length > 0 ? (
          <View style={estilos.aviso}>
            <Mensaje texto={t.mapa.sinReportes} />
          </View>
        ) : null}

        {seleccionado ? (
          <TarjetaAnimal
            animal={seleccionado}
            onCerrar={() => setSeleccionadoId(null)}
            onVerDetalle={() => router.push(`/animal/${seleccionado.id}`)}
          />
        ) : null}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  encabezado: { paddingHorizontal: Espacio.m, paddingTop: Espacio.s },
  mapa: { flex: 1 },
  botonGps: {
    position: 'absolute',
    top: Espacio.m,
    left: Espacio.m,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.fondo,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  presionado: { opacity: 0.7 },
  aviso: { position: 'absolute', top: Espacio.m, left: Espacio.m + 52, right: Espacio.m },
});
