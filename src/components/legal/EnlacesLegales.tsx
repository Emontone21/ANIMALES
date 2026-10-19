import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Boton } from '@/components/ui/Boton';
import { Espacio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type Props = {
  /** Dentro de un modal hay que cerrarlo antes de navegar, o la pantalla queda debajo. */
  onAntesDeNavegar?: () => void;
};

/** Botones para leer los términos de uso y la política de privacidad. */
export function EnlacesLegales({ onAntesDeNavegar }: Props) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const ir = (ruta: '/legal/terminos' | '/legal/privacidad') => {
    onAntesDeNavegar?.();
    router.push(ruta);
  };
  return (
    <View style={estilos.fila}>
      <Boton
        titulo={t.legal.leerTerminos}
        icono="document-text-outline"
        variante="fantasma"
        onPress={() => ir('/legal/terminos')}
        style={estilos.boton}
      />
      <Boton
        titulo={t.legal.leerPrivacidad}
        icono="shield-checkmark-outline"
        variante="fantasma"
        onPress={() => ir('/legal/privacidad')}
        style={estilos.boton}
      />
    </View>
  );
}

const crear = crearEstilos(() => ({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.xs },
  boton: { paddingHorizontal: Espacio.sm, flexGrow: 1 },
}));
