import { useLocalSearchParams, useRouter } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Chips } from '@/components/ui/Chips';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Fuentes, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAccionesModeracion, useDenuncias } from '@/features/moderacion/api';
import { usePerfil } from '@/features/perfil/api';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { fechaHoraCorta } from '@/lib/fechas';

// Errores y Reconocimiento van en bloques aparte: se cargan al elegirlos.
const ErroresModeracion = lazy(() => import('@/components/moderacion/ErroresModeracion'));
const ReconocimientoModeracion = lazy(
  () => import('@/components/moderacion/ReconocimientoModeracion'),
);

type Seccion = 'denuncias' | 'errores' | 'reconocimiento';

/**
 * Panel para moderadores (perfiles.es_moderador): denuncias (y ocultar
 * publicaciones), errores que reportan las personas y el estado del
 * reconocimiento. El aviso de un error nuevo abre Errores (`?seccion=errores`).
 */
export default function PantallaModeracion() {
  const { usuario } = useAuth();
  const perfil = usePerfil(usuario?.id);
  const esModerador = perfil.data?.es_moderador ?? false;
  const { seccion: pedida } = useLocalSearchParams<{ seccion?: string }>();
  const [seccion, setSeccion] = useState<Seccion>(pedida === 'errores' ? 'errores' : 'denuncias');

  if (perfil.isPending && usuario) return <Cargando />;
  if (!esModerador) {
    return (
      <Pantalla scroll ancho={AnchoMaximo.lista}>
        <Mensaje texto={t.moderacion.soloModeradores} />
      </Pantalla>
    );
  }

  return (
    <Pantalla scroll bordes={['left', 'right']} ancho={AnchoMaximo.lista}>
      <Chips
        opciones={[
          { valor: 'denuncias', etiqueta: t.errores.moderacion.denuncias },
          { valor: 'errores', etiqueta: t.errores.moderacion.errores },
          { valor: 'reconocimiento', etiqueta: t.reconocimiento.titulo },
        ]}
        valor={seccion}
        onCambio={setSeccion}
      />
      {seccion === 'errores' ? (
        <Suspense fallback={<Cargando />}>
          <ErroresModeracion />
        </Suspense>
      ) : seccion === 'reconocimiento' ? (
        <Suspense fallback={<Cargando />}>
          <ReconocimientoModeracion />
        </Suspense>
      ) : (
        <Denuncias />
      )}
    </Pantalla>
  );
}

