import { Linking, Platform, type TextProps, View, type ViewStyle } from 'react-native';

import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

/** Lo que piden las guías de atribución de OpenStreetMap: un link a sus derechos. */
const URL_OSM = 'https://www.openstreetmap.org/copyright';

/**
 * En web, un <a> de verdad (react-native-web lo arma con href), que se abre
 * en otra pestaña; en nativo, el navegador del sistema.
 */
const ENLACE_OSM: TextProps =
  Platform.OS === 'web'
    ? ({
        href: URL_OSM,
        hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' },
      } as TextProps)
    : { onPress: () => void Linking.openURL(URL_OSM) };

/**
 * Atribución obligatoria de OpenFreeMap, OpenMapTiles y OpenStreetMap, con los
 * colores del esquema activo. Va abajo a la izquierda en todos los mapas. Solo
 * el link recibe toques: el resto deja pasar los gestos al mapa. Un mapa chico
 * que es todo un botón ("Ver el mapa en grande") la lleva sin link: un link
 * adentro de un botón no se puede usar con teclado ni con lector de pantalla.
 */
export function AtribucionMapa({
  abajo = Espacio.s,
  izquierda = Espacio.s,
  enlace = true,
}: {
  abajo?: number;
  izquierda?: number;
  enlace?: boolean;
}) {
  const estilos = useEstilos(crear);
  return (
    <View style={[estilos.caja, { bottom: abajo, left: izquierda }]}>
      <Texto
        variante="pequeno"
        style={[estilos.texto, estilos.sinToques]}
        maxFontSizeMultiplier={1}>
        {t.mapa.atribucion}
        {enlace ? (
          <Texto
            variante="pequeno"
            style={[estilos.texto, estilos.enlace]}
            maxFontSizeMultiplier={1}
            accessibilityRole="link"
            {...ENLACE_OSM}>
            {t.mapa.atribucionOsm}
          </Texto>
        ) : (
          t.mapa.atribucionOsm
        )}
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
    pointerEvents: 'box-none',
    ...TRANSICION,
  },
  texto: { fontSize: 12, lineHeight: 16 },
  sinToques: { pointerEvents: 'none' },
  enlace: { pointerEvents: 'auto', textDecorationLine: 'underline' },
}));
