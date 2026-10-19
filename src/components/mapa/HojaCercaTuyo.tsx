import { type ComponentRef, useEffect, useRef } from 'react';
import { type ScrollView, View } from 'react-native';

import { ALTO_FOTO_TARJETA, TarjetaCaso } from '@/components/mapa/TarjetaCaso';
import { Cargando } from '@/components/ui/Cargando';
import { DesplazableHorizontal } from '@/components/ui/DesplazableHorizontal';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Margen, Radio, sombraFlotante } from '@/constants/tema';
import type { CasoCercano } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** Alto fijo de la hoja: el menor entre 300 y el 38 % del alto de la pantalla (6.7). */
export function altoHojaCercaTuyo(altoPantalla: number): number {
  return Math.round(Math.min(300, altoPantalla * 0.38));
}

/** Alto de la hoja sin casos: solo la manija y el título. */
export const ALTO_HOJA_VACIA = 72;

/** Lo que ocupa la hoja además de la foto: manija, título, textos de la tarjeta y márgenes. */
const ALTO_SIN_FOTO = 140;
const ALTO_FOTO_MINIMO = 72;

type Props = {
  casos: CasoCercano[];
  alto: number;
  cargando?: boolean;
  seleccionadoId: string | null;
  onAbrir: (id: string) => void;
};

/** Hoja inferior del mapa en celulares, con el carrusel de casos cercanos (6.7). */
export function HojaCercaTuyo({ casos, alto, cargando = false, seleccionadoId, onAbrir }: Props) {
  const estilos = useEstilos(crear);
  const carruselRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const altoFoto = Math.max(ALTO_FOTO_MINIMO, Math.min(ALTO_FOTO_TARJETA, alto - ALTO_SIN_FOTO));

  // Al tocar un marcador, su tarjeta pasa a ser la primera: se vuelve al principio.
  useEffect(() => {
    if (seleccionadoId) carruselRef.current?.scrollTo({ x: 0, animated: true });
  }, [seleccionadoId]);

  return (
    <View style={[estilos.hoja, { height: alto }]}>
      <View style={estilos.manija} />
      <Texto variante="subtitulo" accessibilityRole="header" style={estilos.titulo}>
        {t.mapa.cercaTuyo}
      </Texto>
      {cargando ? (
        <Cargando />
      ) : casos.length > 0 ? (
        <DesplazableHorizontal
          ref={carruselRef}
          contentContainerStyle={estilos.carrusel}
          style={estilos.desplazable}>
          {casos.map((caso) => (
            <TarjetaCaso
              key={caso.animal.id}
              caso={caso}
              seleccionado={caso.animal.id === seleccionadoId}
              altoFoto={altoFoto}
              onPress={() => onAbrir(caso.animal.id)}
            />
          ))}
        </DesplazableHorizontal>
      ) : null}
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Espacio.s,
    borderTopLeftRadius: Radio.hoja,
    borderTopRightRadius: Radio.hoja,
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
    // En oscuro el borde de la sombra solo va arriba.
    borderBottomWidth: 0,
  },
  manija: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radio.redondo,
    backgroundColor: c.borde,
  },
  titulo: { paddingHorizontal: Margen.mapa, marginTop: Espacio.sm, marginBottom: Espacio.sm },
  desplazable: { flexGrow: 0 },
  carrusel: { gap: Espacio.sm, paddingHorizontal: Margen.mapa, paddingBottom: Espacio.m },
}));
