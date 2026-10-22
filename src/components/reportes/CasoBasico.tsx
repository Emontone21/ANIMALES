import { Image } from 'expo-image';
import { lazy, Suspense } from 'react';
import { View } from 'react-native';

import { BotonRedondo } from '@/components/ui/BotonRedondo';
import { Mensaje } from '@/components/ui/Mensaje';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Radio } from '@/constants/tema';
import { tituloBasico } from '@/features/reportes/permisos';
import { useFotoPrioritaria } from '@/hooks/useFotoPrioritaria';
import { crearEstilos, useEstilos } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { urlFoto } from '@/lib/imagenes';
import type { AnimalDetalle } from '@/types/dominio';

// El link a la historia: el mismo bloque aparte que el muro de reencuentros.
const HistoriaEnElCaso = lazy(() =>
  import('@/components/reencuentros/Reencuentros').then((m) => ({ default: m.HistoriaEnElCaso })),
);

/**
 * Lo básico de un caso reunido, para quien no participó (docs/DISENO.md,
 * 7.2.1): la foto, el nombre si la familia lo mostró (o la especie), "Volvió a
 * casa" y el link a su historia, si hay. Sin mapa, zona, avisos, historial,
 * coincidencias ni contactos: la base tampoco los manda (0027).
 */
export function CasoBasico({
  animal: a,
  onVolver,
}: {
  animal: AnimalDetalle;
  onVolver: () => void;
}) {
  const estilos = useEstilos(crear);
  const titulo = tituloBasico(a);
  const fotoCargada = useFotoPrioritaria(true, a.foto_principal_path);

  return (
    <Pantalla scroll ancho={AnchoMaximo.detalle}>
      <BotonRedondo
        icono="chevron-back"
        accessibilityLabel={t.comunes.volver}
        onPress={onVolver}
        flotante={false}
      />
      {/* La foto nunca se oscurece ni se filtra, tampoco en modo oscuro. */}
      <Image
        source={{ uri: urlFoto(a.foto_principal_path) }}
        style={estilos.foto}
        contentFit="cover"
        priority="high"
        loading="eager"
        onLoad={fotoCargada}
        onError={fotoCargada}
        accessible
        accessibilityLabel={titulo}
        accessibilityIgnoresInvertColors
      />
      <View style={estilos.cabecera}>
        <Texto variante="display" accessibilityRole="header">
          {titulo}
        </Texto>
        <Mensaje texto={t.animal.reservado.volvio} tipo="exito" />
      </View>
      <Texto variante="secundario">{t.animal.reservado.aviso}</Texto>
      <Suspense fallback={null}>
        <HistoriaEnElCaso animal={a} soloEnlace />
      </Suspense>
    </Pantalla>
  );
}

const crear = crearEstilos((c) => ({
  // Como la foto de cabecera del detalle: en computadora no tapa el resto.
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 380,
    borderRadius: Radio.hoja,
    backgroundColor: c.superficieSuave,
  },
  cabecera: { gap: Espacio.sm },
}));
