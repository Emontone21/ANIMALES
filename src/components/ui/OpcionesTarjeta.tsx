import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

export type OpcionTarjeta<T extends string> = { valor: T; titulo: string; detalle: string };

type Props<T extends string> = {
  opciones: OpcionTarjeta<T>[];
  valor: T;
  onCambio: (valor: T) => void;
  accessibilityLabel: string;
};

/**
 * Elegir una opción entre pocas, cada una con su explicación. La elegida
 * lleva borde de 2 en primario y el radio lleno.
 */
export function OpcionesTarjeta<T extends string>({
  opciones,
  valor,
  onCambio,
  accessibilityLabel,
}: Props<T>) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={estilos.lista}>
      {opciones.map((opcion) => {
        const elegida = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole="radio"
            // react-native-web no traduce accessibilityState: los aria-* andan en web y en nativo.
            aria-checked={elegida}
            accessibilityLabel={`${opcion.titulo}. ${opcion.detalle}`}
            onPress={() => onCambio(opcion.valor)}
            style={(estado) => [
              estilos.opcion,
              elegida && estilos.elegida,
              estaActivo(estado) && estilos.activa,
            ]}>
            <Ionicons
              name={elegida ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={elegida ? c.primario : c.textoSecundario}
            />
            <View style={estilos.textos}>
              <Texto variante="cuerpoFuerte">{opcion.titulo}</Texto>
              <Texto variante="secundario">{opcion.detalle}</Texto>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  lista: { gap: Espacio.s },
  opcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Espacio.sm,
    padding: Espacio.m,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  // El borde crece 1 px: se compensa en el relleno para que nada salte.
  elegida: { borderWidth: 2, borderColor: c.primario, padding: Espacio.m - 1 },
  activa: { backgroundColor: c.superficieSuave },
  textos: { flex: 1, gap: Espacio.xs },
}));
