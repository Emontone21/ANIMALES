import { Pressable, View } from 'react-native';

import { EtiquetaEstado } from '@/components/ui/Etiqueta';
import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import type { CasoCercano } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { haceCuanto } from '@/lib/fechas';

export const ANCHO_TARJETA = 224;
/**
 * Cuántas tarjetas se ven al abrir sin desplazar: sus fotos son las primeras que
 * se piden (prioritaria). Dos en el carrusel de "Cerca tuyo", cuatro en las filas.
 */
export const TARJETAS_A_LA_VISTA = { vertical: 2, fila: 4 } as const;
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
  /** Una de las primeras que se ven: su foto se pide enseguida (FotoMiniatura). */
  prioritaria?: boolean;
};

/** Tarjeta de un caso (docs/DISENO.md, 6.8): foto, estado, título y distancia. */
export function TarjetaCaso({
  caso,
  forma = 'vertical',
  seleccionado = false,
  altoFoto = ALTO_FOTO_TARJETA,
  onPress,
  onResaltar,
  prioritaria,
}: Props) {
  const estilos = useEstilos(crear);
  const { animal, km } = caso;
  const titulo = t.animal.tituloCaso(animal.nombre, animal.especie, animal.color, animal.tamanio);
  const hace = haceCuanto(animal.ultimo_visto_en);
  const linea = km === null ? hace : t.mapa.distanciaYTiempo(t.mapa.distancia(km), hace);
  const fila = forma === 'fila';

  const foto = (
    <FotoMiniatura
      ruta={animal.foto_principal_path}
      descripcion={titulo}
      prioritaria={prioritaria}
      style={fila ? estilos.fotoFila : [estilos.foto, { height: altoFoto }]}
      contentFit="cover"
      // Las primeras se pintan apenas llegan, sin fundido: son lo primero que se ve.
      transition={prioritaria ? 0 : 150}
      accessibilityIgnoresInvertColors
    />
  );

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${titulo}. ${t.etiquetaEstado(animal.estado, animal.tipo_reporte)}. ${linea}`}
      // "Seleccionado" queda para nativo: en web ARIA no permite aria-selected en un link.
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
            <EtiquetaEstado estado={animal.estado} tipo={animal.tipo_reporte} />
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
              <EtiquetaEstado estado={animal.estado} tipo={animal.tipo_reporte} />
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
