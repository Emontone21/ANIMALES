import { Text, View } from 'react-native';

import {
  coloresDeEstado,
  Espacio,
  MAX_ESCALA_TEXTO,
  type Paleta,
  Radio,
  type TipoReporte,
  Tipografia,
} from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import type { EstadoAnimal } from '@/types/dominio';

type Props = {
  texto: string;
  /** Fondo y texto de la paleta. */
  fondo: keyof Paleta;
  color: keyof Paleta;
};

/** Cápsula de 26 a 28 de alto con fondo suave y texto oscuro del mismo tono (6.3). */
export function Etiqueta({ texto, fondo, color }: Props) {
  const { c } = useTema();
  return <EtiquetaBase texto={texto} fondo={c[fondo]} color={c[color]} />;
}

/** Estado del caso con los colores de la tabla 2.3 de docs/DISENO.md. */
export function EtiquetaEstado({
  estado,
  tipo = 'encontrado',
}: {
  estado: EstadoAnimal;
  tipo?: TipoReporte;
}) {
  const { c } = useTema();
  const colores = coloresDeEstado(c, estado, tipo);
  return <EtiquetaBase texto={t.estado[estado]} fondo={colores.fondo} color={colores.texto} />;
}

function EtiquetaBase({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  const estilos = useEstilos(crear);
  return (
    <View style={[estilos.etiqueta, { backgroundColor: fondo }]}>
      <Text maxFontSizeMultiplier={MAX_ESCALA_TEXTO} style={[estilos.texto, { color }]}>
        {texto}
      </Text>
    </View>
  );
}

const crear = crearEstilos(() => ({
  etiqueta: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 27,
    paddingHorizontal: Espacio.sm - 1,
    borderRadius: Radio.redondo,
  },
  texto: Tipografia.etiqueta,
}));
