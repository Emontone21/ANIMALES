import { type ComponentRef, useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, type ScrollView, View, type ViewStyle } from 'react-native';

import { ALTO_FOTO_TARJETA, TarjetaCaso, TARJETAS_A_LA_VISTA } from '@/components/mapa/TarjetaCaso';
import { TarjetaReencuentros } from '@/components/mapa/TarjetaReencuentros';
import type { HojaPlegable } from '@/components/mapa/useHojaPlegable';
import { Boton } from '@/components/ui/Boton';
import { Cargando } from '@/components/ui/Cargando';
import { DesplazableHorizontal } from '@/components/ui/DesplazableHorizontal';
import { estaActivo } from '@/components/ui/interaccion';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Margen, Medida, Radio, sombraFlotante } from '@/constants/tema';
import type { CasoCercano } from '@/features/reportes/filtros';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** Alto de la hoja abierta: el menor entre 300 y el 38 % del alto de la pantalla (6.7). */
export function altoHojaCercaTuyo(altoPantalla: number): number {
  return Math.round(Math.min(300, altoPantalla * 0.38));
}

const ALTO_MANIJA = 5;
/** El botón fantasma (54) da el alto de la fila del título. */
const ALTO_ENCABEZADO = Medida.boton;

/**
 * Alto de la hoja plegada, y de la hoja sin casos: la barra con la manija, el
 * título y la cantidad.
 */
export const ALTO_HOJA_PLEGADA =
  Espacio.s + ALTO_MANIJA + Espacio.xs + ALTO_ENCABEZADO + Espacio.xs;

/** Lo que ocupa la hoja además de la foto: la barra, los textos de la tarjeta y los márgenes. */
const ALTO_SIN_FOTO = 150;
const ALTO_FOTO_MINIMO = 72;

/**
 * En web, el arrastre de la barra es de la hoja: el navegador no desplaza ni
 * acerca la página, y el mouse no selecciona el texto. (Estilos que solo
 * existen en web.)
 */
const SOLO_ARRASTRE_DE_LA_HOJA =
  Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as ViewStyle) : null;

type Props = {
  casos: CasoCercano[];
  /** Alto de la hoja abierta. */
  alto: number;
  cargando?: boolean;
  seleccionadoId: string | null;
  hoja: HojaPlegable;
  onAbrir: (id: string) => void;
  /** "Ver lista": todos los casos con los filtros activos, del más cercano al más lejano. */
  onVerLista: () => void;
};

/**
 * Hoja inferior del mapa en celulares, con el carrusel de casos cercanos (6.7).
 * Plegada queda solo la barra; se pliega y despliega arrastrándola o tocándola.
 */
export function HojaCercaTuyo({
  casos,
  alto,
  cargando = false,
  seleccionadoId,
  hoja,
  onAbrir,
  onVerLista,
}: Props) {
  const estilos = useEstilos(crear);
  const carruselRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const altoFoto = Math.max(ALTO_FOTO_MINIMO, Math.min(ALTO_FOTO_TARJETA, alto - ALTO_SIN_FOTO));
  const { plegada, setPlegada, desplazamiento, moviendose, arrastre } = hoja;
  const plegable = alto > ALTO_HOJA_PLEGADA;
  // Plegada y quieta, el carrusel no se dibuja: no se ve, y así tampoco se llega con Tab.
  const conContenido = !plegada || moviendose;

  // Al tocar un marcador, su tarjeta pasa a ser la primera: se vuelve al principio.
  useEffect(() => {
    if (seleccionadoId) carruselRef.current?.scrollTo({ x: 0, animated: true });
  }, [seleccionadoId]);

  return (
    <Animated.View
      style={[estilos.hoja, { height: alto, transform: [{ translateY: desplazamiento }] }]}>
      <View {...arrastre} style={[estilos.barra, SOLO_ARRASTRE_DE_LA_HOJA]}>
        {/* Toda la barra pliega y despliega, menos "Ver lista", que va por encima. */}
        {plegable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={plegada ? t.mapa.mostrarCasos : t.mapa.ocultarCasos}
            aria-expanded={!plegada}
            onPress={() => setPlegada(!plegada)}
            style={estilos.alternar}>
            {(estado) => (
              <View style={[estilos.manija, estaActivo(estado) && estilos.manijaActiva]} />
            )}
          </Pressable>
        ) : (
          <View style={estilos.alternar}>
            <View style={estilos.manija} />
          </View>
        )}
        <View style={estilos.encabezado}>
          <View style={estilos.titulos}>
            <Texto variante="subtitulo" accessibilityRole="header">
              {t.mapa.cercaTuyo}
            </Texto>
            <Texto variante="secundario" numberOfLines={1}>
              {cargando ? t.comunes.cargando : t.mapa.cantidadCasos(casos.length)}
            </Texto>
          </View>
          {casos.length > 0 ? (
            <Boton titulo={t.mapa.verLista} variante="fantasma" onPress={onVerLista} />
          ) : null}
        </View>
      </View>
      {!conContenido ? null : cargando ? (
        <Cargando />
      ) : casos.length > 0 ? (
        <DesplazableHorizontal
          ref={carruselRef}
          contentContainerStyle={estilos.carrusel}
          style={estilos.desplazable}>
          {casos.map((caso, i) => (
            <TarjetaCaso
              key={caso.animal.id}
              caso={caso}
              seleccionado={caso.animal.id === seleccionadoId}
              altoFoto={altoFoto}
              prioritaria={i < TARJETAS_A_LA_VISTA.vertical}
              onPress={() => onAbrir(caso.animal.id)}
            />
          ))}
          {/* Al final: la entrada al muro de reencuentros (6.7). */}
          <TarjetaReencuentros forma="carrusel" altoFoto={altoFoto} habilitado={!cargando} />
        </DesplazableHorizontal>
      ) : null}
    </Animated.View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radio.hoja,
    borderTopRightRadius: Radio.hoja,
    backgroundColor: c.superficie,
    ...sombraFlotante(c, esquema),
    // En oscuro el borde de la sombra solo va arriba.
    borderBottomWidth: 0,
  },
  barra: {
    height: ALTO_HOJA_PLEGADA,
    paddingTop: Espacio.s + ALTO_MANIJA + Espacio.xs,
    paddingBottom: Espacio.xs,
  },
  // Ocupa toda la barra, por debajo del encabezado (que deja pasar los toques).
  alternar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingTop: Espacio.s,
    borderTopLeftRadius: Radio.hoja,
    borderTopRightRadius: Radio.hoja,
  },
  manija: {
    width: 40,
    height: ALTO_MANIJA,
    borderRadius: Radio.redondo,
    backgroundColor: c.borde,
  },
  manijaActiva: { backgroundColor: c.textoSecundario },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ALTO_ENCABEZADO,
    paddingLeft: Margen.mapa,
    // El botón ya trae su relleno: el texto queda casi al margen del mapa.
    paddingRight: 0,
    // Los toques sobre el título llegan al botón que pliega; "Ver lista" sigue siendo suyo.
    pointerEvents: 'box-none',
  },
  titulos: { flex: 1, minWidth: 0, pointerEvents: 'none' },
  desplazable: { flexGrow: 0 },
  carrusel: { gap: Espacio.sm, paddingHorizontal: Margen.mapa, paddingBottom: Espacio.m },
}));
