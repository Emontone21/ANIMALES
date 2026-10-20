import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';

import { useFotoPrioritaria } from '@/hooks/useFotoPrioritaria';
import { urlFoto, urlMiniatura } from '@/lib/imagenes';

type Props = Omit<ImageProps, 'source' | 'accessibilityLabel' | 'alt'> & {
  /** Ruta de la foto original en el bucket (o URL https de los datos de demo). */
  ruta: string;
  /** Texto alternativo: el nombre o la especie del caso (t.animal.tituloCaso). */
  descripcion: string;
  /**
   * Las que se ven apenas abre la pantalla (las primeras de "Cerca tuyo"): se
   * piden enseguida y con prioridad alta. El resto, cuando se acercan a la vista.
   */
  prioritaria?: boolean;
};

/**
 * Una foto en tamaño chico (tarjetas, listas, avatares, marcadores): carga la
 * miniatura de 320 y, si no existe (fotos de antes de la Fase 8), la original.
 */
export function FotoMiniatura({
  ruta,
  descripcion,
  prioritaria = false,
  onLoad,
  onError,
  ...props
}: Props) {
  // La ruta cuya miniatura no cargó: si cambia la ruta, se vuelve a probar.
  const [sinMiniatura, setSinMiniatura] = useState<string | null>(null);
  const original = sinMiniatura === ruta;
  const cargada = useFotoPrioritaria(prioritaria, ruta);

  return (
    <Image
      {...props}
      {...(prioritaria ? { priority: 'high', loading: 'eager' } : null)}
      accessibilityLabel={descripcion}
      source={{ uri: original ? urlFoto(ruta) : urlMiniatura(ruta) }}
      onLoad={(evento) => {
        cargada();
        onLoad?.(evento);
      }}
      onError={(evento) => {
        // Sin miniatura se prueba la original: recién si esa falla, terminó.
        if (!original) setSinMiniatura(ruta);
        else cargada();
        onError?.(evento);
      }}
    />
  );
}
