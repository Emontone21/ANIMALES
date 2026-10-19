import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';

import { urlFoto, urlMiniatura } from '@/lib/imagenes';

type Props = Omit<ImageProps, 'source'> & {
  /** Ruta de la foto original en el bucket (o URL https de los datos de demo). */
  ruta: string;
};

/**
 * Una foto en tamaño chico (tarjetas, listas, avatares, marcadores): carga la
 * miniatura de 320 y, si no existe (fotos de antes de la Fase 8), la original.
 */
export function FotoMiniatura({ ruta, onError, ...props }: Props) {
  // La ruta cuya miniatura no cargó: si cambia la ruta, se vuelve a probar.
  const [sinMiniatura, setSinMiniatura] = useState<string | null>(null);
  const original = sinMiniatura === ruta;

  return (
    <Image
      {...props}
      source={{ uri: original ? urlFoto(ruta) : urlMiniatura(ruta) }}
      onError={(evento) => {
        if (!original) setSinMiniatura(ruta);
        onError?.(evento);
      }}
    />
  );
}
