import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

/** Indicador de carga centrado, a pantalla completa. */
export function Cargando({ texto = t.comunes.cargando }: { texto?: string }) {
  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color={Colores.primario} />
      <Texto variante="secundario">{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Espacio.m },
});
