import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useEffect, useMemo, useState } from 'react';

import { recolorearEstilo } from '@/components/mapa/recolorearEstilo';
import type { Esquema, Paleta } from '@/constants/tema';
import { useTema } from '@/hooks/useTema';
import { ENV } from '@/lib/env';

/**
 * Estilo base del mapa (Positron de OpenFreeMap por defecto) recoloreado con
 * los tokens de mapa del esquema activo. Se usa igual en web y en nativo.
 * Ver docs/DECISIONES.md, "Estilo del mapa: Positron recoloreado en el cliente".
 */

// --- Descarga, una vez por sesión ----------------------------------------------

const descargas = new Map<string, Promise<StyleSpecification | null>>();
const descargados = new Map<string, StyleSpecification | null>();
const recoloreados = new Map<string, StyleSpecification>();

function descargar(url: string): Promise<StyleSpecification | null> {
  let promesa = descargas.get(url);
  if (!promesa) {
    promesa = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .catch(() => null)
      .then((estilo) => {
        descargados.set(url, estilo);
        return estilo;
      });
    descargas.set(url, promesa);
  }
  return promesa;
}

function recoloreadoMemorizado(url: string, base: StyleSpecification, c: Paleta, esquema: Esquema) {
  const clave = `${esquema}|${url}`;
  let estilo = recoloreados.get(clave);
  if (!estilo) {
    estilo = recolorearEstilo(base, c);
    recoloreados.set(clave, estilo);
  }
  return estilo;
}

/**
 * Estilo listo para pasarle al mapa: el objeto recoloreado, la URL tal cual si
 * la descarga falló, o null mientras se descarga.
 */
export function useEstiloMapa(): StyleSpecification | string | null {
  const { c, esquema } = useTema();
  const url = ENV.mapStyleUrl;
  const [base, setBase] = useState<StyleSpecification | null | undefined>(() =>
    descargados.has(url) ? descargados.get(url) : undefined,
  );

  useEffect(() => {
    if (base !== undefined) return;
    let vigente = true;
    void descargar(url).then((estilo) => {
      if (vigente) setBase(estilo);
    });
    return () => {
      vigente = false;
    };
  }, [base, url]);

  return useMemo(() => {
    if (base === undefined) return null;
    if (base === null) return url;
    return recoloreadoMemorizado(url, base, c, esquema);
  }, [base, c, esquema, url]);
}
