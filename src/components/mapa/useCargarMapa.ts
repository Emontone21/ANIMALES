import { useEffect, useState } from 'react';

import { precargarEstiloMapa } from '@/components/mapa/estiloBase';
import { cuandoTerminenLasPrioritarias } from '@/lib/fotosPrioritarias';
import { activarFuentesWeb } from '@/lib/fuentesWeb';

/** Sin datos (todavía o nunca), el mapa se carga igual pasado este tiempo. */
const ESPERA_SIN_DATOS_MS = 3000;
/** Si las fotos o el navegador tardan más que esto, el mapa se carga igual. */
const ESPERA_MAXIMA_MS = 5000;
/**
 * Después de que bajan las fotos: la app todavía las está dibujando (y cambia
 * las fuentes). El mapa tarda mucho más en bajar, así que no se nota.
 */
const PAUSA_TRAS_FOTOS_MS = 500;

/**
 * Solo web: cuándo empezar a cargar MapLibre (casi 1 MB), el estilo del mapa y
 * las fuentes de la app (src/lib/fuentesWeb.ts).
 * Primero se dibuja lo que la persona vino a ver: los casos de "Cerca tuyo" o
 * la foto y los datos del caso. Cuando hay datos, terminaron de bajar las fotos
 * prioritarias (src/lib/fotosPrioritarias.ts) y el navegador está desocupado,
 * llega el mapa: así no les quita ancho de banda ni procesador.
 */
export function useCargarMapa(hayDatos: boolean): boolean {
  const [cargar, setCargar] = useState(false);

  useEffect(() => {
    if (cargar) return;
    let cancelarFotos = () => {};
    let cancelarOcioso = () => {};
    const listo = () => {
      cancelarFotos();
      cancelarOcioso();
      precargarEstiloMapa();
      activarFuentesWeb();
      setCargar(true);
    };
    const cuandoEsteDesocupado = () => {
      // Que las fotos que acaban de llegar se pinten antes de arrancar el mapa.
      const pausa = window.setTimeout(() => {
        // Safari no tiene requestIdleCallback: ahí, enseguida.
        if (typeof window.requestIdleCallback === 'function') {
          const id = window.requestIdleCallback(listo, { timeout: 1000 });
          cancelarOcioso = () => window.cancelIdleCallback(id);
        } else {
          listo();
        }
      }, PAUSA_TRAS_FOTOS_MS);
      cancelarOcioso = () => window.clearTimeout(pausa);
    };
    const demora = hayDatos ? 0 : ESPERA_SIN_DATOS_MS;
    const inicio = window.setTimeout(() => {
      cancelarFotos = cuandoTerminenLasPrioritarias(cuandoEsteDesocupado);
    }, demora);
    const tope = window.setTimeout(listo, demora + ESPERA_MAXIMA_MS);
    return () => {
      window.clearTimeout(inicio);
      window.clearTimeout(tope);
      cancelarFotos();
      cancelarOcioso();
    };
  }, [hayDatos, cargar]);

  return cargar;
}
