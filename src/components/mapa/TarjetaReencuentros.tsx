import { lazy, Suspense } from 'react';

import { ALTO_FOTO_TARJETA, ANCHO_TARJETA } from '@/components/mapa/TarjetaCaso';

// La tarjeta y su consulta van en el bloque del contador, el mismo que usa el muro.
const Tarjeta = lazy(() =>
  import('@/components/reencuentros/Contador').then((m) => ({ default: m.TarjetaReencuentros })),
);

type Props = {
  /** En el carrusel de "Cerca tuyo" (celular) o como fila del panel (tablet y computadora). */
  forma: 'carrusel' | 'fila';
  /** El alto de la foto de las tarjetas de al lado, para que quede pareja. */
  altoFoto?: number;
  /** Se pide recién cuando el mapa mostró sus casos: no compite con la carga. */
  habilitado: boolean;
};

/** La entrada al muro de reencuentros al final de "Cerca tuyo" (docs/DISENO.md, 6.7). */
export function TarjetaReencuentros({ forma, altoFoto = ALTO_FOTO_TARJETA, habilitado }: Props) {
  if (!habilitado) return null;
  return (
    <Suspense fallback={null}>
      <Tarjeta forma={forma} ancho={ANCHO_TARJETA} altoFoto={altoFoto} />
    </Suspense>
  );
}
