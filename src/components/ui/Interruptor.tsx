import { Switch, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Medida } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

type Props = { etiqueta: string; valor: boolean; onCambio: (valor: boolean) => void };

/** Fila con etiqueta y switch, con la vía activa en primario. */
export function Interruptor({ etiqueta, valor, onCambio }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.fila}>
      <Texto variante="etiquetaCampo" style={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <Switch
        accessibilityLabel={etiqueta}
        value={valor}
        onValueChange={onCambio}
        trackColor={{ true: c.primario, false: c.borde }}
        thumbColor={c.superficie}
      />
    </View>
  );
}

const crear = crearEstilos(() => ({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.m,
    minHeight: Medida.areaTactil,
  },
  etiqueta: { flex: 1 },
}));
