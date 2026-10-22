import { lazy, Suspense } from 'react';

import { Cargando } from '@/components/ui/Cargando';
import { Pantalla } from '@/components/ui/Pantalla';

// El muro va en un bloque aparte (el mismo de /reencuentros/<id> y del detalle de un caso reunido).
const MuroReencuentros = lazy(() =>
  import('@/components/reencuentros/Reencuentros').then((m) => ({ default: m.MuroReencuentros })),
);

/** El muro de reencuentros: público y sin cuenta (docs/DISENO.md, 6.19). */
export default function PantallaReencuentros() {
  return (
    <Suspense
      fallback={
        <Pantalla bordes={['left', 'right', 'bottom']}>
          <Cargando />
        </Pantalla>
      }>
      <MuroReencuentros />
    </Suspense>
  );
}
