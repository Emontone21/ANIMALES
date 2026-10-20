import { setWorkerUrl } from 'maplibre-gl';

/**
 * Solo web. MapLibre GL JS carga su worker como módulo aparte; Metro y el
 * export estático no lo sirven desde node_modules, así que se publica una
 * copia en public/ (ver scripts/copiar-a-public.js). Sus estilos
 * también: si se importaran, Expo los pondría en el <head> de la carga inicial.
 */
export const URL_WORKER_MAPLIBRE = '/maplibre-gl-worker.mjs';
export const URL_ESTILOS_MAPLIBRE = '/maplibre-gl.css';

let configurado = false;

/** Worker y estilos de MapLibre. Lo llama el bloque del mapa al cargarse. */
export function configurarMapLibreWeb(): void {
  if (configurado) return;
  setWorkerUrl(URL_WORKER_MAPLIBRE);
  if (!document.querySelector(`link[href="${URL_ESTILOS_MAPLIBRE}"]`)) {
    const estilos = document.createElement('link');
    estilos.rel = 'stylesheet';
    estilos.href = URL_ESTILOS_MAPLIBRE;
    document.head.appendChild(estilos);
  }
  configurado = true;
}
