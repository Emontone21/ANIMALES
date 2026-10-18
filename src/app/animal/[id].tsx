import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Cargando } from '@/components/ui/Cargando';
import { Etiqueta, EtiquetaEspecie, EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { usePerfil } from '@/features/perfil/api';
import { useAnimal, useAvistamientos } from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { fechaHoraCorta, haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';
import type { AvistamientoDetalle } from '@/types/dominio';

export default function PantallaAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const animal = useAnimal(id);
  const avistamientos = useAvistamientos(id);
  const autor = usePerfil(animal.data?.creado_por);

  if (animal.isPending) return <Cargando />;

  if (animal.isError) {
    return (
      <Pantalla scroll>
        <Mensaje
          texto={animal.error.message}
          tipo="error"
          onReintentar={() => void animal.refetch()}
        />
      </Pantalla>
    );
  }

  if (!animal.data) {
    return (
      <Pantalla scroll>
        <Mensaje texto={t.animal.noEncontrado} />
      </Pantalla>
    );
  }

  const a = animal.data;

  return (
    <Pantalla scroll bordes={['left', 'right']}>
      <Image
        source={{ uri: urlFoto(a.foto_principal_path) }}
        style={estilos.foto}
        contentFit="cover"
      />

      <View style={estilos.etiquetas}>
        <EtiquetaEspecie especie={a.especie} />
        <EtiquetaEstado estado={a.estado} />
        {a.tamanio ? (
          <Etiqueta texto={t.tamanio[a.tamanio]} color={Colores.textoSecundario} />
        ) : null}
        <Etiqueta
          texto={a.tiene_collar ? t.animal.conCollar : t.animal.sinCollar}
          color={a.tiene_collar ? Colores.exito : Colores.textoSecundario}
        />
      </View>

      {a.color ? <Texto variante="subtitulo">{a.color}</Texto> : null}
      <Texto>{a.descripcion ?? t.animal.sinDescripcion}</Texto>

      <Texto variante="secundario">
        {t.animal.publicadoPor(autor.data?.nombre_publico ?? '…')} · {haceCuanto(a.created_at)}
      </Texto>

      <Mensaje texto={t.animal.proximamente} />

      <Texto variante="subtitulo">{t.animal.historial}</Texto>
      {avistamientos.isPending ? (
        <Cargando />
      ) : avistamientos.isError ? (
        <Mensaje
          texto={avistamientos.error.message}
          tipo="error"
          onReintentar={() => void avistamientos.refetch()}
        />
      ) : (
        avistamientos.data.map((av) => <FilaAvistamiento key={av.id} avistamiento={av} />)
      )}
    </Pantalla>
  );
}

function FilaAvistamiento({ avistamiento }: { avistamiento: AvistamientoDetalle }) {
  const icono =
    avistamiento.tipo === 'encontrado'
      ? 'flag'
      : avistamiento.tipo === 'resguardado'
        ? 'home'
        : 'eye';
  return (
    <View style={estilos.fila}>
      <View style={estilos.filaIcono}>
        <Ionicons name={icono} size={18} color={Colores.primario} />
      </View>
      <View style={estilos.filaCuerpo}>
        <Texto style={estilos.filaTitulo}>
          {t.tipoAvistamiento[avistamiento.tipo]} {avistamiento.usuario_nombre}
        </Texto>
        <Texto variante="pequeno">{fechaHoraCorta(avistamiento.visto_en)}</Texto>
        {avistamiento.nota ? <Texto variante="secundario">{avistamiento.nota}</Texto> : null}
      </View>
      {avistamiento.foto_path ? (
        <Image
          source={{ uri: urlFoto(avistamiento.foto_path) }}
          style={estilos.miniatura}
          contentFit="cover"
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radio.l,
    backgroundColor: Colores.fondoSuave,
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  fila: {
    flexDirection: 'row',
    gap: Espacio.m,
    padding: Espacio.m,
    borderRadius: Radio.m,
    backgroundColor: Colores.fondoSuave,
  },
  filaIcono: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
    backgroundColor: Colores.primarioSuave,
  },
  filaCuerpo: { flex: 1, gap: Espacio.xs },
  filaTitulo: { fontWeight: '600' },
  miniatura: { width: 56, height: 56, borderRadius: Radio.s },
});
