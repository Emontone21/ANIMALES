import { StyleSheet, Switch, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';

type Props = { etiqueta: string; valor: boolean; onCambio: (valor: boolean) => void };

/** Fila con etiqueta y switch. */
export function Interruptor({ etiqueta, valor, onCambio }: Props) {
  return (
    <View style={estilos.fila}>
      <Texto style={estilos.etiqueta}>{etiqueta}</Texto>
      <Switch
        value={valor}
        onValueChange={onCambio}
        trackColor={{ true: Colores.primario, false: Colores.borde }}
        thumbColor={Colores.fondo}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.m,
    minHeight: 48,
  },
  etiqueta: { flex: 1, fontWeight: '600' },
});
