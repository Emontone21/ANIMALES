import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

export default function NoEncontrado() {
  return (
    <>
      <Stack.Screen options={{ title: t.app.nombre }} />
      <View style={estilos.contenedor}>
        <Texto variante="subtitulo">{t.animal.noEncontrado}</Texto>
        <Link href="/" style={estilos.enlace}>
          {t.comunes.volver}
        </Link>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.m,
    padding: Espacio.l,
  },
  enlace: { color: Colores.primario, fontWeight: '600' },
});
