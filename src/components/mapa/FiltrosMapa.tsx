import { StyleSheet, View } from 'react-native';

import { Chips } from '@/components/ui/Chips';
import { Espacio } from '@/constants/tema';
import {
  type FiltrosMapa as Filtros,
  OPCIONES_ANTIGUEDAD,
  OPCIONES_ESPECIE,
  OPCIONES_ESTADO,
} from '@/features/reportes/filtros';

type Props = { filtros: Filtros; onCambio: (filtros: Filtros) => void };

/** Tres filas de chips: especie, estado y antigüedad. */
export function FiltrosMapa({ filtros, onCambio }: Props) {
  return (
    <View style={estilos.contenedor}>
      <Chips
        scroll
        opciones={OPCIONES_ESPECIE}
        valor={filtros.especie}
        onCambio={(especie) => onCambio({ ...filtros, especie })}
      />
      <Chips
        scroll
        opciones={OPCIONES_ESTADO}
        valor={filtros.estado}
        onCambio={(estado) => onCambio({ ...filtros, estado })}
      />
      <Chips
        scroll
        opciones={OPCIONES_ANTIGUEDAD}
        valor={filtros.antiguedad}
        onCambio={(antiguedad) => onCambio({ ...filtros, antiguedad })}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Espacio.s, paddingVertical: Espacio.s },
});
