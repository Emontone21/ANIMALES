import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, Text, type ViewStyle } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Espacio, Medida, type Paleta, Radio, Tipografia } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

export type VarianteBoton =
  'primario' | 'secundario' | 'suave' | 'fantasma' | 'peligro' | 'inverso';

export type BotonProps = {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  icono?: ComponentProps<typeof Ionicons>['name'];
  cargando?: boolean;
  deshabilitado?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const COLOR_TEXTO: Record<VarianteBoton, keyof Paleta> = {
  primario: 'textoSobrePrimario',
  secundario: 'texto',
  suave: 'primario',
  fantasma: 'primario',
  peligro: 'peligro',
  inverso: 'textoInverso',
};

/** Botón de 54 de alto y bordes redondos (docs/DISENO.md, 6.1). */
export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  cargando = false,
  deshabilitado = false,
  accessibilityLabel,
  style,
}: BotonProps) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const inactivo = deshabilitado || cargando;
  const colorTexto = c[COLOR_TEXTO[variante]];

  return (
    <Pressable
      accessibilityRole="button"
      // Mientras carga, el indicador reemplaza al texto: el nombre se mantiene.
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: inactivo }}
      // react-native-web no traduce accessibilityState.busy; aria-busy anda en web y nativo.
      aria-busy={cargando}
      onPress={onPress}
      disabled={inactivo}
      style={(estado) => [
        estilos.base,
        estilos[variante],
        !inactivo && estaActivo(estado) && estilos[`${variante}Activo`],
        inactivo && estilos.inactivo,
        style,
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          {icono ? <Ionicons name={icono} size={20} color={colorTexto} /> : null}
          <Text style={[estilos.texto, { color: colorTexto }]} numberOfLines={1}>
            {titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.s,
    minHeight: Medida.boton,
    paddingHorizontal: Espacio.l,
    borderRadius: Radio.redondo,
  },
  primario: { backgroundColor: c.primario },
  primarioActivo: { backgroundColor: c.primarioPresionado },
  secundario: { borderWidth: 1.5, borderColor: c.texto },
  secundarioActivo: { backgroundColor: c.superficieSuave },
  suave: { backgroundColor: c.superficie },
  suaveActivo: { backgroundColor: c.superficieSuave },
  fantasma: {},
  fantasmaActivo: { backgroundColor: c.superficieSuave },
  peligro: {},
  peligroActivo: { backgroundColor: c.superficieSuave },
  inverso: { backgroundColor: c.inverso },
  inversoActivo: { opacity: 0.85 },
  inactivo: { opacity: 0.45 },
  texto: { ...Tipografia.boton, flexShrink: 1 },
}));
