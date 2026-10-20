import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { estaActivo } from '@/components/ui/interaccion';
import { Espacio, Fuentes, MAX_ESCALA_TEXTO, Medida, Radio, Tipografia } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHayNoLeidas } from '@/features/notificaciones/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

type Destino = { ruta: string; titulo: string; icono: NombreIcono; href: Href };

/** Las cuatro pestañas, en el orden de la barra de abajo. */
const DESTINOS: Destino[] = [
  { ruta: 'index', titulo: t.tabs.mapa, icono: 'map-outline', href: '/' },
  { ruta: 'publicar', titulo: t.tabs.publicar, icono: 'add', href: '/publicar' },
  {
    ruta: 'actividad',
    titulo: t.tabs.actividad,
    icono: 'notifications-outline',
    href: '/actividad',
  },
  { ruta: 'perfil', titulo: t.tabs.perfil, icono: 'person-outline', href: '/perfil' },
];

const RUTA_PUBLICAR = 'publicar';
const RUTA_ACTIVIDAD = 'actividad';

/** Hay notificaciones sin leer: punto en la pestaña Actividad. */
function useHayNovedades(): boolean {
  const { usuario } = useAuth();
  const { data } = useHayNoLeidas(!!usuario);
  return !!data;
}

/** Barra de pestañas de abajo, en celulares y tablets (6.14). */
export function BarraNavegacion({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const estilos = useEstilos(crear);
  const hayNovedades = useHayNovedades();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        estilos.barra,
        {
          height: Medida.barraPestanias + insets.bottom,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      {state.routes.map((ruta, indice) => {
        const destino = DESTINOS.find((d) => d.ruta === ruta.name);
        if (!destino) return null;
        const enfocada = state.index === indice;
        return (
          <ItemNavegacion
            key={ruta.key}
            destino={destino}
            enfocada={enfocada}
            conPunto={ruta.name === RUTA_ACTIVIDAD && hayNovedades}
            onPress={() => {
              const evento = emitter.emit({
                type: 'tabPress',
                target: ruta.key,
                canPreventDefault: true,
              });
              if (!enfocada && !evento.defaultPrevented) navigateToTab(ruta.key);
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Riel de navegación de 88 a la izquierda, en computadoras (8.1). Va en el
 * layout raíz para que siga visible en el detalle y en las demás pantallas.
 */
export function RielNavegacion() {
  const estilos = useEstilos(crear);
  const router = useRouter();
  const ruta = usePathname();
  const insets = useSafeAreaInsets();
  const hayNovedades = useHayNovedades();
  // Publicar va primero, como botón destacado.
  const destinos = [
    ...DESTINOS.filter((d) => d.ruta === RUTA_PUBLICAR),
    ...DESTINOS.filter((d) => d.ruta !== RUTA_PUBLICAR),
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[estilos.riel, { paddingTop: insets.top + Espacio.m, paddingLeft: insets.left }]}>
      {destinos.map((destino) => {
        const enfocada = ruta === destino.href;
        return (
          <ItemNavegacion
            key={destino.ruta}
            destino={destino}
            enfocada={enfocada}
            enRiel
            conPunto={destino.ruta === RUTA_ACTIVIDAD && hayNovedades}
            onPress={() => {
              if (!enfocada) router.navigate(destino.href);
            }}
          />
        );
      })}
    </View>
  );
}

type ItemProps = {
  destino: Destino;
  enfocada: boolean;
  conPunto: boolean;
  enRiel?: boolean;
  onPress: () => void;
};

function ItemNavegacion({ destino, enfocada, conPunto, enRiel = false, onPress }: ItemProps) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const esPublicar = destino.ruta === RUTA_PUBLICAR;
  const colorIcono = esPublicar ? c.textoInverso : enfocada ? c.primario : c.textoSecundario;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: enfocada }}
      accessibilityLabel={conPunto ? t.tabs.conNovedades(destino.titulo) : destino.titulo}
      onPress={onPress}
      style={(estado) => [
        enRiel ? estilos.itemRiel : estilos.item,
        enRiel && esPublicar && estilos.itemPublicarRiel,
      ]}>
      {(estado) => (
        <>
          <View
            style={[
              estilos.capsula,
              enfocada && estilos.capsulaEnfocada,
              !esPublicar && !enfocada && estaActivo(estado) && estilos.capsulaActiva,
              esPublicar && (enRiel ? estilos.publicarRiel : estilos.publicar),
              esPublicar && estaActivo(estado) && estilos.publicarActivo,
            ]}>
            <Ionicons name={destino.icono} size={esPublicar ? 22 : 20} color={colorIcono} />
            {conPunto ? <View style={estilos.punto} /> : null}
          </View>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_ESCALA_TEXTO}
            style={[estilos.etiqueta, enfocada && estilos.etiquetaEnfocada]}>
            {destino.titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  barra: {
    flexDirection: 'row',
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderTopColor: c.borde,
  },
  riel: {
    width: Medida.rielNavegacion,
    alignItems: 'center',
    gap: Espacio.s,
    backgroundColor: c.superficie,
    borderRightWidth: 1,
    borderRightColor: c.borde,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.xs,
    minHeight: Medida.areaTactil,
  },
  itemRiel: {
    width: Medida.rielNavegacion - Espacio.s * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.xs,
    paddingVertical: Espacio.s,
    borderRadius: Radio.l,
  },
  itemPublicarRiel: { marginBottom: Espacio.m },
  capsula: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
  },
  capsulaEnfocada: { backgroundColor: c.primarioSuave },
  capsulaActiva: { backgroundColor: c.superficieSuave },
  publicar: { width: 40, backgroundColor: c.inverso },
  publicarRiel: { width: 56, height: 44, backgroundColor: c.inverso },
  publicarActivo: { opacity: 0.85 },
  punto: {
    position: 'absolute',
    top: 2,
    right: 14,
    width: 13,
    height: 13,
    borderRadius: Radio.redondo,
    borderWidth: 2,
    borderColor: c.superficie,
    backgroundColor: c.primario,
  },
  etiqueta: { ...Tipografia.pestania, color: c.textoSecundario },
  etiquetaEnfocada: { ...Fuentes.negrita, color: c.primario },
}));
