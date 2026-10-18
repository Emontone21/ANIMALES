import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { cerrarSesion } from '@/features/auth/acciones';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePerfil } from '@/features/perfil/api';
import { useMisAnimales } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';

export default function PantallaPerfil() {
  const router = useRouter();
  const { usuario } = useAuth();
  const { data: perfil } = usePerfil(usuario?.id);
  const misAnimales = useMisAnimales(usuario?.id);
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
        <>
          {perfil?.es_moderador ? (
            <Boton
              titulo={t.moderacion.abrirPanel}
              icono="shield-checkmark"
              variante="secundario"
              onPress={() => router.push('/moderacion')}
            />
          ) : null}

          <Texto variante="subtitulo">{t.perfil.misReportes}</Texto>
          {misAnimales.isPending ? (
            <Cargando />
          ) : misAnimales.isError ? (
            <Mensaje
              texto={misAnimales.error.message}
              tipo="error"
              onReintentar={() => void misAnimales.refetch()}
            />
          ) : misAnimales.data.length === 0 ? (
            <Texto variante="secundario">{t.perfil.sinReportes}</Texto>
          ) : (
            <View style={estilos.lista}>
              {misAnimales.data.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/animal/${a.vinculado_a ?? a.id}`)}
                  style={estilos.fila}>
                  <Image
                    source={{ uri: urlFoto(a.foto_principal_path) }}
                    style={estilos.foto}
                    contentFit="cover"
                  />
                  <View style={estilos.cuerpo}>
                    <EtiquetaEstado estado={a.estado} />
                    <Texto numberOfLines={1}>
                      {t.especie[a.especie]}
                      {a.color ? ` · ${a.color}` : ''}
                    </Texto>
                    <Texto variante="pequeno">
                      {haceCuanto(a.created_at)} ·{' '}
                      {t.animal.avistamientos(a.cantidad_avistamientos)}
                    </Texto>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colores.textoSecundario} />
                </Pressable>
              ))}
            </View>
          )}

          <Boton
            titulo={t.auth.salir}
            icono="log-out-outline"
            variante="secundario"
            cargando={saliendo}
            onPress={() => void salir()}
          />
        </>
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
  lista: { gap: Espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.m,
    padding: Espacio.s,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondoSuave,
  },
  foto: { width: 56, height: 56, borderRadius: Radio.s, backgroundColor: Colores.borde },
  cuerpo: { flex: 1, gap: Espacio.xs },
});
