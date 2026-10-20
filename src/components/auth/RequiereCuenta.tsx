import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** Pantalla de bloqueo para acciones que piden cuenta. */
export function RequiereCuenta({ mensaje }: { mensaje: string }) {
  const router = useRouter();
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.icono}>
        <Ionicons name="lock-closed-outline" size={28} color={c.textoPrimarioSuave} />
      </View>
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

const crear = crearEstilos((c) => ({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.m,
    width: '100%',
    maxWidth: AnchoMaximo.acceso,
    alignSelf: 'center',
    padding: Espacio.l,
  },
  icono: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: c.primarioSuave,
  },
  centrado: { textAlign: 'center' },
  botones: { alignSelf: 'stretch', gap: Espacio.s, marginTop: Espacio.m },
}));
