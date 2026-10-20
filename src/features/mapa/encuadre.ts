import type { ColeccionRecorridoGrande, MargenesMapa } from '@/components/mapa/tipos';
import { MONTEVIDEO, ZOOM_CIUDAD, ZOOM_PUNTO } from '@/lib/ubicacion';
import type { LngLat } from '@/types/dominio';

/**
 * Geometría del mapa en grande del recorrido (docs/DISENO.md, 6.9.1): la vista
 * inicial y cuántos píxeles mide la zona de un punto aproximado. Solo la usan
 * los mapas (MapaRecorridoGrande y su versión web), que en web van en el
 * bloque de MapLibre.
 */

/** La vista inicial no se acerca más que esto, aunque los puntos estén pegados. */
export const ZOOM_MAXIMO_ENCUADRE = 17;

/**
 * Radio de la zona de un punto aproximado. La base redondea a 3 decimales: el
 * lugar real queda a menos de 56 m de latitud y 46 m de longitud (en
 * Montevideo) del punto guardado, unos 72 m en diagonal. 110 m lo cubren con
 * holgura y se leen como "unos 100 m a la redonda".
 */
export const RADIO_APROXIMADO_M = 110;

/** De lejos la zona no se achica más que esto, para que se siga viendo y tocando. */
export const RADIO_MINIMO_ZONA_PX = 16;

/** Espacio libre entre los puntos y el borde de lo que se ve. */
export const MARGEN_ENCUADRE_PX = 40;

/** Ancho del mundo en zoom 0, en píxeles (MapLibre, web y nativo). */
const MUNDO_PX = 512;
/** Circunferencia del ecuador en metros (WGS 84). */
const ECUADOR_M = 40_075_016.686;
/** Zoom más alto de MapLibre: la última parada del radio de la zona. */
const ZOOM_TOPE = 24;

/** Sin puntos (no debería pasar: todo caso tiene al menos uno), la ciudad. */
export const ZOOM_SIN_ENCUADRE = ZOOM_CIUDAD;

export type Encuadre = { centro: LngLat; zoom: number };

export type PuntoEncuadre = { lngLat: LngLat; aproximado: boolean };

export type Vista = { ancho: number; alto: number; margenes: MargenesMapa };

/** Los puntos del GeoJSON del recorrido, para la vista inicial. */
export function puntosParaEncuadrar(datos: ColeccionRecorridoGrande): PuntoEncuadre[] {
  return datos.features.flatMap((feature) =>
    feature.geometry.type === 'Point'
      ? [
          {
            lngLat: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as LngLat,
            aproximado: feature.properties.aproximado === true,
          },
        ]
      : [],
  );
}

/** La latitud del recorrido: da cuántos píxeles mide la zona de un aproximado. */
export function latitudDelRecorrido(datos: ColeccionRecorridoGrande): number {
  return puntosParaEncuadrar(datos)[0]?.lngLat[1] ?? MONTEVIDEO[1];
}

const rad = (grados: number) => (grados * Math.PI) / 180;

/** Web Mercator, de 0 a 1 en los dos ejes. */
function aMercator([lng, lat]: LngLat): [number, number] {
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) / Math.PI) / 2;
  return [(lng + 180) / 360, y];
}

function desdeMercator([x, y]: [number, number]): LngLat {
  const lat = (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * y))) - Math.PI / 2) * (180 / Math.PI);
  return [x * 360 - 180, lat];
}

/** Metros que mide un píxel a esa latitud y ese zoom. */
export function metrosPorPixel(latitud: number, zoom: number): number {
  return (ECUADOR_M * Math.cos(rad(latitud))) / (MUNDO_PX * 2 ** zoom);
}

/**
 * Vista inicial: todos los puntos en lo que se ve (descontados los márgenes de
 * lo que tapa y un margen más), sin pasar de ZOOM_MAXIMO_ENCUADRE. Las zonas
 * de los aproximados entran enteras. Un solo lugar se centra con ZOOM_PUNTO.
 * El centro queda en el medio de lo que se ve si el mapa usa `margenes` como
 * padding.
 */
export function encuadrar(puntos: PuntoEncuadre[], vista: Vista): Encuadre | null {
  const primero = puntos[0];
  if (!primero) return null;
  const lugares = new Set(puntos.map(({ lngLat }) => lngLat.join(',')));
  if (lugares.size === 1) return { centro: primero.lngLat, zoom: ZOOM_PUNTO };

  let oeste = Infinity;
  let este = -Infinity;
  let norte = Infinity;
  let sur = -Infinity;
  for (const { lngLat, aproximado } of puntos) {
    const [x, y] = aMercator(lngLat);
    // En Mercator un metro mide lo mismo en los dos ejes (a esa latitud).
    const radio = aproximado ? RADIO_APROXIMADO_M / (ECUADOR_M * Math.cos(rad(lngLat[1]))) : 0;
    oeste = Math.min(oeste, x - radio);
    este = Math.max(este, x + radio);
    norte = Math.min(norte, y - radio);
    sur = Math.max(sur, y + radio);
  }

  const { ancho, alto, margenes } = vista;
  const libreX = Math.max(1, ancho - margenes.left - margenes.right - 2 * MARGEN_ENCUADRE_PX);
  const libreY = Math.max(1, alto - margenes.top - margenes.bottom - 2 * MARGEN_ENCUADRE_PX);
  const zoomX = este > oeste ? Math.log2(libreX / (MUNDO_PX * (este - oeste))) : Infinity;
  const zoomY = sur > norte ? Math.log2(libreY / (MUNDO_PX * (sur - norte))) : Infinity;
  const zoom = Math.max(0, Math.min(zoomX, zoomY, ZOOM_MAXIMO_ENCUADRE));

  return { centro: desdeMercator([(oeste + este) / 2, (norte + sur) / 2]), zoom };
}

/**
 * Paradas [zoom, radio en px] de la zona de un aproximado: mide
 * RADIO_APROXIMADO_M a esa latitud y, de lejos, nunca menos de
 * RADIO_MINIMO_ZONA_PX. Entre parada y parada MapLibre interpola en base 2,
 * que es como crece la escala, así que el radio es exacto en cada zoom.
 */
export function paradasRadioZona(latitud: number): [number, number][] {
  const radioZoom0 = RADIO_APROXIMADO_M / metrosPorPixel(latitud, 0);
  const radioTope = radioZoom0 * 2 ** ZOOM_TOPE;
  const zoomMinimo = Math.log2(RADIO_MINIMO_ZONA_PX / radioZoom0);
  if (zoomMinimo <= 0)
    return [
      [0, radioZoom0],
      [ZOOM_TOPE, radioTope],
    ];
  return [
    [0, RADIO_MINIMO_ZONA_PX],
    [zoomMinimo, RADIO_MINIMO_ZONA_PX],
    [ZOOM_TOPE, radioTope],
  ];
}
