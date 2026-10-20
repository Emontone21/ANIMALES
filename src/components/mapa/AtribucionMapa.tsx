import { Platform, View, type ViewStyle } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/**
 * Atribución obligatoria de OpenFreeMap, OpenMapTiles y OpenStreetMap, con los
 * colores del esquema activo. Va abajo a la izquierda en todos los mapas.
 */
export function AtribucionMapa({
  abajo = Espacio.s,
  izquierda = Espacio.s,
}: {
  abajo?: number;
  izquierda?: number;
}) {
  const estilos = useEstilos(crear);
  return (
    <View style={[estilos.caja, { bottom: abajo, left: izquierda }]}>
      <Texto variante="pequeno" style={estilos.texto} maxFontSizeMultiplier={1}>
        {t.mapa.atribucion}
      </Texto>
    </View>
  );
}

/** En web baja junto con la hoja "Cerca tuyo" al plegarse (solo existe en web). */
const TRANSICION =
  Platform.OS === 'web'
    ? ({ transitionProperty: 'bottom', transitionDuration: '220ms' } as ViewStyle)
    : null;

const crear = crearEstilos((c) => ({
  caja: {
    position: 'absolute',
    // En pantallas angostas la atribución se parte en dos líneas antes que achicarse.
    maxWidth: '70%',
    paddingHorizontal: Espacio.s,
    paddingVertical: 2,
    borderRadius: Radio.s,
    backgroundColor: c.superficie,
    pointerEvents: 'none',
    ...TRANSICION,
  },
  texto: { fontSize: 12, lineHeight: 16 },
}));
