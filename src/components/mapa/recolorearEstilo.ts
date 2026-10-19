import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import type { Paleta } from '@/constants/tema';

/**
 * Recoloreo del estilo base del mapa con los tokens de la paleta, por tipo de
 * capa del esquema OpenMapTiles (el que usan los estilos de OpenFreeMap).
 * Función pura: sin React ni React Native.
 */

type ColorPorCapa = (capa: LayerSpecification, c: Paleta) => string | null;

const capaFuente = (capa: LayerSpecification): string =>
  'source-layer' in capa ? (capa['source-layer'] ?? '') : '';

const PARQUE = /park|wood|grass|forest|scrub|cemetery|pitch|garden|meadow|farmland/;

/** Color de relleno de cada capa "fill" según el esquema OpenMapTiles. */
const colorRelleno: ColorPorCapa = (capa, c) => {
  const fuente = capaFuente(capa);
  if (fuente === 'water') return c.mapaAgua;
  if (fuente === 'park') return c.mapaParque;
  if ((fuente === 'landcover' || fuente === 'landuse') && PARQUE.test(capa.id)) return c.mapaParque;
  if (fuente === 'aeroway') return c.mapaCalle;
  return c.mapaTierra;
};

/** Color de cada capa "line": agua, calles, avenidas, bordes de calle, vías, límites. */
const colorLinea: ColorPorCapa = (capa, c) => {
  const fuente = capaFuente(capa);
  const id = capa.id;
  if (fuente === 'waterway') return c.mapaAgua;
  if (fuente === 'boundary') return c.puntoInactivo;
  if (fuente === 'aeroway') return c.mapaCalle;
  if (fuente === 'transportation') {
    if (/rail/.test(id)) return /dash/.test(id) ? c.mapaTierra : c.borde;
    if (/pier/.test(id)) return c.mapaTierra;
    if (/casing/.test(id)) return c.borde;
    if (/motorway|trunk|primary|major/.test(id)) return c.mapaAvenida;
    return c.mapaCalle;
  }
  return c.borde;
};

/** ¿Tiene el estilo las capas que sabemos recolorear? Si no, se usa tal cual. */
export function esEstiloConocido(estilo: StyleSpecification): boolean {
  const fuentes = new Set(estilo.layers.map(capaFuente));
  return (
    estilo.layers.some((capa) => capa.type === 'background') &&
    fuentes.has('transportation') &&
    fuentes.has('water')
  );
}

/** Copia del estilo con los colores de la paleta. Devuelve el original si no es conocido. */
export function recolorearEstilo(estilo: StyleSpecification, c: Paleta): StyleSpecification {
  if (!esEstiloConocido(estilo)) return estilo;

  const layers = estilo.layers.map((original): LayerSpecification => {
    const capa = { ...original, paint: { ...('paint' in original ? original.paint : {}) } };
    const paint = capa.paint as Record<string, unknown>;
    switch (capa.type) {
      case 'background':
        paint['background-color'] = c.mapaTierra;
        break;
      case 'fill': {
        paint['fill-color'] = colorRelleno(capa, c);
        const fuente = capaFuente(capa);
        if (fuente === 'water') paint['fill-outline-color'] = c.mapaCosta;
        else if (fuente === 'building') paint['fill-outline-color'] = c.borde;
        else delete paint['fill-outline-color'];
        break;
      }
      case 'line':
        paint['line-color'] = colorLinea(capa, c);
        break;
      case 'fill-extrusion':
        paint['fill-extrusion-color'] = c.borde;
        break;
      case 'symbol':
        if ('layout' in capa && capa.layout && 'text-field' in capa.layout) {
          paint['text-color'] = capaFuente(capa) === 'place' ? c.textoCuerpo : c.textoSecundario;
          paint['text-halo-color'] = c.mapaTierra;
          paint['text-halo-width'] = paint['text-halo-width'] ?? 1;
        }
        break;
      default:
        break;
    }
    return capa as LayerSpecification;
  });

  return { ...estilo, layers };
}
