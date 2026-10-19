import { Text, View } from 'react-native';

import { Espacio, Fuentes, MAX_ESCALA_TEXTO, Medida, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';

/** Dato del animal (especie, tamaño, color, collar) en una cápsula neutra (6.4). */
export function ChipDato({ texto }: { texto: string }) {
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.chip}>
      <Text maxFontSizeMultiplier={MAX_ESCALA_TEXTO} style={estilos.texto}>
        {texto}
      </Text>
    </View>
  );
}

const crear = crearEstilos((c) => ({
  chip: {
    justifyContent: 'center',
    minHeight: Medida.chipDato,
    paddingHorizontal: Espacio.m - 2,
    borderRadius: Radio.redondo,
    backgroundColor: c.superficieSuave,
  },
  texto: { ...Fuentes.seminegrita, fontSize: 14, lineHeight: 18, color: c.texto },
}));
