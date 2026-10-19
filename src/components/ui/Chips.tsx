import { Pressable, Text, View } from 'react-native';

import { DesplazableHorizontal } from '@/components/ui/DesplazableHorizontal';
import { estaActivo } from '@/components/ui/interaccion';
import {
  Espacio,
  Fuentes,
  MAX_ESCALA_TEXTO,
  Medida,
  Radio,
  sombraFlotante,
  type TipoReporte,
} from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

export type OpcionChip<T extends string> = {
  valor: T;
  etiqueta: string;
  /** Punto de color a la izquierda para los chips de perdidos o encontrados. */
  punto?: TipoReporte;
};

export type ChipsProps<T extends string> = {
  opciones: OpcionChip<T>[];
  valor: T | null;
  onCambio: (valor: T) => void;
  /** Fila con desplazamiento lateral (barras de filtros). */
  scroll?: boolean;
  /** Sobre el mapa: fondo de superficie con sombra. */
  flotante?: boolean;
  /** Relleno lateral de la fila con scroll, para alinear con el margen de la pantalla. */
  margen?: number;
  accessibilityLabel?: string;
};

/** Selector de una opción entre varias, con forma de chips (docs/DISENO.md, 6.2). */
export function Chips<T extends string>({
  opciones,
  valor,
  onCambio,
  scroll = false,
  flotante = false,
  margen = 0,
  accessibilityLabel,
}: ChipsProps<T>) {
  const estilos = useEstilos(crear);

  const contenido = opciones.map((opcion) => {
    const activo = opcion.valor === valor;
    return (
      <Pressable
        key={opcion.valor}
        accessibilityRole="radio"
        accessibilityState={{ selected: activo, checked: activo }}
        onPress={() => onCambio(opcion.valor)}
        style={(estado) => [
          estilos.chip,
          flotante ? estilos.flotante : estilos.normal,
          !activo && estaActivo(estado) && estilos.chipActivo,
          activo && estilos.seleccionado,
        ]}>
        {opcion.punto ? (
          <View
            style={[
              estilos.punto,
              opcion.punto === 'perdido' ? estilos.perdido : estilos.encontrado,
            ]}
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={MAX_ESCALA_TEXTO}
          style={[estilos.texto, activo && estilos.textoSeleccionado]}>
          {opcion.etiqueta}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <DesplazableHorizontal
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={[estilos.fila, { paddingHorizontal: margen }]}
        // La sombra de los chips flotantes no se corta contra el borde.
        style={flotante ? estilos.filaFlotante : undefined}>
        {contenido}
      </DesplazableHorizontal>
    );
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={estilos.filaEnvuelta}>
      {contenido}
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  fila: { flexDirection: 'row', gap: Espacio.s, alignItems: 'center' },
  filaFlotante: { overflow: 'visible', flexGrow: 0 },
  filaEnvuelta: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.s,
    minHeight: Medida.chip,
    paddingHorizontal: Espacio.m + 1,
    borderRadius: Radio.redondo,
  },
  normal: { backgroundColor: c.superficieSuave },
  flotante: { backgroundColor: c.superficie, ...sombraFlotante(c, esquema) },
  chipActivo: { backgroundColor: c.borde },
  seleccionado: { backgroundColor: c.inverso, borderColor: c.inverso },
  punto: { width: 10, height: 10, borderRadius: 5 },
  perdido: { backgroundColor: c.perdido },
  encontrado: { backgroundColor: c.primario },
  texto: { ...Fuentes.seminegrita, fontSize: 15, lineHeight: 20, color: c.texto },
  textoSeleccionado: { color: c.textoInverso },
}));
