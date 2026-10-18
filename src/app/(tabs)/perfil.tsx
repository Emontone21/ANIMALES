import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { cerrarSesion } from '@/features/auth/acciones';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePerfil } from '@/features/perfil/api';
import { t } from '@/i18n/es-UY';

export default function PantallaPerfil() {
  const router = useRouter();
  const { usuario } = useAuth();
  const { data: perfil } = usePerfil(usuario?.id);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '0.0.0';

  const salir = async () => {
    setSaliendo(true);
    setError(null);
    try {
      await cerrarSesion();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.comunes.errorGenerico);
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <Pantalla scroll>
      <Texto variante="titulo">{t.perfil.titulo}</Texto>

      <View style={estilos.tarjeta}>
        <View style={estilos.avatar}>
          <Ionicons name="person" size={32} color={Colores.primario} />
        </View>
        {usuario ? (
          <>
            <Texto variante="subtitulo">{t.perfil.hola(perfil?.nombre_publico ?? '…')}</Texto>
            <Texto variante="secundario">{usuario.email}</Texto>
            <Texto variante="pequeno">{t.perfil.privacidad}</Texto>
          </>
        ) : (
          <Texto variante="secundario" style={estilos.centrado}>
            {t.perfil.sinCuenta}
          </Texto>
        )}
      </View>

      {error ? <Mensaje texto={error} tipo="error" /> : null}

      {usuario ? (
        <Boton
          titulo={t.auth.salir}
          icono="log-out-outline"
          variante="secundario"
          cargando={saliendo}
          onPress={() => void salir()}
        />
      ) : (
        <>
          <Boton titulo={t.auth.ingresar} onPress={() => router.push('/auth/ingresar')} />
          <Boton
            titulo={t.auth.registrarse}
            variante="secundario"
            onPress={() => router.push('/auth/registrarse')}
          />
        </>
      )}

      <Texto variante="pequeno" style={estilos.centrado}>
        {t.perfil.version(version)}
      </Texto>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    alignItems: 'center',
    gap: Espacio.s,
    padding: Espacio.l,
    borderRadius: Radio.l,
    backgroundColor: Colores.fondoSuave,
  },
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.primarioSuave,
  },
  centrado: { textAlign: 'center' },
});
