import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Colores, Espacio, Radio } from '@/constants/tema';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

export type BotonProps = {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  icono?: ComponentProps<typeof Ionicons>['name'];
  cargando?: boolean;
  deshabilitado?: boolean;
  style?: ViewStyle;
};

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  cargando = false,
  deshabilitado = false,
  style,
}: BotonProps) {
  const inactivo = deshabilitado || cargando;
  const colorTexto =
    variante === 'primario' || variante === 'peligro' ? Colores.textoInvertido : Colores.primario;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.base,
        estilos[variante],
        pressed && estilos.presionado,
        inactivo && estilos.inactivo,
        style,
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          {icono ? <Ionicons name={icono} size={18} color={colorTexto} /> : null}
          <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.s,
    minHeight: 48,
    paddingHorizontal: Espacio.m,
    borderRadius: Radio.m,
  },
  primario: { backgroundColor: Colores.primario },
  secundario: { backgroundColor: Colores.primarioSuave },
  fantasma: { backgroundColor: 'transparent' },
  peligro: { backgroundColor: Colores.peligro },
  presionado: { opacity: 0.85 },
  inactivo: { opacity: 0.5 },
  texto: { fontSize: 16, fontWeight: '600' },
});
