import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import type { CasoCercano } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';
import { urlFoto } from '@/lib/imagenes';

export const ANCHO_TARJETA = 224;
export const ALTO_FOTO_TARJETA = 124;
const LADO_FOTO_FILA = 96;

type Props = {
  caso: CasoCercano;
  /** vertical: carrusel de "Cerca tuyo" · fila: listas de los paneles en pantallas anchas. */
  forma?: 'vertical' | 'fila';
  seleccionado?: boolean;
  /** Alto de la foto en la tarjeta vertical; en pantallas bajas se achica para entrar en la hoja. */
  altoFoto?: number;
  onPress: () => void;
  /** Hover o foco sobre la tarjeta: resalta su marcador en el mapa. */
  onResaltar?: (id: string | null) => void;
};

/** Tarjeta de un caso (docs/DISENO.md, 6.8): foto, estado, título y distancia. */
export function TarjetaCaso({
  caso,
  forma = 'vertical',
  seleccionado = false,
  altoFoto = ALTO_FOTO_TARJETA,
  onPress,
  onResaltar,
}: Props) {
  const estilos = useEstilos(crear);
  const { animal, km } = caso;
  const titulo = t.animal.tituloCorto(animal.especie, animal.color, animal.tamanio);
  const hace = haceCuanto(animal.ultimo_visto_en);
  const linea = km === null ? hace : t.mapa.distanciaYTiempo(t.mapa.distancia(km), hace);
  const fila = forma === 'fila';

  const foto = (
    <Image
      source={{ uri: urlFoto(animal.foto_principal_path) }}
      style={fila ? estilos.fotoFila : [estilos.foto, { height: altoFoto }]}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${titulo}. ${t.estado[animal.estado]}. ${linea}`}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      onHoverIn={() => onResaltar?.(animal.id)}
      onHoverOut={() => onResaltar?.(null)}
      onFocus={() => onResaltar?.(animal.id)}
      onBlur={() => onResaltar?.(null)}
      style={(estado) => [
        fila ? estilos.tarjetaFila : estilos.tarjeta,
        fila && (seleccionado || estaActivo(estado)) && estilos.filaActiva,
        !fila && estaActivo(estado) && estilos.verticalActiva,
      ]}>
      {fila ? (
        <>
          {foto}
          <View style={estilos.cuerpoFila}>
            <EtiquetaEstado estado={animal.estado} />
            <Texto variante="tituloTarjeta" numberOfLines={2}>
              {titulo}
            </Texto>
            <Texto variante="secundario" numberOfLines={1}>
              {linea}
            </Texto>
          </View>
        </>
      ) : (
        <>
          <View>
            {foto}
            <View style={estilos.etiqueta}>
              <EtiquetaEstado estado={animal.estado} />
            </View>
          </View>
          <Texto variante="tituloTarjeta" numberOfLines={1} style={estilos.titulo}>
            {titulo}
          </Texto>
          <Texto variante="secundario" numberOfLines={1}>
            {linea}
          </Texto>
        </>
      )}
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  tarjeta: { width: ANCHO_TARJETA, gap: Espacio.xs },
  verticalActiva: { opacity: 0.85 },
  foto: {
    width: ANCHO_TARJETA,
    borderRadius: Radio.l,
    backgroundColor: c.superficieSuave,
  },
  etiqueta: { position: 'absolute', top: 10, left: 10 },
  titulo: { marginTop: Espacio.xs },
  tarjetaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.sm,
    padding: Espacio.s,
    borderRadius: Radio.xl,
  },
  filaActiva: { backgroundColor: c.superficieSuave },
  fotoFila: {
    width: LADO_FOTO_FILA,
    height: LADO_FOTO_FILA,
    borderRadius: Radio.m,
    backgroundColor: c.superficieSuave,
  },
  cuerpoFila: { flex: 1, gap: Espacio.xs, minWidth: 0 },
}));
