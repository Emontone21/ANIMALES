import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { Mensaje } from '@/components/ui/Mensaje';
import { Texto } from '@/components/ui/Texto';
import { Colores, Espacio, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  otroAnimal,
  useCoincidencias,
  useResolverCoincidencia,
} from '@/features/coincidencias/api';
import { t } from '@/i18n/es-UY';
import { urlFoto } from '@/lib/imagenes';
import type { CoincidenciaDetalle } from '@/types/dominio';

type Props = { animalId: string };

/**
 * "Posibles coincidencias": otros reportes que el reconocimiento de imágenes
 * cree que son el mismo animal. Una persona confirma o rechaza; nunca se une solo.
 */
export function Coincidencias({ animalId }: Props) {
  const router = useRouter();
  const { usuario } = useAuth();
  const coincidencias = useCoincidencias(animalId);
  const resolver = useResolverCoincidencia(animalId);
  const [aviso, setAviso] = useState<string | null>(null);

  if (coincidencias.isPending || coincidencias.isError) return null;

  const pendientes = coincidencias.data.filter((c) => c.estado === 'pendiente');
  const resueltas = coincidencias.data.filter((c) => c.estado !== 'pendiente');
  if (pendientes.length === 0 && resueltas.length === 0) {
    return (
      <View style={estilos.contenedor}>
        <Texto variante="subtitulo">{t.coincidencias.titulo}</Texto>
        <Texto variante="secundario">{t.coincidencias.vacio}</Texto>
      </View>
    );
  }

  const resolverCon = (c: CoincidenciaDetalle, confirmada: boolean) => {
    resolver.mutate(
      { id: c.id, confirmada },
      {
        onSuccess: (principal) => {
          if (confirmada && principal && principal !== animalId) {
            router.replace(`/animal/${principal}`);
            return;
          }
          setAviso(confirmada ? t.coincidencias.confirmada : t.coincidencias.rechazada);
        },
      },
    );
  };

  return (
    <View style={estilos.contenedor}>
      <Texto variante="subtitulo">{t.coincidencias.titulo}</Texto>
      <Texto variante="secundario">{t.coincidencias.intro}</Texto>
      {aviso ? <Mensaje texto={aviso} tipo="exito" /> : null}
      {resolver.isError ? (
        <Mensaje texto={resolver.error.message || t.comunes.errorGenerico} tipo="error" />
      ) : null}
      {!usuario && pendientes.length > 0 ? (
        <Mensaje texto={t.coincidencias.requiereCuenta} />
      ) : null}

      {pendientes.map((c) => (
        <Tarjeta
          key={c.id}
          coincidencia={c}
          animalId={animalId}
          onAbrir={(id) => router.push(`/animal/${id}`)}
          acciones={
            usuario ? (
              <View style={estilos.botones}>
                <Boton
                  titulo={t.coincidencias.esElMismo}
                  icono="checkmark"
                  cargando={resolver.isPending && resolver.variables?.id === c.id}
                  deshabilitado={resolver.isPending}
                  onPress={() => resolverCon(c, true)}
                  style={estilos.boton}
                />
                <Boton
                  titulo={t.coincidencias.noEsElMismo}
                  icono="close"
                  variante="secundario"
                  deshabilitado={resolver.isPending}
                  onPress={() => resolverCon(c, false)}
                  style={estilos.boton}
                />
              </View>
            ) : null
          }
        />
      ))}

      {resueltas.length > 0 ? (
        <Texto variante="pequeno">{t.coincidencias.resueltas(resueltas.length)}</Texto>
      ) : null}
    </View>
  );
}

type TarjetaProps = {
  coincidencia: CoincidenciaDetalle;
  animalId: string;
  onAbrir: (id: string) => void;
  acciones: React.ReactNode;
};

function Tarjeta({ coincidencia, animalId, onAbrir, acciones }: TarjetaProps) {
  const otro = otroAnimal(coincidencia, animalId);
  const porcentaje = Math.round(coincidencia.similitud * 100);
  const km = coincidencia.distancia_m === null ? null : coincidencia.distancia_m / 1000;
  const horas = coincidencia.horas_diferencia;

  return (
    <View style={estilos.tarjeta}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.mapa.verDetalle}
        onPress={() => onAbrir(otro.id)}
        style={estilos.cabecera}>
        <Image source={{ uri: urlFoto(otro.fotoPath) }} style={estilos.foto} contentFit="cover" />
        <View style={estilos.cuerpo}>
          <View style={estilos.fila}>
            <Texto style={estilos.similitud}>{t.coincidencias.similitud(porcentaje)}</Texto>
            <EtiquetaEstado estado={otro.estado} />
          </View>
          <Texto variante="pequeno">
            {km !== null ? t.coincidencias.distancia(km) : ''}
            {km !== null && horas !== null ? ' · ' : ''}
            {horas !== null ? t.coincidencias.tiempo(horas) : ''}
          </Texto>
          <Texto variante="secundario" numberOfLines={2}>
            {otro.descripcion ?? t.animal.sinDescripcion}
          </Texto>
          <Texto variante="pequeno" style={estilos.enlace}>
            {t.coincidencias.verOtro}
          </Texto>
        </View>
      </Pressable>
      {acciones}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Espacio.s },
  tarjeta: {
    gap: Espacio.s,
    padding: Espacio.m,
    borderRadius: Radio.m,
    borderWidth: 1,
    borderColor: Colores.borde,
    backgroundColor: Colores.fondo,
  },
  cabecera: { flexDirection: 'row', gap: Espacio.m },
  foto: { width: 96, height: 96, borderRadius: Radio.m, backgroundColor: Colores.fondoSuave },
  cuerpo: { flex: 1, gap: Espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s, flexWrap: 'wrap' },
  similitud: { fontWeight: '700', color: Colores.primario },
  enlace: { color: Colores.primario, fontWeight: '600' },
  botones: { flexDirection: 'row', gap: Espacio.s },
  boton: { flex: 1 },
});
