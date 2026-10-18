import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colores, Espacio, Radio } from '@/constants/tema';

export type OpcionChip<T extends string> = { valor: T; etiqueta: string; color?: string };

export type ChipsProps<T extends string> = {
  opciones: OpcionChip<T>[];
  valor: T | null;
  onCambio: (valor: T) => void;
  /** Fila con scroll horizontal (para barras de filtros). */
  scroll?: boolean;
};

/** Selector de una opción entre varias, con forma de "chips". */
export function Chips<T extends string>({
  opciones,
  valor,
  onCambio,
  scroll = false,
}: ChipsProps<T>) {
  const contenido = opciones.map((opcion) => {
    const activo = opcion.valor === valor;
    const color = opcion.color ?? Colores.primario;
    return (
      <Pressable
        key={opcion.valor}
        accessibilityRole="radio"
        accessibilityState={{ selected: activo }}
        onPress={() => onCambio(opcion.valor)}
        style={[estilos.chip, activo && { backgroundColor: color, borderColor: color }]}>
        <Text style={[estilos.texto, activo && estilos.textoActivo]}>{opcion.etiqueta}</Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.fila}>
        {contenido}
      </ScrollView>
    );
  }
  return <View style={estilos.filaEnvuelta}>{contenido}</View>;
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Espacio.s, paddingHorizontal: Espacio.m },
  filaEnvuelta: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  chip: {
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderRadius: Radio.redondo,
    borderWidth: 1,
    borderColor: Colores.borde,
    backgroundColor: Colores.fondo,
  },
  texto: { fontSize: 14, fontWeight: '600', color: Colores.texto },
  textoActivo: { color: Colores.textoInvertido },
});
