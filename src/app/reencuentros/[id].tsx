import { useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

import { Cargando } from '@/components/ui/Cargando';
import { Pantalla } from '@/components/ui/Pantalla';

// En el mismo bloque aparte que el muro.
const PantallaHistoria = lazy(() =>
  import('@/components/reencuentros/Reencuentros').then((m) => ({ default: m.PantallaHistoria })),
);

/** La historia de un reencuentro: el link que se comparte (/reencuentros/<id del caso>). */
export default function PantallaHistoriaReencuentro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Suspense
      fallback={
        <Pantalla bordes={['left', 'right', 'bottom']}>
          <Cargando />
        </Pantalla>
      }>
      <PantallaHistoria id={id} />
    </Suspense>
  );
}
