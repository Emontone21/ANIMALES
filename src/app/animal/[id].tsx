import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MapaRecorrido } from '@/components/mapa/MapaRecorrido';
import { AccionesAnimal } from '@/components/reportes/AccionesAnimal';
import { Historial } from '@/components/reportes/Historial';
import { Cargando } from '@/components/ui/Cargando';
import { Etiqueta, EtiquetaEspecie, EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import {
  armarHistorial,
  useAnimal,
  useAvistamientos,
  useCambiosEstado,
} from '@/features/reportes/api';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';

export default function PantallaAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const animal = useAnimal(id);
  const avistamientos = useAvistamientos(id);
  const cambios = useCambiosEstado(id);

  // Un reporte vinculado redirige al caso principal.
  const vinculadoA = animal.data?.estado === 'vinculado' ? animal.data.vinculado_a : null;
  useEffect(() => {
    if (vinculadoA) router.replace(`/animal/${vinculadoA}`);
  }, [vinculadoA, router]);

  const historial = useMemo(
    () => armarHistorial(avistamientos.data ?? [], cambios.data ?? []),
    [avistamientos.data, cambios.data],
  );

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

  if (vinculadoA) {
    return (
      <Pantalla scroll>
        <Mensaje texto={t.animal.vinculadoAviso} />
      </Pantalla>
    );
  }

  // Último contacto compartido por quien lo resguardó, mientras siga resguardado.
  const contacto =
    a.estado === 'resguardado'
      ? (cambios.data?.find((c) => c.estado_nuevo === 'resguardado' && c.contacto_compartido)
          ?.contacto_compartido ?? null)
      : null;

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
        {t.animal.publicadoPor(a.creador_nombre)} · {haceCuanto(a.created_at)} ·{' '}
        {t.animal.avistamientos(a.cantidad_avistamientos)}
      </Texto>

      {a.estado === 'reunido' ? <Mensaje texto={t.animal.casoCerrado} tipo="exito" /> : null}
      {contacto ? <Mensaje texto={`${t.animal.contacto}: ${contacto}`} /> : null}

      <AccionesAnimal animal={a} />

      {avistamientos.data && avistamientos.data.length > 0 ? (
        <>
          <Texto variante="subtitulo">{t.animal.recorrido}</Texto>
          <MapaRecorrido
            key={avistamientos.data.map((av) => av.id).join(',')}
            avistamientos={avistamientos.data}
          />
        </>
      ) : null}

      <Texto variante="subtitulo">{t.animal.historial}</Texto>
      {avistamientos.isPending || cambios.isPending ? (
        <Cargando />
      ) : avistamientos.isError || cambios.isError ? (
        <Mensaje
          texto={avistamientos.error?.message ?? cambios.error?.message ?? t.comunes.errorGenerico}
          tipo="error"
          onReintentar={() => {
            void avistamientos.refetch();
            void cambios.refetch();
          }}
        />
      ) : (
        <Historial eventos={historial} />
      )}
    </Pantalla>
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
});
