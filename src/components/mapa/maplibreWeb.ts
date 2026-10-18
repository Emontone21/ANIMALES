import { setWorkerUrl } from 'maplibre-gl';

/**
 * Solo web. MapLibre GL JS carga su worker como módulo aparte; Metro y el
 * export estático no lo sirven desde node_modules, así que se publica una
 * copia en public/ (ver scripts/copiar-worker-maplibre.js).
 */
export const URL_WORKER_MAPLIBRE = '/maplibre-gl-worker.mjs';

let configurado = false;

export function configurarMapLibreWeb(): void {
  if (configurado) return;
  setWorkerUrl(URL_WORKER_MAPLIBRE);
  configurado = true;
}
