import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';

/** Bloque de formulario con título chico arriba. */
export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <Texto variante="secundario" style={estilos.titulo}>
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Espacio.s },
  titulo: { fontWeight: '600' },
});
