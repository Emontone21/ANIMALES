/**
 * Solo web: los tres mapas con MapLibre GL JS, en un único bloque que se carga
 * aparte (import dinámico desde MapaReportes, MapaRecorrido y MapaSelector .web).
 * Tienen que salir de un solo módulo: si cada uno se importara por separado,
 * Metro pondría MapLibre, que comparten, en el bloque común de la carga inicial.
 */
import { configurarMapLibreWeb } from '@/components/mapa/maplibreWeb';

export { MapaRecorridoGL } from '@/components/mapa/MapaRecorridoGL';
export { MapaReportesGL } from '@/components/mapa/MapaReportesGL';
export { MapaSelectorGL } from '@/components/mapa/MapaSelectorGL';

// Los estilos y el worker se piden apenas llega el bloque, antes de crear el mapa.
configurarMapLibreWeb();
