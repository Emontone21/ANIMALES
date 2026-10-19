import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { Espacio, Margen } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

export type PantallaProps = {
  children: ReactNode;
  /** Con scroll y márgenes (formularios, listas). Sin scroll para el mapa. */
  scroll?: boolean;
  bordes?: Edge[];
  /** Ancho máximo de la columna centrada (docs/DISENO.md, 8.3). */
  ancho?: number;
  /** Contenido fijo abajo, por ejemplo el botón de Publicar. */
  pie?: ReactNode;
};

/** Contenedor base de cada pantalla: área segura, fondo, teclado y columna centrada. */
export function Pantalla({
  children,
  scroll = false,
  bordes = ['top', 'left', 'right'],
  ancho,
  pie,
}: PantallaProps) {
  const estilos = useEstilos(crear);
  const columna = ancho ? { maxWidth: ancho } : null;

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
          <View style={[estilos.columna, columna]}>{children}</View>
        </ScrollView>
        {pie ? (
          <View style={estilos.pie}>
            <View style={[estilos.columnaPie, columna]}>{pie}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const crear = crearEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.fondo },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: Margen.pantalla,
    paddingTop: Espacio.l,
    paddingBottom: Espacio.xxl,
  },
  columna: { width: '100%', alignSelf: 'center', gap: Espacio.m },
  pie: {
    paddingHorizontal: Margen.pantalla,
    paddingVertical: Espacio.sm,
    borderTopWidth: 1,
    borderTopColor: c.borde,
    backgroundColor: c.superficie,
  },
  columnaPie: { width: '100%', alignSelf: 'center' },
}));
