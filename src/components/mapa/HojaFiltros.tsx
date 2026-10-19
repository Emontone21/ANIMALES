import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Chips } from '@/components/ui/Chips';
import { Hoja } from '@/components/ui/Hoja';
import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import {
  type FiltrosMapa,
  OPCIONES_ANTIGUEDAD,
  OPCIONES_ESPECIE,
  OPCIONES_ESTADO,
} from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type Props = {
  visible: boolean;
  filtros: FiltrosMapa;
  onCambio: (filtros: FiltrosMapa) => void;
  onCerrar: () => void;
};

/** Especie, estado y antigüedad, en una hoja que se abre desde el botón de filtros (7.1). */
export function HojaFiltros({ visible, filtros, onCambio, onCerrar }: Props) {
  const estilos = useEstilos(crear);
  const filas = [
    {
      titulo: t.mapa.filtros.especie,
      control: (
        <Chips
          opciones={OPCIONES_ESPECIE}
          valor={filtros.especie}
          onCambio={(especie) => onCambio({ ...filtros, especie })}
          accessibilityLabel={t.mapa.filtros.especie}
        />
      ),
    },
    {
      titulo: t.mapa.filtros.estado,
      control: (
        <Chips
          opciones={OPCIONES_ESTADO}
          valor={filtros.estado}
          onCambio={(estado) => onCambio({ ...filtros, estado })}
          accessibilityLabel={t.mapa.filtros.estado}
        />
      ),
    },
    {
      titulo: t.mapa.filtros.antiguedad,
      control: (
        <Chips
          opciones={OPCIONES_ANTIGUEDAD}
          valor={filtros.antiguedad}
          onCambio={(antiguedad) => onCambio({ ...filtros, antiguedad })}
          accessibilityLabel={t.mapa.filtros.antiguedad}
        />
      ),
    },
  ];

  return (
    <Hoja
      visible={visible}
      titulo={t.mapa.masFiltros}
      onCerrar={onCerrar}
      pie={<Boton titulo={t.comunes.listo} onPress={onCerrar} />}>
      {filas.map((fila) => (
        <View key={fila.titulo} style={estilos.fila}>
          <Texto variante="etiquetaCampo">{fila.titulo}</Texto>
          {fila.control}
        </View>
      ))}
    </Hoja>
  );
}

const crear = crearEstilos(() => ({
  fila: { gap: Espacio.s, marginBottom: Espacio.s },
}));
