import { Image } from 'expo-image';
import { View } from 'react-native';

import { coloresDeEstado, sombraFlotante } from '@/constants/tema';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { urlFoto } from '@/lib/imagenes';
import type { AnimalEnMapa } from '@/types/dominio';

const DIAMETRO = 58;

/**
 * Solo nativo: marcador del animal seleccionado con su foto (docs/DISENO.md,
 * 6.6). Círculo con borde interno en superficie, anillo del color del tipo y
 * una colita en rombo. En web se arma como elemento del DOM (MapaReportes.web).
 */
export function MarcadorFoto({ animal }: { animal: AnimalEnMapa }) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const anillo = coloresDeEstado(c, animal.estado, animal.tipo_reporte).anillo;

  return (
    <View style={estilos.raiz} pointerEvents="none" accessibilityElementsHidden>
      <View style={[estilos.circulo, { borderColor: anillo }]}>
        <Image
          source={{ uri: urlFoto(animal.foto_principal_path) }}
          style={estilos.foto}
          contentFit="cover"
        />
      </View>
      <View style={[estilos.colita, { backgroundColor: anillo }]} />
    </View>
  );
}

const crear = crearEstilos((c, esquema) => ({
  raiz: { alignItems: 'center' },
  circulo: {
    // Primero la sombra: su borde de 1 px (en oscuro) lo reemplaza el anillo de 3.
    ...sombraFlotante(c, esquema),
    width: DIAMETRO,
    height: DIAMETRO,
    padding: 3,
    borderWidth: 3,
    borderRadius: DIAMETRO / 2,
    backgroundColor: c.superficie,
  },
  foto: { flex: 1, borderRadius: DIAMETRO / 2, backgroundColor: c.superficieSuave },
  colita: { width: 12, height: 12, marginTop: -8, transform: [{ rotate: '45deg' }] },
}));
