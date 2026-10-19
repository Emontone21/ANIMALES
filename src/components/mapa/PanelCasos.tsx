import { type ReactNode, useEffect, useRef } from 'react';
import { FlatList, View } from 'react-native';

import { TarjetaCaso } from '@/components/mapa/TarjetaCaso';
import { Cargando } from '@/components/ui/Cargando';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio, sombraFlotante } from '@/constants/tema';
import type { CasoCercano } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

export const ANCHO_PANEL = { flotante: 360, fijo: 400 } as const;
/** Separación del panel flotante con los bordes del mapa. */
export const MARGEN_PANEL = 16;

type Props = {
  /** flotante: sobre el mapa (medio) · fijo: franja al lado del mapa (amplio). */
  forma: keyof typeof ANCHO_PANEL;
  casos: CasoCercano[];
  cargando?: boolean;
  seleccionadoId: string | null;
  /** Chips y botón de filtros. */
  controles: ReactNode;
  /** Error o estado vacío. */
  aviso?: ReactNode;
  onAbrir: (id: string) => void;
  onResaltar: (id: string | null) => void;
};

/** Panel con los filtros y la lista de casos, para pantallas medianas y anchas (8.1). */
export function PanelCasos({
  forma,
  casos,
  cargando = false,
  seleccionadoId,
  controles,
  aviso,
  onAbrir,
  onResaltar,
}: Props) {
  const estilos = useEstilos(crear);
  const listaRef = useRef<FlatList<CasoCercano>>(null);

  // El seleccionado en el mapa pasa a ser el primero de la lista.
  useEffect(() => {
    if (seleccionadoId) listaRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [seleccionadoId]);

  return (
    <View
      style={[
        forma === 'flotante' ? estilos.flotante : estilos.fijo,
        { width: ANCHO_PANEL[forma] },
      ]}>
      <View style={estilos.encabezado}>
        {controles}
        {aviso ? <View style={estilos.aviso}>{aviso}</View> : null}
        <Texto variante="subtitulo" accessibilityRole="header" style={estilos.titulo}>
          {t.mapa.cercaTuyo}
        </Texto>
      </View>
      {cargando ? (
        <Cargando />
      ) : (
        <FlatList
          ref={listaRef}
          data={casos}
          keyExtractor={(caso) => caso.animal.id}
          contentContainerStyle={estilos.lista}
          renderItem={({ item }) => (
            <TarjetaCaso
              caso={item}
              forma="fila"
              seleccionado={item.animal.id === seleccionadoId}
              onPress={() => onAbrir(item.animal.id)}
              onResaltar={onResaltar}
            />
          )}
        />
      )}
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  flotante: {
    position: 'absolute',
    top: MARGEN_PANEL,
    bottom: MARGEN_PANEL,
    left: MARGEN_PANEL,
    borderRadius: Radio.xl,
    overflow: 'hidden',
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
  },
  fijo: {
    flex: 1,
    backgroundColor: c.superficie,
    borderRightWidth: 1,
    borderRightColor: c.borde,
  },
  encabezado: { paddingTop: Espacio.m, gap: Espacio.sm },
  aviso: { paddingHorizontal: Espacio.m },
  titulo: { paddingHorizontal: Espacio.m, marginTop: Espacio.xs },
  lista: { paddingHorizontal: Espacio.s, paddingBottom: Espacio.m, gap: Espacio.xs },
}));
