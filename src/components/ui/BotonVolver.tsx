import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { estaActivo } from '@/components/ui/interaccion';
import { Medida, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** De lo que el Stack le pasa a headerLeft, solo importa si hay adónde volver. */
type Props = { canGoBack?: boolean };

/**
 * Volver del encabezado en web (headerLeft del Stack). El de React Navigation
 * mide unos 30 px y se anuncia en inglés con el título de la pantalla anterior
 * ("(tabs), back"). Este mide 44 × 44 y dice "Volver".
 */
export function BotonVolver({ canGoBack }: Props) {
  const router = useRouter();
  const { c } = useTema();
  const estilos = useEstilos(crear);
  if (!canGoBack) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.comunes.volver}
      onPress={() => router.back()}
      style={(estado) => [estilos.boton, estaActivo(estado) && estilos.activo]}>
      <Ionicons name="chevron-back" size={24} color={c.texto} />
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  boton: {
    width: Medida.areaTactil,
    height: Medida.areaTactil,
    borderRadius: Radio.redondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activo: { backgroundColor: c.superficieSuave },
}));
