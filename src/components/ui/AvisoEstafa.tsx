import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** "Nunca pagues para recuperar a un animal…" (6.12). Va siempre en un caso abierto. */
export function AvisoEstafa() {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  return (
    <View style={estilos.caja} accessibilityRole="summary">
      <Ionicons name="shield-outline" size={20} color={c.textoCuerpo} />
      <Texto variante="secundario" color="textoCuerpo" style={estilos.texto}>
        {t.animal.avisoEstafa}
      </Texto>
    </View>
  );
}

const crear = crearEstilos((c) => ({
  caja: {
    flexDirection: 'row',
    gap: Espacio.sm,
    padding: Espacio.m,
    borderRadius: Radio.l,
    backgroundColor: c.avisoFondo,
  },
  texto: { flex: 1 },
}));
