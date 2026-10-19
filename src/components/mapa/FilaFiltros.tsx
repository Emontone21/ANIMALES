import { View } from 'react-native';

import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { Chips } from '@/components/ui/Chips';
import { Espacio, Medida } from '@/constants/tema';
import { type FiltrosMapa, OPCIONES_TIPO } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type Props = {
  filtros: FiltrosMapa;
  onCambio: (filtros: FiltrosMapa) => void;
  onMasFiltros: () => void;
  /** Sobre el mapa: chips y botón con sombra. */
  flotante?: boolean;
  /** Margen lateral de la fila. */
  margen: number;
};

/** Chips rápidos (Todos, Perdidos, Encontrados) y, a la derecha, el botón que abre el resto de los filtros. */
export function FilaFiltros({ filtros, onCambio, onMasFiltros, flotante = false, margen }: Props) {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.fila}>
      <View style={estilos.chips}>
        <Chips
          scroll
          flotante={flotante}
          margen={margen}
          opciones={OPCIONES_TIPO}
          valor={filtros.tipo}
          onCambio={(tipo) => onCambio({ ...filtros, tipo })}
          accessibilityLabel={t.mapa.filtros.tipo}
        />
      </View>
      <BotonRedondo
        icono="options-outline"
        accessibilityLabel={t.mapa.masFiltros}
        onPress={onMasFiltros}
        flotante={flotante}
        tamanio={Medida.chip}
        style={{ marginRight: margen }}
      />
    </View>
  );
}

const crear = crearEstilos(() => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  chips: { flex: 1, minWidth: 0 },
}));
