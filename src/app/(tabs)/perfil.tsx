import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EnlacesLegales } from '@/components/legal/EnlacesLegales';
import { Avatar } from '@/components/ui/Avatar';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Chips } from '@/components/ui/Chips';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { estaActivo } from '@/components/ui/interaccion';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Fuentes, Radio } from '@/constants/tema';
import { PREFERENCIAS_APARIENCIA } from '@/features/apariencia/preferencia';
import { cerrarSesion } from '@/features/auth/acciones';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAlternarBloqueo, useBloqueados } from '@/features/bloqueos/api';
import { usePerfil } from '@/features/perfil/api';
import { useMisAnimales } from '@/features/reportes/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { haceCuanto } from '@/lib/fechas';

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
  const bloqueados = useBloqueados(usuario?.id);
  const alternarBloqueo = useAlternarBloqueo(usuario?.id);
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
      setError(mensajeDeError(e));
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
          <Avatar
            nombre={usuario ? (perfil?.nombre_publico ?? null) : null}
            fotoPath={usuario ? perfil?.avatar_path : null}
          />
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
          <>
            <Texto variante="pequeno">{t.perfil.privacidad}</Texto>
            <Boton
              titulo={t.perfil.editar}
              icono="create-outline"
              variante="secundario"
              deshabilitado={!perfil}
              onPress={() => router.push('/cuenta/editar')}
            />
          </>
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
                texto={mensajeDeError(misAnimales.error)}
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
                    <FotoMiniatura
                      ruta={a.foto_principal_path}
                      descripcion={t.animal.tituloCaso(a.nombre, a.especie, a.color, a.tamanio)}
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

          <View style={estilos.seccion}>
            <Texto variante="subtitulo" accessibilityRole="header">
              {t.perfil.bloqueados}
            </Texto>
            <Texto variante="secundario">{t.perfil.bloqueadosAyuda}</Texto>
            {bloqueados.isPending ? (
              <Cargando />
            ) : bloqueados.isError ? (
              <Mensaje
                texto={mensajeDeError(bloqueados.error)}
                tipo="error"
                onReintentar={() => void bloqueados.refetch()}
              />
            ) : bloqueados.data.length === 0 ? (
              <Texto variante="secundario">{t.perfil.sinBloqueados}</Texto>
            ) : (
              <View style={estilos.filas}>
                {bloqueados.data.map((b) => (
                  <View key={b.bloqueado_id} style={estilos.fila}>
                    <Avatar
                      nombre={b.bloqueado_nombre}
                      fotoPath={b.bloqueado_avatar_path}
                      tamanio={40}
                    />
                    <Texto numberOfLines={1} style={[estilos.tituloFila, estilos.cuerpo]}>
                      {b.bloqueado_nombre}
                    </Texto>
                    <Boton
                      titulo={t.perfil.desbloquear}
                      variante="fantasma"
                      accessibilityLabel={t.bloqueos.desbloquear(b.bloqueado_nombre)}
                      cargando={
                        alternarBloqueo.isPending &&
                        alternarBloqueo.variables?.otroId === b.bloqueado_id
                      }
                      onPress={() =>
                        alternarBloqueo.mutate({ otroId: b.bloqueado_id, bloqueado: true })
                      }
                      style={estilos.botonFila}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {t.perfil.legal}
        </Texto>
        <EnlacesLegales />
      </View>

      {usuario ? (
        <View style={estilos.cuenta}>
          <Boton
            titulo={t.auth.salir}
            icono="log-out-outline"
            variante="peligro"
            cargando={saliendo}
            onPress={() => void salir()}
          />
          <Boton
            titulo={t.perfil.borrarCuenta}
            icono="trash-outline"
            variante="peligro"
            onPress={() => router.push('/cuenta/borrar')}
          />
        </View>
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
  botonFila: { minHeight: 44, paddingHorizontal: Espacio.sm },
  cuenta: { gap: Espacio.xs, marginTop: Espacio.s },
}));
