import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
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

/** Panel para moderadores (perfiles.es_moderador): denuncias y ocultar publicaciones. */
export default function PantallaModeracion() {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const { usuario } = useAuth();
  const perfil = usePerfil(usuario?.id);
  const esModerador = perfil.data?.es_moderador ?? false;
  const denuncias = useDenuncias(esModerador);
  const { resolver, ocultar } = useAccionesModeracion();

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
          {denuncias.data.map((d) => (
            <View key={d.id} style={estilos.tarjeta}>
              <View style={estilos.cabecera}>
                <FotoMiniatura
                  ruta={d.animal_foto_path}
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
                    {d.animal_oculto ? (
                      <Etiqueta texto={t.moderacion.oculta} fondo="peligroSuave" color="peligro" />
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
                </View>
              </View>
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
          ))}
        </View>
      )}
    </Pantalla>
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
