import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilaFiltros } from '@/components/mapa/FilaFiltros';
import { HojaFiltros } from '@/components/mapa/HojaFiltros';
import { TarjetaCaso, TARJETAS_A_LA_VISTA } from '@/components/mapa/TarjetaCaso';
import { Cargando } from '@/components/ui/Cargando';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Margen } from '@/constants/tema';
import { useAnimalesMapa } from '@/features/reportes/api';
import {
  aplicarFiltros,
  type CasoCercano,
  ordenarPorCercania,
  useFiltrosMapa,
} from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

/**
 * "Ver lista" desde la hoja "Cerca tuyo" (docs/DISENO.md, 6.7): todos los
 * casos con los filtros del mapa, del más cercano al más lejano al centro del
 * mapa, con miniatura, etiqueta y distancia. Los filtros son los mismos que
 * los del mapa: si se cambian acá, el mapa también cambia.
 */
export default function PantallaCasos() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const insets = useSafeAreaInsets();
  const { filtros, setFiltros, centro } = useFiltrosMapa();
  const [verFiltros, setVerFiltros] = useState(false);
  const { data: animales = [], error, refetch, isError, isLoading } = useAnimalesMapa();

  const casos = useMemo(
    () => ordenarPorCercania(aplicarFiltros(animales, filtros), centro),
    [animales, filtros, centro],
  );

  const encabezado = (
    <View style={estilos.encabezado}>
      <FilaFiltros
        filtros={filtros}
        onCambio={setFiltros}
        onMasFiltros={() => setVerFiltros(true)}
        margen={0}
      />
      {isError ? (
        <Mensaje texto={mensajeDeError(error)} tipo="error" onReintentar={() => void refetch()} />
      ) : isLoading ? null : casos.length === 0 ? (
        <Mensaje texto={t.mapa.sinReportes} />
      ) : (
        <Texto variante="secundario">{t.mapa.lista.resumen(casos.length)}</Texto>
      )}
    </View>
  );

  return (
    <View style={estilos.raiz}>
      {isLoading ? (
        <>
          {encabezado}
          <Cargando />
        </>
      ) : (
        <FlatList<CasoCercano>
          data={casos}
          keyExtractor={(caso) => caso.animal.id}
          ListHeaderComponent={encabezado}
          contentContainerStyle={[estilos.lista, { paddingBottom: insets.bottom + Espacio.l }]}
          renderItem={({ item, index }) => (
            <View style={estilos.columna}>
              <TarjetaCaso
                caso={item}
                forma="fila"
                prioritaria={index < TARJETAS_A_LA_VISTA.fila}
                onPress={() => router.push(`/animal/${item.animal.id}`)}
              />
            </View>
          )}
        />
      )}
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
  raiz: { flex: 1, backgroundColor: c.fondo },
  encabezado: {
    gap: Espacio.sm,
    width: '100%',
    maxWidth: AnchoMaximo.lista,
    alignSelf: 'center',
    paddingHorizontal: Margen.pantalla,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.s,
  },
  lista: { gap: Espacio.xs },
  // Cada fila, centrada en la misma columna que el encabezado.
  columna: {
    width: '100%',
    maxWidth: AnchoMaximo.lista,
    alignSelf: 'center',
    paddingHorizontal: Margen.pantalla - Espacio.s,
  },
}));
