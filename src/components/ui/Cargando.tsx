import { ActivityIndicator, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** Indicador de carga centrado. */
export function Cargando({ texto = t.comunes.cargando }: { texto?: string }) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.contenedor} accessibilityRole="progressbar" accessibilityLabel={texto}>
      <ActivityIndicator size="large" color={c.primario} />
      <Texto variante="secundario">{texto}</Texto>
    </View>
  );
}

const crear = crearEstilos(() => ({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.m,
    padding: Espacio.l,
  },
}));
