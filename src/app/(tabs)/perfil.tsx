import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Chips } from '@/components/ui/Chips';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { estaActivo } from '@/components/ui/interaccion';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Fuentes, MAX_ESCALA_TEXTO, Radio } from '@/constants/tema';
import { PREFERENCIAS_APARIENCIA } from '@/features/apariencia/preferencia';
import { cerrarSesion } from '@/features/auth/acciones';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePerfil } from '@/features/perfil/api';
import { useMisAnimales } from '@/features/reportes/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';

const OPCIONES_APARIENCIA = PREFERENCIAS_APARIENCIA.map((valor) => ({
  valor,
  etiqueta: t.perfil.aparienciaOpciones[valor],
}));

export default function PantallaPerfil() {
  const router = useRouter();
  const { c, preferencia, setPreferencia } = useTema();
  const estilos = useEstilos(crear);
  const { usuario } = useAuth();
  const { data: perfil } = usePerfil(usuario?.id);
  const misAnimales = useMisAnimales(usuario?.id);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '0.0.0';
  const nombre = perfil?.nombre_publico ?? '…';

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
    <Pantalla scroll ancho={AnchoMaximo.lista}>
      <Texto variante="titulo" accessibilityRole="header">
        {t.perfil.titulo}
      </Texto>

      <View style={estilos.tarjeta}>
        <View style={estilos.persona}>
          <View style={estilos.avatar}>
            {usuario && perfil ? (
              <Text style={estilos.inicial} maxFontSizeMultiplier={MAX_ESCALA_TEXTO}>
                {perfil.nombre_publico.trim().charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person-outline" size={26} color={c.textoPrimarioSuave} />
            )}
          </View>
          <View style={estilos.datosPersona}>
            {usuario ? (
              <>
                <Texto variante="tituloTarjeta">{t.perfil.hola(nombre)}</Texto>
                <Texto variante="secundario">{usuario.email}</Texto>
              </>
            ) : (
              <Texto variante="secundario">{t.perfil.sinCuenta}</Texto>
            )}
          </View>
        </View>
        {usuario ? (
          <Texto variante="pequeno">{t.perfil.privacidad}</Texto>
        ) : (
          <View style={estilos.botones}>
            <Boton titulo={t.auth.ingresar} onPress={() => router.push('/auth/ingresar')} />
            <Boton
              titulo={t.auth.registrarse}
              variante="secundario"
              onPress={() => router.push('/auth/registrarse')}
            />
          </View>
        )}
      </View>

      {error ? <Mensaje texto={error} tipo="error" /> : null}

      {usuario && perfil?.es_moderador ? (
        <Boton
          titulo={t.moderacion.abrirPanel}
          icono="shield-checkmark-outline"
          variante="secundario"
          onPress={() => router.push('/moderacion')}
        />
      ) : null}

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {t.perfil.apariencia}
        </Texto>
        <Chips
          opciones={OPCIONES_APARIENCIA}
          valor={preferencia}
          onCambio={setPreferencia}
          accessibilityLabel={t.perfil.apariencia}
        />
        <Texto variante="secundario">{t.perfil.aparienciaAyuda}</Texto>
      </View>

      {usuario ? (
        <>
          <View style={estilos.seccion}>
            <Texto variante="subtitulo" accessibilityRole="header">
              {t.perfil.misReportes}
            </Texto>
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
              <View style={estilos.filas}>
                {misAnimales.data.map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/animal/${a.vinculado_a ?? a.id}`)}
                    style={(estado) => [estilos.fila, estaActivo(estado) && estilos.filaActiva]}>
                    <Image
                      source={{ uri: urlFoto(a.foto_principal_path) }}
                      style={estilos.foto}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                    <View style={estilos.cuerpo}>
                      <EtiquetaEstado estado={a.estado} tipo={a.tipo_reporte} />
                      <Texto numberOfLines={1} style={estilos.tituloFila}>
                        {t.animal.tituloCaso(a.nombre, a.especie, a.color, a.tamanio)}
                      </Texto>
                      <Texto variante="pequeno">
                        {haceCuanto(a.created_at)} ·{' '}
                        {/* Un vinculado ya no tiene avistamientos: pasaron al caso principal. */}
                        {a.estado === 'vinculado'
                          ? t.perfil.verCasoPrincipal
                          : t.animal.avistamientos(a.cantidad_avistamientos)}
                      </Texto>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={c.textoSecundario} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Boton
            titulo={t.auth.salir}
            icono="log-out-outline"
            variante="peligro"
            cargando={saliendo}
            onPress={() => void salir()}
          />
        </>
      ) : null}

      <Texto variante="pequeno" style={estilos.centrado}>
        {t.perfil.version(version)}
      </Texto>
    </Pantalla>
  );
}

const crear = crearEstilos((c) => ({
  tarjeta: {
    gap: Espacio.m,
    padding: Espacio.ml,
    borderRadius: Radio.xl,
    borderWidth: 1,
    borderColor: c.borde,
    backgroundColor: c.superficie,
  },
  persona: { flexDirection: 'row', alignItems: 'center', gap: Espacio.m },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: c.primarioSuave,
  },
  inicial: { ...Fuentes.titulo, fontSize: 26, lineHeight: 30, color: c.textoPrimarioSuave },
  datosPersona: { flex: 1, gap: 2, minWidth: 0 },
  botones: { gap: Espacio.s },
  seccion: { gap: Espacio.sm, marginTop: Espacio.s },
  centrado: { textAlign: 'center' },
  filas: { borderTopWidth: 1, borderTopColor: c.borde },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.sm,
    paddingVertical: Espacio.sm,
    paddingHorizontal: Espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: c.borde,
  },
  filaActiva: { backgroundColor: c.superficieSuave },
  foto: { width: 56, height: 56, borderRadius: Radio.s, backgroundColor: c.superficieSuave },
  cuerpo: { flex: 1, gap: Espacio.xs, minWidth: 0 },
  tituloFila: { ...Fuentes.negrita, fontSize: 15, lineHeight: 20 },
}));
