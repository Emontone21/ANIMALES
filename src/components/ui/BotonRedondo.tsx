import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Medida, type Paleta, Radio, sombraFlotante } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';

type Props = {
  icono: ComponentProps<typeof Ionicons>['name'];
  /** Siempre requerido: el botón no tiene texto visible. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Color del ícono; por defecto, el del texto. */
  color?: keyof Paleta;
  tamanio?: number;
  cargando?: boolean;
  deshabilitado?: boolean;
  /** Estado de un botón que se activa y desactiva (Seguir). */
  seleccionado?: boolean;
  /** Sobre el mapa o la foto lleva sombra; dentro de un panel, fondo suave sin sombra. */
  flotante?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Botón redondo flotante sobre el mapa o la foto del detalle (6.5). */
export function BotonRedondo({
  icono,
  accessibilityLabel,
  onPress,
  color = 'texto',
  tamanio = Medida.botonRedondo,
  cargando = false,
  deshabilitado = false,
  seleccionado,
  flotante = true,
  style,
}: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: deshabilitado || cargando,
        busy: cargando,
        ...(seleccionado === undefined ? null : { selected: seleccionado }),
      }}
      onPress={onPress}
      disabled={deshabilitado || cargando}
      hitSlop={Math.max(0, (Medida.areaTactil - tamanio) / 2)}
      style={(estado) => [
        estilos.boton,
        flotante ? estilos.flotante : estilos.plano,
        { width: tamanio, height: tamanio },
        estaActivo(estado) && (flotante ? estilos.activo : estilos.activoPlano),
        deshabilitado && estilos.inactivo,
        style,
      ]}>
      {cargando ? (
        <ActivityIndicator color={c[color]} />
      ) : (
        <Ionicons name={icono} size={22} color={c[color]} />
      )}
    </Pressable>
  );
}

const crear = crearEstilos((c, esquema) => ({
  boton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.redondo,
  },
  flotante: { backgroundColor: c.superficie, ...sombraFlotante(c, esquema) },
  plano: { backgroundColor: c.superficieSuave },
  activo: { backgroundColor: c.superficieSuave },
  activoPlano: { backgroundColor: c.borde },
  inactivo: { opacity: 0.45 },
}));
