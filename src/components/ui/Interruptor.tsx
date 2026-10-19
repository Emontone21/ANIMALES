import { Platform, Pressable, Switch, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Medida } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

type Props = { etiqueta: string; valor: boolean; onCambio: (valor: boolean) => void };

/**
 * Fila con etiqueta y switch, con la vía activa en primario. Tocar la etiqueta
 * también cambia el valor (el switch solo es chico para el dedo); va al lado y
 * no envolviéndolo, para que un toque en el switch no cuente dos veces. La vía
 * apagada va en textoSecundario: con borde no se distinguía del fondo (1,2:1).
 */
export function Interruptor({ etiqueta, valor, onCambio }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  // En web, react-native-web pinta el círculo encendido de verde agua si no se
  // le pasa su color, y el switch mide 40 × 20.
  const web = Platform.OS === 'web' ? { activeThumbColor: c.superficie } : {};
  return (
    <View style={estilos.fila}>
      <Pressable accessible={false} onPress={() => onCambio(!valor)} style={estilos.etiqueta}>
        <Texto variante="etiquetaCampo">{etiqueta}</Texto>
      </Pressable>
      <Switch
        accessibilityLabel={etiqueta}
        value={valor}
        onValueChange={onCambio}
        trackColor={{ true: c.primario, false: c.textoSecundario }}
        thumbColor={c.superficie}
        style={Platform.OS === 'web' ? estilos.switchWeb : undefined}
        {...web}
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
  etiqueta: { flex: 1, minHeight: Medida.areaTactil, justifyContent: 'center' },
  switchWeb: { height: 28, width: 56 },
}));