/** Las denuncias, con ocultar o mostrar la publicación y marcarlas revisadas. */
function Denuncias() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const denuncias = useDenuncias(true);
  const { resolver, ocultar, ocultarDeHistoria } = useAccionesModeracion();

  return (
    <>
      <Texto variante="secundario">{t.moderacion.intro}</Texto>
      {denuncias.isPending ? (
        <Cargando />
      ) : denuncias.isError ? (
        <Mensaje
          texto={mensajeDeError(denuncias.error)}
          tipo="error"
          onReintentar={() => void denuncias.refetch()}
        />
      ) : denuncias.data.length === 0 ? (
        <Texto variante="secundario">{t.moderacion.vacio}</Texto>
      ) : (
        <View style={estilos.filas}>
          {denuncias.data.map((d) => {
            // Una denuncia de la historia del reencuentro: se modera la historia, no el caso.
            const oculta = d.historia ? d.historia_oculta : d.animal_oculto;
            return (
              <View key={d.id} style={estilos.tarjeta}>
                <View style={estilos.cabecera}>
                  <FotoMiniatura
                    ruta={(d.historia ? d.historia_foto_path : null) ?? d.animal_foto_path}
                    descripcion={t.especie[d.animal_especie]}
                    style={estilos.foto}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={estilos.cuerpo}>
                    <View style={estilos.fila}>
                      <Etiqueta
                        texto={t.estadoDenuncia[d.estado]}
                        fondo={d.estado === 'pendiente' ? 'avisoFondo' : 'superficieSuave'}
                        color={d.estado === 'pendiente' ? 'texto' : 'textoSecundario'}
                      />
                      {d.historia ? (
                        <Etiqueta
                          texto={t.moderacion.historia}
                          fondo="primarioSuave"
                          color="textoPrimarioSuave"
                        />
                      ) : null}
                      {oculta ? (
                        <Etiqueta
                          texto={t.moderacion.oculta}
                          fondo="peligroSuave"
                          color="peligro"
                        />
                      ) : null}
                      {d.cuenta_nueva ? (
                        <Etiqueta
                          texto={t.moderacion.cuentaNueva}
                          fondo="superficieSuave"
                          color="textoSecundario"
                        />
                      ) : null}
                    </View>
                    <Texto style={estilos.titulo}>{t.motivoDenuncia[d.motivo]}</Texto>
                    <Texto variante="pequeno">
                      {d.denunciante_nombre} · {fechaHoraCorta(d.created_at)}
                    </Texto>
                    {d.cuenta_nueva ? (
                      <Texto variante="pequeno">{t.moderacion.cuentaNuevaAyuda}</Texto>
                    ) : null}
                    {d.detalle ? <Texto variante="secundario">{d.detalle}</Texto> : null}
                    {d.historia && d.historia_frase ? (
                      <Texto color="textoCuerpo">{d.historia_frase}</Texto>
                    ) : null}
                  </View>
                </View>
                {d.historia ? (
                  <View style={estilos.fila}>
                    <Boton
                      titulo={t.moderacion.verHistoria}
                      variante="fantasma"
                      icono="open-outline"
                      onPress={() => router.push(`/reencuentros/${d.animal_id}`)}
                      style={estilos.boton}
                    />
                    <Boton
                      titulo={oculta ? t.moderacion.mostrarHistoria : t.moderacion.ocultarHistoria}
                      variante="secundario"
                      icono={oculta ? 'eye-outline' : 'eye-off-outline'}
                      cargando={
                        ocultarDeHistoria.isPending &&
                        ocultarDeHistoria.variables?.animalId === d.animal_id
                      }
                      onPress={() =>
                        ocultarDeHistoria.mutate({ animalId: d.animal_id, oculta: !oculta })
                      }
                      style={estilos.boton}
                    />
                  </View>
                ) : (
                  <View style={estilos.fila}>
                    <Boton
                      titulo={t.mapa.verDetalle}
                      variante="fantasma"
                      icono="open-outline"
                      onPress={() => router.push(`/animal/${d.animal_id}`)}
                      style={estilos.boton}
                    />
                    <Boton
                      titulo={d.animal_oculto ? t.moderacion.mostrar : t.moderacion.ocultar}
                      variante="secundario"
                      icono={d.animal_oculto ? 'eye-outline' : 'eye-off-outline'}
                      cargando={ocultar.isPending && ocultar.variables?.animalId === d.animal_id}
                      onPress={() =>
                        ocultar.mutate({ animalId: d.animal_id, oculto: !d.animal_oculto })
                      }
                      style={estilos.boton}
                    />
                  </View>
                )}
                {d.estado === 'pendiente' ? (
                  <View style={estilos.fila}>
                    <Boton
                      titulo={t.moderacion.marcarRevisada}
                      icono="checkmark-outline"
                      cargando={resolver.isPending && resolver.variables?.id === d.id}
                      onPress={() => resolver.mutate({ id: d.id, estado: 'revisada' })}
                      style={estilos.boton}
                    />
                    <Boton
                      titulo={t.moderacion.descartar}
                      variante="secundario"
                      icono="close-outline"
                      onPress={() => resolver.mutate({ id: d.id, estado: 'descartada' })}
                      style={estilos.boton}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const crear = crearEstilos((c) => ({
  filas: { borderTopWidth: 1, borderTopColor: c.borde },
  tarjeta: {
    gap: Espacio.sm,
    paddingVertical: Espacio.m,
    paddingHorizontal: Espacio.s,
    borderBottomWidth: 1,
    borderBottomColor: c.borde,
  },
  cabecera: { flexDirection: 'row', gap: Espacio.sm },
  foto: { width: 56, height: 56, borderRadius: Radio.s, backgroundColor: c.superficieSuave },
  cuerpo: { flex: 1, gap: Espacio.xs, minWidth: 0 },
  fila: { flexDirection: 'row', gap: Espacio.s, flexWrap: 'wrap' },
  titulo: { ...Fuentes.negrita, fontSize: 15, lineHeight: 20 },
  boton: { flex: 1, minWidth: 140 },
}));
