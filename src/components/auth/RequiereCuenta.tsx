import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio } from '@/constants/tema';
import { t } from '@/i18n/es-UY';

/** Pantalla de bloqueo para acciones que piden cuenta. */
export function RequiereCuenta({ mensaje }: { mensaje: string }) {
  const router = useRouter();
  return (
    <View style={estilos.contenedor}>
      <Ionicons name="lock-closed-outline" size={48} color={Colores.primario} />
      <Texto variante="subtitulo" style={estilos.centrado}>
        {mensaje}
      </Texto>
      <Texto variante="secundario" style={estilos.centrado}>
        {t.auth.nombreAyuda}
      </Texto>
      <View style={estilos.botones}>
        <Boton titulo={t.auth.ingresar} onPress={() => router.push('/auth/ingresar')} />
        <Boton
          titulo={t.auth.registrarse}
          variante="secundario"
          onPress={() => router.push('/auth/registrarse')}
        />
      </View>
    </View>
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
  centrado: { textAlign: 'center' },
  botones: { alignSelf: 'stretch', gap: Espacio.s, marginTop: Espacio.m },
});
