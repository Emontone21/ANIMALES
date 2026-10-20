import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Medida, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

type Props = {
  etiqueta: string;
  valor: boolean;
  onCambio: (valor: boolean) => void;
  error?: string | null;
};

/** Casilla para aceptar algo: términos, o que una acción no se puede deshacer. */
export function Casilla({ etiqueta, valor, onCambio, error }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: valor }}
        accessibilityLabel={etiqueta}
        onPress={() => onCambio(!valor)}
        style={(estado) => [estilos.fila, estaActivo(estado) && estilos.filaActiva]}>
        <Ionicons
          name={valor ? 'checkbox' : 'square-outline'}
          size={24}
          color={valor ? c.primario : error ? c.peligro : c.textoSecundario}
        />
        <Texto style={estilos.etiqueta}>{etiqueta}</Texto>
      </Pressable>
      {error ? (
        <Texto variante="pequeno" color="peligro" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  contenedor: { gap: Espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Espacio.sm,
    minHeight: Medida.areaTactil,
    paddingVertical: Espacio.s + 2,
    paddingHorizontal: Espacio.s,
    marginHorizontal: -Espacio.s,
    borderRadius: Radio.m,
  },
  filaActiva: { backgroundColor: c.superficieSuave },
  etiqueta: { flex: 1 },
}));
