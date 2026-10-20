import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { FotoMiniatura } from '@/components/ui/FotoMiniatura';
import { Fuentes, MAX_ESCALA_TEXTO, Radio } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';

type Props = {
  nombre: string | null;
  /** Ruta de la foto en el bucket, o una URI local mientras se elige. */
  fotoPath?: string | null;
  fotoUri?: string | null;
  tamanio?: number;
};

/**
 * Avatar circular en primarioSuave (7.6): la foto de perfil si hay, si no la
 * inicial del nombre en Fredoka, y sin nombre el ícono de persona.
 */
export function Avatar({ nombre, fotoPath, fotoUri, tamanio = 56 }: Props) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const inicial = nombre?.trim().charAt(0).toUpperCase() ?? '';
  const medida = { width: tamanio, height: tamanio };
  const comunes = {
    style: [estilos.circulo, medida],
    contentFit: 'cover' as const,
    accessible: true,
    accessibilityIgnoresInvertColors: true,
  };
  // Sin nombre, la foto es decorativa (alt vacío).
  const descripcion = nombre ? t.perfil.fotoDe(nombre) : '';

  // La foto recién elegida (local) se ve tal cual; la guardada, en miniatura.
  if (fotoUri)
    return <Image source={{ uri: fotoUri }} accessibilityLabel={descripcion} {...comunes} />;
  if (fotoPath) return <FotoMiniatura ruta={fotoPath} descripcion={descripcion} {...comunes} />;
  return (
    <View style={[estilos.circulo, medida]}>
      {inicial ? (
        <Text
          style={[estilos.inicial, { fontSize: tamanio * 0.46, lineHeight: tamanio * 0.54 }]}
          maxFontSizeMultiplier={MAX_ESCALA_TEXTO}>
          {inicial}
        </Text>
      ) : (
        <Ionicons name="person-outline" size={tamanio * 0.46} color={c.textoPrimarioSuave} />
      )}
    </View>
  );
}

const crear = crearEstilos((c) => ({
  circulo: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: Radio.redondo,
    backgroundColor: c.primarioSuave,
  },
  inicial: { ...Fuentes.titulo, color: c.textoPrimarioSuave },
}));
