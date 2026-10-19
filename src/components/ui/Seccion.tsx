import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

/** Bloque de formulario con su etiqueta arriba. */
export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.seccion}>
      <Texto variante="etiquetaCampo">{titulo}</Texto>
      {children}
    </View>
  );
}

const crear = crearEstilos(() => ({
  seccion: { gap: Espacio.s },
}));
