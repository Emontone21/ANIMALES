import { StyleSheet, Text, View } from 'react-native';

import { ColorEspecie, ColorEstado, Espacio, Radio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';
import type { Especie, EstadoAnimal } from '@/types/dominio';

type Props = { texto: string; color: string };

/** Etiqueta de color (estado, especie). */
export function Etiqueta({ texto, color }: Props) {
  return (
    <View style={[estilos.etiqueta, { backgroundColor: color }]}>
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  );
}

export function EtiquetaEstado({ estado }: { estado: EstadoAnimal }) {
  return <Etiqueta texto={t.estado[estado]} color={ColorEstado[estado]} />;
}

export function EtiquetaEspecie({ especie }: { especie: Especie }) {
  return <Etiqueta texto={t.especie[especie]} color={ColorEspecie[especie]} />;
}

const estilos = StyleSheet.create({
  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Espacio.s + 2,
    paddingVertical: Espacio.xs,
    borderRadius: Radio.redondo,
  },
  texto: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
