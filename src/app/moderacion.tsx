import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAccionesModeracion, useDenuncias } from '@/features/moderacion/api';
import { usePerfil } from '@/features/perfil/api';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';

/** Panel para moderadores (perfiles.es_moderador): denuncias y ocultar publicaciones. */
export default function PantallaModeracion() {
  const router = useRouter();
  const { usuario } = useAuth();
  const perfil = usePerfil(usuario?.id);
  const esModerador = perfil.data?.es_moderador ?? false;
  const denuncias = useDenuncias(esModerador);
  const { resolver, ocultar } = useAccionesModeracion();

  if (perfil.isPending && usuario) return <Cargando />;
  if (!esModerador) {
    return (
      <Pantalla scroll>
        <Mensaje texto={t.moderacion.soloModeradores} />
      </Pantalla>
    );
  }

  return (
    <Pantalla scroll bordes={['left', 'right']}>
      <Texto variante="secundario">{t.moderacion.intro}</Texto>
      {denuncias.isPending ? (
        <Cargando />
      ) : denuncias.isError ? (
        <Mensaje
          texto={denuncias.error.message}
          tipo="error"
          onReintentar={() => void denuncias.refetch()}
        />
      ) : denuncias.data.length === 0 ? (
        <Texto variante="secundario">{t.moderacion.vacio}</Texto>
      ) : (
        denuncias.data.map((d) => (
          <View key={d.id} style={estilos.tarjeta}>
            <View style={estilos.cabecera}>
              <Image
                source={{ uri: urlFoto(d.animal_foto_path) }}
                style={estilos.foto}
                contentFit="cover"
              />
              <View style={estilos.cuerpo}>
                <View style={estilos.fila}>
                  <Etiqueta
                    texto={t.estadoDenuncia[d.estado]}
                    color={d.estado === 'pendiente' ? Colores.advertencia : Colores.textoSecundario}
                  />
                  {d.animal_oculto ? (
                    <Etiqueta texto={t.moderacion.oculta} color={Colores.peligro} />
                  ) : null}
                </View>
                <Texto style={estilos.titulo}>{t.motivoDenuncia[d.motivo]}</Texto>
                <Texto variante="pequeno">
                  {d.denunciante_nombre} · {fechaHoraCorta(d.created_at)}
                </Texto>
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
                icono={d.animal_oculto ? 'eye' : 'eye-off'}
                cargando={ocultar.isPending && ocultar.variables?.animalId === d.animal_id}
                onPress={() => ocultar.mutate({ animalId: d.animal_id, oculto: !d.animal_oculto })}
                style={estilos.boton}
              />
            </View>
            {d.estado === 'pendiente' ? (
              <View style={estilos.fila}>
                <Boton
                  titulo={t.moderacion.marcarRevisada}
                  icono="checkmark"
                  cargando={resolver.isPending && resolver.variables?.id === d.id}
                  onPress={() => resolver.mutate({ id: d.id, estado: 'revisada' })}
                  style={estilos.boton}
                />
                <Boton
                  titulo={t.moderacion.descartar}
                  variante="secundario"
                  icono="close"
                  onPress={() => resolver.mutate({ id: d.id, estado: 'descartada' })}
                  style={estilos.boton}
                />
              </View>
            ) : null}
          </View>
        ))
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: Espacio.s,
    padding: Espacio.m,
    borderRadius: Radio.m,
    borderWidth: 1,
    borderColor: Colores.borde,
  },
  cabecera: { flexDirection: 'row', gap: Espacio.m },
  foto: { width: 72, height: 72, borderRadius: Radio.s, backgroundColor: Colores.fondoSuave },
  cuerpo: { flex: 1, gap: Espacio.xs },
  fila: { flexDirection: 'row', gap: Espacio.s, flexWrap: 'wrap' },
  titulo: { fontWeight: '600' },
  boton: { flex: 1, minWidth: 140 },
});
