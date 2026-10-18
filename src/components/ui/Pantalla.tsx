import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colores, Espacio } from '@/constants/tema';

export type PantallaProps = {
  children: ReactNode;
  /** Con scroll y padding (formularios, detalle). Sin scroll para el mapa. */
  scroll?: boolean;
  bordes?: Edge[];
};

/** Contenedor base de cada pantalla: safe area, fondo y teclado. */
export function Pantalla({
  children,
  scroll = false,
  bordes = ['top', 'left', 'right'],
}: PantallaProps) {
  if (!scroll) {
    return (
      <SafeAreaView edges={bordes} style={estilos.raiz}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={bordes} style={estilos.raiz}>
      <KeyboardAvoidingView
        style={estilos.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          <View style={estilos.columna}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.fondo },
  contenido: { padding: Espacio.m, paddingBottom: Espacio.xl * 2 },
  columna: { gap: Espacio.m },
});
